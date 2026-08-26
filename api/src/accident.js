// api/src/accident.js — l'accident du travail : les 48 heures qui
// comptent. Calcul pur, aucun réseau — tout s'éprouve au banc.
//
// LE MOMENT. Un salarié se blesse, le patron a la tête à l'accident, pas
// au droit. Or c'est maintenant que tout se joue, et sur les délais les
// plus courts de tout le droit du travail :
//
//   — le salarié informe l'employeur dans la JOURNÉE, au plus tard sous
//     24 heures (R.441-2) — on l'affiche, on ne le contrôle pas ;
//   — l'employeur déclare l'accident à la CPAM sous 48 HEURES à compter
//     du moment où il en a connaissance, dimanches et jours fériés non
//     compris (R.441-3). En retard : amende, et la CPAM peut lui faire
//     supporter les dépenses de l'accident ;
//   — il remet AU SALARIÉ la feuille d'accident (S6201) qui lui ouvre la
//     gratuité des soins — tout de suite, sans attendre la déclaration ;
//   — s'il a un doute sur la réalité ou l'origine professionnelle de
//     l'accident, il a DIX JOURS FRANCS à compter de la déclaration pour
//     émettre des réserves MOTIVÉES (R.441-6). Passé ce délai, ou si les
//     réserves ne sont pas motivées, la prise en charge suit son cours —
//     et c'est le taux de cotisation AT de l'entreprise qui en hérite.
//
// CE QUE LE PORTAIL FAIT : capter les faits À CHAUD (lieu, heure,
// circonstances, témoins — dans six mois, plus personne ne se
// souviendra), armer les deux horloges, prévenir le gestionnaire dans la
// minute, et préparer la trame des réserves. La déclaration elle-même
// part par net-entreprises : c'est le geste du cabinet, le portail lui
// donne tout ce qu'il faut pour le faire vite et bien.
//
// L'ACCIDENT DE TRAJET suit le même formulaire et les mêmes délais. La
// MALADIE PROFESSIONNELLE, non : c'est le SALARIÉ qui la déclare à la
// CPAM — le portail le dit pour éviter une déclaration à tort.

const D = require("./delais");

const MOTIFS_ACCIDENT = ["Accident du travail", "Accident de trajet"];
const estAccident = (motif) => MOTIFS_ACCIDENT.includes(String(motif || ""));

const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const estHeure = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
const fr = (iso) => (estDate(iso) ? String(iso).split("-").reverse().join("/") : String(iso || ""));

/* ── L'échéance de la DAT ────────────────────────────────────────────
   48 heures depuis la connaissance, dimanches et jours fériés NON
   COMPRIS : chaque dimanche ou férié traversé étend l'échéance d'une
   journée. Un accident connu le samedi 18 h se déclare au plus tard le
   mardi 18 h — le dimanche ne compte pas.

   Point fixe : on ajoute 48 h, puis tant que l'intervalle contient des
   jours exclus non encore comptés, on ajoute 24 h par jour exclu. */
function echeanceDat(connaissanceDate, connaissanceHeure) {
  if (!estDate(connaissanceDate)) return null;
  const heure = estHeure(connaissanceHeure) ? connaissanceHeure : "23:59";
  // Arithmétique en calendrier « naïf » (tout en UTC, jamais convertie) :
  // l'heure saisie est l'heure de Paris, le serveur tourne en UTC — la
  // moindre conversion locale décalerait le JOUR de l'échéance.
  const debut = Date.UTC(...connaissanceDate.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)),
    Number(heure.slice(0, 2)), Number(heure.slice(3, 5)));
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const exclu = (j) => D.estDimanche(j) || D.estFerie(j);

  let fin = debut + 48 * 3600000;
  const comptes = new Set();
  let bouge = true;
  while (bouge) {
    bouge = false;
    // Le report peut faire atterrir l'échéance SUR un jour exclu : la
    // boucle à point fixe le rattrape au tour suivant.
    for (let t = debut; t <= fin; t += 86400000) {
      const j = iso(t);
      if (exclu(j) && !comptes.has(j)) { comptes.add(j); fin += 86400000; bouge = true; }
    }
    const dernier = iso(fin);
    if (exclu(dernier) && !comptes.has(dernier)) { comptes.add(dernier); fin += 86400000; bouge = true; }
  }
  return { date: iso(fin), heure: new Date(fin).toISOString().slice(11, 16), joursExclus: comptes.size };
}

/* Dix jours FRANCS pour les réserves : le jour de la déclaration ne
   compte pas, et une échéance qui tombe un samedi, un dimanche ou un
   férié est reportée au premier jour ouvrable suivant (délai franc). */
function echeanceReserves(dateDat) {
  if (!estDate(dateDat)) return null;
  let d = D.ajouter(dateDat, 10, "calendaires");
  while (D.estDimanche(d) || D.estFerie(d) || D.jourSemaine(d) === 6) d = D.ajouter(d, 1, "calendaires");
  return d;
}

