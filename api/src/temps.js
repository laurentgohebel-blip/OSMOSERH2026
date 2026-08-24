// api/src/temps.js — le temps de travail : planning prévu, temps réel
// pointé, et les heures qui en découlent pour la paie.
//
// Tous les clients font un planning. Sur un cahier, un tableau blanc,
// un tableur refait chaque semaine — puis quelqu'un recompte les heures
// à la main pour la paie. Le même travail deux fois, et deux occasions
// de se tromper. Ici, le planning EST la source des heures.
//
// CE QUE CE MODULE CALCULE : des QUANTITÉS d'heures, réparties dans les
// catégories que la liste « Variables de paie » attend déjà — normales,
// complémentaires, majorées à 25 %, à 50 %, de nuit, du dimanche et des
// jours fériés. Il ne calcule AUCUN montant : les taux de majoration
// dépendent de la convention collective, et c'est le métier de la paie,
// pas celui d'un portail.
//
// CE QU'IL SIGNALE : les dépassements. Un planning qui met quelqu'un à
// 52 heures est illégal, et personne ne s'en aperçoit avant la semaine
// suivante. Les contrôles sont faits sur le PRÉVU, donc avant que la
// semaine soit travaillée — c'est le seul moment où la correction coûte
// encore quelque chose de raisonnable.

/* ── Repères légaux ──────────────────────────────────────────────────
   Ce sont les règles supplétives du code du travail : un accord de
   branche ou d'entreprise peut en modifier plusieurs (seuil de nuit,
   taux, contingent). Elles sont donc regroupées ici, nommées, et non
   éparpillées dans le code — le jour où un client relève d'un accord
   différent, c'est ici qu'on regarde. */
const DUREE_LEGALE_HEBDO = 35;      // L.3121-27
const SEUIL_SUP_50 = 8;             // les 8 premières heures sup à +25 %, au-delà +50 % (L.3121-36)
const MAX_QUOTIDIEN = 10;           // L.3121-18
const MAX_HEBDO = 48;               // L.3121-20
const MAX_HEBDO_MOYEN = 44;         // sur 12 semaines glissantes (L.3121-22)
const REPOS_QUOTIDIEN_H = 11;       // L.3131-1
const REPOS_HEBDO_H = 35;           // 24 h + 11 h (L.3132-2)
const MAX_JOURS_CONSECUTIFS = 6;    // L.3132-1
const NUIT_DEBUT_H = 21, NUIT_FIN_H = 6;  // L.3122-2 (plage supplétive)
const CONTINGENT_ANNUEL = 220;      // heures supplémentaires (D.3121-24)

const MIN_PAR_H = 60;
const h = (n) => Math.round(n * 100) / 100;   // heures à deux décimales

/* ── Dates ───────────────────────────────────────────────────────── */
const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const estHeure = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
const minutes = (hhmm) => {
  const [a, b] = String(hhmm).split(":").map(Number);
  return a * 60 + b;
};
const jourPlus = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);

/* Jour de la semaine, lundi = 1 … dimanche = 7 (ISO 8601). */
const jourSemaine = (iso) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
/* Le lundi de la semaine civile — l'unité de décompte des heures
   supplémentaires (L.3121-35). */
const lundiDe = (iso) => jourPlus(iso, -(jourSemaine(iso) - 1));

/* Dimanche de Pâques (algorithme de Meeus/Jones/Butcher) — trois des
   onze jours fériés français en dépendent. */
