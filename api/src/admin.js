// api/src/admin.js — activation des demandes d'accès en un clic.
// Réservé aux gestionnaires : la variable ADMIN_EMAILS (adresses séparées
// par des virgules) est la liste blanche ; le jeton External ID reste
// vérifié comme partout — un gestionnaire se connecte au portail avec un
// compte dont l'adresse figure dans ADMIN_EMAILS.
//
// Ce module n'enregistre PAS ses routes : il exporte les handlers, et
// c'est me.js qui les déclare auprès du runtime (voir le commentaire de
// contournement SWA dans me.js).
//
// GET  /api/adminDonnees : demandes d'accès « Nouvelle » + clients actifs.
// POST /api/adminActiver : { email, demandeId?, codeClient } pour un client
//   existant, ou { email, demandeId?, nouveau: { codeClient, raisonSociale,
//   options[], adresseEntreprise?, siret?, representant?,
//   fonctionRepresentant?, lieuEdition?, emailGestionnaire? } }.
//   Écrit « Paramètres clients » (si nouveau) + « Utilisateurs portail »,
//   passe la demande en « Traitée », vide le cache de lecture (effet
//   immédiat pour le client qui recharge).

const { verifierJeton, tokenGraph, idsListes, items, viderCacheItems, dateParis, SELECT_SALARIES, SELECT_CLIENTS } = require("./annuaire");

const OPTIONS_VALIDES = ["embauche", "acompte", "attestation", "paie", "etrangers", "securite"];

function adminAutorise(email) {
  const liste = (process.env.ADMIN_EMAILS || "")
    .split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  return liste.includes(email);
}

async function exigerAdmin(request) {
  const { email } = await verifierJeton(request);
  if (!adminAutorise(email))
    throw { status: 403, erreur: "Accès réservé aux gestionnaires Osmose RH." };
  return email;
}

const graphListe = (listeId, suite = "") =>
  `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}${suite}`;

/* ── GET /api/adminDonnees ────────────────────────────────────────────── */
async function donnees(request, context) {
  try {
    await exigerAdmin(request);
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    if (!ids["Demandes d'accès portail"]) throw { status: 502, erreur: "Liste des demandes introuvable." };

    // Demandes avec leur id d'élément (nécessaire pour le passage en Traitée)
    const demandes = [];
    let url = graphListe(ids["Demandes d'accès portail"],
      "/items?$expand=fields($select=Email,NomComplet,Entreprise,Telephone,Message,Statut)&$top=200");
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
      if (!r.ok) throw { status: 502, erreur: "Lecture des demandes impossible." };
      const j = await r.json();
      for (const i of j.value) {
        if (i.fields.Statut === "Nouvelle") demandes.push({
          id: i.id,
          email: (i.fields.Email || "").toLowerCase(),
          nom: i.fields.NomComplet || "",
          entreprise: i.fields.Entreprise || "",
          telephone: i.fields.Telephone || "",
          message: i.fields.Message || "",
          recueLe: i.createdDateTime || null,
        });
      }
      url = j["@odata.nextLink"] || null;
    }

    const clients = (await items(tok, ids["Paramètres clients"], SELECT_CLIENTS))
      .filter((c) => c.CodeClient && c.Actif !== false)
      .map((c) => ({ codeClient: c.CodeClient, raisonSociale: c.RaisonSociale || "" }))
      .sort((a, b) => a.codeClient.localeCompare(b.codeClient));

    // Embauches récentes (« Production contrat ») avec leur état DPAE —
    // lecture DIRECTE (hors cache items(), dont la clé ignore le $select).
    // Les colonnes Dpae* absentes (script pas encore passé) ne bloquent
    // pas : SharePoint ignore les champs inconnus du $select.
    const embauches = [];
    try {
      let urlE = graphListe(ids["Production contrat"],
        "/items?$expand=fields($select=CodeClient,Nom,Pr_x00e9_nom,Type_x0020_contrat,Dateded_x00e9_but,Datedefin,Created,DpaeStatut,DpaeIdFlux,Nationalit_x00e9_,TitreSejourType,TitreSejourNumero,TitreSejourExpiration,TitreSejourStatut)&$top=200");
      while (urlE) {
        const r = await fetch(urlE, { headers: { Authorization: `Bearer ${tok}` } });
        if (!r.ok) break;
        const j = await r.json();
        for (const i of j.value) {
          const f = i.fields || {};
          embauches.push({
            id: i.id,
            codeClient: f.CodeClient || "",
            nom: String(f.Nom || "").toUpperCase(),
            prenom: f["Pr_x00e9_nom"] || "",
            type: f["Type_x0020_contrat"] || "",
            debut: dateParis(f["Dateded_x00e9_but"]),
            fin: dateParis(f.Datedefin),
            recueLe: f.Created || i.createdDateTime || null,
            dpaeStatut: f.DpaeStatut || "",
            dpaeIdFlux: f.DpaeIdFlux || "",
            nationalite: f["Nationalit_x00e9_"] || "",
            titreType: f.TitreSejourType || "",
            titreNumero: f.TitreSejourNumero || "",
            titreExpiration: dateParis(f.TitreSejourExpiration),
            titreStatut: f.TitreSejourStatut || "",
          });
        }
        urlE = j["@odata.nextLink"] || null;
      }
    } catch (e) { context.error("admin/donnees embauches :", e); }
    embauches.sort((a, b) => String(b.recueLe).localeCompare(String(a.recueLe)));

    const dpaeMode = require("./dpae").configuree() ? (process.env.DPAE_MODE || "test") : null;
    return { status: 200, jsonBody: { demandes, clients, options: OPTIONS_VALIDES, embauches: embauches.slice(0, 100), dpaeMode } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/donnees :", e);
    return { status: 502, jsonBody: { erreur: "Données d'administration indisponibles." } };
  }
}

