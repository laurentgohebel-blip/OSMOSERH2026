// api/src/frais.js — le moteur des notes de frais. Calcul pur : ce
// module ne connaît ni Graph, ni jeton, ni requête HTTP. Il répond à une
// seule question, et c'est la seule qui compte vraiment.
//
// LE GESTE MÉTIER. Rembourser un ticket, n'importe quel tableur le fait.
// Ce qui se paie cher, c'est la QUALIFICATION du frais, et c'est le
// premier motif de redressement URSSAF dans les petites entreprises :
//
//   1. le frais est-il professionnel — engagé dans l'intérêt de
//      l'entreprise, et non pour la convenance du salarié ;
//   2. est-il remboursé AU RÉEL (justificatif obligatoire, montant libre)
//      ou AU FORFAIT (pas de justificatif, mais limite d'exonération) ;
//   3. et surtout : la part qui dépasse la limite d'exonération N'EST PAS
//      un frais. C'est du SALAIRE — soumis à cotisations, à porter en
//      brut. Un employeur qui rembourse 30 € un repas au restaurant ne
//      fait pas une générosité : il verse un complément de salaire non
//      déclaré, et il le découvre trois ans plus tard.
//
// Le portail ne décide de rien : il calcule les deux parts, les nomme, et
// les envoie séparément en paie. L'employeur reste libre de rembourser
// au-delà — il sait simplement ce que ça coûte.
//
// LES BARÈMES SONT DATÉS, ET C'EST VOLONTAIRE. Les plafonds
// d'exonération et le barème kilométrique sont revalorisés chaque année.
// Ils vivent tous dans UNE table, `BAREMES`, indexée par millésime :
// la mise à jour annuelle est une seule modification, au même endroit.
// Quand l'année demandée dépasse le dernier millésime connu, le calcul
// se fait sur le dernier connu ET le rend dit `baremeAVerifier: true` —
// l'écran l'affiche, personne ne signe un chiffre périmé sans le savoir.

/* ════════════════════════════════════════════════════════════════════
   BARÈMES — À ACTUALISER CHAQUE ANNÉE
   Source : plafonds d'exonération des frais professionnels publiés par
   l'URSSAF, et barème kilométrique publié par l'administration fiscale.
   Les valeurs ci-dessous sont celles du millésime 2025. AVANT de retenir
   un millésime 2026, confronter chaque ligne à la publication officielle
   de l'année : ces montants n'ont AUCUNE valeur s'ils ne sont pas
   vérifiés à la source.
   ════════════════════════════════════════════════════════════════════ */

const BAREMES = {
  2025: {
    // Limites d'exonération journalières (allocations forfaitaires).
    repasRestaurant: 21.10,   // repas au restaurant en déplacement
    repasHorsLocaux: 10.30,   // repas hors des locaux, sans restaurant (chantier, tournée)
    repasPanier: 7.40,        // repas sur le lieu de travail imposé par l'organisation
    // Grand déplacement, par nuitée, petit-déjeuner compris.
    logementParis: 74.30,     // Paris et départements 92, 93, 94
    logementProvince: 55.10,  // autres départements de métropole
    // Télétravail : allocation forfaitaire.
    teletravailJour: 2.70,
    teletravailPlafondMois: 59.40,
    // Barème kilométrique, voitures. Par puissance fiscale (CV) et par
    // tranche de kilomètres parcourus dans l'année.
    km: {
      3: [[5000, 0.529, 0], [20000, 0.316, 1065], [Infinity, 0.370, 0]],
      4: [[5000, 0.606, 0], [20000, 0.340, 1330], [Infinity, 0.407, 0]],
      5: [[5000, 0.636, 0], [20000, 0.357, 1395], [Infinity, 0.427, 0]],
      6: [[5000, 0.665, 0], [20000, 0.374, 1457], [Infinity, 0.447, 0]],
      7: [[5000, 0.697, 0], [20000, 0.394, 1515], [Infinity, 0.470, 0]],
    },
  },
};
const ANNEES_CONNUES = Object.keys(BAREMES).map(Number).sort((a, b) => a - b);
const DERNIER_BAREME = ANNEES_CONNUES[ANNEES_CONNUES.length - 1];

/* Le barème applicable, et l'aveu quand il est périmé. */
function bareme(annee) {
  const a = Number(annee) || DERNIER_BAREME;
  const retenu = BAREMES[a] ? a : DERNIER_BAREME;
  return { annee: retenu, ...BAREMES[retenu], aVerifier: retenu !== a };
}

