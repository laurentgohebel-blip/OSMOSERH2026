// api/src/etrangers.js — brique « Salariés étrangers » (option de contrat).
// Tout le cycle de conformité d'un travailleur étranger hors UE/EEE/Suisse :
//   • ÉTAT DU DROIT AU SÉJOUR, calculé — jamais stocké — depuis la fiche
//     « Salariés » : Valide / À renouveler (fenêtre J-90) / En
//     renouvellement (récépissé en cours de validité, qui PROLONGE les
//     droits même titre expiré) / EXPIRÉ SANS DROITS (interdiction
//     d'emploi, art. L.8251-1) ;
//   • déclaration du renouvellement par le CLIENT (récépissé puis nouveau
//     titre, pièces déposées via /api/depot) ;
//   • vue GESTIONNAIRE tous clients : suivi, qualification du droit au
//     travail (plein / limité étudiant 964 h / autorisation requise),
//     suivi de la demande d'autorisation de travail, dossier
//     « contrôle inspection » (copies des titres en GED).
// Doctrine des routes (21/08) : ce module n'enregistre RIEN — me.js sert
// GET ?vue=etrangers (client) et ?vue=admin&onglet=etrangers ;
// demande.js relaie POST { action: "titreRenouvellement" | "adminEtrangers" }.

const { verifierJeton, resoudreClient, tokenGraph, idsListes, items, dateParis, viderCacheItems, SELECT_SALARIES, SELECT_CLIENTS } = require("./annuaire");

/* ── Référentiels partagés (source unique — le front duplique à l'identique,
      demande.js importe d'ici) ─────────────────────────────────────────── */
const RADICAUX_UE_EEE_SUISSE = ["franc", "allemand", "autrich", "belg", "bulgar", "chypr", "croat", "danois", "danemark", "espagn", "eston", "finland", "grec", "hongr", "irland", "ital", "letton", "lituan", "luxembourg", "malt", "neerland", "holland", "pays-bas", "pays bas", "polon", "portug", "roumain", "slovaqu", "sloven", "sued", "tchec", "island", "liechtenstein", "norveg", "suisse"];
function titreSejourRequis(nationalite) {
  const n = String(nationalite || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!n.trim()) return false;
  return !RADICAUX_UE_EEE_SUISSE.some((r) => n.includes(r));
}
const TITRES_SEJOUR = ["Carte de séjour pluriannuelle", "Carte de séjour temporaire", "Carte de résident", "VLS-TS (visa long séjour valant titre)", "Récépissé avec autorisation de travail", "Autorisation provisoire de séjour", "Carte de séjour citoyen UE/famille", "Autre"];

// Qualification du droit au travail — suggérée par type de titre, ajustable
// par le gestionnaire (la mention exacte du titre fait foi).
const DROITS_TRAVAIL = ["", "Plein", "Limité (étudiant 964 h/an)", "Autorisation de travail requise"];
const AUTORISATIONS = ["", "Non requise", "À déposer", "Déposée", "Accordée", "Refusée"];
const DROIT_SUGGERE = {
  "Carte de séjour pluriannuelle": "Plein",
  "Carte de résident": "Plein",
  "VLS-TS (visa long séjour valant titre)": "Plein",
  "Récépissé avec autorisation de travail": "Plein",
  "Carte de séjour citoyen UE/famille": "Plein",
  "Carte de séjour temporaire": "Autorisation de travail requise",
  "Autorisation provisoire de séjour": "Autorisation de travail requise",
  "Autre": "Autorisation de travail requise",
};

const SEUIL_RENOUVELLEMENT = 90; // jours avant expiration : fenêtre légale de dépôt (4 à 2 mois)

/* État du droit au séjour d'une fiche — le récépissé PROLONGE les droits.
   `f` : champs bruts « Salariés » ; `aujourdhui` : AAAA-MM-JJ Paris. */
function etatTitre(f, aujourdhui) {
  const expiration = dateParis(f.TitreSejourExpiration);
  const recepisseFin = dateParis(f.RecepisseFin);
  if (!expiration && !recepisseFin) return { etat: "inconnu", joursRestants: null, finDroits: null };
  if (recepisseFin && recepisseFin >= aujourdhui) {
    return { etat: "en-renouvellement", finDroits: recepisseFin,
      joursRestants: Math.round((new Date(recepisseFin) - new Date(aujourdhui)) / 86400000) };
  }
  if (expiration && expiration >= aujourdhui) {
    const jours = Math.round((new Date(expiration) - new Date(aujourdhui)) / 86400000);
    return { etat: jours <= SEUIL_RENOUVELLEMENT ? "a-renouveler" : "valide", joursRestants: jours, finDroits: expiration };
  }
  return { etat: "expire", finDroits: recepisseFin || expiration,
    joursRestants: Math.round((new Date(expiration || recepisseFin) - new Date(aujourdhui)) / 86400000) };
}

