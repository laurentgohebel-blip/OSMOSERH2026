// api/src/saisies.js — la brique Saisie sur salaire : accès aux
// données, circuit, transmission en paie. Le calcul vit dans saisie.js.
//
// LE CIRCUIT. Le client reçoit le procès-verbal, le déclare ici : le
// portail calcule la quotité (détaillée tranche par tranche), affiche
// les obligations avec l'horloge des 15 jours, et prévient le
// gestionnaire DANS LA MINUTE — c'est lui qui prépare la réponse au
// commissaire de justice. Chaque mois, le client transmet la retenue en
// variables de paie d'un clic ; le cumul retenu avance, et le dossier
// s'éteint tout seul quand la dette est soldée.
//
// CONFIDENTIALITÉ. Une saisie en dit long sur la vie d'un salarié. Elle
// est cloisonnée par CodeClient comme tout le reste, n'apparaît dans
// aucune autre vue du portail, et l'écran rappelle qu'elle ne regarde
// que ceux qui font la paie.
//
// V1, dit honnêtement : UN dossier actif par salarié. Un salarié qui
// cumule pension alimentaire et saisie ordinaire — la pension prime, la
// saisie se calcule sur le reste — relève du gestionnaire, et l'écran
// le dit au lieu de calculer faux.

const S = require("./saisie");

const LISTE = "Saisies sur salaire";
const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const estMois = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));
const cleDe = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();

/* ── Lecture ─────────────────────────────────────────────────────── */
const CHAMPS = "Reference,CodeClient,SalarieNom,SalariePrenom,TypeSaisie,Creancier,"
  + "MontantDette,Mensualite,NetMensuel,PersonnesACharge,DejaRetenu,DateReception,"
  + "Statut,DernierMoisTransmis";

async function dossiersDu(codeClient) {
  const { tokenGraph, idsListes, items, dateParis } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: `Liste « ${LISTE} » introuvable — relancer creer_site_rh.py.` };
  return (await items(tok, ids[LISTE], CHAMPS))
    .filter((x) => x.CodeClient === codeClient)
    .map((x) => ({
      id: x.id, reference: x.Reference || "",
      cle: cleDe(x.SalarieNom, x.SalariePrenom),
      nom: String(x.SalarieNom || "").toUpperCase(), prenom: x.SalariePrenom || "",
      type: x.TypeSaisie === "pension" ? "pension" : "saisie",
      creancier: x.Creancier || "",
      montantDette: Number(x.MontantDette) || 0,
      mensualite: Number(x.Mensualite) || 0,
      netMensuel: Number(x.NetMensuel) || 0,
      personnesACharge: Number(x.PersonnesACharge) || 0,
      dejaRetenu: Number(x.DejaRetenu) || 0,
      dateReception: dateParis(x.DateReception) || "",
      statut: x.Statut || "En cours",
      dernierMoisTransmis: x.DernierMoisTransmis || "",
    }))
    .sort((a, b) => String(b.dateReception).localeCompare(String(a.dateReception)));
}

async function ecrire(fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: `Liste « ${LISTE} » introuvable — relancer creer_site_rh.py.` };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items`, {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: "Enregistrement de la saisie impossible — réessayez.", detail: corps };
  }
  viderCacheItems();
}

async function majDossier(id, fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}/fields`, {
    method: "PATCH", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw { status: 502, erreur: "Mise à jour de la saisie impossible — réessayez." };
  viderCacheItems();
}

const enrichir = (d, jour) => ({
  ...d,
  calcul: S.calculer({ ...d, annee: Number(String(jour).slice(0, 4)) }),
  obligations: S.obligations(d, jour),
});

/* ── Actions ─────────────────────────────────────────────────────── */

async function lister(clientInfo) {
  const jour = new Date().toISOString().slice(0, 10);
  const dossiers = (await dossiersDu(clientInfo.codeClient)).map((d) => enrichir(d, jour));
  return { status: 200, jsonBody: {
    saisies: dossiers,
    bareme: S.bareme(Number(jour.slice(0, 4))),
  } };
}

