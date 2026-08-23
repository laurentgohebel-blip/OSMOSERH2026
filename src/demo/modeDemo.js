// src/demo/modeDemo.js — mode démonstration du portail Osmose RH.
// ─────────────────────────────────────────────────────────────────────────────
// Pensé pour la démo pilotée en rendez-vous : le lien « Découvrir la
// démonstration » de la page de connexion ouvre le portail SANS compte,
// sur un client fictif complet (« Aux Délices de Provence », boulangerie-
// pâtisserie à Toulon). apiFetch court-circuite alors TOUS les appels
// /api/* et répond localement avec les mêmes formes JSON que l'API réelle :
//  • rien n'est écrit dans SharePoint, aucun e-mail ne part, aucun jeton
//    n'est demandé — le réseau n'est jamais touché ;
//  • les envois de formulaires MUTENT l'état local : une absence déclarée
//    apparaît aussitôt dans la fiche du salarié, une embauche CDD dans les
//    échéances — l'effet « ça vit » de la vraie plateforme ;
//  • les dates sont relatives au jour de la visite : la démo reste fraîche
//    sans maintenance (échéances toujours à J+18/J+48, etc.) ;
//  • recharger la page remet la démo à zéro (état en mémoire) — pratique
//    entre deux rendez-vous.
// ─────────────────────────────────────────────────────────────────────────────

const CLE_SESSION = "osmoseDemoActif";

export function demoActive() {
  try { return sessionStorage.getItem(CLE_SESSION) === "1"; } catch { return false; }
}
export function entrerDemo() {
  try { sessionStorage.setItem(CLE_SESSION, "1"); } catch { /* stockage bloqué : lien inopérant */ }
}
export function quitterDemo() {
  try { sessionStorage.removeItem(CLE_SESSION); } catch { /* rien à faire */ }
}

export const ENTREPRISE_DEMO = "Aux Délices de Provence";

export const UTILISATEUR_DEMO = {
  displayName: "Camille Renard",
  givenName: "Camille",
  email: "camille.renard@delices-demo.fr",
  tenantLabel: "Démonstration",
};

const CODE_CLIENT_DEMO = "DEMO";
const OPTIONS_DEMO = ["embauche", "acompte", "attestation", "paie", "etrangers", "securite"];

/* ── Dates relatives (AAAA-MM-JJ) ─────────────────────────────────────── */
const dansNJours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const enISO = (n) => new Date(Date.now() + n * 86400000).toISOString();
const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const cleSalarie = (texte) => String(texte || "").trim().toUpperCase().replace(/\s+/g, " ");
const cleNomPrenom = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();
const referenceDemo = (prefixe) => `${prefixe}-${Date.now().toString(36).toUpperCase()}`;

/* ── État de la démo — construit à la première requête, muté par les
      formulaires, remis à zéro au rechargement de la page ─────────────── */
let etat = null;
const etatDemo = () => (etat ??= etatInitial());

