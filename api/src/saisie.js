// api/src/saisie.js — la saisie sur salaire : le moteur. Calcul pur,
// aucun réseau — tout s'éprouve au banc.
//
// LE MOMENT. Un courrier de commissaire de justice arrive : procès-verbal
// de saisie des rémunérations pour un salarié. Le patron n'y est pour
// rien, mais c'est LUI qui doit tout faire, et vite :
//
//   — RÉPONDRE sous 15 jours : existence du contrat, autres saisies ou
//     cessions en cours. Ne pas répondre, c'est une amende civile
//     pouvant atteindre 10 000 € — et le risque d'être déclaré
//     personnellement débiteur des retenues ;
//   — RETENIR chaque mois la quotité saisissable — ni plus, ni moins.
//     Trop retenu : il en répond envers le salarié. Pas assez : envers
//     le créancier ;
//   — VERSER la retenue au commissaire de justice répartiteur, tous les
//     mois, jusqu'à extinction de la dette ;
//   — et ne JAMAIS sanctionner ni licencier le salarié pour ce motif.
//
// Depuis la réforme entrée en vigueur le 1er juillet 2025, la procédure
// est conduite par les commissaires de justice (plus par le tribunal) :
// commandement de payer, puis procès-verbal de saisie notifié à
// l'employeur. Les textes de fond n'ont pas bougé : le barème des
// quotités saisissables reste fixé par décret, révisé chaque année.
//
// LE CALCUL, et pourquoi personne n'ose le faire. La quotité se calcule
// par TRANCHES de rémunération — comme l'impôt — sur le NET saisissable,
// avec des seuils majorés par personne à charge, et un plancher absolu :
// quoi qu'il arrive, il doit rester au salarié le montant forfaitaire du
// RSA pour une personne seule (le « solde bancaire insaisissable »).
// La PENSION ALIMENTAIRE échappe au barème : le créancier d'aliments
// peut prendre TOUT ce qui dépasse ce plancher (paiement direct).

/* ════════════════════════════════════════════════════════════════════
   BARÈMES — À ACTUALISER CHAQUE ANNÉE
   Sources : décret annuel revalorisant les seuils de saisie des
   rémunérations (art. R.3252-2 et R.3252-3 du code du travail) et
   montant forfaitaire du RSA pour une personne seule. Les valeurs
   ci-dessous sont celles du millésime 2025, ÉCRITES DE MÉMOIRE : AVANT
   toute utilisation en clientèle, confronter chaque chiffre au décret
   de l'année. Ces montants n'ont aucune valeur non vérifiés.
   ════════════════════════════════════════════════════════════════════ */

const BAREMES = {
  2025: {
    // Tranches ANNUELLES de rémunération nette saisissable, et fraction
    // saisissable de chaque tranche. La dernière tranche (au-delà du
    // dernier seuil) est saisissable en totalité.
    tranches: [
      { jusqu: 4440, fraction: 1 / 20 },
      { jusqu: 8660, fraction: 1 / 10 },
      { jusqu: 12890, fraction: 1 / 5 },
      { jusqu: 17090, fraction: 1 / 4 },
      { jusqu: 21300, fraction: 1 / 3 },
      { jusqu: 25600, fraction: 2 / 3 },
      { jusqu: Infinity, fraction: 1 },
    ],
    // Chaque seuil est majoré de ce montant ANNUEL par personne à charge.
    majorationParCharge: 1720,
    // Le plancher absolu : montant forfaitaire mensuel du RSA pour une
    // personne seule. Il reste au salarié quoi qu'il arrive.
    rsaMensuel: 646.52,
  },
};
const ANNEES_CONNUES = Object.keys(BAREMES).map(Number).sort((a, b) => a - b);
const DERNIER_BAREME = ANNEES_CONNUES[ANNEES_CONNUES.length - 1];

function bareme(annee) {
  const a = Number(annee) || DERNIER_BAREME;
  const retenu = BAREMES[a] ? a : DERNIER_BAREME;
  return { annee: retenu, ...BAREMES[retenu], aVerifier: retenu !== a };
}

const sou = (x) => Math.round((Number(x) || 0) * 100) / 100;

