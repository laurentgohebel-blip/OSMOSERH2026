// api/src/reembauche.js — réembaucher quelqu'un qui a déjà travaillé ici.
//
// Le cas est universel : l'extra qui revient chaque service, le
// saisonnier de la station, le vacataire de l'association, le
// remplaçant du cabinet, l'ouvrier repris au chantier suivant. Et
// pourtant la deuxième embauche coûte aussi cher que la première : on
// redemande l'identité, le numéro de sécurité sociale, l'adresse, la
// banque. Tout cela est déjà dans le dossier du salarié sorti.
//
// Ce module fait deux choses, et rien d'autre :
//   1. il REPREND le dossier administratif de l'ancien contrat ;
//   2. il énonce les POINTS DE VIGILANCE que cette réembauche soulève.
//
// Le second point est le vrai travail. Réembaucher n'est pas embaucher :
// un délai de carence peut interdire le CDD, un titre de séjour valable
// il y a deux ans peut être périmé, la période d'essai peut devoir être
// réduite, une visite médicale récente peut dispenser de la suivante.
// Ce sont exactement les erreurs qu'un cabinet rattrape après coup.
//
// PRINCIPE : on avertit, on ne bloque pas. Le délai de carence connaît
// sept exceptions légales (L.1244-4-1) que seul le client connaît —
// saisonnier, CDD d'usage, remplacement d'un absent revenu absent,
// rupture à son initiative… Refuser la saisie serait juridiquement faux.
// Le portail expose la règle, demande une confirmation explicite quand
// elle mord, et trace le motif retenu.

const JOUR = 86400000;

const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const jours = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / JOUR);
const ajouter = (d, n) => iso(new Date(Date.parse(d) + n * JOUR));

/* ── Délai de carence entre deux CDD (L.1244-3 et L.1244-3-1) ────────
   À l'expiration d'un CDD, il ne peut être recouru, pour pourvoir LE
   MÊME POSTE, à un nouveau CDD avant l'expiration d'un délai calculé
   sur la durée du contrat précédent, renouvellement inclus :
     — contrat de 14 jours ou plus : un TIERS de sa durée ;
     — contrat de moins de 14 jours : la MOITIÉ de sa durée.
   Ce délai se décompte en jours d'OUVERTURE de l'entreprise, que le
   portail ne connaît pas : la date rendue est donc la plus optimiste
   possible (entreprise ouverte tous les jours) et s'annonce comme
   telle. Une convention de branche peut fixer d'autres règles.

   Ne s'applique pas si le nouveau contrat est un CDI : le CDI ne
   « pourvoit » pas le poste au sens de l'article. */
const EXCEPTIONS_CARENCE = [
  "Nouvelle absence du salarié remplacé",
  "Travaux urgents de sécurité",
  "Emploi saisonnier",
  "CDD d'usage (secteur le permettant)",
  "Remplacement d'un chef d'entreprise ou d'exploitation",
  "Rupture anticipée à l'initiative du salarié",
  "Refus du salarié de renouveler son contrat",
  "Accord de branche prévoyant d'autres modalités",
];

function carence({ typePrecedent, debutPrecedent, finPrecedent, typeNouveau, dateDebut, memePoste }) {
  if (typePrecedent !== "CDD" || typeNouveau !== "CDD") return null;
  if (!estDate(debutPrecedent) || !estDate(finPrecedent)) return null;
  if (memePoste === false) return null;

  const duree = jours(debutPrecedent, finPrecedent) + 1;   // bornes incluses
  if (duree <= 0) return null;
  const delai = duree >= 14 ? Math.ceil(duree / 3) : Math.ceil(duree / 2);
  const finCarence = ajouter(finPrecedent, delai);          // dernier jour couvert

  const r = {
    dureePrecedente: duree,
    delai,
    regle: duree >= 14 ? "un tiers de la durée du contrat précédent" : "la moitié de la durée du contrat précédent",
    auPlusTot: ajouter(finCarence, 1),
    exceptions: EXCEPTIONS_CARENCE,
    respecte: null,
  };
  if (estDate(dateDebut)) r.respecte = dateDebut >= r.auPlusTot;
  return r;
}