/* ── Validation du volet accident ────────────────────────────────────
   Ce qui est REQUIS, c'est ce que la DAT exige et ce qui s'oublie :
   quand, où, comment. Le reste enrichit le dossier sans bloquer — on ne
   renvoie pas un patron secoué chercher le numéro de sécu d'un témoin. */
function valider(d) {
  const erreurs = [];
  if (!estDate(d.accidentDate)) erreurs.push("Date de l'accident requise.");
  else if (d.accidentDate > new Date().toISOString().slice(0, 10))
    erreurs.push("La date de l'accident est dans le futur.");
  if (d.accidentHeure && !estHeure(d.accidentHeure)) erreurs.push("Heure de l'accident invalide (format 14:30).");
  if (!String(d.accidentLieu || "").trim()) erreurs.push("Lieu de l'accident requis (atelier, chantier, trajet…).");
  if (String(d.accidentCirconstances || "").trim().length < 15)
    erreurs.push("Décrivez les circonstances en une phrase au moins — c'est ce que la déclaration reprendra mot pour mot.");
  if (d.connaissanceDate) {
    if (!estDate(d.connaissanceDate)) erreurs.push("Date de prise de connaissance invalide.");
    else if (estDate(d.accidentDate) && d.connaissanceDate < d.accidentDate)
      erreurs.push("Vous ne pouvez pas avoir eu connaissance de l'accident avant qu'il survienne.");
  }
  return erreurs;
}

/* ── Le dossier assemblé ─────────────────────────────────────────────
   Rend les échéances, les gestes à faire et les champs propres à
   stocker. `aujourdhui` est injectable pour le banc. */
function dossier(d, aujourdhui) {
  const jour = aujourdhui || new Date().toISOString().slice(0, 10);
  // À défaut d'indication, l'employeur apprend l'accident au moment où
  // il le déclare ici — l'hypothèse la plus favorable au délai.
  const connaissanceDate = estDate(d.connaissanceDate) ? d.connaissanceDate : jour;
  const connaissanceHeure = estHeure(d.connaissanceHeure) ? d.connaissanceHeure : "";

  const dat = echeanceDat(connaissanceDate, connaissanceHeure || "23:59");
  const enRetard = dat && dat.date < jour;

  const gestes = [
    {
      cle: "feuille", quand: "Tout de suite",
      texte: "Remettez au salarié la feuille d'accident du travail (formulaire S6201) — elle lui ouvre la gratuité des soins. Sans elle, il avance les frais.",
    },
    {
      cle: "dat",
      quand: enRetard ? "DÉLAI DÉPASSÉ — déclarez sans attendre" : `Avant le ${fr(dat.date)}${connaissanceHeure ? ` à ${dat.heure}` : ""}`,
      texte: enRetard
        ? "Les 48 heures sont écoulées : déclarez immédiatement — une déclaration tardive vaut toujours mieux qu'une absence de déclaration, et votre gestionnaire joindra les explications du retard."
        : `Déclaration d'accident du travail à la CPAM : 48 heures à compter de votre connaissance de l'accident, dimanches et jours fériés non compris (R.441-3)${dat.joursExclus ? ` — ${dat.joursExclus} jour${dat.joursExclus > 1 ? "s" : ""} non compté${dat.joursExclus > 1 ? "s" : ""} dans votre cas` : ""}. Votre gestionnaire s'en charge : il vient d'être prévenu.`,
    },
    {
      cle: "reserves", quand: "10 jours francs après la déclaration",
      texte: "Si vous avez un doute sur la réalité de l'accident ou son lien avec le travail, dites-le à votre gestionnaire MAINTENANT : les réserves doivent être émises dans les dix jours francs suivant la déclaration, et elles doivent être motivées (R.441-6). Après, la prise en charge s'impose — et pèse sur votre taux de cotisation AT.",
    },
  ];
  // Pas d'arrêt de travail ni de soins ? Le registre des accidents
  // bénins peut remplacer la déclaration — sous conditions strictes.
  if (!d.dateFin && d.benin === true) {
    gestes.push({
      cle: "benin", quand: "Alternative possible",
      texte: "Sans arrêt de travail ni soins médicaux, l'accident peut être inscrit au registre des accidents bénins AU LIEU d'être déclaré — uniquement si l'entreprise tient ce registre (présence d'un sauveteur secouriste et d'un poste de secours, L.441-4). Au moindre doute, déclarez : votre gestionnaire tranche.",
    });
  }

  return {
    connaissanceDate, connaissanceHeure,
    dat: { ...dat, enRetard },
    reserves: { delai: "10 jours francs à compter de la déclaration" },
    gestes,
  };
}