/* ── POST /api/adminActiver ───────────────────────────────────────────── */
/* `corps` : payload déjà lu par l'appelant (détour via /api/demande — le
   corps d'une requête ne se lit qu'une fois). Absent : lu ici. */
async function activer(request, context, corps) {
  try {
    await exigerAdmin(request);
    let d = corps;
    if (!d) {
      try { d = await request.json(); } catch { return { status: 400, jsonBody: { erreur: "JSON attendu" } }; }
    }

    const email = String(d.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return { status: 400, jsonBody: { erreur: "Adresse e-mail du demandeur invalide." } };

    const tok = await tokenGraph();
    const ids = await idsListes(tok);

    let codeClient;
    if (d.nouveau) {
      const n = d.nouveau;
      codeClient = String(n.codeClient || "").trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(codeClient))
        return { status: 400, jsonBody: { erreur: "Code client invalide (2 à 20 lettres/chiffres/tirets)." } };
      if (!n.raisonSociale || String(n.raisonSociale).trim().length < 2)
        return { status: 400, jsonBody: { erreur: "Raison sociale requise." } };
      const options = Array.isArray(n.options) ? n.options.filter((o) => OPTIONS_VALIDES.includes(o)) : [];

      // Unicité du code : refuser un doublon plutôt que créer un clone
      const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
      if (clients.some((c) => (c.CodeClient || "").toUpperCase() === codeClient))
        return { status: 409, jsonBody: { erreur: `Le code client ${codeClient} existe déjà — choisissez « client existant ».` } };

      const rc = await fetch(graphListe(ids["Paramètres clients"], "/items"), {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          Title: String(n.raisonSociale).trim().slice(0, 255),
          CodeClient: codeClient,
          RaisonSociale: String(n.raisonSociale).trim().slice(0, 255),
          AdresseEntreprise: String(n.adresseEntreprise || "").trim().slice(0, 255),
          Siret: String(n.siret || "").trim().slice(0, 20),
          Representant: String(n.representant || "").trim().slice(0, 120),
          FonctionRepresentant: String(n.fonctionRepresentant || "").trim().slice(0, 120),
          LieuEdition: String(n.lieuEdition || "").trim().slice(0, 120),
          EmailGestionnaire: String(n.emailGestionnaire || "").trim().slice(0, 200),
          Actif: true,
          "Options@odata.type": "Collection(Edm.String)",
          Options: options,
        } }),
      });
      if (!rc.ok) {
        context.error("admin/activer client :", rc.status, (await rc.text().catch(() => "")).slice(0, 300));
        throw { status: 502, erreur: "Création de la fiche client impossible." };
      }
    } else {
      codeClient = String(d.codeClient || "").trim();
      const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
      if (!clients.some((c) => c.CodeClient === codeClient && c.Actif !== false))
        return { status: 400, jsonBody: { erreur: `Client ${codeClient} introuvable ou inactif.` } };
    }

    // Rattachement — refuser le doublon d'utilisateur
    const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email");
    if (utilisateurs.some((u) => (u.Email || "").toLowerCase() === email))
      return { status: 409, jsonBody: { erreur: "Cette adresse est déjà rattachée — vérifiez « Utilisateurs portail »." } };

    const ru = await fetch(graphListe(ids["Utilisateurs portail"], "/items"), {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { Title: email, Email: email, CodeClient: codeClient, Actif: true } }),
    });
    if (!ru.ok) {
      context.error("admin/activer utilisateur :", ru.status, (await ru.text().catch(() => "")).slice(0, 300));
      throw { status: 502, erreur: "Rattachement du compte impossible." };
    }

    // Demande → Traitée (best-effort : l'activation elle-même est faite)
    if (d.demandeId && ids["Demandes d'accès portail"]) {
      await fetch(graphListe(ids["Demandes d'accès portail"], `/items/${encodeURIComponent(String(d.demandeId))}/fields`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Statut: "Traitée" }),
      }).catch(() => {});
    }

    viderCacheItems(); // effet immédiat : le client entre dès son rechargement
    return { status: 200, jsonBody: { ok: true, email, codeClient } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/activer :", e);
    return { status: 502, jsonBody: { erreur: "Activation impossible — réessayez." } };
  }
}