/* ════════════════════════════════════════════════════════════════════
   LA QUOTITÉ SAISISSABLE
   Entrée : le net mensuel SAISISSABLE (salaire net, primes comprises,
   MOINS les remboursements de frais professionnels — insaisissables) et
   le nombre de personnes à charge. Le barème est annuel : on le ramène
   au mois, tranche par tranche, et on détaille — le patron doit pouvoir
   vérifier chaque ligne, pas croire un chiffre sorti d'une boîte noire.
   ════════════════════════════════════════════════════════════════════ */
function quotite({ netMensuel, personnesACharge = 0, annee }) {
  const b = bareme(annee);
  const net = Math.max(0, Number(netMensuel) || 0);
  const charges = Math.max(0, Math.round(Number(personnesACharge) || 0));
  const majoration = (b.majorationParCharge * charges) / 12;

  const detail = [];
  let saisissable = 0, plancherPrecedent = 0;
  for (const t of b.tranches) {
    const plafond = t.jusqu === Infinity ? Infinity : t.jusqu / 12 + majoration;
    const assiette = Math.max(0, Math.min(net, plafond) - plancherPrecedent);
    if (assiette > 0) {
      // La part de chaque tranche est arrondie AVANT d'être cumulée : le
      // total est ainsi la somme exacte des lignes affichées — un patron
      // doit pouvoir vérifier le calcul au centime, ligne à ligne.
      const part = sou(assiette * t.fraction);
      detail.push({
        de: sou(plancherPrecedent), a: plafond === Infinity ? null : sou(plafond),
        fraction: t.fraction === 1 ? "totalité"
          : t.fraction === 2 / 3 ? "2/3"
          : `1/${Math.round(1 / t.fraction)}`,
        assiette: sou(assiette), part,
      });
      saisissable += part;
    }
    if (plafond === Infinity || net <= plafond) break;
    plancherPrecedent = plafond;
  }

  // Le plancher absolu : quoi qu'il arrive, le RSA reste au salarié.
  const maxPrelevable = Math.max(0, net - b.rsaMensuel);
  const plafonneParRsa = saisissable > maxPrelevable;
  const retenueMax = sou(Math.min(saisissable, maxPrelevable));

  return {
    netMensuel: sou(net), personnesACharge: charges,
    majorationMensuelle: sou(majoration),
    detail, quotiteBareme: sou(saisissable),
    rsaMensuel: b.rsaMensuel, plafonneParRsa,
    retenueMax,
    resteAuSalarie: sou(net - retenueMax),
    baremeAnnee: b.annee, baremeAVerifier: b.aVerifier,
  };
}

/* La pension alimentaire (paiement direct) échappe au barème : tout ce
   qui dépasse le plancher du RSA peut être pris — dans la limite du
   terme mensuel dû, arriérés compris le cas échéant. */
function pensionAlimentaire({ netMensuel, mensualite, annee }) {
  const b = bareme(annee);
  const net = Math.max(0, Number(netMensuel) || 0);
  const due = Math.max(0, Number(mensualite) || 0);
  const maxPrelevable = Math.max(0, net - b.rsaMensuel);
  const retenue = sou(Math.min(due, maxPrelevable));
  return {
    netMensuel: sou(net), mensualite: sou(due),
    rsaMensuel: b.rsaMensuel,
    retenue, insuffisant: due > maxPrelevable,
    resteAuSalarie: sou(net - retenue),
    baremeAnnee: b.annee, baremeAVerifier: b.aVerifier,
  };
}

/* ════════════════════════════════════════════════════════════════════
   LE DOSSIER : retenue du mois + échéancier
   `type` : "saisie" (barème) ou "pension" (paiement direct).
   Une pension et une saisie peuvent coexister : la pension prime, et la
   saisie ordinaire se calcule sur ce qui reste — cas renvoyé au
   gestionnaire (v1 : un dossier à la fois, on le dit).
   ════════════════════════════════════════════════════════════════════ */