/* ── Points de vigilance d'une réembauche ────────────────────────────
   Chacun est un FAIT vérifiable tiré du dossier, jamais une injonction.
   Le portail dit ce qu'il sait ; la décision reste au client et à son
   gestionnaire. */

const DUREE_VIP_ANS = 5;        // R.4624-15 : dispense possible sous conditions
const DUREE_VIP_SIR_ANS = 2;    // suivi individuel renforcé

function vigilance(ancien, nouveau, aujourdhui) {
  const jour = estDate(aujourdhui) ? aujourdhui : iso(new Date());
  const points = [];

  // 1. Titre de séjour : valable au précédent contrat ne veut rien dire
  //    aujourd'hui. L'employeur doit s'assurer du droit au travail à
  //    CHAQUE embauche (L.8251-1) — l'oubli est une infraction pénale.
  if (ancien.titreSejourType) {
    const exp = ancien.titreSejourExpiration;
    if (!estDate(exp)) {
      points.push({ cle: "titre-sejour", niveau: "attention",
        titre: "Titre de séjour à vérifier",
        detail: "Le dossier porte un titre de séjour sans date d'expiration connue. Le droit au travail doit être vérifié avant toute nouvelle embauche." });
    } else if (exp < jour) {
      points.push({ cle: "titre-sejour", niveau: "bloquant",
        titre: "Titre de séjour expiré",
        detail: `Le titre au dossier a expiré le ${fr(exp)}. Un titre en cours de validité est exigé avant l'embauche, et l'authentification préfectorale doit être refaite.` });
    } else if (estDate(nouveau.dateDebut) && exp < nouveau.dateDebut) {
      points.push({ cle: "titre-sejour", niveau: "bloquant",
        titre: "Titre de séjour expiré à la date d'embauche",
        detail: `Le titre expire le ${fr(exp)}, avant le début prévu le ${fr(nouveau.dateDebut)}.` });
    } else {
      points.push({ cle: "titre-sejour", niveau: "info",
        titre: "Titre de séjour valable",
        detail: `Valable jusqu'au ${fr(exp)}. L'authentification préfectorale reste à refaire pour ce nouveau contrat.` });
    }
  }

  // 2. Délai de carence.
  const c = carence({
    typePrecedent: ancien.typeContrat, debutPrecedent: ancien.dateEntree, finPrecedent: ancien.dateSortie,
    typeNouveau: nouveau.typeContrat, dateDebut: nouveau.dateDebut,
    memePoste: nouveau.memePoste,
  });
  if (c) {
    points.push({
      cle: "carence",
      niveau: c.respecte === false ? "bloquant" : "info",
      titre: c.respecte === false ? "Délai de carence non respecté" : "Délai de carence",
      detail: c.respecte === false
        ? `Le contrat précédent a duré ${c.dureePrecedente} jours : le délai de carence est de ${c.delai} jours d'ouverture de l'entreprise (${c.regle}). Un nouveau CDD sur le même poste ne peut donc pas commencer avant le ${fr(c.auPlusTot)} — et plus tard encore si l'entreprise n'ouvre pas tous les jours. Une exception légale peut s'appliquer : il faut alors la préciser.`
        : `Le contrat précédent a duré ${c.dureePrecedente} jours : ${c.delai} jours d'ouverture de l'entreprise (${c.regle}), soit une reprise possible à partir du ${fr(c.auPlusTot)} au plus tôt.`,
      donnees: c,
    });
  }

  // 3. Période d'essai : la durée du CDD s'impute sur l'essai du CDI
  //    conclu à l'issue (L.1221-24). Après une interruption, ce n'est
  //    plus automatique — d'où un signalement, pas un calcul.
  if (ancien.typeContrat === "CDD" && nouveau.typeContrat === "CDI") {
    const interruption = estDate(ancien.dateSortie) && estDate(nouveau.dateDebut)
      ? jours(ancien.dateSortie, nouveau.dateDebut) : null;
    points.push({ cle: "essai", niveau: "attention",
      titre: "Période d'essai à réduire",
      detail: interruption !== null && interruption <= 1
        ? "Le CDI est conclu à l'issue du CDD : la durée du CDD s'impute intégralement sur la période d'essai (L.1221-24)."
        : `Le salarié a déjà occupé un poste dans l'entreprise${interruption !== null ? ` (interruption de ${interruption} jours)` : ""}. Selon les fonctions occupées, la durée du contrat précédent peut devoir être déduite de la période d'essai.` });
  } else if (ancien.poste && nouveau.poste && sansCasse(ancien.poste) === sansCasse(nouveau.poste)) {
    points.push({ cle: "essai", niveau: "attention",
      titre: "Même poste qu'au contrat précédent",
      detail: "Le salarié a déjà tenu ce poste : une nouvelle période d'essai de pleine durée est difficilement justifiable, sa finalité étant d'éprouver des compétences déjà éprouvées." });
  }

  // 4. Visite médicale : une visite récente peut dispenser de la
  //    suivante (R.4624-15) — sous conditions que le portail ne peut
  //    pas toutes vérifier, d'où une formulation prudente.
  if (estDate(ancien.derniereVisiteMedicale)) {
    const anciennete = jours(ancien.derniereVisiteMedicale, jour) / 365.25;
    const limite = ancien.suiviRenforce ? DUREE_VIP_SIR_ANS : DUREE_VIP_ANS;
    points.push({ cle: "visite", niveau: "info",
      titre: anciennete <= limite ? "Visite médicale peut-être non nécessaire" : "Visite médicale à prévoir",
      detail: anciennete <= limite
        ? `Dernière visite le ${fr(ancien.derniereVisiteMedicale)}, soit il y a moins de ${limite} ans. Si le salarié reprend un emploi identique aux mêmes risques et qu'aucun avis d'inaptitude ni aménagement n'est intervenu, une nouvelle visite peut ne pas être requise. À confirmer avec le service de santé au travail.`
        : `Dernière visite le ${fr(ancien.derniereVisiteMedicale)}, il y a plus de ${limite} ans : une visite d'information et de prévention est à prévoir dans les trois mois de la prise de poste.` });
  } else {
    points.push({ cle: "visite", niveau: "attention",
      titre: "Visite médicale à prévoir",
      detail: "Aucune visite médicale n'est connue au dossier : une visite d'information et de prévention est à prévoir dans les trois mois de la prise de poste." });
  }

  // 5. Ancienneté : le compteur ne repart pas toujours de zéro
  //    (L.1243-11 pour le CDD poursuivi en CDI, conventions de branche
  //    pour les saisonniers reconduits).
  if (estDate(ancien.dateEntree) && estDate(ancien.dateSortie)) {
    const duree = jours(ancien.dateEntree, ancien.dateSortie) + 1;
    points.push({ cle: "anciennete", niveau: "info",
      titre: "Ancienneté du contrat précédent",
      detail: `${duree} jours travaillés, du ${fr(ancien.dateEntree)} au ${fr(ancien.dateSortie)}. Cette ancienneté peut devoir être reprise (poursuite d'un CDD en CDI, reconduction saisonnière prévue par la convention collective).` });
  }

  // 6. La DPAE est due à chaque embauche, sans exception.
  points.push({ cle: "dpae", niveau: "info",
    titre: "Déclaration préalable à l'embauche",
    detail: "Une nouvelle DPAE est obligatoire, au plus tôt huit jours avant la prise de poste." });

  return points;
}

