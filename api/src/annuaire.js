// api/src/annuaire.js — le verrou serveur du portail.
// 1. verifierJeton : valide le jeton External ID (osmoserh) reçu du navigateur
//    et en extrait l'email — c'est la SEULE identité à laquelle on se fie.
// 2. resoudreClient : email vérifié → ligne « Utilisateurs portail » → ligne
//    « Paramètres clients » (site RH, lues via Graph avec l'app Sites.Selected).
// Le payload envoyé par le navigateur (email, client) n'est jamais cru.
//
// Variables d'environnement (Static Web App) :
//   AUTH_TENANT_ID / AUTH_CLIENT_ID          — tenant External ID + app SPA (audience)
//   GRAPH_TENANT_ID / GRAPH_CLIENT_ID /
//   GRAPH_CLIENT_SECRET / RH_SITE_ID         — lecture des listes du site RH

const { createRemoteJWKSet, jwtVerify } = require("jose");

const AUTH_TENANT = process.env.AUTH_TENANT_ID;
const AUTH_CLIENT = process.env.AUTH_CLIENT_ID;

let jwks; // mis en cache entre les invocations (instance chaude)
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(
    new URL(`https://${AUTH_TENANT}.ciamlogin.com/${AUTH_TENANT}/discovery/v2.0/keys`)
  );
  return jwks;
}

/** Valide le jeton et renvoie { email } ou lève { status, erreur }.
    Le jeton est lu en priorité dans « x-osmose-jeton » : Static Web Apps
    écrase l'en-tête Authorization avant les fonctions managées, un en-tête
    personnalisé passe intact. Authorization reste en repli (dev local). */
async function verifierJeton(request) {
  const perso = request.headers.get("x-osmose-jeton") || "";
  const entete = request.headers.get("authorization") || "";
  const brut = perso || (entete.startsWith("Bearer ") ? entete.slice(7) : null);
  if (!brut) throw { status: 401, erreur: "Connexion requise." };

  let charge;
  try {
    ({ payload: charge } = await jwtVerify(brut, getJwks(), {
      issuer: `https://${AUTH_TENANT}.ciamlogin.com/${AUTH_TENANT}/v2.0`,
      audience: [AUTH_CLIENT, `api://${AUTH_CLIENT}`],
    }));
  } catch {
    throw { status: 401, erreur: "Session invalide ou expirée — reconnectez-vous." };
  }
  const email = (charge.email || charge.preferred_username || charge.upn || "").toLowerCase();
  if (!email.includes("@")) throw { status: 401, erreur: "Jeton sans email exploitable." };
  return { email };
}

/* ---------------- Graph : lecture des listes du site RH ---------------- */