function calculer(d) {
  const type = d.type === "pension" ? "pension" : "saisie";
  const dette = Math.max(0, Number(d.montantDette) || 0);
  const dejaRetenu = Math.max(0, Number(d.dejaRetenu) || 0);
  const restant = sou(Math.max(0, dette - dejaRetenu));

  if (type === "pension") {
    const q = pensionAlimentaire({ netMensuel: d.netMensuel, mensualite: d.mensualite, annee: d.annee });
    return { type, ...q, restantDu: restant || null,
      retenueDuMois: q.retenue,
      // Une pension n'a pas d'échéancier : elle est due chaque mois.
      echeancier: null };
  }

  const q = quotite({ netMensuel: d.netMensuel, personnesACharge: d.personnesACharge, annee: d.annee });
  // La retenue du mois : la quotité, mais jamais plus que ce qui reste
  // dû. Une dette entièrement retenue donne une retenue NULLE — un
  // restant de zéro n'est pas une dette absente.
  const retenueDuMois = dette > 0 ? sou(Math.min(q.retenueMax, restant)) : q.retenueMax;
  let echeancier = null;
  if (restant > 0 && q.retenueMax > 0) {
    const mois = Math.ceil(restant / q.retenueMax);
    echeancier = {
      restantDu: restant, retenueMensuelle: q.retenueMax, mois,
      dernierMois: sou(restant - (mois - 1) * q.retenueMax),
    };
  }
  return { type, ...q, restantDu: restant, retenueDuMois, echeancier,
    soldee: dette > 0 && restant === 0 };
}

/* ════════════════════════════════════════════════════════════════════
   LES OBLIGATIONS — ce que l'employeur doit faire, avec les horloges
   ════════════════════════════════════════════════════════════════════ */
function obligations(d, aujourdhui) {
  const D = require("./delais");
  const jour = aujourdhui || new Date().toISOString().slice(0, 10);
  const recu = D.estDate(d.dateReception) ? d.dateReception : jour;
  // 15 jours pour répondre ; une échéance tombant un jour non ouvrable
  // se reporte au premier jour ouvrable — on ne piège pas un client sur
  // un dimanche.
  let limite = D.ajouter(recu, 15, "calendaires");
  limite = D.reporterSiNonOuvrable(limite);
  const enRetard = limite < jour;

  return {
    reponse: {
      limite, enRetard,
      texte: enRetard
        ? "Le délai de réponse de 15 jours est dépassé — répondez sans attendre : le silence expose à une amende civile pouvant atteindre 10 000 €, et à être déclaré personnellement débiteur."
        : `Répondre au commissaire de justice avant le ${limite.split("-").reverse().join("/")} : existence du contrat de travail, montant de la rémunération, autres saisies ou cessions en cours. Votre gestionnaire prépare cette réponse — il vient d'être prévenu.`,
    },
    gestes: [
      "Retenir chaque mois la quotité calculée — ni plus, ni moins — et la verser au commissaire de justice répartiteur.",
      "Ne JAMAIS sanctionner, écarter ou licencier le salarié en raison de la saisie : la discrimination pour ce motif est interdite.",
      "Prévenir le commissaire de justice de tout changement : arrêt long, départ du salarié, autre saisie reçue.",
      "En cas de fin de contrat, le signaler : la saisie suit le salarié, elle ne s'éteint pas avec le contrat.",
    ],
    discretion: "La saisie est une information strictement confidentielle : seules les personnes qui traitent la paie doivent y avoir accès.",
  };
}

/* Validation de la déclaration. */
function valider(d) {
  const erreurs = [];
  const type = d.type === "pension" ? "pension" : "saisie";
  if (!(Number(d.netMensuel) > 0)) erreurs.push("Salaire net mensuel requis — il figure sur le dernier bulletin.");
  if (type === "saisie" && !(Number(d.montantDette) > 0)) erreurs.push("Montant de la dette requis — il figure sur le procès-verbal de saisie.");
  if (type === "pension" && !(Number(d.mensualite) > 0)) erreurs.push("Mensualité de la pension requise — elle figure sur la notification de paiement direct.");
  if (d.dateReception && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dateReception))) erreurs.push("Date de réception invalide (AAAA-MM-JJ).");
  if (Number(d.personnesACharge) < 0 || Number(d.personnesACharge) > 20) erreurs.push("Nombre de personnes à charge invalide.");
  return erreurs;
}

module.exports = {
  BAREMES, ANNEES_CONNUES, DERNIER_BAREME,
  bareme, quotite, pensionAlimentaire, calculer, obligations, valider, sou,
};