function etatInitial() {
  const salaries = [
    { nom: "BERTRAND", prenom: "Sophie", matricule: "DP-001", type: "CDI", poste: "Responsable de boutique", debut: "2019-03-04", fin: null },
    { nom: "MOREAU", prenom: "Julien", matricule: "DP-002", type: "CDI", poste: "Boulanger", debut: "2020-09-14", fin: null },
    { nom: "GARCIA", prenom: "Léa", matricule: "DP-003", type: "CDI", poste: "Pâtissière", debut: "2021-06-01", fin: null },
    { nom: "KACI", prenom: "Nadia", matricule: "DP-004", type: "CDI", poste: "Assistante administrative", debut: "2022-01-10", fin: null },
    { nom: "NGUYEN", prenom: "Linh", matricule: "DP-005", type: "CDI", poste: "Vendeuse", debut: "2023-02-13", fin: null },
    { nom: "ROUX", prenom: "Thomas", matricule: "DP-006", type: "CDD", poste: "Vendeur", debut: dansNJours(-140), fin: dansNJours(18) },
    { nom: "FONTAINE", prenom: "Hugo", matricule: "DP-007", type: "Alternance", poste: "Apprenti boulanger", debut: "2025-09-01", fin: "2027-08-31" },
    { nom: "BLANCHARD", prenom: "Emma", matricule: "DP-008", type: "CDD", poste: "Vendeuse (renfort été)", debut: dansNJours(-30), fin: dansNJours(48) },
  ].map((s) => ({ cle: cleNomPrenom(s.nom, s.prenom), statut: "Actif", ...s }));

  /* Embauches des 6 derniers mois (barres du tableau de bord) — libellés
     calés sur le mois courant, comme l'API réelle. */
  const maintenant = new Date();
  const volumes = [1, 0, 2, 1, 1, 2];
  const parMois = volumes.map((n, i) => ({
    m: MOIS_COURTS[new Date(maintenant.getFullYear(), maintenant.getMonth() - (5 - i), 1).getMonth()],
    n,
  }));

  return {
    dashboard: {
      client: CODE_CLIENT_DEMO,
      raisonSociale: ENTREPRISE_DEMO,
      options: OPTIONS_DEMO,
      embauches: {
        total: 12,
        enAttente: 1,
        moisCourant: 2,
        parMois,
        repartition: { CDI: 6, CDD: 4, Alternance: 2 },
        prochaines: [
          { nom: "DA SILVA", prenom: "Paulo", type: "CDD", debut: dansNJours(12) },
        ],
      },
      acomptes: { enAttente: 1, montantEnAttente: 300, traites: 7 },
      attestations: { total: 9, moisCourant: 1 },
      aTraiter: [
        { t: "Embauche CDD DA SILVA Paulo — en attente d'approbation", s: "À traiter" },
        { t: "Acompte MOREAU Julien — 300 € à traiter", s: "À traiter" },
      ],
    },

    personnel: {
      salaries,
      absences: [
        { cle: "NGUYEN LINH", salarie: "NGUYEN Linh", du: dansNJours(-3), au: dansNJours(-3), motif: "Enfant malade", justificatifUrl: "", statut: "Nouvelle", reference: "ABS-DEMO03" },
        { cle: "MOREAU JULIEN", salarie: "MOREAU Julien", du: dansNJours(-6), au: dansNJours(1), motif: "Maladie (arrêt de travail)", justificatifUrl: "https://espace.osmoserh.fr/documents", statut: "Nouvelle", reference: "ABS-DEMO02" },
        { cle: "GARCIA LÉA", salarie: "GARCIA Léa", du: dansNJours(-20), au: dansNJours(-13), motif: "Congés payés", justificatifUrl: "", statut: "Traitée", reference: "ABS-DEMO01" },
      ],
      visites: [
        { cle: "FONTAINE HUGO", salarie: "FONTAINE Hugo", date: dansNJours(9), statut: "À planifier", reference: "VIS-DEMO02" },
        { cle: "BERTRAND SOPHIE", salarie: "BERTRAND Sophie", date: dansNJours(-90), statut: "Réalisée", reference: "VIS-DEMO01" },
      ],
      mutuelles: [
        { cle: "BLANCHARD EMMA", salarie: "BLANCHARD Emma", mutuelle: "Harmonie Mutuelle", date: dansNJours(-28), statut: "Demande", reference: "MUT-DEMO02" },
        { cle: "ROUX THOMAS", salarie: "ROUX Thomas", mutuelle: "Harmonie Mutuelle", date: dansNJours(-135), statut: "Traitée", reference: "MUT-DEMO01" },
      ],
      habilitations: [
        { cle: "ROUX THOMAS", salarie: "ROUX Thomas", type: "CACES R489 (chariots élévateurs)", numero: "489-2022-0871", organisme: "AFTRAL", obtention: dansNJours(-1750), expiration: dansNJours(75), alerte: "J-90 " + new Date().toISOString(), reference: "HAB-DEMO02" },
        { cle: "GARCIA LÉA", salarie: "GARCIA Léa", type: "SST (sauveteur secouriste du travail)", numero: "", organisme: "Croix-Rouge", obtention: dansNJours(-740), expiration: dansNJours(-10), alerte: "EXPIRE " + new Date().toISOString(), reference: "HAB-DEMO01" },
      ],
      avenants: [
        { cle: "NGUYEN LINH", salarie: "NGUYEN Linh", type: "Durée du travail", dateEffet: dansNJours(20), statut: "En cours", reference: "AVE-DEMO01" },
      ],
      fins: [
        { cle: "LEFEBVRE MARC", salarie: "LEFEBVRE MARC", type: "CDD", motif: "Fin de CDD (terme prévu)", date: dansNJours(-25), statut: "Traitée", reference: "FIN-DEMO01" },
      ],
    },

    echeances: {
      echeances: [
        { salarie: "ROUX Thomas", poste: "Vendeur", dateFin: dansNJours(18), joursRestants: 18, alerte: new Date(Date.now() - 5 * 86400000).toISOString() },
        { salarie: "BLANCHARD Emma", poste: "Vendeuse (renfort été)", dateFin: dansNJours(48), joursRestants: 48, alerte: null },
      ],
      recentes: [
        { salarie: "LEFEBVRE Marc", poste: "Vendeur", dateFin: dansNJours(-25), joursRestants: -25, alerte: dansNJours(-56) },
      ],
      titres: [
        { salarie: "OKAFOR Chidi", type: "Carte de séjour pluriannuelle", numero: "9901234567", dateExpiration: dansNJours(48), finDroits: dansNJours(48), etat: "a-renouveler", joursRestants: 48, alerte: "J-90 " + new Date().toISOString() },
      ],
      essais: [
        { salarie: "BLANCHARD Emma", poste: "Vendeuse (renfort été)", dateFin: dansNJours(9), joursRestants: 9, alerte: "J-15 " + new Date().toISOString() },
      ],
      visitesMedicales: [
        { salarie: "ROUX Thomas", poste: "Vendeur", echeance: dansNJours(35), joursRestants: 35, alerte: null },
        { salarie: "LEROY Anne", poste: "Chargée de com", echeance: dansNJours(-12), joursRestants: -12, alerte: "RETARD " + new Date().toISOString() },
      ],
      habilitations: [
        { salarie: "ROUX Thomas", type: "CACES R489 (chariots élévateurs)", numero: "489-2022-0871", dateExpiration: dansNJours(75), joursRestants: 75, alerte: "J-90 " + new Date().toISOString() },
        { salarie: "GARCIA Léa", type: "SST (sauveteur secouriste du travail)", numero: "", dateExpiration: dansNJours(-10), joursRestants: -10, alerte: "EXPIRE " + new Date().toISOString() },
      ],
      entretiens: [
        { salarie: "BERTRAND Sophie", poste: "Responsable boutique", echeance: dansNJours(50), joursRestants: 50, alerte: null },
        { salarie: "MOREAU Julien", poste: "Magasinier", echeance: dansNJours(-30), joursRestants: -30, alerte: "RETARD " + new Date().toISOString() },
      ],
      reprises: [
        { salarie: "MOREAU Julien", motif: "Maladie (arrêt de travail)", dureeJours: 68, retourLe: dansNJours(1), echeance: dansNJours(9), joursRestants: 9, alerte: null },
      ],
    },

    /* Brique « Salariés étrangers » : trois états pour la démonstration
       (à renouveler, en renouvellement, valide). */
    etrangers: {
      seuil: 90,
      titres: ["Carte de séjour pluriannuelle", "Carte de séjour temporaire", "Carte de résident", "VLS-TS (visa long séjour valant titre)", "Récépissé avec autorisation de travail", "Autorisation provisoire de séjour", "Carte de séjour citoyen UE/famille", "Autre"],
      salaries: [
        { id: "demo-etr-1", cle: "OKAFOR CHIDI", nom: "OKAFOR", prenom: "Chidi", poste: "Menuisier", nationalite: "Nigériane",
          titre: { type: "Carte de séjour pluriannuelle", numero: "9901234567", expiration: dansNJours(48), pj: "" },
          recepisse: { numero: "", fin: null, pj: "" }, droitTravail: "Plein", droitSuggere: false, autorisationTravail: "Non requise",
          etat: "a-renouveler", joursRestants: 48, finDroits: dansNJours(48), alerte: "J-90 " + new Date().toISOString() },
        { id: "demo-etr-2", cle: "PETROV IVAN", nom: "PETROV", prenom: "Ivan", poste: "Poseur", nationalite: "Serbe",
          titre: { type: "Carte de séjour temporaire", numero: "8804522190", expiration: dansNJours(-5), pj: "" },
          recepisse: { numero: "R-2026-1187", fin: dansNJours(80), pj: "" }, droitTravail: "Plein", droitSuggere: false, autorisationTravail: "Accordée",
          etat: "en-renouvellement", joursRestants: 80, finDroits: dansNJours(80), alerte: null },
        { id: "demo-etr-3", cle: "TANAKA YUKI", nom: "TANAKA", prenom: "Yuki", poste: "Assistante ADV", nationalite: "Japonaise",
          titre: { type: "VLS-TS (visa long séjour valant titre)", numero: "7712093344", expiration: dansNJours(210), pj: "" },
          recepisse: { numero: "", fin: null, pj: "" }, droitTravail: "", droitSuggere: true, autorisationTravail: "",
          etat: "valide", joursRestants: 210, finDroits: dansNJours(210), alerte: null },
      ],
    },

    /* Fils « Mon gestionnaire » : un en attente, un répondu (la réponse
       vit dans le fil), un clos — le nuancier complet de la messagerie. */
    fils: [
      {
        id: "fil-demo-3", objet: "Transmission d'informations", reference: "MSG-DEMO03",
        statut: "Nouveau", clos: false, nonLu: false,
        message: "Bonjour,\nEmma Blanchard prolonge son renfort jusqu'à fin septembre — je vous envoie l'avenant signé dès que je l'ai. Pouvez-vous le prévoir côté paie ?",
        creeLe: enISO(-1), derniereMaj: enISO(-1), dernierAuteur: "client", echanges: [],
      },
      {
        id: "fil-demo-2", objet: "Question sur la paie", reference: "MSG-DEMO02",
        statut: "Répondu", clos: false, nonLu: true,
        message: "Bonjour,\nPouvez-vous vérifier le calcul des heures supplémentaires de Julien Moreau sur le bulletin de juin ? Il me semble qu'il manque 4 heures à 25 %.\nMerci !",
        creeLe: enISO(-6), derniereMaj: enISO(-5), dernierAuteur: "gestionnaire",
        echanges: [
          { qui: "gestionnaire", quand: enISO(-5), texte: "Bonjour Camille,\nBien vu : les 4 heures du 14 juin n'avaient pas été remontées. Elles sont régularisées sur le bulletin de juillet, avec la majoration à 25 %.\nBonne journée !" },
        ],
      },
      {
        id: "fil-demo-1", objet: "Attestation pour la banque", reference: "MSG-DEMO01",
        statut: "Répondu", clos: true, nonLu: false,
        message: "Bonjour,\nSophie Bertrand a besoin d'une attestation employeur pour son dossier de prêt immobilier. C'est possible cette semaine ?",
        creeLe: enISO(-34), derniereMaj: enISO(-33), dernierAuteur: "gestionnaire",
        echanges: [
          { qui: "gestionnaire", quand: enISO(-33), texte: "Bonjour,\nC'est fait : l'attestation est déposée dans vos documents (dossier Attestations) et envoyée à Sophie. Bonne fin de semaine !" },
        ],
      },
    ],

    documents: [
      { id: "demo-doc-1", nom: "Contrat_ROUX_Thomas_CDD.pdf", categorie: "Contrats", taille: 182_400, modifie: new Date(Date.now() - 140 * 86400000).toISOString() },
      { id: "demo-doc-2", nom: "Contrat_FONTAINE_Hugo_Alternance.pdf", categorie: "Contrats", taille: 214_812, modifie: "2025-08-28T09:15:00Z" },
      { id: "demo-doc-3", nom: "Attestation_GARCIA_Lea.pdf", categorie: "Attestations", taille: 96_130, modifie: new Date(Date.now() - 11 * 86400000).toISOString() },
      { id: "demo-doc-4", nom: "Bulletins_juin_2026.pdf", categorie: "Paie", taille: 1_204_540, modifie: new Date(Date.now() - 12 * 86400000).toISOString() },
      { id: "demo-doc-5", nom: "Solde_tout_compte_LEFEBVRE.pdf", categorie: "Paie", taille: 88_920, modifie: new Date(Date.now() - 22 * 86400000).toISOString() },
      { id: "demo-doc-6", nom: "Reglement_interieur_2026.pdf", categorie: "Général", taille: 342_010, modifie: "2026-01-15T14:02:00Z" },
    ],
    compteurDoc: 7,
  };
}