let graphTok = { valeur: null, expire: 0 };
async function tokenGraph() {
  if (graphTok.valeur && Date.now() < graphTok.expire - 60000) return graphTok.valeur;
  const r = await fetch(`https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID,
      client_secret: process.env.GRAPH_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!r.ok) throw { status: 502, erreur: "Annuaire clients injoignable (jeton)." };
  const j = await r.json();
  graphTok = { valeur: j.access_token, expire: Date.now() + j.expires_in * 1000 };
  return graphTok.valeur;
}

/* $select UNIQUE de la liste « Salariés » — le cache items() est indexé
   par liste (pas par champs) : tous les lecteurs (personnel, admin,
   échéances, étrangers) partagent CE select pour ne jamais s'appauvrir
   mutuellement pendant les 60 s de cache. Toute nouvelle colonne
   s'ajoute ICI (et dans creer_site_rh.py). */
const SELECT_SALARIES = "CodeClient,Matricule,Nom,Prenom,Poste,TypeContrat,DateEntree,DateSortie,Statut,Email,Telephone,AdressePostale,NumeroSS,DateNaissance,Sexe,NomNaissance,NomMarital,SituationFamiliale,DepartementNaissance,CodeDepartementNaissance,PaysNaissance,CodePaysNaissance,Iban,Bic,BulletinDematerialise,Nationalite,TitreSejourType,TitreSejourNumero,TitreSejourExpiration,AlerteTitreSejour,TitreSejourPj,RecepisseNumero,RecepisseFin,RecepissePj,DroitTravail,AutorisationTravail,FinPeriodeEssai,AlertePeriodeEssai,PeriodiciteVisiteMois,DerniereVisiteMedicale,AlerteVisiteMedicale,DernierEntretienPro,AlerteEntretienPro,DureeMensuelle";

let listeIds; // { "Utilisateurs portail": id, "Paramètres clients": id }
async function idsListes(tok) {
  if (listeIds) return listeIds;
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists?$select=id,displayName`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw { status: 502, erreur: "Annuaire clients injoignable (listes)." };
  const j = await r.json();
  listeIds = Object.fromEntries(j.value.map((l) => [l.displayName, l.id]));
  return listeIds;
}

/** Date « AAAA-MM-JJ » VUE DE PARIS pour une valeur datetime SharePoint.
    Piège : les colonnes « date seule » sont stockées à minuit heure de Paris,
    soit 22:00Z (ou 23:00Z l'hiver) LA VEILLE — tronquer l'ISO UTC recule
    donc d'un jour. fr-CA donne directement le format AAAA-MM-JJ. */
function dateParis(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

// Les deux listes restent petites : on les lit en entier (pagination suivie)
// et on filtre en code — aucun besoin de colonnes indexées. Cache 60 s.
const cacheItems = new Map();

/** Vide le cache de lecture des listes — à appeler après toute écriture
    d'administration (activation d'un compte) pour que l'effet soit
    immédiat au rechargement, sans attendre l'expiration des 60 s. */
function viderCacheItems() { cacheItems.clear(); }
async function items(tok, listeId, champs) {
  const enCache = cacheItems.get(listeId);
  if (enCache && Date.now() < enCache.expire) return enCache.valeur;
  let url = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$expand=fields($select=${champs})&$top=200`;
  const tout = [];
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw { status: 502, erreur: "Annuaire clients injoignable (lecture)." };
    const j = await r.json();
    // L'id d'élément accompagne les champs : nécessaire aux mises à jour
    // (fiche salarié). Posé après le spread : il gagne en cas de collision.
    tout.push(...j.value.map((i) => ({ ...i.fields, id: i.id })));
    url = j["@odata.nextLink"] || null;
  }
  cacheItems.set(listeId, { valeur: tout, expire: Date.now() + 60000 });
  return tout;
}

/* $select UNIQUE de « Paramètres clients » — SOURCE UNIQUE, comme
   SELECT_SALARIES. Le cache items() est indexé par LISTE, pas par
   champs : un lecteur au $select étroit qui remplit le cache le premier
   appauvrit tous les suivants pendant 60 s (constaté le 23/08 : quatre
   lecteurs divergents, dont admin.donnees sans Options — un client se
   connectant dans la minute suivant une consultation gestionnaire
   voyait toutes ses tuiles grisées, puis « ça se réparait tout seul »).
   Toute nouvelle colonne lue s'ajoute ICI (et dans creer_site_rh.py). */
const SELECT_CLIENTS = "CodeClient,RaisonSociale,AdresseEntreprise,Siret,Representant,FonctionRepresentant,LieuEdition,EmailGestionnaire,Actif,Options,CodeUrssaf,CodeApe,VilleEntreprise,CodePostalEntreprise,TelephoneEntreprise,SanteTravail,DateSouscription,TarifMensuel";

/** email vérifié → { codeClient, entreprise… } ou lève 403. */
async function resoudreClient(email) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);

  const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email,CodeClient,Actif");
  const u = utilisateurs.find((x) => (x.Email || "").toLowerCase() === email && x.Actif !== false);
  if (!u || !u.CodeClient) throw { status: 403, erreur: "Compte non rattaché à un client — contactez votre gestionnaire Osmose RH." };

  const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
  const c = clients.find((x) => x.CodeClient === u.CodeClient && x.Actif !== false);
  if (!c) throw { status: 403, erreur: "Client inactif ou inconnu — contactez votre gestionnaire Osmose RH." };

  return {
    // Options souscrites (opt-in : vide = rien d'ouvert) — pilote le verrou
    // par démarche et l'affichage des tuiles/KPI.
    options: Array.isArray(c.Options) ? c.Options : [],
    codeClient: c.CodeClient,
    raisonSociale: c.RaisonSociale || "",
    adresseEntreprise: c.AdresseEntreprise || "",
    siret: c.Siret || "",
    representant: c.Representant || "",
    fonctionRepresentant: c.FonctionRepresentant || "",
    lieuEdition: c.LieuEdition || "",
    emailGestionnaire: c.EmailGestionnaire || "",
  };
}

/** Enregistre une demande d'accès (compte authentifié mais non rattaché).
    Écrit dans la liste « Demandes d'accès portail » du site RH.
    Lève 409 si une demande est déjà en attente pour cet email. */
async function creerDemandeAcces(email, d) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Demandes d'accès portail"];
  if (!listeId) throw { status: 502, erreur: "Liste des demandes d'accès introuvable." };

  // Doublon ? (lecture directe, sans cache : il faut l'état réel)
  let url = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$expand=fields($select=Email,Statut)&$top=200`;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw { status: 502, erreur: "Demandes d'accès injoignables (lecture)." };
    const j = await r.json();
    if (j.value.some((i) => (i.fields.Email || "").toLowerCase() === email && i.fields.Statut === "Nouvelle"))
      throw { status: 409, erreur: "Votre demande d'accès est déjà en cours de traitement — vous serez prévenu par email." };
    url = j["@odata.nextLink"] || null;
  }

  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: email,
      Email: email,
      NomComplet: (d.nom || "").slice(0, 120),
      Entreprise: (d.entreprise || "").slice(0, 120),
      Telephone: (d.telephone || "").slice(0, 30),
      Message: (d.message || "").slice(0, 1000),
      Statut: "Nouvelle",
    } }),
  });
  if (!r.ok) throw { status: 502, erreur: "Enregistrement de la demande impossible, réessayez." };
}