/* ── Import de reprise d'effectif ─────────────────────────────────────── */
/* Payload (détour /api/demande, action "adminImportSalaries") :
   { codeClient, salaries: [{ matricule?, nom, prenom?, poste?, typeContrat?,
     dateEntree?, dateSortie?, email?, telephone?, statut? }] }
   Écrit le référentiel « Salariés » avec le CodeClient imposé côté serveur.
   Doublons ignorés (clé nom+prénom normalisée, la même que personnel.js),
   dans le lot ET contre l'existant. Rend un compte-rendu ligne à ligne. */

const cleSalarie = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();
const dateValide = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "";

/* Dossier salarié dans la reprise (22/08 — fin du chantier « fiches ») :
   les 14 champs sont ACCEPTÉS mais jamais exigés, et normalisés avec
   tolérance — une reprise ne doit pas échouer pour un « F » au lieu de
   « Féminin ». Un champ absent ou vide n'est pas écrit. */
const SEXES_REPRISE = { m: "Masculin", h: "Masculin", masculin: "Masculin", homme: "Masculin", monsieur: "Masculin", "1": "Masculin", f: "Féminin", feminin: "Féminin", femme: "Féminin", madame: "Féminin", "2": "Féminin" };
const norm = (v) => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function ficheDepuisReprise(s) {
  const si = (col, val) => (String(val ?? "").trim() ? { [col]: val } : {});
  const oui = norm(s.bulletinDematerialise);
  return {
    ...si("AdressePostale", String(s.adressePostale || "").trim().slice(0, 250)),
    ...si("NumeroSS", String(s.numeroSS || "").replace(/\s/g, "").slice(0, 15)),
    ...si("DateNaissance", dateValide(s.dateNaissance)),
    ...si("Sexe", SEXES_REPRISE[norm(s.sexe)] || ""),
    ...si("NomNaissance", String(s.nomNaissance || "").trim().toUpperCase().slice(0, 120)),
    ...si("NomMarital", String(s.nomMarital || "").trim().slice(0, 120)),
    ...si("SituationFamiliale", String(s.situationFamiliale || "").trim().slice(0, 60)),
    ...si("DepartementNaissance", String(s.departementNaissance || "").trim().slice(0, 80)),
    ...si("CodeDepartementNaissance", String(s.codeDepartementNaissance || "").trim().toUpperCase().slice(0, 3)),
    ...si("PaysNaissance", String(s.paysNaissance || "").trim().slice(0, 80)),
    ...si("CodePaysNaissance", String(s.codePaysNaissance || "").trim().toUpperCase().slice(0, 2)),
    ...si("Iban", String(s.iban || "").replace(/\s/g, "").toUpperCase().slice(0, 34)),
    ...si("Bic", String(s.bic || "").replace(/\s/g, "").toUpperCase().slice(0, 11)),
    ...(oui ? { BulletinDematerialise: ["oui", "o", "yes", "true", "1", "x", "vrai"].includes(oui) } : {}),
  };
}