/* ── Réponses simulées ────────────────────────────────────────────────── */
const json = (status, corps) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

/** Remplaçant local de fetch("/api/…") quand la démo est active. */
export async function reponseDemo(chemin, options = {}) {
  // Petite latence pour un ressenti réaliste (spinners visibles).
  await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 250)));
  const url = new URL(chemin, window.location.origin);
  const e = etatDemo();

  switch (url.pathname) {
    case "/api/me":
      if (url.searchParams.get("vue") === "messages") {
        return json(200, { fils: [...e.fils].sort((a, b) => b.derniereMaj.localeCompare(a.derniereMaj)) });
      }
      if (url.searchParams.get("vue") === "etrangers") {
        return json(200, e.etrangers);
      }
      return json(200, {
        email: UTILISATEUR_DEMO.email,
        client: CODE_CLIENT_DEMO,
        raisonSociale: ENTREPRISE_DEMO,
        options: OPTIONS_DEMO,
        messagesNonLus: e.fils.filter((f) => f.nonLu).length,
      });

    case "/api/dashboard":
      return json(200, e.dashboard);

    case "/api/personnel":
      return json(200, e.personnel);

    case "/api/echeances":
      return json(200, e.echeances);

    case "/api/documents":
      return json(200, { client: CODE_CLIENT_DEMO, documents: e.documents });

    case "/api/document": {
      const doc = e.documents.find((d) => d.id === url.searchParams.get("id"));
      if (!doc) return json(404, { erreur: "Document introuvable." });
      return new Response(pdfDemo(doc.nom), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    }

    case "/api/depot": {
      const nom = url.searchParams.get("nom") || "document.pdf";
      e.documents.unshift({
        id: `demo-doc-${e.compteurDoc++}`,
        nom,
        categorie: "Dépôts",
        taille: options.body?.size || 24_576,
        modifie: new Date().toISOString(),
      });
      return json(200, { ok: true, nom });
    }

    case "/api/demande":
      return traiterDemande(e, options);

    default:
      return json(404, { erreur: "Démarche non disponible en démonstration." });
  }
}