/** Crée la demande d'embauche (contrat + DPAE) dans « Production contrat ».
    Le flux existant « Production contrat + AR » se déclenche à la création
    de l'élément : accusé au demandeur (EmailDemandeur), approbation routée
    (EmailGestionnaire), génération du contrat Word/PDF selon le type. */
async function creerEmbauche(email, clientInfo, d, reference) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Production contrat"];
  if (!listeId) throw { status: 502, erreur: "Liste de production des contrats introuvable." };

  const fields = {
    Title: reference,
    CodeClient: clientInfo.codeClient,
    EmailDemandeur: email,
    EmailGestionnaire: clientInfo.emailGestionnaire,
    "Type_x0020_contrat": d.typeContrat, // "CDI" | "CDD" (choix de la liste)
    Nom: String(d.nom).trim().toUpperCase().slice(0, 120),
    "Pr_x00e9_nom": String(d.prenom).trim().slice(0, 120),
    Datedenaissance: d.dateNaissance,
    Lieudenaissance: String(d.lieuNaissance).trim().slice(0, 120),
    "Nationalit_x00e9_": String(d.nationalite).trim().slice(0, 80),
    "N_x00b0_S_x00e9_curit_x00e9_Soci": Number(String(d.numeroSS).replace(/\s/g, "")), // colonne Nombre
    "Adresse_x0020_postale": String(d.adressePostale).trim().slice(0, 250),
    Email: String(d.emailSalarie || "").trim().slice(0, 120),
    "Num_x00e9_rodet_x00e9_l_x00e9_ph": String(d.telephoneSalarie || "").trim().slice(0, 30),
    "Dateded_x00e9_but": d.dateDebut,
    Postedetravail: String(d.poste).trim().slice(0, 120), // choix à saisie libre
    "Dur_x00e9_edutempsdetravail_x002": Number(String(d.dureeMensuelle).replace(",", ".")),
  };
  if (d.dateFin) fields.Datedefin = d.dateFin;
  // Salarié étranger : le titre de séjour suit l'embauche — son
  // authentification préfectorale (R.5221-41 s.) est pilotée depuis
  // l'écran gestionnaire, statut initial « À authentifier ».
  if (d.titreSejourType) {
    fields.TitreSejourType = String(d.titreSejourType).trim().slice(0, 60);
    fields.TitreSejourNumero = String(d.titreSejourNumero || "").trim().toUpperCase().slice(0, 40);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d.titreSejourExpiration || "")))
      fields.TitreSejourExpiration = d.titreSejourExpiration;
    fields.TitreSejourStatut = "À authentifier";
  }

  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw { status: 502, erreur: "Enregistrement de la demande d'embauche impossible, réessayez." };
}

/* ---------------- Documents clients (bibliothèque dédiée) ----------------
   Un dossier par CodeClient — TOUT son contenu est visible par ce client.
   L'API crée le dossier (et les sous-dossiers standards) à la première
   résolution : les flux qui y archivent ne tombent jamais sur un dossier
   manquant. Lecture seule côté client (v1). */