/* ════════════════════════════════════════════════════════════════════
   CATÉGORIES
   Chaque catégorie porte son RÉGIME, qui décide de tout le reste :
     reel    — montant libre, justificatif OBLIGATOIRE, aucune limite ;
     forfait — allocation sans justificatif, plafonnée par salarié et par
               jour (ou par nuitée) ;
     bareme  — le montant n'est pas déclaré, il est CALCULÉ (kilomètres).
   ════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  { cle: "repas-restaurant", libelle: "Repas au restaurant (déplacement)", regime: "forfait", limite: "repasRestaurant", unite: "repas",
    aide: "Le salarié est en déplacement et déjeune au restaurant.", tvaDeductible: true },
  { cle: "repas-hors-locaux", libelle: "Repas hors des locaux, sans restaurant", regime: "forfait", limite: "repasHorsLocaux", unite: "repas",
    aide: "Chantier, tournée, véhicule : le salarié ne peut ni rentrer ni aller au restaurant.", tvaDeductible: true },
  { cle: "repas-panier", libelle: "Repas sur le lieu de travail (panier)", regime: "forfait", limite: "repasPanier", unite: "repas",
    aide: "Horaire posté, équipe, travail de nuit : le salarié mange sur place, contraint par l'organisation.", tvaDeductible: false },
  { cle: "logement-paris", libelle: "Nuitée — Paris et 92 / 93 / 94", regime: "forfait", limite: "logementParis", unite: "nuitée",
    aide: "Grand déplacement, petit-déjeuner compris.", tvaDeductible: false },
  { cle: "logement-province", libelle: "Nuitée — autres départements", regime: "forfait", limite: "logementProvince", unite: "nuitée",
    aide: "Grand déplacement, petit-déjeuner compris.", tvaDeductible: false },
  { cle: "teletravail", libelle: "Allocation télétravail", regime: "forfait", limite: "teletravailJour", unite: "jour",
    plafondMois: "teletravailPlafondMois",
    aide: "Participation aux frais du domicile, par jour de télétravail.", tvaDeductible: false },
  { cle: "km", libelle: "Indemnité kilométrique (véhicule personnel)", regime: "bareme", unite: "km",
    aide: "Le montant est calculé par le barème : ni le carburant ni l'entretien ne se remboursent en plus.", tvaDeductible: false },
  { cle: "hebergement", libelle: "Hôtel (au réel)", regime: "reel",
    aide: "Facture au nom de l'entreprise ou du salarié. La TVA sur l'hébergement d'un salarié n'est pas déductible.", tvaDeductible: false },
  { cle: "transport", libelle: "Transport (train, avion, taxi, péage, parking)", regime: "reel",
    aide: "Au réel, sur justificatif.", tvaDeductible: true },
  { cle: "carburant", libelle: "Carburant (véhicule de l'entreprise)", regime: "reel",
    aide: "Réservé aux véhicules de l'entreprise. Sur véhicule personnel, c'est l'indemnité kilométrique — jamais les deux.", tvaDeductible: false },
  { cle: "fournitures", libelle: "Achat pour l'entreprise", regime: "reel",
    aide: "Le salarié avance un achat professionnel.", tvaDeductible: true },
  { cle: "autre", libelle: "Autre frais professionnel", regime: "reel",
    aide: "À qualifier par le gestionnaire : sans qualification, un remboursement est un avantage soumis.", tvaDeductible: false },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.cle, c]));
const categorieValide = (c) => Object.prototype.hasOwnProperty.call(CAT, String(c || ""));

/* ── Outils ─────────────────────────────────────────────────────── */
const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const sou = (x) => Math.round((Number(x) || 0) * 100) / 100;   // deux décimales, sans dérive binaire
const jours = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/* Indemnité kilométrique.
   Le barème NE SE CUMULE PAS par tranche : c'est une formule unique,
   choisie d'après la distance ANNUELLE totale, majoration comprise
   (« d × 0,340 + 1 330 » pour 4 CV entre 5 001 et 20 000 km). On calcule
   donc l'indemnité annuelle avant ce déplacement, celle après, et on
   rend la différence. C'est la seule manière d'obtenir la bonne somme
   quand un salarié franchit un seuil en cours d'année — et le seuil se
   franchit, 5 000 km, c'est une tournée de trois mois. */
function annuelle(b, puissance, distance) {
  if (distance <= 0) return 0;
  const [, taux, majoration] = b.km[puissance].find(([plafond]) => distance <= plafond) || b.km[puissance][2];
  return distance * taux + majoration;
}