async function declarer(clientInfo, email, d, context) {
  const erreurs = S.valider(d);
  if (erreurs.length) return { status: 400, jsonBody: { erreur: erreurs[0] } };

  const salaries = await require("./planning").effectif(clientInfo.codeClient);
  const s = salaries.find((x) => x.cle === String(d.cle || "").toUpperCase() || x.cle === cleDe(d.nom, d.prenom));
  if (!s) return { status: 400, jsonBody: { erreur: "Salarié inconnu dans votre effectif." } };

  // V1 : un dossier actif par salarié — le cumul relève du gestionnaire.
  const existants = await dossiersDu(clientInfo.codeClient);
  if (existants.some((x) => x.cle === s.cle && x.statut === "En cours"))
    return { status: 409, jsonBody: { erreur: "Une saisie est déjà en cours pour ce salarié. Le cumul de plusieurs saisies obéit à des règles de rang : contactez votre gestionnaire, qui arbitrera." } };

  const jour = new Date().toISOString().slice(0, 10);
  const type = d.type === "pension" ? "pension" : "saisie";
  const reference = `SAI-${Date.now().toString(36).toUpperCase()}`;
  await ecrire({
    Title: `${type === "pension" ? "Pension alimentaire" : "Saisie"} — ${s.nom} ${s.prenom}`.slice(0, 255),
    Reference: reference,
    CodeClient: clientInfo.codeClient, RaisonSociale: clientInfo.raisonSociale || "",
    SalarieNom: s.nom.slice(0, 120), SalariePrenom: s.prenom.slice(0, 120),
    EmailDemandeur: email, EmailGestionnaire: clientInfo.emailGestionnaire || "",
    TypeSaisie: type,
    ...(String(d.creancier || "").trim() ? { Creancier: String(d.creancier).trim().slice(0, 255) } : {}),
    MontantDette: Math.max(0, Number(d.montantDette) || 0),
    Mensualite: Math.max(0, Number(d.mensualite) || 0),
    NetMensuel: Math.max(0, Number(d.netMensuel) || 0),
    PersonnesACharge: Math.max(0, Math.round(Number(d.personnesACharge) || 0)),
    DejaRetenu: 0,
    DateReception: estDate(d.dateReception) ? d.dateReception : jour,
    Statut: "En cours",
  });

  const dossier = enrichir({
    type, creancier: d.creancier, montantDette: d.montantDette, mensualite: d.mensualite,
    netMensuel: d.netMensuel, personnesACharge: d.personnesACharge, dejaRetenu: 0,
    dateReception: estDate(d.dateReception) ? d.dateReception : jour,
  }, jour);

  // Le gestionnaire prépare la réponse des 15 jours : il est prévenu
  // dans la minute par le fil « Mon gestionnaire ». Un échec d'envoi ne
  // fait pas échouer la déclaration — mais il se voit dans les journaux.
  try {
    const { creerMessageGestionnaire } = require("./functions/demande");
    await creerMessageGestionnaire(email, clientInfo, {
      objet: `🔴 ${type === "pension" ? "Pension alimentaire (paiement direct)" : "Saisie sur salaire"} — ${s.nom} ${s.prenom} — réponse avant le ${dossier.obligations.reponse.limite.split("-").reverse().join("/")}`,
      message: [
        `${type === "pension" ? "Notification de paiement direct" : "Procès-verbal de saisie"} reçu le ${dossier.dateReception.split("-").reverse().join("/")}.`,
        `Salarié : ${s.nom} ${s.prenom}${s.matricule ? ` (matricule ${s.matricule})` : ""}`,
        d.creancier ? `Créancier / référence : ${String(d.creancier).trim()}` : "",
        type === "pension"
          ? `Mensualité due : ${S.sou(d.mensualite).toFixed(2)} €`
          : `Dette totale : ${S.sou(d.montantDette).toFixed(2)} €`,
        `Net mensuel déclaré : ${S.sou(d.netMensuel).toFixed(2)} € — ${Math.round(Number(d.personnesACharge) || 0)} personne(s) à charge`,
        `Retenue mensuelle calculée : ${dossier.calcul.retenueDuMois.toFixed(2)} € (barème ${dossier.calcul.baremeAnnee}${dossier.calcul.baremeAVerifier ? " — À VÉRIFIER, millésime plus récent non chargé" : ""})`,
        "",
        `RÉPONSE À ADRESSER AU COMMISSAIRE DE JUSTICE AVANT LE ${dossier.obligations.reponse.limite.split("-").reverse().join("/")} : situation du contrat, rémunération, autres saisies ou cessions en cours.`,
      ].filter(Boolean).join("\n"),
    }, reference);
  } catch (e) { context?.error?.("saisie : message gestionnaire non envoyé —", e?.erreur || e?.message || e); }

  return { status: 201, jsonBody: { reference, ...dossier } };
}

/* La retenue du mois part en variables de paie. Aperçu implicite : le
   client a déjà le calcul sous les yeux — mais rien n'est transmis deux
   fois pour le même mois. */