let driveDocs; // id du drive « Documents clients », mis en cache
async function driveDocuments(tok) {
  if (driveDocs) return driveDocs;
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/drives?$select=id,name`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw { status: 502, erreur: "Espace documentaire injoignable." };
  const j = await r.json();
  const dv = j.value.find((x) => x.name === "Documents clients");
  if (!dv) throw { status: 502, erreur: "Bibliothèque Documents clients introuvable." };
  driveDocs = dv.id;
  return driveDocs;
}

const dossiersAssures = new Set(); // codes client dont le dossier est garanti (instance chaude)
async function assurerDossierClient(tok, codeClient) {
  if (dossiersAssures.has(codeClient)) return;
  const drive = await driveDocuments(tok);
  const creer = async (parent, nom) => {
    const url = parent
      ? `https://graph.microsoft.com/v1.0/drives/${drive}/root:/${encodeURIComponent(parent)}:/children`
      : `https://graph.microsoft.com/v1.0/drives/${drive}/root/children`;
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: nom, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
    });
    if (!r.ok && r.status !== 409) throw { status: 502, erreur: "Préparation de l'espace documentaire impossible." };
  };
  await creer(null, codeClient);
  for (const sous of ["Attestations", "Contrats", "Paie", "Dépôts"]) await creer(codeClient, sous);
  dossiersAssures.add(codeClient);
}

/** Liste les documents du client : sous-dossiers = catégories.
    Renvoie [{ id, nom, categorie, taille, modifie }]. */
async function listerDocuments(codeClient) {
  const tok = await tokenGraph();
  const drive = await driveDocuments(tok);
  await assurerDossierClient(tok, codeClient);
  const lire = async (chemin) => {
    const r = await fetch(`https://graph.microsoft.com/v1.0/drives/${drive}/root:/${encodeURIComponent(chemin).replace(/%2F/g, "/")}:/children?$select=id,name,size,lastModifiedDateTime,folder,file&$top=200`,
      { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw { status: 502, erreur: "Lecture des documents impossible." };
    return (await r.json()).value;
  };
  const racine = await lire(codeClient);
  const docs = [];
  for (const e of racine) {
    if (e.file) docs.push({ id: e.id, nom: e.name, categorie: "Général", taille: e.size, modifie: e.lastModifiedDateTime });
    else if (e.folder) {
      for (const f of await lire(`${codeClient}/${e.name}`)) {
        if (f.file) docs.push({ id: f.id, nom: f.name, categorie: e.name, taille: f.size, modifie: f.lastModifiedDateTime });
      }
    }
  }
  return docs;
}

/** Télécharge un document APRÈS vérification qu'il appartient bien au
    dossier du client — c'est le contrôle qui interdit de télécharger le
    document d'un autre client en devinant un id. */
async function telechargerDocument(codeClient, itemId) {
  if (!/^[A-Za-z0-9!_-]{10,}$/.test(itemId || "")) throw { status: 400, erreur: "Identifiant de document invalide." };
  const tok = await tokenGraph();
  const drive = await driveDocuments(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/drives/${drive}/items/${itemId}?$select=id,name,size,parentReference,file`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw { status: 404, erreur: "Document introuvable." };
  const meta = await r.json();
  const chemin = decodeURIComponent(meta.parentReference?.path || "");
  const prefixe = `/drives/${drive}/root:/${codeClient}`;
  if (!meta.file || (chemin !== prefixe && !chemin.startsWith(prefixe + "/")))
    throw { status: 403, erreur: "Ce document n'appartient pas à votre espace." };
  const rc = await fetch(`https://graph.microsoft.com/v1.0/drives/${drive}/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!rc.ok) throw { status: 502, erreur: "Téléchargement impossible, réessayez." };
  return {
    nom: meta.name,
    contentType: meta.file.mimeType || "application/octet-stream",
    contenu: Buffer.from(await rc.arrayBuffer()),
  };
}

/** Enregistre les variables de paie du mois : une ligne = un salarié
    (un salarié peut occuper plusieurs lignes, ex. deux absences).
    Écrit un élément par ligne dans la liste « Variables de paie ». */
async function creerVariablesPaie(email, clientInfo, mois, lignes) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Variables de paie"];
  if (!listeId) throw { status: 502, erreur: "Liste des variables de paie introuvable." };

  const num = (v) => {
    if (v === undefined || v === null || String(v).trim() === "") return undefined;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };
  const txt = (v, max) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : undefined;
  };

  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const fields = {
      Title: `${mois} — ${String(l.nom || "").trim().toUpperCase()} ${String(l.prenom || "").trim()}`.trim(),
      CodeClient: clientInfo.codeClient,
      EmailDemandeur: email,
      Mois: mois,
      Matricule: txt(l.matricule, 30),
      Nom: txt(l.nom, 120) && txt(l.nom, 120).toUpperCase(),
      Prenom: txt(l.prenom, 120),
      HeuresNormales: num(l.heuresNormales),
      HeuresComplementaires: num(l.heuresComplementaires),
      HeuresSup25: num(l.heuresSup25),
      HeuresSup50: num(l.heuresSup50),
      HeuresNuit: num(l.heuresNuit),
      HeuresDimancheFerie: num(l.heuresDimancheFerie),
      AbsenceType: txt(l.absenceType, 40),
      AbsenceDu: txt(l.absenceDu, 10),
      AbsenceAu: txt(l.absenceAu, 10),
      PrimeLibelle: txt(l.primeLibelle, 120),
      PrimeMontant: num(l.primeMontant),
      Acompte: num(l.acompte),
      TitresResto: num(l.titresResto),
      FraisPro: num(l.fraisPro),
      AvantagesNature: num(l.avantagesNature),
      SaisieArret: num(l.saisieArret),
      Commentaire: txt(l.commentaire, 1000),
      Statut: "Nouvelle",
    };
    Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
    const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    if (!r.ok) throw { status: 502, erreur: `Enregistrement de la ligne ${i + 1} impossible — aucune ligne suivante n'a été transmise, réessayez.` };
  }
  await majCyclePaie(clientInfo.codeClient, mois, "Variables reçues");
}

