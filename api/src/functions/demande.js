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
const { verifierJeton, resoudreClient, creerDemandeAcces, creerEmbauche, creerVariablesPaie } = require("../annuaire");

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
      const OPTION_PAR_DEMARCHE = { "attestation-employeur": "attestation", "acompte": "acompte", "embauche": "embauche", "variables-paie": "paie" };
      const option = OPTION_PAR_DEMARCHE[d.demarche];
      if (option && !clientInfo.options.includes(option))
        return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };

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