/* Les colonnes SharePoint du volet — écrites avec la ligne d'absence. */
function champs(d, dos) {
  const t = (v, max) => { const s = String(v || "").trim(); return s ? s.slice(0, max) : undefined; };
  const c = {
    AccidentDate: d.accidentDate,
    AccidentHeure: estHeure(d.accidentHeure) ? d.accidentHeure : undefined,
    AccidentLieu: t(d.accidentLieu, 255),
    AccidentCirconstances: t(d.accidentCirconstances, 4000),
    AccidentLesions: t(d.accidentLesions, 1000),
    AccidentTemoins: t(d.accidentTemoins, 1000),
    AccidentTiers: t(d.accidentTiers, 1000),
    ConnaissanceDate: dos.connaissanceDate,
    ...(dos.connaissanceHeure ? { ConnaissanceHeure: dos.connaissanceHeure } : {}),
    DatEcheance: dos.dat?.date,
  };
  Object.keys(c).forEach((k) => c[k] === undefined && delete c[k]);
  return c;
}

/* Le message envoyé au gestionnaire dans la minute — c'est LUI le vrai
   signal, pas l'alerte du flux. Tout ce qu'il faut pour faire la DAT
   sans rappeler le client. */
function messageGestionnaire(d, dos, salarie) {
  const lignes = [
    `${d.motif} — ${salarie}`,
    "",
    `Accident survenu le ${fr(d.accidentDate)}${estHeure(d.accidentHeure) ? ` à ${d.accidentHeure}` : ""}`,
    `Lieu : ${String(d.accidentLieu || "").trim()}`,
    `Circonstances : ${String(d.accidentCirconstances || "").trim()}`,
  ];
  if (String(d.accidentLesions || "").trim()) lignes.push(`Siège et nature des lésions : ${String(d.accidentLesions).trim()}`);
  if (String(d.accidentTemoins || "").trim()) lignes.push(`Témoins : ${String(d.accidentTemoins).trim()}`);
  if (String(d.accidentTiers || "").trim()) lignes.push(`Tiers impliqué : ${String(d.accidentTiers).trim()}`);
  lignes.push(
    "",
    `Employeur informé le ${fr(dos.connaissanceDate)}${dos.connaissanceHeure ? ` à ${dos.connaissanceHeure}` : ""}.`,
    dos.dat?.enRetard
      ? "⚠ LE DÉLAI DE 48 H EST DÉJÀ DÉPASSÉ — déclarer sans attendre, avec les explications du retard."
      : `DAT à transmettre AVANT LE ${fr(dos.dat?.date)}${dos.connaissanceHeure ? ` à ${dos.dat?.heure}` : ""} (48 h hors dimanches et fériés, R.441-3).`,
    "Réserves motivées éventuelles : 10 jours francs à compter de la déclaration (R.441-6).",
    d.dateFin ? "" : "Pas de date de fin d'absence indiquée à ce stade.",
  );
  return {
    objet: `🔴 ${d.motif} — ${salarie} — DAT avant le ${fr(dos.dat?.date)}`,
    message: lignes.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n"),
  };
}

/* ── Trame des réserves motivées ─────────────────────────────────────
   Des réserves non motivées ne valent rien : la CPAM les écarte sans
   examen. La trame force la motivation — elle demande les FAITS. */
function courrierReserves(ctx) {
  return {
    objet: "Réserves motivées sur le caractère professionnel de l'accident",
    avertissement: "À relire et à adapter : des réserves ne valent que MOTIVÉES — datées, factuelles, circonstanciées. Envoyez-les avec la déclaration ou dans les dix jours francs qui suivent, en recommandé avec accusé de réception.",
    corps: [
      `${ctx.raisonSociale || "[Raison sociale]"}`,
      `${ctx.adresseEntreprise || "[Adresse]"}`,
      "",
      "Caisse primaire d'assurance maladie",
      "[Adresse de la caisse]",
      "",
      `${ctx.lieuEdition || "[Ville]"}, le ${fr(ctx.date || "")}`,
      "Lettre recommandée avec accusé de réception",
      "",
      `Objet : réserves motivées — déclaration d'accident du travail de ${ctx.prenom || ""} ${ctx.nom || ""} du ${fr(ctx.accidentDate || "")}`,
      "",
      "Madame, Monsieur,",
      "",
      `Nous avons déclaré l'accident dont ${ctx.prenom || "[Prénom]"} ${ctx.nom || "[Nom]"} indique avoir été victime le ${fr(ctx.accidentDate || "")}. Nous émettons toutefois les réserves suivantes quant à son caractère professionnel :`,
      "",
      "[Exposez ici les FAITS qui fondent le doute — par exemple : absence de témoin ; accident non signalé le jour même alors que l'activité s'est poursuivie normalement ; lésion évoquée dès avant la prise de poste ; circonstances incompatibles avec les horaires ou le lieu de travail. Dates, heures, personnes : plus c'est précis, plus la caisse devra instruire.]",
      "",
      "Nous vous demandons en conséquence de bien vouloir instruire ce dossier au regard de ces éléments et de nous tenir informés des suites données.",
      "",
      "Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
      "",
      `${ctx.representant || "[Représentant]"}`,
      `${ctx.fonctionRepresentant || "[Fonction]"}`,
    ].join("\n"),
  };
}

module.exports = {
  MOTIFS_ACCIDENT, estAccident, echeanceDat, echeanceReserves,
  valider, dossier, champs, messageGestionnaire, courrierReserves,
};