/** Enregistre une déclaration de fin de contrat dans « Fins de contrat ».
    Le gestionnaire produit ensuite STC, certificat de travail et
    attestation France Travail (Statut : Nouvelle → En cours → Traitée). */
async function creerFinContrat(email, clientInfo, d, reference) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Fins de contrat"];
  if (!listeId) throw { status: 502, erreur: "Liste des fins de contrat introuvable." };
  const fields = {
    Title: reference,
    CodeClient: clientInfo.codeClient,
    EmailDemandeur: email,
    EmailGestionnaire: clientInfo.emailGestionnaire,
    Matricule: String(d.matricule || "").trim().slice(0, 30),
    Nom: String(d.nom).trim().toUpperCase().slice(0, 120),
    Prenom: String(d.prenom || "").trim().slice(0, 120),
    TypeContrat: d.typeContrat,
    Motif: d.motif,
    DateFin: d.dateFin,
    Preavis: d.preavis || undefined,
    DernierJourTravaille: d.dernierJourTravaille || undefined,
    CongesRestants: (() => {
      const n = Number(String(d.congesRestants ?? "").replace(",", "."));
      return Number.isFinite(n) && String(d.congesRestants ?? "").trim() !== "" ? n : undefined;
    })(),
    Commentaire: String(d.commentaire || "").trim().slice(0, 1000) || undefined,
    Statut: "Nouvelle",
  };
  Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw { status: 502, erreur: "Enregistrement de la fin de contrat impossible, réessayez." };
}

/* ---------------- Cycle de paie (pilotage interne) ----------------
   Une ligne par client × mois. Le portail la crée et la fait avancer
   automatiquement jusqu'à « Variables reçues » ; les statuts suivants
   (Saisie Cegid, Contrôlée, Bulletins déposés) appartiennent aux
   gestionnaires — on ne rétrograde JAMAIS un statut. */
const STATUTS_CYCLE = ["En attente variables", "Variables reçues", "Saisie Cegid", "Contrôlée", "Bulletins déposés"];