/* ── POST /api/demande : mêmes références que l'API réelle, et l'état
      local est muté pour que la démarche apparaisse aussitôt dans les
      vues (fiche salarié, échéances, tableau de bord) ─────────────────── */
function traiterDemande(e, options) {
  let d;
  try { d = JSON.parse(options.body); } catch { return json(400, { erreur: "JSON attendu" }); }
  const p = e.personnel;

  // Mise à jour du dossier salarié (onglet Dossier) — mutée en mémoire
  // pour que la fiche reflète aussitôt la saisie, comme en réel.
  if (d.action === "majSalarie") {
    const s = (p.salaries || []).find((x) => x.cle === d.cle);
    if (s) s.fiche = { ...(s.fiche || {}), ...(d.fiche || {}) };
    return json(200, { ok: true });
  }

  // Pré-embauche par invitation : fiche minimale créée + lien factice —
  // en réel, le contrat part automatiquement à la soumission du salarié.
  if (d.action === "onboardingEmbauche") {
    p.salaries.push({
      cle: cleNomPrenom(d.nom, d.prenom),
      nom: String(d.nom || "").toUpperCase(), prenom: d.prenom || "",
      matricule: "", type: d.typeContrat, poste: d.poste || "",
      debut: d.dateDebut, fin: d.dateFin || null, statut: "Actif",
    });
    p.salaries.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    return json(201, {
      lien: `${window.location.origin}/?onboarding=demo000000000000000000000000000000000000000000000`,
      expireLe: new Date(Date.now() + 14 * 86400000).toISOString(),
      reference: referenceDemo("INV"), deja: false,
    });
  }

  // Onboarding : lien d'invitation factice (le formulaire public n'est
  // pas simulé — la démo montre le geste côté employeur).
  if (d.action === "onboardingInviter") {
    return json(201, {
      lien: `${window.location.origin}/?onboarding=demo000000000000000000000000000000000000000000000`,
      expireLe: new Date(Date.now() + 14 * 86400000).toISOString(),
      reference: referenceDemo("INV"), deja: false,
    });
  }

  // Brique « Salariés étrangers » : récépissé ou nouveau titre — l'état
  // est recalculé comme côté serveur (le récépissé prolonge les droits).
  if (d.action === "titreRenouvellement") {
    const s = (e.etrangers.salaries || []).find((x) => String(x.id) === String(d.id));
    if (!s) return json(404, { erreur: "Fiche salarié introuvable." });
    if (d.mode === "recepisse") {
      s.recepisse = { numero: d.recepisseNumero || "", fin: d.recepisseFin, pj: d.pj || "" };
      s.etat = "en-renouvellement";
      s.finDroits = d.recepisseFin;
      s.alerte = null;
    } else {
      s.titre = { type: d.titreType, numero: d.titreNumero || "", expiration: d.titreExpiration, pj: d.pj || "" };
      s.recepisse = { numero: "", fin: null, pj: "" };
      const jours = Math.round((new Date(d.titreExpiration) - Date.now()) / 86400000);
      s.etat = jours <= 90 ? "a-renouveler" : "valide";
      s.joursRestants = jours;
      s.finDroits = d.titreExpiration;
      s.alerte = null;
    }
    return json(200, { ok: true });
  }

  // Fil de discussion : réponse et statut mutés en mémoire, mêmes règles
  // que l'API réelle (fil clos refusé, relance → statut « Nouveau »).
  if (d.action === "messageRepondre") {
    const f = e.fils.find((x) => String(x.id) === String(d.id));
    if (!f) return json(404, { erreur: "Fil introuvable." });
    if (f.clos) return json(400, { erreur: "Fil clos — écrivez un nouveau message." });
    const quand = new Date().toISOString();
    f.echanges.push({ qui: "client", quand, texte: String(d.texte || "").trim() });
    f.derniereMaj = quand; f.dernierAuteur = "client"; f.statut = "Nouveau";
    return json(200, { ok: true, quand });
  }
  if (d.action === "messageStatut") {
    const f = e.fils.find((x) => String(x.id) === String(d.id));
    if (!f) return json(404, { erreur: "Fil introuvable." });
    if (typeof d.clos === "boolean") f.clos = d.clos;
    if (d.lu === true) f.nonLu = false;
    return json(200, { ok: true });
  }

  switch (d.demarche) {
    case "absences": {
      const reference = referenceDemo("ABS");
      p.absences.unshift({
        cle: cleSalarie(d.salarie), salarie: String(d.salarie || "").trim(),
        du: d.dateDebut, au: d.dateFin || null, motif: d.motif,
        justificatifUrl: d.justificatifUrl || "", statut: "Nouvelle", reference,
      });
      return json(202, { reference });
    }

    case "visite-medicale": {
      const reference = referenceDemo("VIS");
      p.visites.unshift({
        cle: cleSalarie(d.salarie), salarie: String(d.salarie || "").trim(),
        date: d.dateVisite, statut: "À planifier", reference,
      });
      return json(202, { reference });
    }

    case "mutuelle": {
      const reference = referenceDemo("MUT");
      p.mutuelles.unshift({
        cle: cleSalarie(d.salarie), salarie: String(d.salarie || "").trim(),
        mutuelle: d.mutuelle, date: d.dateAdhesion || dansNJours(0),
        statut: "Demande", reference,
      });
      return json(202, { reference });
    }

    case "habilitation": {
      const reference = referenceDemo("HAB");
      const expiration = d.dateExpiration;
      p.habilitations.unshift({
        cle: cleSalarie(d.salarie), salarie: String(d.salarie || "").trim(),
        type: d.typeHabilitation || "", numero: d.numero || "", organisme: d.organisme || "",
        obtention: d.dateObtention || null, expiration, alerte: null, reference,
      });
      // La plus récente par salarié + type pilote l'échéance : on remplace
      // l'éventuelle ligne du même couple dans la page Échéances.
      const salarie = String(d.salarie || "").trim();
      e.echeances.habilitations = [
        ...e.echeances.habilitations.filter((h) => !(h.salarie.toUpperCase() === salarie.toUpperCase() && h.type === d.typeHabilitation)),
        ...(expiration ? [{ salarie, type: d.typeHabilitation || "", numero: d.numero || "",
          dateExpiration: expiration,
          joursRestants: Math.round((new Date(expiration) - new Date(dansNJours(0))) / 86400000),
          alerte: null }] : []),
      ].filter((h) => h.joursRestants <= 120).sort((a, b) => a.dateExpiration.localeCompare(b.dateExpiration));
      return json(202, { reference });
    }

    case "avenant": {
      const reference = referenceDemo("AVE");
      p.avenants.unshift({
        cle: cleSalarie(d.salarie), salarie: String(d.salarie || "").trim(),
        type: d.typeAvenant || "", dateEffet: d.dateEffet, statut: "Nouvelle", reference,
      });
      return json(202, { reference });
    }

    case "fin-contrat": {
      const reference = referenceDemo("FIN");
      p.fins.unshift({
        cle: cleNomPrenom(d.nom, d.prenom), salarie: cleNomPrenom(d.nom, d.prenom),
        type: d.typeContrat, motif: d.motif, date: d.dateFin, statut: "Nouvelle", reference,
      });
      return json(202, { reference });
    }

    case "embauche": {
      const reference = referenceDemo("EMB");
      p.salaries.push({
        cle: cleNomPrenom(d.nom, d.prenom),
        nom: String(d.nom || "").toUpperCase(), prenom: d.prenom || "",
        matricule: "", type: d.typeContrat, poste: d.poste || "",
        debut: d.dateDebut, fin: d.dateFin || null, statut: "Actif",
      });
      p.salaries.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
      const emb = e.dashboard.embauches;
      emb.total += 1; emb.enAttente += 1; emb.moisCourant += 1;
      emb.parMois[emb.parMois.length - 1].n += 1;
      emb.repartition[d.typeContrat] = (emb.repartition[d.typeContrat] || 0) + 1;
      e.dashboard.aTraiter.unshift({
        t: `Embauche ${d.typeContrat} ${String(d.nom || "").toUpperCase()} ${d.prenom || ""} — en attente d'approbation`,
        s: "À traiter",
      });
      const aujourdhui = dansNJours(0);
      if (d.dateDebut >= aujourdhui) {
        emb.prochaines = [...emb.prochaines, { nom: String(d.nom || "").toUpperCase(), prenom: d.prenom || "", type: d.typeContrat, debut: d.dateDebut }]
          .sort((a, b) => a.debut.localeCompare(b.debut)).slice(0, 3);
      }
      if (d.typeContrat === "CDD" && d.dateFin && d.dateFin >= aujourdhui) {
        e.echeances.echeances = [...e.echeances.echeances, {
          salarie: `${String(d.nom || "").toUpperCase()} ${d.prenom || ""}`.trim(),
          poste: d.poste || "",
          dateFin: d.dateFin,
          joursRestants: Math.round((new Date(d.dateFin) - new Date(aujourdhui)) / 86400000),
          alerte: null,
        }].sort((a, b) => a.dateFin.localeCompare(b.dateFin));
      }
      return json(202, { reference });
    }

    case "acompte": {
      const reference = referenceDemo("ACOMPTE");
      const montant = parseFloat(String(d.montant ?? d.montantDemande ?? 0).replace(",", ".")) || 0;
      const aco = e.dashboard.acomptes;
      aco.enAttente += 1;
      aco.montantEnAttente = Math.round((aco.montantEnAttente + montant) * 100) / 100;
      e.dashboard.aTraiter.push({
        t: `Acompte ${String(d.nom || "").toUpperCase()} ${d.prenom || ""} — ${montant} € à traiter`,
        s: "À traiter",
      });
      return json(202, { reference });
    }

    case "attestation-employeur": {
      e.dashboard.attestations.total += 1;
      e.dashboard.attestations.moisCourant += 1;
      return json(202, { reference: referenceDemo("ATTESTATION") });
    }

    case "variables-paie":
      return json(202, { reference: referenceDemo("VAR"), lignes: (d.lignes || []).length });

    case "contact": {
      const reference = referenceDemo("MSG");
      const quand = new Date().toISOString();
      e.fils.unshift({
        id: `fil-${reference}`, objet: d.objet || "(sans objet)", reference,
        statut: "Nouveau", clos: false, nonLu: false,
        message: String(d.message || ""), creeLe: quand, derniereMaj: quand,
        dernierAuteur: "client", echanges: [],
      });
      return json(202, { reference });
    }

    default: {
      const prefixe = String(d.demarche || "DEM").split("-")[0].toUpperCase() || "DEM";
      return json(202, { reference: referenceDemo(prefixe) });
    }
  }
}

/* ── PDF minimal généré à la volée pour le bouton Télécharger ─────────── */
function pdfDemo(nomFichier) {
  // Texte ASCII uniquement (encodage PDF standard) : accents translittérés.
  const ascii = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
  const echapper = (s) => ascii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const lignes = [
    "Osmose RH - Document de demonstration",
    echapper(nomFichier),
    "Ce fichier est genere par le mode demonstration du portail.",
    "Aucune donnee reelle : le contenu veritable est produit en production.",
  ];
  const contenu =
    "BT /F1 14 Tf 64 760 Td (" + lignes[0] + ") Tj " +
    "0 -30 Td /F1 11 Tf (" + lignes[1] + ") Tj " +
    "0 -40 Td (" + lignes[2] + ") Tj " +
    "0 -18 Td (" + lignes[3] + ") Tj ET";
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
  ];
  let corps = "%PDF-1.4\n";
  const offsets = [];
  objets.forEach((o, i) => {
    offsets.push(corps.length);
    corps += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const debutXref = corps.length;
  corps += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) corps += `${String(off).padStart(10, "0")} 00000 n \n`;
  corps += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF`;
  return new Blob([corps], { type: "application/pdf" });
}
