// api/src/delais.js — compter les jours comme le code du travail les compte.
//
// Une procédure RH est une horloge. Et les horloges du droit social ne
// battent pas toutes au même rythme : le délai de rétractation d'une
// rupture conventionnelle se compte en jours CALENDAIRES, celui qui
// sépare la convocation de l'entretien préalable en jours OUVRABLES,
// la modification du planning d'un temps partiel en jours OUVRÉS.
// Confondre les trois, c'est se tromper de deux à quatre jours — assez
// pour rendre un licenciement irrégulier.
//
//   calendaires : tous les jours, sans exception
//   ouvrables   : tous SAUF les dimanches et les jours fériés
//                 (le samedi est ouvrable, c'est la surprise la plus
//                 fréquente pour qui ne pratique pas)
//   ouvrés      : les jours normalement travaillés dans l'entreprise —
//                 lundi à vendredi hors fériés dans le cas général
//
// Les jours fériés viennent de temps.js, qui les recalcule année par
// année (Pâques comprise) : une source unique pour tout le portail.

const { estFerie } = require("./temps");

const JOUR = 86400000;
const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const jourPlus = (d, n) => iso(Date.parse(`${d}T12:00:00Z`) + n * JOUR);
/* Lundi = 1 … dimanche = 7 (ISO 8601). */
const jourSemaine = (d) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

const estOuvrable = (d) => jourSemaine(d) !== 7 && !estFerie(d);
const estOuvre = (d) => jourSemaine(d) <= 5 && !estFerie(d);

const TYPES = {
  calendaires: () => true,
  ouvrables: estOuvrable,
  ouvres: estOuvre,
};

/* Ajoute n jours du type demandé. Le jour de départ n'est jamais
   compté : « cinq jours ouvrables après la présentation » signifie que
   l'on compte à partir du lendemain. */
function ajouter(depart, n, type = "calendaires") {
  if (!estDate(depart)) return "";
  const compte = TYPES[type] || TYPES.calendaires;
  let d = depart, restants = Math.max(0, Math.round(Number(n) || 0));
  while (restants > 0) {
    d = jourPlus(d, 1);
    if (compte(d)) restants--;
  }
  return d;
}

/* Une échéance « au plus tôt » qui tomberait un jour non ouvrable est
   reportée au jour ouvrable suivant : le délai doit être ENTIER, on ne
   convoque pas un salarié un dimanche pour gagner vingt-quatre heures. */
function reporterSiNonOuvrable(d) {
  if (!estDate(d)) return "";
  let j = d;
  while (!estOuvrable(j)) j = jourPlus(j, 1);
  return j;
}

/* Nombre de jours du type demandé entre deux dates, bornes exclues au
   départ et incluses à l'arrivée — la même convention que `ajouter`,
   pour que les deux fonctions se répondent. */
function compter(depuis, jusqu, type = "calendaires") {
  if (!estDate(depuis) || !estDate(jusqu) || jusqu < depuis) return 0;
  const compte = TYPES[type] || TYPES.calendaires;
  let n = 0, d = depuis;
  while (d < jusqu) {
    d = jourPlus(d, 1);
    if (compte(d)) n++;
  }
  return n;
}

/* Ajoute des mois de date à date (L.1226-4 : « dans le délai d'un mois
   à compter de l'examen médical »). Le 31 janvier + 1 mois donne le
   28 février : on retient le dernier jour du mois d'arrivée quand le
   quantième n'existe pas. */
function ajouterMois(depart, n) {
  if (!estDate(depart)) return "";
  const [a, m, j] = depart.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + Number(n), 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

const fr = (d) => (estDate(d) ? d.split("-").reverse().join("/") : String(d || ""));

module.exports = { ajouter, ajouterMois, compter, reporterSiNonOuvrable, estOuvrable, estOuvre, jourPlus, jourSemaine, estDate, fr,
  estFerie, estDimanche: (d) => jourSemaine(d) === 7 };