async function majCyclePaie(codeClient, mois, statutCible) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Cycle de paie"];
  if (!listeId) return; // liste absente : le pilotage est optionnel, ne jamais bloquer la démarche

  // lecture directe (sans cache) : il faut l'id d'élément pour la mise à jour
  const rl = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$select=id&$expand=fields($select=CodeClient,Mois,Statut)&$top=500`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!rl.ok) return;
  const existante = (await rl.json()).value.find((x) => x.fields.CodeClient === codeClient && x.fields.Mois === mois);

  const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
  const raisonSociale = clients.find((c) => c.CodeClient === codeClient)?.RaisonSociale || codeClient;

  const corps = {
    Title: `${mois} — ${codeClient}`,
    CodeClient: codeClient, Mois: mois, RaisonSociale: raisonSociale,
    Statut: statutCible,
    ...(statutCible === "Variables reçues" ? { VariablesRecuesLe: new Date().toISOString() } : {}),
  };
  try {
    if (!existante) {
      await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
        method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: corps }),
      });
    } else if (STATUTS_CYCLE.indexOf(statutCible) > STATUTS_CYCLE.indexOf(existante.fields.Statut || "En attente variables")) {
      await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items/${existante.id}/fields`, {
        method: "PATCH", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Statut: statutCible, ...(statutCible === "Variables reçues" ? { VariablesRecuesLe: new Date().toISOString() } : {}) }),
      });
    }
  } catch (_) { /* pilotage best-effort : jamais bloquant */ }
}

const EXTENSIONS_DEPOT = ["pdf", "jpg", "jpeg", "png", "heic", "xlsx", "xls", "csv", "docx", "doc", "odt", "ods", "txt", "zip"];
const TAILLE_MAX_DEPOT = 10 * 1024 * 1024; // 10 Mo

/** Dépose un fichier du client dans {code}/Dépôts (lecture ET écriture pour
    lui, visible du gestionnaire). Nom nettoyé, extension en liste blanche,
    10 Mo max, renommage automatique en cas de collision. */
async function deposerFichier(codeClient, nomBrut, contentType, contenu) {
  const nom = String(nomBrut || "").replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "").trim().slice(0, 120);
  const ext = (nom.split(".").pop() || "").toLowerCase();
  if (!nom || !nom.includes(".") || !EXTENSIONS_DEPOT.includes(ext))
    throw { status: 400, erreur: `Type de fichier non accepté (autorisés : ${EXTENSIONS_DEPOT.join(", ")}).` };
  if (!contenu || contenu.byteLength === 0) throw { status: 400, erreur: "Fichier vide." };
  if (contenu.byteLength > TAILLE_MAX_DEPOT) throw { status: 413, erreur: "Fichier trop volumineux (10 Mo maximum)." };

  const tok = await tokenGraph();
  const drive = await driveDocuments(tok);
  await assurerDossierClient(tok, codeClient);
  const chemin = `${codeClient}/Dépôts/${nom}`;

  if (contenu.byteLength <= 4 * 1024 * 1024) {
    // PUT simple jusqu'à 4 Mo
    const r = await fetch(`https://graph.microsoft.com/v1.0/drives/${drive}/root:/${encodeURIComponent(chemin).replace(/%2F/g, "/")}:/content?@microsoft.graph.conflictBehavior=rename`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": contentType || "application/octet-stream" },
      body: contenu,
    });
    if (!r.ok) throw { status: 502, erreur: "Dépôt impossible, réessayez." };
    const nomFinal = (await r.json()).name;
    const m = nomFinal.match(/^Variables_(\d{4}-\d{2})_/);
    if (m) await majCyclePaie(codeClient, m[1], "Variables reçues");
    return nomFinal;
  }

  // au-delà : session de téléversement (un seul segment suffit sous 10 Mo)
  const rs = await fetch(`https://graph.microsoft.com/v1.0/drives/${drive}/root:/${encodeURIComponent(chemin).replace(/%2F/g, "/")}:/createUploadSession`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename", name: nom } }),
  });
  if (!rs.ok) throw { status: 502, erreur: "Dépôt impossible (session), réessayez." };
  const session = await rs.json();
  const r = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(contenu.byteLength),
      "Content-Range": `bytes 0-${contenu.byteLength - 1}/${contenu.byteLength}`,
    },
    body: contenu,
  });
  if (!r.ok) throw { status: 502, erreur: "Dépôt interrompu, réessayez." };
  const nomFinal = (await r.json()).name;
  const m = nomFinal.match(/^Variables_(\d{4}-\d{2})_/);
  if (m) await majCyclePaie(codeClient, m[1], "Variables reçues");
  return nomFinal;
}

module.exports = { verifierJeton, resoudreClient, creerDemandeAcces, creerEmbauche, tokenGraph, idsListes, items, dateParis, listerDocuments, telechargerDocument, creerVariablesPaie, creerFinContrat, deposerFichier, majCyclePaie, viderCacheItems, SELECT_SALARIES, SELECT_CLIENTS };