const sansCasse = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const fr = (iso) => (estDate(iso) ? String(iso).split("-").reverse().join("/") : String(iso || ""));

/* Ce que la réembauche reprend du dossier existant. Rien de ce qui
   dépend du CONTRAT (poste, dates, durée, salaire) : seulement ce qui
   appartient à la PERSONNE et ne change pas d'un contrat à l'autre. */
const CHAMPS_REPRIS = [
  "nom", "prenom", "nomNaissance", "nomMarital", "dateNaissance", "sexe",
  "situationFamiliale", "numeroSS", "adressePostale", "email", "telephone",
  "departementNaissance", "codeDepartementNaissance", "paysNaissance",
  "codePaysNaissance", "nationalite", "iban", "bic",
  "titreSejourType", "titreSejourNumero", "titreSejourExpiration",
];

function reprendre(ancien) {
  const repris = {};
  for (const champ of CHAMPS_REPRIS) if (ancien[champ]) repris[champ] = ancien[champ];
  return repris;
}

/* Un salarié est réembauchable s'il est sorti. On ne propose pas la
   réembauche de quelqu'un qui est encore là — ce serait un avenant. */
const reembauchable = (s) => s.statut === "Sorti" || (estDate(s.dateSortie) && s.dateSortie <= iso(new Date()));