function indemniteKilometrique({ km, cv, dejaParcourus = 0, annee }) {
  const b = bareme(annee);
  const distance = Math.max(0, Number(km) || 0);
  // Puissance fiscale : sous 3 CV et au-delà de 7, le barème ne distingue plus.
  const puissance = Math.min(7, Math.max(3, Math.round(Number(cv) || 5)));
  if (!distance) return { montant: 0, puissance, cumulAnnuel: 0, baremeAnnee: b.annee, baremeAVerifier: b.aVerifier };
  const avant = Math.max(0, Number(dejaParcourus) || 0);
  const cumul = avant + distance;
  return {
    montant: sou(Math.max(0, annuelle(b, puissance, cumul) - annuelle(b, puissance, avant))),
    taux: sou((annuelle(b, puissance, cumul) - annuelle(b, puissance, avant)) / distance),
    puissance, cumulAnnuel: cumul,
    baremeAnnee: b.annee, baremeAVerifier: b.aVerifier,
  };
}

/* ════════════════════════════════════════════════════════════════════
   QUALIFICATION — le cœur du module
   Rend, pour une note : ce qui se rembourse en franchise de cotisations,
   ce qui bascule en salaire, et pourquoi.
   ════════════════════════════════════════════════════════════════════ */
function qualifier(note, options = {}) {
  const cat = CAT[note.categorie] || CAT.autre;
  const annee = options.annee || Number(String(note.date || "").slice(0, 4)) || DERNIER_BAREME;
  const b = bareme(annee);
  const quantite = Math.max(1, Math.round(Number(note.quantite) || 1));

  if (cat.regime === "bareme") {
    const ik = indemniteKilometrique({ km: note.km, cv: note.cv, dejaParcourus: options.kmDejaParcourus, annee });
    return {
      categorie: cat.cle, libelle: cat.libelle, regime: "bareme",
      demande: sou(ik.montant), exonere: sou(ik.montant), reintegre: 0,
      limite: null, quantite: Math.max(0, Number(note.km) || 0), unite: "km",
      justificatifRequis: false, detail: ik,
      baremeAnnee: b.annee, baremeAVerifier: b.aVerifier,
      // La note de frais kilométrique n'a pas de ticket : ce qui la
      // justifie, c'est le déplacement — objet, trajet, date.
      motifRequis: true,
    };
  }

  const demande = sou(note.montant);
  if (cat.regime === "reel") {
    return {
      categorie: cat.cle, libelle: cat.libelle, regime: "reel",
      demande, exonere: demande, reintegre: 0, limite: null, quantite: 1,
      justificatifRequis: true, tvaDeductible: cat.tvaDeductible,
      baremeAnnee: b.annee, baremeAVerifier: b.aVerifier, motifRequis: false,
    };
  }

  // Forfait : la limite s'apprécie par unité (repas, nuitée, jour).
  const unitaire = b[cat.limite];
  let plafond = sou(unitaire * quantite);
  // Le télétravail porte un plafond mensuel qui prime sur le journalier.
  if (cat.plafondMois) plafond = Math.min(plafond, b[cat.plafondMois]);
  const exonere = Math.min(demande, plafond);
  return {
    categorie: cat.cle, libelle: cat.libelle, regime: "forfait",
    demande, exonere: sou(exonere), reintegre: sou(Math.max(0, demande - plafond)),
    limite: sou(plafond), limiteUnitaire: unitaire, quantite, unite: cat.unite,
    // Sur allocation forfaitaire, le justificatif n'est pas exigé par
    // l'URSSAF ; il reste demandé quand le montant dépasse la limite,
    // puisqu'on quitte alors le forfait.
    justificatifRequis: demande > plafond,
    tvaDeductible: cat.tvaDeductible,
    baremeAnnee: b.annee, baremeAVerifier: b.aVerifier, motifRequis: false,
  };
}

/* ════════════════════════════════════════════════════════════════════
   CONTRÔLES
   Trois familles, et elles n'ont pas le même poids :
     bloquant  — la note ne peut pas être validée en l'état ;
     vigilance — elle peut l'être, l'employeur doit savoir ;
     info      — utile au comptable, sans conséquence sur la paie.
   Aucun contrôle ne refuse tout seul : l'employeur décide, toujours.
   ════════════════════════════════════════════════════════════════════ */
