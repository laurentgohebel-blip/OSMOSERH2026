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
    // Anciens salariés — matière du parcours « réembauche ». PEREZ sort
    // d'un CDD récent : un nouveau CDD sur le même poste se heurte au
    // délai de carence. LEFEVRE sortait d'un CDI : rien ne s'y oppose.
    { nom: "PEREZ", prenom: "Manon", matricule: "DP-009", type: "CDD", poste: "Vendeuse (renfort)",
      debut: dansNJours(-70), fin: dansNJours(-8), statut: "Sorti" },
    { nom: "LEFEVRE", prenom: "Antoine", matricule: "DP-010", type: "CDI", poste: "Boulanger",
      debut: "2021-01-05", fin: dansNJours(-400), statut: "Sorti" },
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
        { cle: "FONTAINE HUGO", salarie: "FONTAINE Hugo", date: dansNJours(9), type: "Visite d'information et de prévention (embauche)", statut: "À planifier", reference: "VIS-DEMO02" },
        { cle: "BERTRAND SOPHIE", salarie: "BERTRAND Sophie", date: dansNJours(-90), type: "Visite périodique", statut: "Réalisée", reference: "VIS-DEMO01" },
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
      // Lecture automatique simulée : la démo montre le geste (champs
      // proposés, corrigeables) sans appeler de service d'analyse.
      const aAnalyser = url.searchParams.get("analyser");
      const EXTRACTIONS_DEMO = {
        arret: { dateDebut: dansNJours(-2), dateFin: dansNJours(12), motif: "Maladie (arrêt de travail)" },
        rib: { iban: "FR7630006000011234567890189", bic: "AGRIFRPP" },
        vitale: { numeroSS: "294051234567846" },
        identite: { nomNaissance: "DUPONT", dateNaissance: "1994-05-12", sexe: "Féminin", communeNaissance: "Toulon" },
      };
      return json(200, {
        ok: true, nom,
        ...(aAnalyser ? { extraction: EXTRACTIONS_DEMO[aAnalyser]
          ? { champs: EXTRACTIONS_DEMO[aAnalyser] }
          : { champs: null, motif: "type de pièce inconnu" } } : {}),
      });
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
/* Le front désigne l'ancien salarié par son identifiant de fiche quand
   il en a un, sinon par « Nom Prénom » — la clé démo, elle, est tout en
   majuscules. On compare donc sans tenir compte de la casse. */
const memeSalarie = (s, reprise) => {
  const cible = String(reprise || "").trim().toUpperCase();
  return String(s.id || "") === String(reprise) || String(s.cle || "").toUpperCase() === cible
    || `${s.nom} ${s.prenom}`.toUpperCase() === cible;
};

/* Points de vigilance d'une réembauche — VERSION DÉMO. Le calcul qui
   fait foi vit dans api/src/reembauche.js ; celui-ci n'en montre que le
   résultat, comme le reste du mode démonstration. */
function pointsReembaucheDemo(ancien, d) {
  const points = [];
  const jours = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  if (ancien.type === "CDD" && d.typeContrat === "CDD" && ancien.debut && ancien.fin) {
    const duree = jours(ancien.debut, ancien.fin) + 1;
    const delai = duree >= 14 ? Math.ceil(duree / 3) : Math.ceil(duree / 2);
    const auPlusTot = new Date(Date.parse(ancien.fin) + (delai + 1) * 86400000).toISOString().slice(0, 10);
    const fr = (x) => x.split("-").reverse().join("/");
    const respecte = d.dateDebut ? d.dateDebut >= auPlusTot : null;
    points.push({
      cle: "carence", niveau: respecte === false ? "bloquant" : "info",
      titre: respecte === false ? "Délai de carence non respecté" : "Délai de carence",
      detail: `Le contrat précédent a duré ${duree} jours : le délai de carence est de ${delai} jours d'ouverture de l'entreprise (un tiers de la durée). Un nouveau CDD sur le même poste ne peut pas commencer avant le ${fr(auPlusTot)} — et plus tard encore si l'entreprise n'ouvre pas tous les jours. Une exception légale peut s'appliquer.`,
    });
  }
  if (ancien.type === "CDD" && d.typeContrat === "CDI") {
    points.push({ cle: "essai", niveau: "attention", titre: "Période d'essai à réduire",
      detail: "Le salarié a déjà occupé un poste dans l'entreprise : selon les fonctions, la durée du contrat précédent peut devoir être déduite de la période d'essai." });
  }
  points.push({ cle: "visite", niveau: "info", titre: "Visite médicale peut-être non nécessaire",
    detail: "Si le salarié reprend un emploi identique aux mêmes risques et qu'aucun avis d'inaptitude n'est intervenu, une nouvelle visite peut ne pas être requise. À confirmer avec le service de santé au travail." });
  points.push({ cle: "dpae", niveau: "info", titre: "Déclaration préalable à l'embauche",
    detail: "Une nouvelle DPAE est obligatoire, au plus tôt huit jours avant la prise de poste." });
  return points;
}