async function transmettre(clientInfo, email, d) {
  const mois = estMois(d.mois) ? d.mois : new Date().toISOString().slice(0, 7);
  const dossiers = await dossiersDu(clientInfo.codeClient);
  const dossier = dossiers.find((x) => String(x.id) === String(d.id));
  if (!dossier) return { status: 404, jsonBody: { erreur: "Saisie introuvable." } };
  if (dossier.statut !== "En cours") return { status: 409, jsonBody: { erreur: "Cette saisie n'est plus en cours." } };
  if (dossier.dernierMoisTransmis === mois)
    return { status: 409, jsonBody: { erreur: `La retenue de ${mois.split("-").reverse().join("/")} a déjà été transmise.` } };

  const jour = new Date().toISOString().slice(0, 10);
  const calc = S.calculer({ ...dossier, annee: Number(mois.slice(0, 4)) });
  if (!(calc.retenueDuMois > 0))
    return { status: 400, jsonBody: { erreur: "Aucune retenue à opérer ce mois-ci (dette soldée ou salaire sous le plancher insaisissable)." } };

  const { creerVariablesPaie } = require("./annuaire");
  const salaries = await require("./planning").effectif(clientInfo.codeClient).catch(() => []);
  const s = salaries.find((x) => x.cle === dossier.cle) || {};
  await creerVariablesPaie(email, clientInfo, mois, [{
    nom: dossier.nom, prenom: dossier.prenom, matricule: s.matricule || "",
    saisieArret: calc.retenueDuMois,
    commentaire: `${dossier.type === "pension" ? "Pension alimentaire (paiement direct)" : "Saisie sur rémunérations"} — retenue de ${mois.split("-").reverse().join("/")} : ${calc.retenueDuMois.toFixed(2)} €${dossier.type === "saisie" ? ` (restant dû après ce mois : ${S.sou(Math.max(0, calc.restantDu - calc.retenueDuMois)).toFixed(2)} €)` : ""} — réf. ${dossier.reference}`,
  }]);

  // La pension est due chaque mois : le cumul ne l'éteint pas. La saisie
  // ordinaire avance vers l'extinction.
  const majs = { DernierMoisTransmis: mois };
  if (dossier.type === "saisie") {
    const cumul = S.sou(dossier.dejaRetenu + calc.retenueDuMois);
    majs.DejaRetenu = cumul;
    if (cumul >= dossier.montantDette) majs.Statut = "Soldée";
  }
  await majDossier(dossier.id, majs);

  return { status: 202, jsonBody: { mois, retenue: calc.retenueDuMois,
    soldee: majs.Statut === "Soldée",
    restantDu: dossier.type === "saisie" ? S.sou(Math.max(0, dossier.montantDette - (majs.DejaRetenu ?? dossier.dejaRetenu))) : null } };
}

/* Clore : mainlevée du créancier, départ du salarié, erreur de saisie. */
async function cloturer(clientInfo, d) {
  const dossiers = await dossiersDu(clientInfo.codeClient);
  const dossier = dossiers.find((x) => String(x.id) === String(d.id));
  if (!dossier) return { status: 404, jsonBody: { erreur: "Saisie introuvable." } };
  await majDossier(dossier.id, { Statut: "Clôturée" });
  return { status: 200, jsonBody: { ok: true } };
}

/* Mise à jour du dossier : le net change (augmentation, temps partiel),
   une personne à charge de plus — la quotité doit suivre la vie réelle. */
async function actualiser(clientInfo, d) {
  const dossiers = await dossiersDu(clientInfo.codeClient);
  const dossier = dossiers.find((x) => String(x.id) === String(d.id));
  if (!dossier) return { status: 404, jsonBody: { erreur: "Saisie introuvable." } };
  const majs = {};
  if (Number(d.netMensuel) > 0) majs.NetMensuel = S.sou(d.netMensuel);
  if (d.personnesACharge !== undefined && Number(d.personnesACharge) >= 0)
    majs.PersonnesACharge = Math.round(Number(d.personnesACharge));
  if (!Object.keys(majs).length) return { status: 400, jsonBody: { erreur: "Rien à mettre à jour." } };
  await majDossier(dossier.id, majs);
  const jour = new Date().toISOString().slice(0, 10);
  return { status: 200, jsonBody: enrichir({ ...dossier,
    netMensuel: majs.NetMensuel ?? dossier.netMensuel,
    personnesACharge: majs.PersonnesACharge ?? dossier.personnesACharge }, jour) };
}

module.exports = { lister, declarer, transmettre, cloturer, actualiser, dossiersDu, LISTE };