const cleNomPrenom = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();

/* Un salarié « étranger » du référentiel : titre suivi OU nationalité hors
   UE/EEE/Suisse. Sortis exclus. */
const estEtranger = (s) => s.Statut !== "Sorti" && (!!s.TitreSejourType || titreSejourRequis(s.Nationalite));

function ligne(s, aujourdhui) {
  return {
    id: s.id,
    cle: cleNomPrenom(s.Nom, s.Prenom),
    nom: String(s.Nom || "").toUpperCase(),
    prenom: s.Prenom || "",
    poste: s.Poste || "",
    nationalite: s.Nationalite || "",
    titre: { type: s.TitreSejourType || "", numero: s.TitreSejourNumero || "", expiration: dateParis(s.TitreSejourExpiration), pj: s.TitreSejourPj || "" },
    recepisse: { numero: s.RecepisseNumero || "", fin: dateParis(s.RecepisseFin), pj: s.RecepissePj || "" },
    droitTravail: s.DroitTravail || DROIT_SUGGERE[s.TitreSejourType] || "",
    droitSuggere: !s.DroitTravail, // vrai = suggestion par type, pas encore qualifié
    autorisationTravail: s.AutorisationTravail || "",
    alerte: s.AlerteTitreSejour || null,
    ...etatTitre(s, aujourdhui),
  };
}