const EXCEPTIONS_CARENCE_DEMO = [
  "Nouvelle absence du salarié remplacé", "Travaux urgents de sécurité", "Emploi saisonnier",
  "CDD d'usage (secteur le permettant)", "Remplacement d'un chef d'entreprise ou d'exploitation",
  "Rupture anticipée à l'initiative du salarié", "Refus du salarié de renouveler son contrat",
  "Accord de branche prévoyant d'autres modalités",
];

function traiterDemande(e, options) {
  let d;
  try { d = JSON.parse(options.body); } catch { return json(400, { erreur: "JSON attendu" }); }
  const p = e.personnel;

  /* Procédures — VERSION DÉMO. Les délais qui font foi sont calculés
     par api/src/procedures.js ; la démo montre une inaptitude en cours
     avec son compte à rebours, parce que c'est le cas qui parle. */
  if (d.action === "procedure") {
    e.procedures ??= [{
      id: "demo-proc-1", reference: "PROC-DEMO01", nom: "MOREAU", prenom: "Julien",
      type: "inaptitude", libelle: "Inaptitude constatée par le médecin du travail",
      statut: "En cours", ouverture: dansNJours(-22), echeance: dansNJours(8),
      etapes: [
        { cle: "avis", libelle: "Avis d'inaptitude du médecin du travail", statut: "faite", date: dansNJours(-22),
          obligatoire: true, irregularites: [], document: null, auPlusTot: "", auPlusTard: "",
          aide: "La date de l'examen médical fait courir le délai d'un mois." },
        { cle: "recherche-reclassement", libelle: "Recherche de reclassement", statut: "faite", date: dansNJours(-14),
          obligatoire: false, irregularites: [], document: "recherche-reclassement", auPlusTot: "", auPlusTard: "",
          aide: "Obligation de moyens, à consigner PAR ÉCRIT : son absence suffit à priver le licenciement de cause réelle et sérieuse." },
        { cle: "consultation-cse", libelle: "Consultation du CSE sur le reclassement", statut: "sans-objet", date: "",
          obligatoire: false, irregularites: [], document: null, auPlusTot: "", auPlusTard: "",
          aide: "Sans objet dans les entreprises sans CSE." },
        { cle: "proposition-ou-impossibilite", libelle: "Notification de l'impossibilité de reclasser", statut: "a-faire", date: "",
          obligatoire: false, irregularites: [], document: "impossibilite-reclassement", auPlusTot: "", auPlusTard: "" },
        { cle: "convocation", libelle: "Envoi de la convocation à l'entretien préalable", statut: "a-faire", date: "",
          obligatoire: false, irregularites: [], document: "convocation-entretien", auPlusTot: "", auPlusTard: "" },
        { cle: "presentation", libelle: "Présentation de la convocation au salarié", statut: "a-venir", date: "",
          obligatoire: false, irregularites: [], document: null, auPlusTot: "", auPlusTard: "" },
        { cle: "entretien", libelle: "Entretien préalable", statut: "a-venir", date: "",
          obligatoire: false, irregularites: [], document: null, auPlusTot: "", auPlusTard: "" },
        { cle: "notification", libelle: "Notification du licenciement pour inaptitude", statut: "a-faire", date: "",
          obligatoire: true, irregularites: [], document: "notification-inaptitude",
          auPlusTot: "", auPlusTard: dansNJours(8),
          aide: "À défaut de reclassement ou de licenciement dans le mois de l'examen médical, l'employeur reprend le versement du salaire (L.1226-4)." },
        { cle: "documents", libelle: "Remise des documents de fin de contrat", statut: "a-venir", date: "",
          obligatoire: true, irregularites: [], document: "documents-fin-contrat", auPlusTot: "", auPlusTard: "" },
      ],
      alertes: [{ niveau: "proche", etape: "notification", titre: "Notification du licenciement pour inaptitude — 8 jours",
        detail: "Passé ce délai, le versement du salaire doit reprendre tant que le salarié n'est ni reclassé ni licencié (L.1226-4)." }],
    }];
    if (d.mode === "ouvrir") {
      const libelles = { "licenciement-personnel": "Licenciement pour motif personnel", "sanction-disciplinaire": "Sanction disciplinaire",
        "inaptitude": "Inaptitude constatée par le médecin du travail", "rupture-conventionnelle": "Rupture conventionnelle individuelle" };
      const mots = String(d.nom || "").trim().split(/\s+/);
      e.procedures.unshift({ id: `demo-proc-${e.procedures.length + 1}`, reference: referenceDemo("PROC"),
        nom: (mots[0] || "").toUpperCase(), prenom: mots.slice(1).join(" "), type: d.type, libelle: libelles[d.type] || d.type,
        statut: "En cours", ouverture: dansNJours(0), echeance: "", etapes: [], alertes: [] });
      return json(201, { reference: e.procedures[0].reference });
    }
    if (d.mode === "etape") {
      const p = e.procedures.find((x) => x.id === d.id);
      const et = p?.etapes.find((x) => x.cle === d.etape);
      if (et) { et.date = d.valeur === "sans-objet" ? "" : d.valeur; et.statut = d.valeur === "sans-objet" ? "sans-objet" : d.valeur ? "faite" : "a-faire"; }
      return json(200, { ok: true });
    }
    if (d.mode === "document") {
      return json(200, { objet: "Convocation à un entretien préalable", etape: d.etape,
        corps: "Boulangerie Demo\n12 rue de la République, 83000 Toulon\n\nMOREAU Julien\n\nToulon, le " + dansNJours(0).split("-").reverse().join("/") +
          "\nLettre recommandée avec accusé de réception\n\nObjet : convocation à un entretien préalable\n\nMadame, Monsieur,\n\nNous sommes conduits à envisager à votre égard une mesure de licenciement.\n\nNous vous convoquons à un entretien préalable qui se tiendra le …… à ……, au siège de l'entreprise.\n\nVous pouvez vous faire assister par une personne de votre choix appartenant au personnel de l'entreprise. En l'absence de représentant du personnel, vous pouvez vous faire assister par un conseiller de votre choix inscrit sur une liste dressée par le préfet.\n\nNous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.\n\nPour Boulangerie Demo,\nMarie Delaunay\nGérante" });
    }
    return json(200, {
      procedures: e.procedures,
      catalogue: [
        { cle: "licenciement-personnel", libelle: "Licenciement pour motif personnel", resume: "Convocation, entretien préalable, notification, préavis." },
        { cle: "sanction-disciplinaire", libelle: "Sanction disciplinaire", resume: "Des faits connus à la sanction notifiée, deux délais à ne pas manquer." },
        { cle: "inaptitude", libelle: "Inaptitude constatée par le médecin du travail", resume: "Un mois pour reclasser ou licencier, sinon le salaire repart." },
        { cle: "rupture-conventionnelle", libelle: "Rupture conventionnelle individuelle", resume: "Entretien, signature, quinze jours de rétractation, homologation." },
      ],
    });
  }

  /* Saisie sur salaire — VERSION DÉMO. Le calcul qui fait foi (quotité
     par tranches, plancher RSA) vit dans api/src/saisie.js ; la démo
     montre un dossier en cours avec un calcul posé à la main. */
  if (d.action === "saisie") {
    e.saisies ??= [{
      id: "demo-sai-1", reference: "SAI-DEMO1", cle: "MARTIN PAUL", nom: "MARTIN", prenom: "Paul",
      type: "saisie", creancier: "SCP Demo & associés, dossier 2026-117",
      montantDette: 2400, mensualite: 0, netMensuel: 1500, personnesACharge: 0,
      dejaRetenu: 473.88, dateReception: dansNJours(-40), statut: "En cours", dernierMoisTransmis: "",
      // Valeurs produites par api/src/saisie.js, barème 2026 (décret
      // n° 2025-1299) — régénérer d'un `node -e` si le millésime change.
      calcul: {
        type: "saisie", netMensuel: 1500, personnesACharge: 0, majorationMensuelle: 0,
        detail: [
          { de: 0, a: 373.33, fraction: "1/20", assiette: 373.33, part: 18.67 },
          { de: 373.33, a: 727.5, fraction: "1/10", assiette: 354.17, part: 35.42 },
          { de: 727.5, a: 1083.33, fraction: "1/5", assiette: 355.83, part: 71.17 },
          { de: 1083.33, a: 1435.83, fraction: "1/4", assiette: 352.5, part: 88.13 },
          { de: 1435.83, a: 1789.17, fraction: "1/3", assiette: 64.17, part: 21.39 },
        ],
        quotiteBareme: 234.78, rsaMensuel: 651.69, plafonneParRsa: false,
        retenueMax: 234.78, resteAuSalarie: 1265.22,
        restantDu: 1926.12, retenueDuMois: 234.78,
        echeancier: { restantDu: 1926.12, retenueMensuelle: 234.78, mois: 9, dernierMois: 47.88 },
        baremeAnnee: 2026, baremeAVerifier: false,
      },
      obligations: {
        reponse: { limite: dansNJours(-25), enRetard: false,
          texte: "La réponse au commissaire de justice a été adressée dans le délai de 15 jours (existence du contrat, rémunération, absence d'autre saisie)." },
        gestes: [], discretion: "Information strictement confidentielle.",
      },
    }];
    if (d.mode === "declarer") {
      return json(201, { reference: referenceDemo("SAI") });
    }
    if (d.mode === "transmettre") {
      const s = e.saisies.find((x) => x.id === d.id);
      if (s && s.dernierMoisTransmis === d.mois) return json(409, { erreur: "Déjà transmise ce mois-ci." });
      if (s) { s.dernierMoisTransmis = d.mois; s.dejaRetenu = Math.round((s.dejaRetenu + s.calcul.retenueDuMois) * 100) / 100; }
      return json(202, { mois: d.mois, retenue: s ? s.calcul.retenueDuMois : 0, soldee: false, restantDu: s ? Math.round((s.montantDette - s.dejaRetenu) * 100) / 100 : 0 });
    }
    if (d.mode === "cloturer") {
      const s = e.saisies.find((x) => x.id === d.id);
      if (s) s.statut = "Clôturée";
      return json(200, { ok: true });
    }
    return json(200, { saisies: e.saisies, bareme: { annee: 2026, aVerifier: false } });
  }

  /* Notes de frais — VERSION DÉMO. La qualification qui fait foi vit
     dans api/src/frais.js (barèmes URSSAF, part exonérée, part
     réintégrée) ; ici les montants sont posés à la main pour montrer les
     trois cas qui parlent : une note nette, une note qui dépasse le
     plafond et bascule en salaire, une note bloquée faute de ticket. */
  if (d.action === "frais") {
    const CATS = [
      { cle: "repas-restaurant", libelle: "Repas au restaurant (déplacement)", regime: "forfait", unite: "repas", aide: "Le salarié est en déplacement et déjeune au restaurant." },
      { cle: "repas-hors-locaux", libelle: "Repas hors des locaux, sans restaurant", regime: "forfait", unite: "repas", aide: "Chantier, tournée, véhicule : le salarié ne peut ni rentrer ni aller au restaurant." },
      { cle: "km", libelle: "Indemnité kilométrique (véhicule personnel)", regime: "bareme", unite: "km", aide: "Le montant est calculé par le barème : ni le carburant ni l'entretien ne se remboursent en plus." },
      { cle: "transport", libelle: "Transport (train, avion, taxi, péage, parking)", regime: "reel", unite: null, aide: "Au réel, sur justificatif." },
      { cle: "hebergement", libelle: "Hôtel (au réel)", regime: "reel", unite: null, aide: "Facture au nom de l'entreprise ou du salarié." },
      { cle: "fournitures", libelle: "Achat pour l'entreprise", regime: "reel", unite: null, aide: "Le salarié avance un achat professionnel." },
      { cle: "autre", libelle: "Autre frais professionnel", regime: "reel", unite: null, aide: "À qualifier par le gestionnaire." },
    ];
    const qual = (libelle, demande, exonere, extra = {}) => ({
      libelle, demande, exonere, reintegre: Math.round((demande - exonere) * 100) / 100,
      limite: null, quantite: 1, unite: "", justificatifRequis: false,
      baremeAnnee: 2025, baremeAVerifier: true, motifRequis: false, ...extra,
    });
    e.frais ??= [
      { id: "demo-frais-1", reference: "FRAIS-DEMO1", cle: "MARTIN PAUL", nom: "MARTIN", prenom: "Paul",
        categorie: "repas-restaurant", date: dansNJours(-5), montant: 28, commercant: "Le Bistrot du Port",
        justificatif: "Frais_MARTIN-Paul_ticket.jpg", statut: "Nouvelle", source: "Salarié",
        qualification: qual("Repas au restaurant (déplacement)", 28, 21.10, { limite: 21.10, quantite: 1, unite: "repas", justificatifRequis: true }),
        points: [{ niveau: "vigilance", texte: "Dépassement de 6.90 € au-delà de la limite d'exonération (21.10 € pour 1 repas). Cette part est du salaire : elle partira en brut soumis, pas en frais." }],
        bloquants: 0, validable: true },
      { id: "demo-frais-2", reference: "FRAIS-DEMO2", cle: "DUPONT MARIE", nom: "DUPONT", prenom: "Marie",
        categorie: "km", date: dansNJours(-4), km: 140, cv: 5, motif: "Client Durand, Hyères",
        montant: 89.04, justificatif: "", statut: "Nouvelle", source: "Employeur",
        qualification: qual("Indemnité kilométrique (véhicule personnel)", 89.04, 89.04, { quantite: 140, unite: "km", motifRequis: true, detail: { puissance: 5 } }),
        points: [], bloquants: 0, validable: true },
      { id: "demo-frais-3", reference: "FRAIS-DEMO3", cle: "MARTIN PAUL", nom: "MARTIN", prenom: "Paul",
        categorie: "transport", date: dansNJours(-3), montant: 42.60, commercant: "SNCF",
        justificatif: "", statut: "Nouvelle", source: "Salarié",
        qualification: qual("Transport (train, avion, taxi, péage, parking)", 42.60, 42.60, { justificatifRequis: true }),
        points: [{ niveau: "bloquant", texte: "Justificatif manquant. Sans pièce, le remboursement est un avantage soumis à cotisations." }],
        bloquants: 1, validable: false },
    ];

    if (d.mode === "saisir") {
      const s = (p.salaries || []).find((x) => x.cle === d.cle) || {};
      const c = CATS.find((x) => x.cle === d.categorie) || CATS[CATS.length - 1];
      const montant = c.regime === "bareme" ? Math.round((Number(d.km) || 0) * 0.636 * 100) / 100 : Number(String(d.montant).replace(",", ".")) || 0;
      e.frais.unshift({ id: `demo-frais-${e.frais.length + 1}`, reference: referenceDemo("FRAIS"),
        cle: d.cle, nom: s.nom || d.cle, prenom: s.prenom || "", categorie: c.cle, date: d.date,
        montant, km: Number(d.km) || 0, cv: Number(d.cv) || 0, motif: d.motif || "", commercant: d.commercant || "",
        justificatif: "", statut: "Nouvelle", source: "Employeur",
        qualification: qual(c.libelle, montant, montant, { justificatifRequis: c.regime === "reel", detail: { puissance: Number(d.cv) || 5 } }),
        points: c.regime === "reel"
          ? [{ niveau: "bloquant", texte: "Justificatif manquant. Sans pièce, le remboursement est un avantage soumis à cotisations." }]
          : [],
        bloquants: c.regime === "reel" ? 1 : 0, validable: c.regime !== "reel" });
      return json(201, { reference: e.frais[0].reference });
    }
    if (d.mode === "statuer") {
      const ids = Array.isArray(d.ids) ? d.ids : [d.id];
      let traitees = 0; const refusees = [];
      for (const id of ids) {
        const n = e.frais.find((x) => x.id === id);
        if (!n) continue;
        if (d.statut === "Validée" && !n.validable) { refusees.push({ id, reference: n.reference, motif: n.points[0]?.texte || "Note incomplète." }); continue; }
        n.statut = d.statut; traitees++;
      }
      return json(200, { traitees, refusees });
    }
    if (d.mode === "apercu" || d.mode === "variables") {
      const parSal = new Map();
      for (const n of e.frais.filter((x) => x.statut === "Validée")) {
        const cur = parSal.get(n.cle) || { nom: n.nom, prenom: n.prenom, matricule: "", fraisPro: 0, reintegre: 0, detail: [] };
        cur.fraisPro += n.qualification.exonere;
        cur.reintegre += n.qualification.reintegre;
        cur.detail.push(`${n.date} ${n.qualification.libelle} ${n.qualification.demande.toFixed(2)} €`);
        parSal.set(n.cle, cur);
      }
      const lignes = [...parSal.values()].map((l) => ({
        nom: l.nom, prenom: l.prenom, matricule: l.matricule,
        fraisPro: Math.round(l.fraisPro * 100) / 100,
        ...(l.reintegre > 0 ? { primeLibelle: "Frais au-delà du plafond (soumis)", primeMontant: Math.round(l.reintegre * 100) / 100 } : {}),
        commentaire: `${l.detail.length} note${l.detail.length > 1 ? "s" : ""} de frais — ${l.detail.join(" · ")}`,
      }));
      if (!lignes.length) return json(400, { erreur: "Aucune note validée à transmettre pour ce mois." });
      if (d.mode === "variables") { e.frais.forEach((n) => { if (n.statut === "Validée") n.statut = "En paie"; }); return json(202, { mois: d.mois, lignes: lignes.length }); }
      return json(200, { mois: d.mois, lignes });
    }

    const enAttente = e.frais.filter((n) => n.statut === "Nouvelle");
    const validees = e.frais.filter((n) => n.statut === "Validée");
    const somme = (liste, champ) => Math.round(liste.reduce((s, n) => s + n.qualification[champ], 0) * 100) / 100;
    return json(200, {
      notes: e.frais, categories: CATS,
      bareme: { annee: 2025, aVerifier: true },
      resume: {
        enAttente: enAttente.length,
        bloquees: enAttente.filter((n) => !n.validable).length,
        aRembourser: somme(validees, "exonere"),
        aReintegrer: somme(validees, "reintegre"),
        enAttenteMontant: somme(enAttente, "demande"),
      },
      lien: { actif: true, jeton: "demo0000000000000000000000000000" },
    });
  }

  /* Planning d'équipe — VERSION DÉMO. Le calcul qui fait foi vit dans
     api/src/temps.js ; ici on montre le geste avec une arithmétique
     simplifiée (semaine unique, temps plein). */
  if (d.action === "planning") {
    e.planning ??= [];
    const heures = (c) => {
      const m = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
      let f = m(c.fin); if (f <= m(c.debut)) f += 1440;
      return Math.max(0, f - m(c.debut) - (Number(c.pause) || 0)) / 60;
    };
    if (d.mode === "poser") {
      for (const c of d.creneaux || []) e.planning.push({ id: `demo-tps-${e.planning.length + 1}`, ...c, cle: cleNomPrenom(c.nom, c.prenom), source: "Planning" });
      return json(201, { enregistres: (d.creneaux || []).length, points: [] });
    }
    if (d.mode === "supprimer") { e.planning = e.planning.filter((c) => c.id !== d.id); return json(200, { ok: true }); }
    if (d.mode === "apercu" || d.mode === "variables") {
      const parSal = new Map();
      for (const c of e.planning) parSal.set(c.cle, (parSal.get(c.cle) || 0) + heures(c));
      const lignes = [...parSal].map(([cle, t]) => {
        const s = (p.salaries || []).find((x) => x.cle === cle) || {};
        return { nom: s.nom || cle, prenom: s.prenom || "", matricule: s.matricule || "",
          heuresNormales: Math.min(t, 35), ...(t > 35 ? { heuresSup25: Math.round((t - 35) * 100) / 100 } : {}) };
      });
      if (!lignes.length) return json(400, { erreur: "Aucun temps de travail saisi pour ce mois." });
      return d.mode === "apercu" ? json(200, { mois: d.mois, lignes }) : json(202, { mois: d.mois, lignes: lignes.length });
    }
    const dans = (c) => (!d.depuis || c.jour >= d.depuis) && (!d.jusqu || c.jour <= d.jusqu);
    const creneaux = e.planning.filter(dans);
    return json(200, {
      depuis: d.depuis, jusqu: d.jusqu, creneaux,
      salaries: (p.salaries || []).filter((s) => s.statut !== "Sorti").map((s) => {
        const siens = creneaux.filter((c) => c.cle === s.cle);
        const total = Math.round(siens.reduce((t, c) => t + heures(c), 0) * 100) / 100;
        return { ...s, hebdoContractuel: 35,
          semaines: [{ lundi: d.depuis, total, normales: Math.min(total, 35), complementaires: 0,
            sup25: Math.max(0, Math.min(total - 35, 8)), sup50: Math.max(0, total - 43), nuit: 0, dimancheFerie: 0 }] };
      }),
      points: [],
      pointage: { actif: true, jeton: "demo0000000000000000000000000000" },
    });
  }

  // Réembauche, écran de contrôle : dossier repris + points de vigilance.
  if (d.action === "reembaucheControles") {
    const a = (p.salaries || []).find((s) => memeSalarie(s, d.reprise));
    if (!a) return json(404, { erreur: "Salarié introuvable dans votre effectif." });
    if (a.statut !== "Sorti") return json(409, { erreur: `${a.prenom} ${a.nom} fait toujours partie de l'effectif — un avenant convient mieux qu'une réembauche.` });
    return json(200, {
      ancien: { nom: a.nom, prenom: a.prenom, matricule: a.matricule, poste: a.poste, typeContrat: a.type, dateEntree: a.debut, dateSortie: a.fin },
      repris: {
        nom: a.nom, prenom: a.prenom, numeroSS: "2 94 05 12 345 678 46",
        dateNaissance: "1994-05-12", adressePostale: "12 rue des Lices, 83000 Toulon",
        iban: "FR76 3000 6000 0112 3456 7890 189", bic: "AGRIFRPP",
      },
      points: pointsReembaucheDemo(a, d),
      bloquants: pointsReembaucheDemo(a, d).filter((x) => x.niveau === "bloquant").map((x) => x.cle),
      exceptionsCarence: EXCEPTIONS_CARENCE_DEMO,
    });
  }

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
      // Accident du travail / de trajet : le calcul qui fait foi (48 h
      // hors dimanches et fériés) vit dans api/src/accident.js — la démo
      // montre le geste avec un lendemain-de-lendemain simplifié.
      if (d.motif === "Accident du travail" || d.motif === "Accident de trajet") {
        const limite = dansNJours(2).split("-").reverse().join("/");
        return json(202, { reference, accident: { dat: { date: dansNJours(2), enRetard: false }, gestes: [
          { cle: "feuille", quand: "Tout de suite", texte: "Remettez au salarié la feuille d'accident du travail (formulaire S6201) — elle lui ouvre la gratuité des soins. Sans elle, il avance les frais." },
          { cle: "dat", quand: `Avant le ${limite}`, texte: "Déclaration d'accident du travail à la CPAM : 48 heures à compter de votre connaissance de l'accident, dimanches et jours fériés non compris (R.441-3). Votre gestionnaire s'en charge : il vient d'être prévenu." },
          { cle: "reserves", quand: "10 jours francs après la déclaration", texte: "Si vous avez un doute sur la réalité de l'accident ou son lien avec le travail, dites-le à votre gestionnaire MAINTENANT : les réserves doivent être émises dans les dix jours francs suivant la déclaration, et elles doivent être motivées (R.441-6)." },
        ] } });
      }
      return json(202, { reference });
    }

    case "visite-medicale": {
      const reference = referenceDemo("VIS");
      p.visites.unshift({
        cle: cleSalarie(d.salarie), salarie: String(d.salarie || "").trim(),
        date: d.dateVisite, type: d.typeVisite || "Visite périodique", statut: "À planifier", reference,
      });
      // Comme en réel : une visite demandée depuis le retour éteint
      // l'obligation de reprise du salarié concerné.
      const cible = String(d.salarie || "").trim().toUpperCase();
      e.echeances.reprises = (e.echeances.reprises || []).filter((r) => r.salarie.toUpperCase() !== cible);
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
      // Réembauche : le nom vient du dossier repris, pas du formulaire.
      if (d.reprise) {
        const a = (p.salaries || []).find((s) => memeSalarie(s, d.reprise));
        if (!a) return json(404, { erreur: "Salarié introuvable dans votre effectif." });
        const bloquant = pointsReembaucheDemo(a, d).some((x) => x.niveau === "bloquant");
        if (bloquant && !d.motifDerogation)
          return json(409, { erreur: "Cette réembauche se heurte au délai de carence — indiquez le motif qui permet de passer outre." });
        a.statut = "Actif"; a.type = d.typeContrat; a.poste = d.poste || a.poste;
        a.debut = d.dateDebut; a.fin = d.dateFin || null;
        e.dashboard.aTraiter.unshift({ t: `Réembauche ${d.typeContrat} ${a.nom} ${a.prenom} — en attente d'approbation`, s: "À traiter" });
        return json(202, { reference, reprise: true });
      }
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