async function importerSalaries(request, context, corps) {
  try {
    await exigerAdmin(request);
    const d = corps || {};
    const codeClient = String(d.codeClient || "").trim();
    const lot = Array.isArray(d.salaries) ? d.salaries : [];
    if (!codeClient) return { status: 400, jsonBody: { erreur: "Code client requis." } };
    if (lot.length === 0) return { status: 400, jsonBody: { erreur: "Aucun salarié à importer." } };
    if (lot.length > 500) return { status: 400, jsonBody: { erreur: "500 salariés maximum par import." } };

    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    if (!ids["Salariés"]) throw { status: 502, erreur: "Liste « Salariés » introuvable." };

    const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
    if (!clients.some((c) => c.CodeClient === codeClient && c.Actif !== false))
      return { status: 400, jsonBody: { erreur: `Client ${codeClient} introuvable ou inactif.` } };

    const existants = new Set(
      (await items(tok, ids["Salariés"], "CodeClient,Nom,Prenom"))
        .filter((s) => s.CodeClient === codeClient)
        .map((s) => cleSalarie(s.Nom, s.Prenom)));

    const aujourdhui = new Date().toISOString().slice(0, 10);
    let crees = 0, doublons = 0;
    const ignorees = [];
    for (let i = 0; i < lot.length; i++) {
      const s = lot[i] || {};
      const nom = String(s.nom || "").trim();
      const prenom = String(s.prenom || "").trim();
      if (nom.length < 2) { ignorees.push({ ligne: i + 1, raison: "nom manquant" }); continue; }
      const cle = cleSalarie(nom, prenom);
      if (existants.has(cle)) { doublons++; continue; }
      const dateSortie = dateValide(s.dateSortie);
      const r = await fetch(graphListe(ids["Salariés"], "/items"), {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          Title: `${nom.toUpperCase()} ${prenom}`.trim(),
          CodeClient: codeClient,
          Matricule: String(s.matricule || "").trim().slice(0, 40),
          Nom: nom.slice(0, 120),
          Prenom: prenom.slice(0, 120),
          Poste: String(s.poste || "").trim().slice(0, 160),
          TypeContrat: String(s.typeContrat || "").trim().slice(0, 60),
          ...(dateValide(s.dateEntree) ? { DateEntree: dateValide(s.dateEntree) } : {}),
          ...(dateSortie ? { DateSortie: dateSortie } : {}),
          Statut: String(s.statut || "").trim().slice(0, 40)
            || (dateSortie && dateSortie < aujourdhui ? "Sorti" : "Actif"),
          Email: String(s.email || "").trim().toLowerCase().slice(0, 200),
          Telephone: String(s.telephone || "").trim().slice(0, 40),
          ...ficheDepuisReprise(s),
        } }),
      });
      if (!r.ok) {
        context.error("admin/import salarié :", r.status, (await r.text().catch(() => "")).slice(0, 200));
        ignorees.push({ ligne: i + 1, raison: `écriture refusée (HTTP ${r.status})` });
        continue;
      }
      existants.add(cle);
      crees++;
    }

    viderCacheItems(); // le client voit son effectif dès le prochain chargement
    return { status: 200, jsonBody: { ok: true, codeClient, crees, doublons, ignorees } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/importerSalaries :", e);
    return { status: 502, jsonBody: { erreur: "Import impossible — réessayez." } };
  }
}