function controles(note, contexte = {}) {
  const q = contexte.qualification || qualifier(note, contexte);
  const cat = CAT[note.categorie] || CAT.autre;
  const points = [];
  const aujourdhui = contexte.aujourdhui || new Date().toISOString().slice(0, 10);
  // Une note ne se compare jamais à elle-même. On écarte par identité
  // ET par identifiant : les notes du banc n'ont pas toujours d'`id`, et
  // `undefined !== undefined` est faux — la note se croiserait alors
  // elle-même et se déclarerait son propre doublon.
  const autres = (contexte.autres || []).filter((n) => n !== note && !(note.id != null && n.id === note.id));

  if (!estDate(note.date)) points.push({ niveau: "bloquant", texte: "Date du frais absente ou illisible." });
  else if (note.date > aujourdhui) points.push({ niveau: "bloquant", texte: "Le frais est daté dans le futur." });

  if (!categorieValide(note.categorie))
    points.push({ niveau: "bloquant", texte: "Catégorie non renseignée — un frais non qualifié se rembourse comme du salaire." });

  if (q.regime !== "bareme" && !(Number(note.montant) > 0))
    points.push({ niveau: "bloquant", texte: "Montant absent ou nul." });

  if (q.justificatifRequis && !note.justificatif)
    points.push({ niveau: "bloquant", texte: q.regime === "reel"
      ? "Justificatif manquant. Sans pièce, le remboursement est un avantage soumis à cotisations."
      : "Le montant dépasse la limite du forfait : le justificatif devient nécessaire pour la part au réel." });

  if (q.motifRequis && !String(note.motif || "").trim())
    points.push({ niveau: "bloquant", texte: "Objet du déplacement non précisé — c'est ce qui justifie l'indemnité kilométrique en cas de contrôle." });

  if (q.reintegre > 0)
    points.push({ niveau: "vigilance", texte:
      `Dépassement de ${sou(q.reintegre).toFixed(2)} € au-delà de la limite d'exonération (${q.limite.toFixed(2)} € pour ${q.quantite} ${q.unite}${q.quantite > 1 ? "s" : ""}). Cette part est du salaire : elle partira en brut soumis, pas en frais.` });

  if (q.baremeAVerifier)
    points.push({ niveau: "vigilance", texte:
      `Barème ${q.baremeAnnee} appliqué faute de millésime plus récent — vérifiez les plafonds de l'année avant de valider.` });

  // Cumul interdit : le barème kilométrique comprend déjà le carburant,
  // l'entretien, l'assurance et la dépréciation du véhicule. Un plein
  // remboursé en plus, le même jour, est un double remboursement.
  if (note.categorie === "km" || note.categorie === "carburant") {
    const oppose = note.categorie === "km" ? "carburant" : "km";
    const collision = autres.find((n) => n.cle === note.cle && n.date === note.date && n.categorie === oppose);
    if (collision) points.push({ niveau: "vigilance", texte:
      "Indemnité kilométrique et carburant le même jour : le barème kilométrique couvre déjà le carburant. Choisissez l'un des deux." });
  }

  // Doublon probable : même personne, même jour, même catégorie, même
  // montant. Le cas légitime existe (deux péages), d'où la vigilance.
  const jumeau = autres.find((n) => n.cle === note.cle && n.date === note.date
    && n.categorie === note.categorie && sou(n.montant) === sou(note.montant) && Number(note.montant) > 0);
  if (jumeau) points.push({ niveau: "vigilance", texte: "Une note identique existe déjà pour ce jour (même catégorie, même montant) — doublon probable." });

  // Ancienneté. Rien d'illégal : le salaire se réclame trois ans
  // (L. 3245-1). Mais un frais qui remonte de plusieurs mois échappe au
  // rapprochement bancaire et à l'exercice comptable.
  if (estDate(note.date)) {
    const age = jours(note.date, aujourdhui);
    if (age > 90) points.push({ niveau: "vigilance", texte: `Frais engagé il y a ${Math.round(age / 30)} mois — hors du mois de paie courant, à rapprocher de l'exercice comptable.` });
  }

  // Croisement avec le temps de travail, quand le portail le connaît :
  // un repas de déplacement un jour sans aucun créneau posé mérite une
  // question. Le planning n'est pas la vérité — il est déclaratif lui
  // aussi —, donc jamais bloquant, et muet quand rien n'est saisi.
  const creneaux = contexte.creneaux || null;
  if (creneaux && creneaux.length && estDate(note.date)
    && ["repas-restaurant", "repas-hors-locaux", "repas-panier", "km"].includes(note.categorie)) {
    const jourTravaille = creneaux.some((c) => c.cle === note.cle && c.jour === note.date);
    const jourConnu = creneaux.some((c) => c.jour === note.date);
    if (jourConnu && !jourTravaille)
      points.push({ niveau: "vigilance", texte: "Aucun temps de travail enregistré ce jour-là pour ce salarié — vérifiez la date du frais." });
  }

  if (cat.tvaDeductible === false && Number(note.tva) > 0)
    points.push({ niveau: "info", texte: "La TVA de cette catégorie n'est pas déductible pour l'entreprise — à signaler au comptable." });

  return points;
}

