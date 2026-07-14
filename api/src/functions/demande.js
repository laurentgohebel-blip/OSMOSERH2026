// api/src/functions/demande.js — Azure Functions v4 (fonctions managées Static Web Apps)
// Point d'entrée UNIQUE des formulaires du portail, désormais VERROUILLÉ :
//   1. le jeton External ID du navigateur est validé (annuaire.verifierJeton) ;
//   2. l'email vérifié est résolu en client via les listes du site RH
//      (annuaire.resoudreClient) — le payload n'est jamais cru sur parole ;
//   3. le payload relayé au flux est enrichi de l'identité entreprise
//      (raison sociale, SIRET…) et du gestionnaire : les flux Power Automate
//      n'ont plus AUCUNE recherche SharePoint à faire, que des jetons.
//
// Configuration : FLOW_URL_<DEMARCHE> (une par démarche) + variables AUTH_*/GRAPH_*
// (voir annuaire.js). Les URLs de flux restent secrètes côté Azure.

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, creerDemandeAcces, creerEmbauche, creerVariablesPaie, creerFinContrat, tokenGraph, idsListes } = require("../annuaire");

app.http("demande", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    let d;
    try { d = await request.json(); }
    catch { return { status: 400, jsonBody: { erreur: "JSON attendu" } }; }

    // 1. Honeypot : un humain ne remplit jamais ce champ caché
    if (d.xq_note || d.website) return { status: 202, jsonBody: { reference: "OK" } }; // on ne renseigne pas le bot

    // 2. Identité vérifiée puis résolution client — le verrou.
    //    Cas particulier « acces » : la demande d'accès est LA démarche des
    //    comptes pas encore rattachés — jeton valide exigé, résolution non.
    let email, clientInfo;
    try {
      ({ email } = await verifierJeton(request));
      if (d.demarche === "acces") {
        if (!d.entreprise || String(d.entreprise).trim().length < 2 || !d.nom || String(d.nom).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Entreprise et nom sont requis." } };
        await creerDemandeAcces(email, d);
        return { status: 202, jsonBody: { reference: `ACCES-${Date.now().toString(36).toUpperCase()}` } };
      }
      clientInfo = await resoudreClient(email);

      // Verrou d'option : une démarche non souscrite est refusée côté
      // serveur, même si l'appel contourne l'interface (tuiles grisées).
      // fin-contrat relève de l'option 'embauche' : elle couvre le cycle
      // contrat complet (entrées ET sorties).
      const OPTION_PAR_DEMARCHE = { "attestation-employeur": "attestation", "acompte": "acompte", "embauche": "embauche", "variables-paie": "paie", "fin-contrat": "embauche", "absences": "embauche", "visite-medicale": "embauche", "mutuelle": "embauche" };
      const option = OPTION_PAR_DEMARCHE[d.demarche];
      if (option && !clientInfo.options.includes(option))
        return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };

      // Cas particulier « fin-contrat » : déclaration de départ — écrite
      // dans la liste « Fins de contrat », production documentaire par le
      // gestionnaire (STC, certificat, attestation France Travail).
      if (d.demarche === "fin-contrat") {
        const MOTIFS = ["Démission", "Rupture conventionnelle", "Licenciement pour motif personnel", "Licenciement pour motif économique", "Fin de CDD (terme prévu)", "Rupture anticipée de CDD", "Rupture période d'essai (employeur)", "Rupture période d'essai (salarié)", "Départ à la retraite", "Mise à la retraite", "Décès", "Autre"];
        if (!d.nom || String(d.nom).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Nom du salarié requis." } };
        if (!["CDI", "CDD", "Autre"].includes(d.typeContrat))
          return { status: 400, jsonBody: { erreur: "Type de contrat invalide." } };
        if (!MOTIFS.includes(d.motif))
          return { status: 400, jsonBody: { erreur: "Motif de fin de contrat invalide." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateFin || "")))
          return { status: 400, jsonBody: { erreur: "Date de fin de contrat requise." } };
        const reference = `FIN-${Date.now().toString(36).toUpperCase()}`;
        await creerFinContrat(email, clientInfo, d, reference);
        return { status: 202, jsonBody: { reference } };
      }

      // Cas particulier « variables-paie » : la grille mensuelle. Pas de
      // flux HTTP — l'API écrit une ligne de liste par salarié transmis.
      if (d.demarche === "variables-paie") {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(d.mois || "")))
          return { status: 400, jsonBody: { erreur: "Mois invalide (format AAAA-MM)." } };
        const lignes = Array.isArray(d.lignes) ? d.lignes : [];
        if (lignes.length === 0)
          return { status: 400, jsonBody: { erreur: "Aucune ligne à transmettre." } };
        if (lignes.length > 100)
          return { status: 400, jsonBody: { erreur: "Trop de lignes (100 maximum par envoi)." } };
        for (let i = 0; i < lignes.length; i++)
          if (!lignes[i] || String(lignes[i].nom || "").trim().length < 2)
            return { status: 400, jsonBody: { erreur: `Ligne ${i + 1} : le nom du salarié est requis.` } };
        const reference = `VAR-${Date.now().toString(36).toUpperCase()}`;
        await creerVariablesPaie(email, clientInfo, d.mois, lignes);
        return { status: 202, jsonBody: { reference, lignes: lignes.length } };
      }

      // Cas particulier « embauche » (contrat + DPAE) : pas de flux HTTP —
      // l'API écrit dans « Production contrat » et le flux existant
      // « Production contrat + AR » se déclenche à la création.
      if (d.demarche === "embauche") {
        const requis = ["typeContrat", "nom", "prenom", "dateNaissance", "lieuNaissance", "nationalite", "numeroSS", "adressePostale", "dateDebut", "poste", "dureeMensuelle"];
        for (const c of requis)
          if (!d[c] || !String(d[c]).trim())
            return { status: 400, jsonBody: { erreur: `Champ manquant : ${c}` } };
        if (!/^[12]\d{12}(\d{2})?$/.test(String(d.numeroSS).replace(/\s/g, "")))
          return { status: 400, jsonBody: { erreur: "Numéro de sécurité sociale invalide (13 ou 15 chiffres)." } };
        if (!["CDI", "CDD"].includes(d.typeContrat))
          return { status: 400, jsonBody: { erreur: "Type de contrat non pris en charge." } };
        if (d.typeContrat === "CDD" && !d.dateFin)
          return { status: 400, jsonBody: { erreur: "Date de fin requise pour un CDD." } };
        const reference = `EMB-${Date.now().toString(36).toUpperCase()}`;
        await creerEmbauche(email, clientInfo, d, reference);
        return { status: 202, jsonBody: { reference } };
      }

      // Cas particulier « contact » : message au gestionnaire — JAMAIS
      // optionnel (le canal fait partie du service de base). Écrit dans
      // « Messages gestionnaire » ; le flux « + AR » notifie et accuse
      // réception, la réponse du gestionnaire part par e-mail classique.
      if (d.demarche === "contact") {
        if (!d.objet || String(d.objet).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Objet requis." } };
        if (!d.message || String(d.message).trim().length < 10)
          return { status: 400, jsonBody: { erreur: "Message trop court — précisez votre demande." } };
        const reference = `MSG-${Date.now().toString(36).toUpperCase()}`;
        await creerMessageGestionnaire(email, clientInfo, d, reference);
        return { status: 202, jsonBody: { reference } };
      }

      // Cas particuliers « gestion du personnel » (absences, visite médicale,
      // mutuelle) : écriture directe dans la liste dédiée. Le flux « + AR »
      // attaché à chaque liste envoie l'accusé de réception au demandeur et
      // la notification au gestionnaire — l'API écrit donc les emails requis.
      if (d.demarche === "absences") {
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateDebut || "")))
          return { status: 400, jsonBody: { erreur: "Date de début requise." } };
        if (d.dateFin && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateFin)))
          return { status: 400, jsonBody: { erreur: "Date de fin invalide." } };
        if (!d.motif || String(d.motif).trim().length < 1)
          return { status: 400, jsonBody: { erreur: "Motif requis." } };
        const reference = `ABS-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Absences", email, clientInfo, d, reference, {
          DateDebut: d.dateDebut,
          ...(d.dateFin ? { DateFin: d.dateFin } : {}),
          Motif: String(d.motif).trim().slice(0, 255),
          JustificatifUrl: String(d.justificatifUrl || "").trim().slice(0, 500),
          Statut: "Nouvelle",
        });
        return { status: 202, jsonBody: { reference } };
      }

      if (d.demarche === "visite-medicale") {
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateVisite || "")))
          return { status: 400, jsonBody: { erreur: "Date souhaitée requise." } };
        const reference = `VIS-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Visites médicales", email, clientInfo, d, reference, {
          DateVisite: d.dateVisite,
          Statut: "À planifier",
        });
        return { status: 202, jsonBody: { reference } };
      }

      if (d.demarche === "mutuelle") {
        if (!d.salarie || String(d.salarie).trim().length < 2)
          return { status: 400, jsonBody: { erreur: "Salarié requis." } };
        if (!d.mutuelle || String(d.mutuelle).trim().length < 1)
          return { status: 400, jsonBody: { erreur: "Mutuelle requise." } };
        if (d.dateAdhesion && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateAdhesion)))
          return { status: 400, jsonBody: { erreur: "Date d'adhésion invalide." } };
        const reference = `MUT-${Date.now().toString(36).toUpperCase()}`;
        await creerElementPersonnel("Adhésions mutuelles", email, clientInfo, d, reference, {
          Mutuelle: String(d.mutuelle).trim().slice(0, 120),
          DateAdhesion: d.dateAdhesion || new Date().toISOString().slice(0, 10),
          Statut: "Demande",
        });
        return { status: 202, jsonBody: { reference } };
      }
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("Verrou :", e);
      return { status: 502, jsonBody: { erreur: "Vérification du compte impossible, réessayez." } };
    }

    // 3. Démarche requise et résolution du flux cible
    if (!d.demarche || typeof d.demarche !== "string" || !d.demarche.trim())
      return { status: 400, jsonBody: { erreur: "Champ manquant : demarche" } };
    const cle = "FLOW_URL_" + d.demarche.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const flowUrl = process.env[cle];
    if (!flowUrl) {
      context.warn(`Démarche inconnue ou non configurée : ${d.demarche}`);
      return { status: 400, jsonBody: { erreur: "Démarche non reconnue" } };
    }

    // 4. Référence lisible, renvoyée au client et transmise au flux
    const reference = `${d.demarche.split("-")[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // 5. Relais enrichi : identité et données entreprise imposées par le serveur.
    //    Ce que le navigateur a déclaré pour email/client est écrasé.
    delete d.xq_note; delete d.website;
    const enrichi = {
      ...d,
      email,                                    // email VÉRIFIÉ (jeton)
      client: clientInfo.codeClient,            // client RÉSOLU (listes)
      raisonSociale: clientInfo.raisonSociale,
      adresseEntreprise: clientInfo.adresseEntreprise,
      siret: clientInfo.siret,
      representant: clientInfo.representant,
      fonctionRepresentant: clientInfo.fonctionRepresentant,
      lieuEdition: clientInfo.lieuEdition,
      emailGestionnaire: clientInfo.emailGestionnaire,
      reference,
      recuLe: new Date().toISOString(),
    };
    const r = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichi),
    });

    if (!r.ok) {
      const corps = (await r.text().catch(() => "")).slice(0, 200);
      context.error(`Relais flux ${cle} en échec : ${r.status} ${corps}`);
      return { status: 502, jsonBody: { erreur: `Relais vers le flux refusé → HTTP ${r.status}. ${r.status === 404 ? "URL de flux introuvable : flux désactivé, supprimé, ou URL erronée." : (r.status === 401 || r.status === 403) ? "Signature invalide : URL probablement tronquée au copier-coller." : corps}` } };
    }

    return { status: 202, jsonBody: { reference } };
  }
});

/* Écrit un message client dans « Messages gestionnaire » (canal de contact).
   Même exigence que les autres écritures : réponse Graph vérifiée. */
async function creerMessageGestionnaire(email, clientInfo, d, reference) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids["Messages gestionnaire"]) throw { status: 502, erreur: "Canal gestionnaire indisponible." };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Messages gestionnaire"]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: String(d.objet).trim().slice(0, 255),
      Message: String(d.message).trim().slice(0, 4000),
      Reference: reference,
      CodeClient: clientInfo.codeClient,
      RaisonSociale: clientInfo.raisonSociale || "",
      EmailDemandeur: email,
      EmailGestionnaire: clientInfo.emailGestionnaire || "",
      Statut: "Nouveau",
    } }),
  });
  if (!r.ok) throw { status: 502, erreur: "Envoi du message impossible — réessayez." };
}

/* Écrit une ligne « gestion du personnel » (Absences, Visites médicales,
   Adhésions mutuelles) : socle commun imposé par le serveur (identité client,
   référence, emails pour le flux d'accusé de réception) + champs spécifiques.
   Toute réponse non-2xx de Graph LÈVE une erreur : le client ne reçoit
   jamais une référence pour une ligne qui n'a pas été écrite. */
async function creerElementPersonnel(liste, email, clientInfo, d, reference, champs) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[liste]) throw { status: 502, erreur: `Liste « ${liste} » introuvable.` };
  const mots = String(d.salarie).trim().split(/\s+/);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[liste]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: String(d.salarie).trim().slice(0, 255),
      Reference: reference,
      CodeClient: clientInfo.codeClient,
      RaisonSociale: clientInfo.raisonSociale || "",
      SalarieNom: (mots[0] || "").toUpperCase(),
      SalariePrenom: mots.slice(1).join(" "),
      EmailDemandeur: email,
      EmailGestionnaire: clientInfo.emailGestionnaire || "",
      ...champs,
    } }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: `Enregistrement dans « ${liste} » impossible — réessayez.`, detail: corps };
  }
}