/* ── DPAE (déclaration préalable à l'embauche, API URSSAF) ────────────── */
/* Détour /api/demande, action "adminDpae", trois phases :
   - { phase:"preparer", idContrat }  → brouillon pré-rempli : employeur
     (Paramètres clients), salarié (Production contrat + fiche « Salariés »,
     sexe et département déduits du NIR à défaut), contrat. `manques` liste
     ce que le gestionnaire doit compléter avant l'envoi.
   - { phase:"deposer", idContrat, dpae:{employeur,salarie,contrat} } →
     validation stricte, authentification URSSAF, dépôt du message, écriture
     DpaeStatut/DpaeIdFlux/DpaeDeclareLe sur l'élément.
   - { phase:"retour", idContrat } → consultation du bilan : Conforme
     (+ certificat) ou Refusée (+ motif URSSAF) ; « pas encore publié »
     rend { pret:false } et le front redemande.
   Le protocole vit dans dpae.js ; le compte URSSAF reste en variables
   d'application (DPAE_*) — jamais dans les payloads ni les réponses. */

const cleContrat = cleSalarie; // même normalisation nom+prénom

async function lireContrat(tok, ids, idContrat) {
  if (!/^\d+$/.test(String(idContrat || "")))
    throw { status: 400, erreur: "Embauche introuvable." };
  const r = await fetch(graphListe(ids["Production contrat"], `/items/${encodeURIComponent(String(idContrat))}?$expand=fields`),
    { headers: { Authorization: `Bearer ${tok}` } });
  if (r.status === 404) throw { status: 404, erreur: "Embauche introuvable." };
  if (!r.ok) throw { status: 502, erreur: "Lecture de l'embauche impossible." };
  return r.json();
}

async function majContrat(tok, ids, idContrat, champs, context) {
  const r = await fetch(graphListe(ids["Production contrat"], `/items/${encodeURIComponent(String(idContrat))}/fields`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(champs),
  });
  if (!r.ok) {
    context.error("admin/dpae maj contrat :", r.status, (await r.text().catch(() => "")).slice(0, 300));
    throw { status: 502, erreur: "Écriture du suivi DPAE impossible — les colonnes Dpae* existent-elles sur « Production contrat » (script creer_site_rh.py) ?" };
  }
}

// 1 → homme, 2 → femme (7/8 : NIR provisoires, 3/4 : historiques).
const sexeDepuisNir = (nir) => ({ 1: "1", 3: "1", 7: "1", 2: "2", 4: "2", 8: "2" }[String(nir)[0]] || "");
const NIR_13 = /^[1-478]\d{4}(?:\d{2}|2[AB])\d{6}$/;