/* ── Accès aux données ───────────────────────────────────────────────
   `require` volontairement PARESSEUX : tout ce qui précède est du calcul
   pur, vérifiable sans annuaire, sans jeton et sans réseau. */

/* Retrouve la fiche d'un ancien salarié. Le CodeClient vient du jeton
   résolu, jamais de la requête : un client ne peut pas réembaucher
   l'ancien salarié d'un autre. */
async function ficheAncien(clientInfo, reprise) {
  const { tokenGraph, idsListes, items, dateParis, SELECT_SALARIES } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids["Salariés"]) throw { status: 502, erreur: "Référentiel des salariés introuvable." };
  const cle = String(reprise || "").trim();
  if (!cle) throw { status: 400, erreur: "Salarié à réembaucher non précisé." };

  const nomComplet = (x) => `${String(x.Nom || "").trim().toUpperCase()} ${String(x.Prenom || "").trim().toUpperCase()}`.trim();
  const fiche = (await items(tok, ids["Salariés"], SELECT_SALARIES))
    .filter((x) => x.CodeClient === clientInfo.codeClient)
    .find((x) => String(x.id) === cle || nomComplet(x) === cle.toUpperCase());
  if (!fiche) throw { status: 404, erreur: "Salarié introuvable dans votre effectif." };

  const ancien = {
    id: fiche.id,
    nom: String(fiche.Nom || "").toUpperCase(), prenom: fiche.Prenom || "",
    matricule: fiche.Matricule || "",
    poste: fiche.Poste || "", typeContrat: fiche.TypeContrat || "",
    dateEntree: dateParis(fiche.DateEntree) || "", dateSortie: dateParis(fiche.DateSortie) || "",
    statut: fiche.Statut || "Actif",
    nomNaissance: fiche.NomNaissance || "", nomMarital: fiche.NomMarital || "",
    dateNaissance: dateParis(fiche.DateNaissance) || "", sexe: fiche.Sexe || "",
    situationFamiliale: fiche.SituationFamiliale || "", numeroSS: fiche.NumeroSS || "",
    adressePostale: fiche.AdressePostale || "", email: fiche.Email || "", telephone: fiche.Telephone || "",
    departementNaissance: fiche.DepartementNaissance || "", codeDepartementNaissance: fiche.CodeDepartementNaissance || "",
    paysNaissance: fiche.PaysNaissance || "", codePaysNaissance: fiche.CodePaysNaissance || "",
    nationalite: fiche.Nationalite || "", iban: fiche.Iban || "", bic: fiche.Bic || "",
    titreSejourType: fiche.TitreSejourType || "", titreSejourNumero: fiche.TitreSejourNumero || "",
    titreSejourExpiration: dateParis(fiche.TitreSejourExpiration) || "",
    titreSejourPj: fiche.TitreSejourPj || "",
    derniereVisiteMedicale: dateParis(fiche.DerniereVisiteMedicale) || "",
  };
  if (!reembauchable(ancien))
    throw { status: 409, erreur: `${ancien.prenom} ${ancien.nom} fait toujours partie de l'effectif — un avenant convient mieux qu'une réembauche.` };
  return ancien;
}