function paques(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), i = (19 * a + b - d - g + 15) % 30;
  const k = Math.floor(c / 4), l = c % 4, m = (32 + 2 * e + 2 * k - i - l) % 7;
  const n = Math.floor((a + 11 * i + 22 * m) / 451);
  const mois = Math.floor((i + m - 7 * n + 114) / 31);
  const jour = ((i + m - 7 * n + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

const cacheFeries = new Map();
function feries(annee) {
  if (cacheFeries.has(annee)) return cacheFeries.get(annee);
  const p = paques(annee);
  const set = new Set([
    `${annee}-01-01`, `${annee}-05-01`, `${annee}-05-08`, `${annee}-07-14`,
    `${annee}-08-15`, `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`,
    jourPlus(p, 1),   // lundi de Pâques
    jourPlus(p, 39),  // Ascension
    jourPlus(p, 50),  // lundi de Pentecôte
  ]);
  cacheFeries.set(annee, set);
  return set;
}
const estFerie = (iso) => feries(Number(String(iso).slice(0, 4))).has(iso);
const estDimanche = (iso) => jourSemaine(iso) === 7;

/* ── Un créneau ──────────────────────────────────────────────────────
   { jour: "2026-09-07", debut: "18:00", fin: "02:00", pause: 30 }
   Une fin antérieure au début franchit minuit : le service du soir en
   restauration, la nuit en hôtellerie ou en établissement de santé. */
function dureeMinutes(c) {
  if (!estDate(c.jour) || !estHeure(c.debut) || !estHeure(c.fin)) return 0;
  const d = minutes(c.debut);
  let f = minutes(c.fin);
  if (f <= d) f += 24 * MIN_PAR_H;
  const pause = Math.max(0, Number(c.pause) || 0);
  return Math.max(0, f - d - pause);
}

/* Minutes de nuit du créneau. La plage 21 h – 6 h est comptée sur l'axe
   continu du créneau : 22 h → 2 h donne quatre heures de nuit, dont
   deux appartiennent au lendemain.
   La pause est ignorée ici : on ne saurait pas dire à quel moment elle
   a été prise, et la surestimer serait moins prudent que de compter
   l'amplitude nocturne réelle. */
function minutesNuit(c) {
  if (!estDate(c.jour) || !estHeure(c.debut) || !estHeure(c.fin)) return 0;
  const d = minutes(c.debut);
  let f = minutes(c.fin);
  if (f <= d) f += 24 * MIN_PAR_H;
  const plages = [
    [0, NUIT_FIN_H * MIN_PAR_H],                                   // 0 h – 6 h
    [NUIT_DEBUT_H * MIN_PAR_H, 24 * MIN_PAR_H],                    // 21 h – 24 h
    [24 * MIN_PAR_H, (24 + NUIT_FIN_H) * MIN_PAR_H],               // 0 h – 6 h du lendemain
    [(24 + NUIT_DEBUT_H) * MIN_PAR_H, 48 * MIN_PAR_H],             // 21 h – 24 h du lendemain
  ];
  let total = 0;
  for (const [a, b] of plages) total += Math.max(0, Math.min(f, b) - Math.max(d, a));
  return total;
}

/* ── Répartition des heures d'une semaine ────────────────────────────
   Le décompte des heures supplémentaires est HEBDOMADAIRE, jamais
   mensuel : 45 h une semaine et 25 h la suivante, ce n'est pas 70 h
   normales, ce sont 10 heures supplémentaires.

   Temps plein : au-delà de 35 h, les 8 premières à +25 %, ensuite +50 %.
   Temps partiel : au-delà de la durée contractuelle, ce sont des heures
   COMPLÉMENTAIRES — jamais supplémentaires. La distinction n'est pas
   cosmétique : porter un temps partiel à 35 h le requalifie en temps
   plein, ce que `controles` signale. */
function repartirSemaine(creneaux, hebdoContractuel) {
  const total = creneaux.reduce((s, c) => s + dureeMinutes(c), 0) / MIN_PAR_H;
  const nuit = creneaux.reduce((s, c) => s + minutesNuit(c), 0) / MIN_PAR_H;
  const dimancheFerie = creneaux
    .filter((c) => estDimanche(c.jour) || estFerie(c.jour))
    .reduce((s, c) => s + dureeMinutes(c), 0) / MIN_PAR_H;

  const contractuel = Number(hebdoContractuel) > 0 ? Number(hebdoContractuel) : DUREE_LEGALE_HEBDO;
  const tempsPartiel = contractuel < DUREE_LEGALE_HEBDO;

  let normales = total, complementaires = 0, sup25 = 0, sup50 = 0;
  if (tempsPartiel) {
    normales = Math.min(total, contractuel);
    complementaires = Math.max(0, total - contractuel);
  } else if (total > DUREE_LEGALE_HEBDO) {
    normales = DUREE_LEGALE_HEBDO;
    const sup = total - DUREE_LEGALE_HEBDO;
    sup25 = Math.min(sup, SEUIL_SUP_50);
    sup50 = Math.max(0, sup - SEUIL_SUP_50);
  }
  // nuit et dimancheFerie sont des compteurs de MAJORATION : ces heures
  // sont déjà comptées dans normales/sup — elles ne s'additionnent pas
  // au total, elles le qualifient.
  return { total: h(total), normales: h(normales), complementaires: h(complementaires),
    sup25: h(sup25), sup50: h(sup50), nuit: h(nuit), dimancheFerie: h(dimancheFerie) };
}

/* Regroupe des créneaux par semaine civile. */
function parSemaine(creneaux) {
  const semaines = new Map();
  for (const c of creneaux) {
    if (!estDate(c.jour)) continue;
    const l = lundiDe(c.jour);
    if (!semaines.has(l)) semaines.set(l, []);
    semaines.get(l).push(c);
  }
  return semaines;
}

/* ── Contrôles de légalité ───────────────────────────────────────────
   Faits sur le planning PRÉVU : c'est le seul moment où corriger coûte
   encore un déplacement de créneau plutôt qu'un rappel de salaire.
   Chaque point dit la règle et le dépassement constaté, jamais « c'est
   interdit » tout court. */
function controles(creneaux, contrat = {}) {
  const points = [];
  const hebdoContractuel = Number(contrat.hebdoContractuel) > 0
    ? Number(contrat.hebdoContractuel) : DUREE_LEGALE_HEBDO;
  const nom = contrat.nom ? `${contrat.nom} ` : "";

  // 1. Amplitude quotidienne
  const parJour = new Map();
  for (const c of creneaux) {
    if (!estDate(c.jour)) continue;
    parJour.set(c.jour, (parJour.get(c.jour) || 0) + dureeMinutes(c));
  }
  for (const [jour, min] of [...parJour].sort()) {
    const heures = min / MIN_PAR_H;
    if (heures > MAX_QUOTIDIEN)
      points.push({ cle: `quotidien-${jour}`, niveau: "bloquant",
        titre: "Journée de plus de 10 heures",
        detail: `${nom}le ${fr(jour)} : ${h(heures)} h de travail effectif. La durée quotidienne maximale est de ${MAX_QUOTIDIEN} heures (L.3121-18) ; la dépasser suppose une dérogation.` });
  }

  // 2. Durée hebdomadaire et heures supplémentaires
  for (const [lundi, sem] of [...parSemaine(creneaux)].sort()) {
    const r = repartirSemaine(sem, hebdoContractuel);
    if (r.total > MAX_HEBDO)
      points.push({ cle: `hebdo-${lundi}`, niveau: "bloquant",
        titre: "Semaine de plus de 48 heures",
        detail: `${nom}semaine du ${fr(lundi)} : ${r.total} h. La durée hebdomadaire maximale absolue est de ${MAX_HEBDO} heures (L.3121-20).` });
    else if (r.total > MAX_HEBDO_MOYEN)
      points.push({ cle: `hebdo-moyen-${lundi}`, niveau: "attention",
        titre: "Semaine de plus de 44 heures",
        detail: `${nom}semaine du ${fr(lundi)} : ${r.total} h. La moyenne sur douze semaines consécutives ne peut dépasser ${MAX_HEBDO_MOYEN} heures (L.3121-22) — cette semaine devra être compensée.` });

    // Temps partiel porté au niveau légal : requalification en temps plein
    if (hebdoContractuel < DUREE_LEGALE_HEBDO && r.total >= DUREE_LEGALE_HEBDO)
      points.push({ cle: `requalification-${lundi}`, niveau: "bloquant",
        titre: "Temps partiel porté à 35 heures",
        detail: `${nom}semaine du ${fr(lundi)} : ${r.total} h pour un contrat de ${hebdoContractuel} h. Des heures complémentaires ne peuvent pas porter la durée au niveau de la durée légale — le contrat serait requalifié en temps plein (L.3123-9).` });
    else if (hebdoContractuel < DUREE_LEGALE_HEBDO && r.complementaires > hebdoContractuel / 10)
      points.push({ cle: `complementaires-${lundi}`, niveau: "attention",
        titre: "Heures complémentaires au-delà du dixième",
        detail: `${nom}semaine du ${fr(lundi)} : ${r.complementaires} h complémentaires pour un contrat de ${hebdoContractuel} h. Au-delà d'un dixième de la durée contractuelle, il faut un accord collectif le prévoyant (limite alors d'un tiers), et la majoration passe de 10 % à 25 %.` });
  }

  // 3. Repos quotidien : 11 heures entre la fin d'un service et le début du suivant
  const tries = [...creneaux].filter((c) => estDate(c.jour) && estHeure(c.debut) && estHeure(c.fin))
    .sort((a, b) => (a.jour + a.debut).localeCompare(b.jour + b.debut));
  for (let i = 1; i < tries.length; i++) {
    const p = tries[i - 1], c = tries[i];
    const finP = Date.parse(`${p.jour}T${p.fin}:00Z`) + (minutes(p.fin) <= minutes(p.debut) ? 86400000 : 0);
    const debutC = Date.parse(`${c.jour}T${c.debut}:00Z`);
    const ecart = (debutC - finP) / 3600000;
    if (ecart >= 0 && ecart < REPOS_QUOTIDIEN_H)
      points.push({ cle: `repos-${c.jour}-${c.debut}`, niveau: "bloquant",
        titre: "Repos quotidien inférieur à 11 heures",
        detail: `${nom}entre la fin du ${fr(p.jour)} (${p.fin}) et la reprise du ${fr(c.jour)} (${c.debut}) : ${h(ecart)} h. Le repos quotidien minimal est de ${REPOS_QUOTIDIEN_H} heures consécutives (L.3131-1).` });
  }

  // 4. Six jours consécutifs au maximum, et le repos hebdomadaire
  const jours = [...parJour.keys()].filter((j) => parJour.get(j) > 0).sort();
  let serie = 1;
  for (let i = 1; i < jours.length; i++) {
    serie = jourPlus(jours[i - 1], 1) === jours[i] ? serie + 1 : 1;
    if (serie > MAX_JOURS_CONSECUTIFS) {
      points.push({ cle: `consecutifs-${jours[i]}`, niveau: "bloquant",
        titre: "Plus de six jours consécutifs",
        detail: `${nom}${serie} jours travaillés d'affilée jusqu'au ${fr(jours[i])}. Le repos hebdomadaire de ${REPOS_HEBDO_H} heures consécutives est dû après six jours au plus (L.3132-1 et L.3132-2).` });
      break;   // un seul signalement par série suffit à faire agir
    }
  }

  // 5. Le dimanche et les jours fériés ne sont pas interdits, ils se
  //    déclarent : la paie doit savoir, et le 1er mai a son régime propre.
  for (const c of creneaux) {
    if (!estDate(c.jour) || dureeMinutes(c) === 0) continue;
    if (String(c.jour).slice(5) === "05-01")
      points.push({ cle: `premier-mai-${c.jour}`, niveau: "attention",
        titre: "Travail le 1er mai",
        detail: `${nom}le 1er mai est le seul jour férié chômé par la loi. Le travail n'y est admis que dans les établissements qui ne peuvent interrompre leur activité, et il ouvre droit à une indemnité égale au salaire du jour (L.3133-6).` });
  }

  return points;
}

const fr = (iso) => (estDate(iso) ? String(iso).split("-").reverse().join("/") : String(iso || ""));

/* ── Du temps de travail aux variables de paie ───────────────────────
   Les créneaux d'un mois, salarié par salarié, deviennent une ligne de
   variables — exactement les colonnes que « Variables de paie » attend.
   Le découpage reste hebdomadaire à l'intérieur du mois : c'est la
   semaine qui détermine les heures supplémentaires. */
function versVariables(creneaux, salaries, mois) {
  const duMois = creneaux.filter((c) => estDate(c.jour) && c.jour.slice(0, 7) === mois);
  const parSalarie = new Map();
  for (const c of duMois) {
    const cle = String(c.cle || `${c.nom || ""} ${c.prenom || ""}`).trim().toUpperCase();
    if (!cle) continue;
    if (!parSalarie.has(cle)) parSalarie.set(cle, []);
    parSalarie.get(cle).push(c);
  }

  const lignes = [];
  for (const [cle, siens] of parSalarie) {
    const s = (salaries || []).find((x) =>
      `${String(x.nom || "").toUpperCase()} ${String(x.prenom || "").toUpperCase()}`.trim() === cle) || {};
    // Durée contractuelle : mensuelle au dossier, ramenée à la semaine
    // (12 mois / 52 semaines) — 151,67 h mensuelles = 35 h hebdomadaires.
    const hebdo = Number(s.dureeMensuelle) > 0 ? (Number(s.dureeMensuelle) * 12) / 52 : DUREE_LEGALE_HEBDO;
    const cumul = { normales: 0, complementaires: 0, sup25: 0, sup50: 0, nuit: 0, dimancheFerie: 0 };
    for (const [, sem] of parSemaine(siens)) {
      const r = repartirSemaine(sem, hebdo);
      for (const k of Object.keys(cumul)) cumul[k] += r[k];
    }
    lignes.push({
      matricule: s.matricule || "",
      nom: s.nom || cle.split(" ")[0] || "",
      prenom: s.prenom || cle.split(" ").slice(1).join(" "),
      heuresNormales: h(cumul.normales),
      ...(cumul.complementaires ? { heuresComplementaires: h(cumul.complementaires) } : {}),
      ...(cumul.sup25 ? { heuresSup25: h(cumul.sup25) } : {}),
      ...(cumul.sup50 ? { heuresSup50: h(cumul.sup50) } : {}),
      ...(cumul.nuit ? { heuresNuit: h(cumul.nuit) } : {}),
      ...(cumul.dimancheFerie ? { heuresDimancheFerie: h(cumul.dimancheFerie) } : {}),
      commentaire: `Calculé depuis le temps de travail saisi (${siens.length} créneau${siens.length > 1 ? "x" : ""}).`,
    });
  }
  return lignes.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
}

module.exports = {
  dureeMinutes, minutesNuit, repartirSemaine, parSemaine, controles, versVariables,
  feries, paques, estFerie, estDimanche, lundiDe, jourSemaine,
  DUREE_LEGALE_HEBDO, MAX_QUOTIDIEN, MAX_HEBDO, CONTINGENT_ANNUEL,
};