/* Une note enrichie : qualification + contrôles + décision possible. */
function examiner(note, contexte = {}) {
  const qualification = qualifier(note, contexte);
  const points = controles(note, { ...contexte, qualification });
  return {
    ...note,
    qualification,
    points,
    bloquants: points.filter((p) => p.niveau === "bloquant").length,
    validable: !points.some((p) => p.niveau === "bloquant"),
  };
}

/* Un lot de notes, examinées ensemble — c'est ensemble que se voient les
   doublons et les cumuls.

   Le cumul kilométrique se reconstitue DANS L'ORDRE DES DATES, et pas
   autrement : la tranche du barème dépend de ce qui a déjà été parcouru
   AVANT ce trajet-là. Compter pour chaque note « tout ce que font les
   autres » décalerait le premier trajet de l'année dans la tranche du
   dernier, et gonflerait l'indemnité de plusieurs dizaines d'euros. */
function examinerLot(notes, contexte = {}) {
  const deja = new Map();    // rang de la note → kilomètres antérieurs
  const cumul = new Map();   // salarié | année → total courant
  notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.categorie === "km")
    .sort((a, b) => String(a.n.date).localeCompare(String(b.n.date)) || a.i - b.i)
    .forEach(({ n, i }) => {
      const cle = `${n.cle}|${String(n.date || "").slice(0, 4)}`;
      const avant = cumul.get(cle) || 0;
      deja.set(i, avant);
      cumul.set(cle, avant + (Number(n.km) || 0));
    });
  return notes.map((n, i) => examiner(n, {
    ...contexte, autres: notes, kmDejaParcourus: deja.get(i) || 0,
  }));
}

/* ════════════════════════════════════════════════════════════════════
   VERS LA PAIE
   Une ligne par salarié. Les deux parts ne se mélangent JAMAIS :
     FraisPro    — remboursement net, hors cotisations ;
     PrimeMontant — la part réintégrée, en brut soumis, libellée pour que
                    personne n'ait à deviner de quoi il s'agit.
   ════════════════════════════════════════════════════════════════════ */
function versVariables(notesExaminees, salaries, mois) {
  const parSalarie = new Map();
  for (const n of notesExaminees) {
    if (n.statut !== "Validée") continue;
    if (String(n.date || "").slice(0, 7) > mois) continue;
    const s = (salaries || []).find((x) => x.cle === n.cle);
    const cur = parSalarie.get(n.cle) || {
      cle: n.cle, nom: n.nom, prenom: n.prenom, matricule: s?.matricule || "",
      fraisPro: 0, reintegre: 0, lignes: 0, detail: [],
    };
    cur.fraisPro += n.qualification.exonere;
    cur.reintegre += n.qualification.reintegre;
    cur.lignes += 1;
    cur.detail.push(`${n.date} ${n.qualification.libelle} ${n.qualification.demande.toFixed(2)} €`);
    parSalarie.set(n.cle, cur);
  }
  return [...parSalarie.values()].map((l) => ({
    nom: l.nom, prenom: l.prenom, matricule: l.matricule,
    fraisPro: sou(l.fraisPro),
    ...(l.reintegre > 0 ? {
      primeLibelle: "Frais au-delà du plafond (soumis)",
      primeMontant: sou(l.reintegre),
    } : {}),
    commentaire: `${l.lignes} note${l.lignes > 1 ? "s" : ""} de frais — ${l.detail.slice(0, 6).join(" · ")}${l.detail.length > 6 ? " …" : ""}`.slice(0, 1000),
  }));
}

module.exports = {
  BAREMES, ANNEES_CONNUES, DERNIER_BAREME, CATEGORIES, CAT,
  bareme, categorieValide, indemniteKilometrique,
  qualifier, controles, examiner, examinerLot, versVariables, sou,
};