async function dpae(request, context, corps) {
  try {
    await exigerAdmin(request);
    const dpaeApi = require("./dpae");
    if (!dpaeApi.configuree())
      return { status: 400, jsonBody: { erreur: "API DPAE non configurée — renseignez DPAE_MODE, DPAE_SIRET, DPAE_NOM, DPAE_PRENOM et DPAE_MDP dans les variables de la SWA (docs/DPAE-API.md)." } };
    const d = corps || {};
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    if (!ids["Production contrat"]) throw { status: 502, erreur: "Liste « Production contrat » introuvable." };
    const enTest = dpaeApi.indicateurTest() !== 120;
    const suffixe = enTest ? " (test)" : "";

    /* ---- Phase 1 : brouillon pré-rempli ------------------------------- */
    if (d.phase === "preparer") {
      const item = await lireContrat(tok, ids, d.idContrat);
      const f = item.fields || {};
      const codeClient = f.CodeClient || "";

      const params = (await items(tok, ids["Paramètres clients"], SELECT_CLIENTS))
        .find((c) => c.CodeClient === codeClient) || {};

      // Fiche « Salariés » du même salarié (même $select que personnel.js —
      // le cache items() est par liste, un $select réduit l'appauvrirait).
      const fiche = (await items(tok, ids["Salariés"], SELECT_SALARIES))
        .find((s) => s.CodeClient === codeClient && cleContrat(s.Nom, s.Prenom) === cleContrat(f.Nom, f["Pr_x00e9_nom"]));

      const nirBrut = String(fiche?.NumeroSS || f["N_x00b0_S_x00e9_curit_x00e9_Soci"] || "").replace(/\s/g, "").toUpperCase();
      const nir = nirBrut.slice(0, 13);
      const cle = nirBrut.length >= 15 ? nirBrut.slice(13, 15) : dpaeApi.cleNir(nir);
      const sexeFiche = { "Masculin": "1", "Féminin": "2" }[fiche?.Sexe || ""] || "";
      const deptFiche = String(fiche?.CodeDepartementNaissance || "").toUpperCase().slice(0, 2);

      const brouillon = {
        employeur: {
          siret: String(params.Siret || "").replace(/\s/g, ""),
          designation: params.RaisonSociale || "",
          codeApe: String(params.CodeApe || "").replace(".", "").toUpperCase(),
          codeUrssaf: String(params.CodeUrssaf || ""),
          adresse: params.AdresseEntreprise || "",
          ville: params.VilleEntreprise || "",
          codePostal: String(params.CodePostalEntreprise || ""),
          telephone: String(params.TelephoneEntreprise || ""),
          santeTravail: String(params.SanteTravail || "01"),
        },
        salarie: {
          nom: String(f.Nom || "").toUpperCase(),
          prenom: f["Pr_x00e9_nom"] || "",
          sexe: sexeFiche || sexeDepuisNir(nir),
          nir, cleNir: cle,
          dateNaissance: dateParis(f.Datedenaissance) || dateParis(fiche?.DateNaissance) || "",
          communeNaissance: f.Lieudenaissance || "",
          departementNaissance: deptFiche || (NIR_13.test(nir) ? nir.slice(5, 7) : ""),
        },
        contrat: {
          nature: ["CDI", "CDD", "CTT"].includes(f["Type_x0020_contrat"]) ? f["Type_x0020_contrat"] : "CDI",
          dateDebut: dateParis(f["Dateded_x00e9_but"]) || "",
          heureDebut: "09:00:00",
          dateFin: dateParis(f.Datedefin) || "",
        },
      };
      const manques = [];
      if (!brouillon.employeur.siret) manques.push("SIRET de l'employeur (fiche client)");
      if (!brouillon.employeur.codeUrssaf) manques.push("code URSSAF (fiche client)");
      if (!brouillon.employeur.codeApe) manques.push("code APE (fiche client)");
      if (!brouillon.employeur.ville || !brouillon.employeur.codePostal) manques.push("ville et code postal de l'employeur (fiche client)");
      if (!NIR_13.test(brouillon.salarie.nir)) manques.push("NIR du salarié (13 chiffres)");
      const cleAttendue = dpaeApi.cleNir(brouillon.salarie.nir);
      if (cle && cleAttendue && cle !== cleAttendue)
        manques.push(`clé du NIR incohérente (${cle} saisie, ${cleAttendue} calculée) — vérifiez la carte Vitale`);
      if (!brouillon.salarie.sexe) manques.push("sexe du salarié");
      if (!brouillon.salarie.dateNaissance) manques.push("date de naissance");
      if (!brouillon.salarie.communeNaissance) manques.push("commune de naissance");
      if (f.TitreSejourType && f.TitreSejourStatut !== "Authentifié")
        manques.push("titre de séjour NON AUTHENTIFIÉ — à faire valider par la préfecture avant l'embauche (2 jours ouvrables)");
      return { status: 200, jsonBody: { brouillon, manques, mode: enTest ? "test" : "production", statut: f.DpaeStatut || "", idflux: f.DpaeIdFlux || "" } };
    }

    /* ---- Phase 2 : validation stricte + dépôt ------------------------- */
    if (d.phase === "deposer") {
      const item = await lireContrat(tok, ids, d.idContrat);
      const p = d.dpae || {};
      const e = p.employeur || {}, s = p.salarie || {}, c = p.contrat || {};
      const err = (m) => ({ status: 400, jsonBody: { erreur: m } });

      const siret = String(e.siret || "").replace(/\s/g, "");
      if (!/^\d{14}$/.test(siret)) return err("SIRET employeur invalide (14 chiffres).");
      if (String(e.designation || "").trim().length < 2) return err("Dénomination de l'employeur requise.");
      if (!/^\d{4}[A-Z]$/.test(String(e.codeApe || "").replace(".", "").toUpperCase())) return err("Code APE invalide (ex. 1623Z).");
      if (!/^\d{3}$/.test(String(e.codeUrssaf || "").trim())) return err("Code URSSAF invalide (3 chiffres — voir la fiche d'identification URSSAF du client).");
      if (String(e.adresse || "").trim().length < 4) return err("Adresse de l'employeur requise.");
      if (String(e.ville || "").trim().length < 2) return err("Ville de l'employeur requise.");
      if (!/^\d{5}$/.test(String(e.codePostal || "").trim())) return err("Code postal employeur invalide.");
      const nir = String(s.nir || "").replace(/\s/g, "").toUpperCase();
      if (!NIR_13.test(nir)) return err("NIR invalide (13 caractères, 2A/2B admis pour la Corse).");
      const cle = String(s.cleNir || "").trim();
      if (!/^\d{2}$/.test(cle)) return err("Clé du NIR invalide (2 chiffres).");
      const cleCalc = require("./dpae").cleNir(nir);
      if (cleCalc && cle !== cleCalc) return err(`Clé du NIR incohérente (attendue : ${cleCalc}).`);
      if (!["1", "2"].includes(String(s.sexe))) return err("Sexe du salarié requis (1 ou 2).");
      if (String(s.nom || "").trim().length < 2 || !String(s.prenom || "").trim()) return err("Nom et prénom du salarié requis.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.dateNaissance || ""))) return err("Date de naissance invalide (AAAA-MM-JJ).");
      if (String(s.communeNaissance || "").trim().length < 2) return err("Commune de naissance requise.");
      if (!/^(\d{2}|2A|2B)$/.test(String(s.departementNaissance || "").toUpperCase())) return err("Département de naissance invalide (2 caractères, 99 si né à l'étranger).");
      if (!["CDI", "CDD", "CTT"].includes(c.nature)) return err("Nature du contrat invalide (CDI, CDD ou CTT).");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.dateDebut || ""))) return err("Date d'embauche invalide (AAAA-MM-JJ).");
      const heure = String(c.heureDebut || "").trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(heure)) return err("Heure d'embauche invalide (HH:MM).");
      if ((c.nature === "CDD" || c.nature === "CTT") && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.dateFin || "")))
        return err("Date de fin requise pour un CDD/CTT.");

      const message = require("./dpae").construireMessage({
        employeur: { ...e, siret, codeApe: String(e.codeApe).replace(".", "").toUpperCase(), santeTravail: String(e.santeTravail || "01") },
        salarie: { ...s, nir, cleNir: cle, departementNaissance: String(s.departementNaissance).toUpperCase() },
        contrat: { ...c, heureDebut: heure.length === 5 ? `${heure}:00` : heure },
      });
      const jeton = await dpaeApi.authentifier();
      const idflux = await dpaeApi.deposer(jeton, message);
      await majContrat(tok, ids, d.idContrat, {
        DpaeStatut: `Déposée${suffixe}`,
        DpaeIdFlux: idflux,
        DpaeDeclareLe: new Date().toISOString(),
        DpaeMessage: "", DpaeCertificat: "",
      }, context);
      viderCacheItems();
      return { status: 200, jsonBody: { ok: true, idflux, statut: `Déposée${suffixe}` } };
    }

    /* ---- Phase 3 : consultation du bilan ------------------------------ */
    if (d.phase === "retour") {
      const item = await lireContrat(tok, ids, d.idContrat);
      const f = item.fields || {};
      const idflux = String(d.idflux || f.DpaeIdFlux || "").trim();
      if (!idflux) return { status: 400, jsonBody: { erreur: "Aucun dépôt DPAE enregistré pour cette embauche." } };
      const enTestDepot = /\(test\)/.test(String(f.DpaeStatut || "")) || enTest;
      const suffixeDepot = enTestDepot ? " (test)" : "";
      const jeton = await dpaeApi.authentifier();
      const retour = await dpaeApi.consulterRetour(jeton, idflux);
      if (!retour.pret) return { status: 200, jsonBody: { pret: false, statut: f.DpaeStatut || "" } };
      const statut = retour.conforme ? `Conforme${suffixeDepot}` : `Refusée${suffixeDepot}`;
      await majContrat(tok, ids, d.idContrat, {
        DpaeStatut: statut,
        DpaeCertificat: retour.conforme ? String(retour.certificat).slice(0, 255) : "",
        DpaeMessage: retour.conforme ? "" : String(retour.message).slice(0, 2000),
      }, context);
      viderCacheItems();
      return { status: 200, jsonBody: { pret: true, conforme: retour.conforme, statut, certificat: retour.certificat || "", message: retour.message || "" } };
    }

    return { status: 400, jsonBody: { erreur: "Phase DPAE inconnue (preparer, deposer ou retour)." } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/dpae :", e);
    return { status: 502, jsonBody: { erreur: "DPAE momentanément indisponible — réessayez." } };
  }
}