/* ── Vue CLIENT : GET /api/me?vue=etrangers ───────────────────────────── */
async function donneesClient(request, context) {
  try {
    const { email } = await verifierJeton(request);
    const c = await resoudreClient(email);
    if (!c.options.includes("etrangers"))
      return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    const aujourdhui = dateParis(new Date());
    const salaries = (await items(tok, ids["Salariés"], SELECT_SALARIES))
      .filter((s) => s.CodeClient === c.codeClient && estEtranger(s))
      .map((s) => ligne(s, aujourdhui))
      .sort((a, b) => (a.finDroits || "9999").localeCompare(b.finDroits || "9999"));
    return { status: 200, jsonBody: { salaries, seuil: SEUIL_RENOUVELLEMENT, titres: TITRES_SEJOUR } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("etrangers/client :", e);
    return { status: 502, jsonBody: { erreur: "Suivi des salariés étrangers momentanément indisponible." } };
  }
}

/* ── Action CLIENT : POST demande { action:"titreRenouvellement" } ─────── */
/* { id, mode:"recepisse", recepisseNumero, recepisseFin, pj? }
   { id, mode:"nouveauTitre", titreType, titreNumero, titreExpiration, pj? }
   Verrous : jeton + client résolus par demande.js (clientInfo), option
   etrangers, PROPRIÉTÉ de l'élément relue avant écriture. Les alertes
   sont réarmées (nouveau cycle de vie du titre). */
async function renouveler(clientInfo, d, context) {
  if (!clientInfo.options.includes("etrangers"))
    return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };
  const id = String(d.id || "").trim();
  if (!/^\d+$/.test(id)) return { status: 400, jsonBody: { erreur: "Fiche salarié introuvable." } };
  const aujourdhui = dateParis(new Date());
  const dateValide = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "";
  const pj = String(d.pj || "").trim().slice(0, 255);
  if (pj && !/\.(pdf|jpe?g|png)$/i.test(pj))
    return { status: 400, jsonBody: { erreur: "Pièce jointe invalide (PDF/JPG/PNG)." } };

  let champs;
  if (d.mode === "recepisse") {
    const fin = dateValide(d.recepisseFin);
    if (!fin || fin < aujourdhui)
      return { status: 400, jsonBody: { erreur: "Date de fin de validité du récépissé requise (à venir)." } };
    champs = {
      RecepisseNumero: String(d.recepisseNumero || "").trim().toUpperCase().slice(0, 40),
      RecepisseFin: fin,
      ...(pj ? { RecepissePj: pj } : {}),
      AlerteTitreSejour: "", // nouveau cycle : les relances repartent
    };
  } else if (d.mode === "nouveauTitre") {
    const exp = dateValide(d.titreExpiration);
    if (!TITRES_SEJOUR.includes(d.titreType))
      return { status: 400, jsonBody: { erreur: "Type de titre invalide." } };
    if (String(d.titreNumero || "").trim().length < 4)
      return { status: 400, jsonBody: { erreur: "Numéro du titre requis." } };
    if (!exp || exp < aujourdhui)
      return { status: 400, jsonBody: { erreur: "Date d'expiration du nouveau titre requise (à venir)." } };
    champs = {
      TitreSejourType: d.titreType,
      TitreSejourNumero: String(d.titreNumero).trim().toUpperCase().slice(0, 40),
      TitreSejourExpiration: exp,
      ...(pj ? { TitreSejourPj: pj } : {}),
      RecepisseNumero: "", RecepisseFin: null, RecepissePj: "",
      AlerteTitreSejour: "",
      DroitTravail: "", // le type a pu changer : re-qualification gestionnaire
    };
  } else {
    return { status: 400, jsonBody: { erreur: "Mode inconnu (recepisse ou nouveauTitre)." } };
  }

  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const base = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${id}`;
  const rl = await fetch(`${base}?$expand=fields($select=CodeClient)`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!rl.ok) return { status: 404, jsonBody: { erreur: "Fiche salarié introuvable." } };
  if ((await rl.json()).fields?.CodeClient !== clientInfo.codeClient)
    return { status: 404, jsonBody: { erreur: "Fiche salarié introuvable." } };

  const r = await fetch(`${base}/fields`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(champs),
  });
  if (!r.ok) {
    context.error("etrangers/renouveler :", r.status, (await r.text().catch(() => "")).slice(0, 300));
    return { status: 502, jsonBody: { erreur: "Enregistrement impossible — les colonnes Recepisse* existent-elles (creer_site_rh.py) ?" } };
  }
  viderCacheItems();
  return { status: 200, jsonBody: { ok: true } };
}

/* ── Vue GESTIONNAIRE : GET /api/me?vue=admin&onglet=etrangers ────────── */
function adminAutorise(email) {
  return (process.env.ADMIN_EMAILS || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean).includes(email);
}
async function donneesAdmin(request, context) {
  try {
    const { email } = await verifierJeton(request);
    if (!adminAutorise(email)) return { status: 403, jsonBody: { erreur: "Accès réservé aux gestionnaires Osmose RH." } };
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    const aujourdhui = dateParis(new Date());
    const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
    const nomClient = (code) => clients.find((c) => c.CodeClient === code)?.RaisonSociale || code;
    const salaries = (await items(tok, ids["Salariés"], SELECT_SALARIES))
      .filter(estEtranger)
      .map((s) => ({ ...ligne(s, aujourdhui), codeClient: s.CodeClient || "", raisonSociale: nomClient(s.CodeClient) }))
      .sort((a, b) => (a.finDroits || "9999").localeCompare(b.finDroits || "9999"));
    const compte = (etat) => salaries.filter((s) => s.etat === etat).length;
    return { status: 200, jsonBody: {
      salaries,
      compteurs: { expires: compte("expire"), enRenouvellement: compte("en-renouvellement"), aRenouveler: compte("a-renouveler"), valides: compte("valide") + compte("inconnu") },
      droits: DROITS_TRAVAIL, autorisations: AUTORISATIONS,
    } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("etrangers/admin :", e);
    return { status: 502, jsonBody: { erreur: "Suivi des salariés étrangers indisponible." } };
  }
}

/* ── Action GESTIONNAIRE : POST demande { action:"adminEtrangers" } ────── */
/* { id, droitTravail?, autorisationTravail? } — qualification du droit au
   travail et suivi de la demande d'autorisation (téléservice Intérieur). */
async function adminMaj(request, context, d) {
  try {
    const { email } = await verifierJeton(request);
    if (!adminAutorise(email)) return { status: 403, jsonBody: { erreur: "Accès réservé aux gestionnaires Osmose RH." } };
    const id = String(d.id || "").trim();
    if (!/^\d+$/.test(id)) return { status: 400, jsonBody: { erreur: "Fiche salarié introuvable." } };
    const champs = {};
    if (d.droitTravail !== undefined) {
      if (!DROITS_TRAVAIL.includes(d.droitTravail)) return { status: 400, jsonBody: { erreur: "Droit au travail invalide." } };
      champs.DroitTravail = d.droitTravail;
    }
    if (d.autorisationTravail !== undefined) {
      if (!AUTORISATIONS.includes(d.autorisationTravail)) return { status: 400, jsonBody: { erreur: "Statut d'autorisation invalide." } };
      champs.AutorisationTravail = d.autorisationTravail;
    }
    if (!Object.keys(champs).length) return { status: 400, jsonBody: { erreur: "Rien à enregistrer." } };
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(champs),
    });
    if (!r.ok) {
      context.error("etrangers/adminMaj :", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return { status: 502, jsonBody: { erreur: "Enregistrement impossible — réessayez." } };
    }
    viderCacheItems();
    return { status: 200, jsonBody: { ok: true } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("etrangers/adminMaj :", e);
    return { status: 502, jsonBody: { erreur: "Enregistrement impossible — réessayez." } };
  }
}

module.exports = { titreSejourRequis, TITRES_SEJOUR, etatTitre, SEUIL_RENOUVELLEMENT, donneesClient, renouveler, donneesAdmin, adminMaj };
