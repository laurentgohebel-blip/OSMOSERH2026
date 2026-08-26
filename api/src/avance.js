// api/src/avance.js — l'avance sur salaire : le cousin de l'acompte que
// tout le monde confond. Calcul pur, aucun réseau.
//
// L'ACOMPTE paie du travail DÉJÀ FAIT : il se déduit intégralement de la
// paie du mois, sans limite. L'AVANCE est un PRÊT sur du travail à
// venir — et la loi protège le salarié qui l'a reçue : l'employeur ne
// peut se rembourser que par retenues successives, plafonnées à UN
// DIXIÈME du salaire exigible à chaque paie (L.3251-3). Le patron qui
// prête 1 000 € et les retient d'un coup le mois suivant est en tort —
// même si le salarié était d'accord.
//
// (Le dixième s'applique au salaire exigible ; le portail le calcule
// sur le NET MENSUEL déclaré et le dit — c'est l'assiette usuelle en
// paie TPE, le gestionnaire ajuste au bulletin près.)
//
// Ce module rend l'échéancier : la retenue mensuelle maximale, le
// nombre de mois, le dernier mois qui solde exactement. Le salarié qui
// part avant la fin : le solde se retient sur le solde de tout compte
// (là, sans limite du dixième — la compensation finale est libre).

const sou = (x) => Math.round((Number(x) || 0) * 100) / 100;
const estMois = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));

function moisSuivant(m) {
  const [a, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(a, mm, 1)); // mm est déjà le mois suivant (0-indexé)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function valider(d) {
  const erreurs = [];
  if (!(Number(d.montant) > 0)) erreurs.push("Montant de l'avance requis.");
  if (Number(d.montant) > 100000) erreurs.push("Montant invraisemblable — vérifiez.");
  if (!(Number(d.netMensuel) > 0)) erreurs.push("Salaire net mensuel requis — il fixe le plafond de retenue (un dixième par paie, L.3251-3).");
  if (d.premierMois && !estMois(d.premierMois)) erreurs.push("Premier mois de retenue invalide (AAAA-MM).");
  return erreurs;
}

/* L'échéancier de remboursement au dixième. */
function echeancier({ montant, netMensuel, premierMois }) {
  const avance = sou(montant);
  const plafond = sou(Number(netMensuel) / 10);
  if (!(avance > 0) || !(plafond > 0)) return null;

  const nb = Math.ceil(avance / plafond);
  const dernier = sou(avance - (nb - 1) * plafond);
  const lignes = [];
  let mois = estMois(premierMois) ? premierMois : new Date().toISOString().slice(0, 7);
  for (let i = 0; i < nb; i++) {
    lignes.push({ mois, retenue: i === nb - 1 ? dernier : plafond });
    mois = moisSuivant(mois);
  }
  return {
    montant: avance,
    netMensuel: sou(netMensuel),
    retenueMensuelle: plafond,
    mois: nb,
    dernierMois: dernier,
    lignes,
    // La phrase que l'écran affiche — la règle, pas un conseil.
    regle: `Remboursement par retenues plafonnées à un dixième du salaire (L.3251-3) : ${plafond.toFixed(2).replace(".", ",")} € par mois pendant ${nb} mois${nb > 1 ? `, dernier mois ${dernier.toFixed(2).replace(".", ",")} €` : ""}. En cas de départ, le solde restant se retient sur le solde de tout compte.`,
  };
}

/* Le résumé texte stocké avec la demande — le gestionnaire de paie le
   lit tel quel, sans recalcul. */
function resume(e) {
  if (!e) return "";
  return [
    `AVANCE de ${e.montant.toFixed(2)} € — remboursement au 1/10e (L.3251-3)`,
    `Net mensuel déclaré : ${e.netMensuel.toFixed(2)} € → retenue max ${e.retenueMensuelle.toFixed(2)} €/mois`,
    ...e.lignes.map((l) => `${l.mois} : ${l.retenue.toFixed(2)} €`),
  ].join("\n");
}

module.exports = { valider, echeancier, resume, sou };