/* Ce que le client voit AVANT de valider : le dossier repris et les
   points de vigilance du contrat qu'il envisage. Lecture seule. */
async function controles(clientInfo, d) {
  const ancien = await ficheAncien(clientInfo, d.reprise);
  const projet = {
    typeContrat: d.typeContrat || "", dateDebut: d.dateDebut || "",
    poste: d.poste || "", memePoste: d.memePoste,
  };
  const points = vigilance(ancien, projet, undefined);
  return {
    status: 200,
    jsonBody: {
      ancien: {
        nom: ancien.nom, prenom: ancien.prenom, matricule: ancien.matricule,
        poste: ancien.poste, typeContrat: ancien.typeContrat,
        dateEntree: ancien.dateEntree, dateSortie: ancien.dateSortie,
      },
      repris: reprendre(ancien),
      points,
      bloquants: points.filter((p) => p.niveau === "bloquant").map((p) => p.cle),
      exceptionsCarence: EXCEPTIONS_CARENCE,
    },
  };
}

/* Complète une demande d'embauche à partir du dossier repris, et
   vérifie une dernière fois les points bloquants — le contrôle
   d'affichage ne prouve rien, seule cette vérification-ci compte.
   Un point bloquant n'INTERDIT pas : il exige que le client ait
   explicitement dit pourquoi il passe outre (motif d'exception à la
   carence, titre renouvelé), et ce motif est tracé. */
async function preparer(clientInfo, d) {
  const ancien = await ficheAncien(clientInfo, d.reprise);
  const complet = { ...reprendre(ancien), ...ecarterVides(d) };
  // La fiche salarié range la naissance en département et pays ; le
  // contrat attend un lieu en clair. On le reconstitue plutôt que de
  // le redemander — c'est tout l'objet de cette brique.
  if (!complet.lieuNaissance)
    complet.lieuNaissance = ancien.departementNaissance || ancien.paysNaissance || "";
  const points = vigilance(ancien, {
    typeContrat: complet.typeContrat, dateDebut: complet.dateDebut,
    poste: complet.poste, memePoste: d.memePoste,
  }, undefined);

  // Titre de séjour toujours valable : la pièce au dossier fait foi, on
  // ne la redemande pas. S'il est expiré, le point bloquant ci-dessous
  // impose de fournir le nouveau titre — donc une nouvelle pièce.
  const titreOk = !points.some((p) => p.cle === "titre-sejour" && p.niveau === "bloquant");
  if (!complet.pjTitreSejour && titreOk && ancien.titreSejourPj)
    complet.pjTitreSejour = ancien.titreSejourPj;

  const bloquants = points.filter((p) => p.niveau === "bloquant");
  const justifie = String(d.motifDerogation || "").trim();
  if (bloquants.length && !justifie) {
    throw {
      status: 409,
      erreur: bloquants.map((b) => `${b.titre} — ${b.detail}`).join("\n\n"),
      points: bloquants,
    };
  }
  return { ancien, demande: complet, points, derogation: justifie.slice(0, 300) };
}

/* Les champs vides du formulaire ne doivent pas effacer ce que le
   dossier sait déjà : « non renseigné » n'est pas « à supprimer ». */
const ecarterVides = (d) => Object.fromEntries(
  Object.entries(d).filter(([, v]) => v !== "" && v !== null && v !== undefined));

module.exports = { carence, vigilance, reprendre, reembauchable, ficheAncien, controles, preparer, CHAMPS_REPRIS, EXCEPTIONS_CARENCE };