/* ── Titre de séjour : suivi de l'authentification préfectorale ──────── */
/* Détour /api/demande, action "adminTitreSejour" :
   { idContrat, decision: "authentifie" | "refuse" | "aAuthentifier" }.
   La demande elle-même part par courriel à la préfecture du lieu
   d'embauche (mail type généré par l'écran) — ici on ne fait que
   CONSIGNER la réponse : statut + horodatage sur l'embauche. */
async function titreSejour(request, context, corps) {
  try {
    await exigerAdmin(request);
    const d = corps || {};
    const statut = { authentifie: "Authentifié", refuse: "Refusé", aAuthentifier: "À authentifier" }[d.decision];
    if (!statut) return { status: 400, jsonBody: { erreur: "Décision inconnue (authentifie, refuse ou aAuthentifier)." } };
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    if (!ids["Production contrat"]) throw { status: 502, erreur: "Liste « Production contrat » introuvable." };
    const item = await lireContrat(tok, ids, d.idContrat);
    if (!item.fields?.TitreSejourType)
      return { status: 400, jsonBody: { erreur: "Aucun titre de séjour suivi sur cette embauche." } };
    await majContrat(tok, ids, d.idContrat, {
      TitreSejourStatut: statut,
      TitreSejourVerifieLe: statut === "À authentifier" ? null : new Date().toISOString(),
    }, context);
    viderCacheItems();
    return { status: 200, jsonBody: { ok: true, statut } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/titreSejour :", e);
    return { status: 502, jsonBody: { erreur: "Suivi du titre momentanément indisponible — réessayez." } };
  }
}

module.exports = { donnees, activer, importerSalaries, dpae, titreSejour };
