// api/src/planning.js — le planning d'équipe et le pointage.
//
// Deux gestes, une seule matière : des créneaux. Le patron pose ce qui
// est PRÉVU (le planning), le salarié ou le responsable déclare ce qui a
// été RÉALISÉ (le pointage). Les deux coexistent — le pointage ne
// remplace pas le planning, il le confronte — et les deux alimentent la
// paie sans ressaisie.
//
// Le calcul des heures vit dans temps.js, qui ne connaît ni Graph ni
// jeton : c'est là que se vérifient les règles dont une erreur se paie
// en rappel de salaire. Ce module-ci ne fait que lire, écrire et
// autoriser.
//
// LE POINTAGE SANS MATÉRIEL. Pas de badgeuse : un QR code affiché près
// de la porte mène à une page publique. Son adresse porte un jeton
// DÉRIVÉ du code client par HMAC — rien n'est stocké, rien à créer, et
// le jeton se révoque en changeant le secret. Sans POINTAGE_SECRET dans
// la Static Web App, la brique est absente : le planning fonctionne,
// simplement personne ne peut pointer.
//
// Ce que le pointage vaut, dit franchement : c'est un registre
// DÉCLARATIF, comme le cahier qu'il remplace. Quelqu'un peut pointer
// pour un collègue. Il apporte deux choses que le cahier n'a pas :
// l'heure vient du SERVEUR (le téléphone ne décide de rien) et la ligne
// est datée à la seconde, donc invérifiable après coup. L'employeur
// garde la main : il voit tout et corrige.

const crypto = require("crypto");
const temps = require("./temps");

const LISTE = "Temps de travail";
const MAX_CRENEAUX = 400;          // un mois d'équipe, largement
const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const estHeure = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
const cleDe = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();

/* ── Jeton de pointage ───────────────────────────────────────────────
   Dérivé, jamais stocké : le même code client redonne toujours le même
   jeton, et personne ne peut le fabriquer sans le secret. */
const pointageConfigure = () => !!process.env.POINTAGE_SECRET;
const jetonPointage = (codeClient) =>
  crypto.createHmac("sha256", String(process.env.POINTAGE_SECRET))
    .update(`pointage:${codeClient}`).digest("hex").slice(0, 32);

function clientDuJeton(jeton, clients) {
  if (!pointageConfigure() || !/^[0-9a-f]{32}$/.test(String(jeton || ""))) return null;
  for (const c of clients) {
    const attendu = jetonPointage(c.CodeClient);
    // Comparaison à temps constant : un jeton se devine octet par octet
    // quand la comparaison s'arrête au premier caractère différent.
    if (attendu.length === jeton.length
      && crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(String(jeton)))) return c;
  }
  return null;
}

/* ── Lecture ─────────────────────────────────────────────────────── */
async function creneauxDu(codeClient, depuis, jusqu) {
  const { tokenGraph, idsListes, items, dateParis } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: `Liste « ${LISTE} » introuvable — relancer creer_site_rh.py.` };
  return (await items(tok, ids[LISTE], "CodeClient,SalarieNom,SalariePrenom,Jour,Debut,Fin,PauseMinutes,Source,Statut,Commentaire"))
    .filter((x) => x.CodeClient === codeClient)
    .map((x) => ({
      id: x.id,
      cle: cleDe(x.SalarieNom, x.SalariePrenom),
      nom: x.SalarieNom || "", prenom: x.SalariePrenom || "",
      jour: dateParis(x.Jour) || "", debut: x.Debut || "", fin: x.Fin || "",
      pause: Number(x.PauseMinutes) || 0,
      source: x.Source || "Planning", statut: x.Statut || "Prévu",
      commentaire: x.Commentaire || "",
    }))
    .filter((x) => estDate(x.jour) && (!depuis || x.jour >= depuis) && (!jusqu || x.jour <= jusqu))
    .sort((a, b) => (a.jour + a.debut).localeCompare(b.jour + b.debut));
}

async function ecrireCreneau(codeClient, c, source, statut) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: `${c.nom} ${c.prenom || ""} — ${c.jour}`.trim().slice(0, 255),
      CodeClient: codeClient,
      SalarieNom: String(c.nom || "").toUpperCase().slice(0, 120),
      SalariePrenom: String(c.prenom || "").slice(0, 120),
      Jour: c.jour, Debut: c.debut, Fin: c.fin,
      PauseMinutes: Math.max(0, Number(c.pause) || 0),
      Source: source, Statut: statut,
      ...(c.commentaire ? { Commentaire: String(c.commentaire).slice(0, 1000) } : {}),
    } }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: "Enregistrement du créneau impossible — réessayez.", detail: corps };
  }
  viderCacheItems();
}

async function supprimerCreneau(codeClient, id) {
  const { tokenGraph, idsListes, items, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  // Cloisonnement : on ne supprime que ce qui appartient à ce client.
  const sien = (await items(tok, ids[LISTE], "CodeClient")).find((x) => String(x.id) === String(id));
  if (!sien || sien.CodeClient !== codeClient) throw { status: 404, erreur: "Créneau introuvable." };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw { status: 502, erreur: "Suppression impossible — réessayez." };
  viderCacheItems();
}

/* Effectif du client, avec la durée contractuelle : c'est elle qui
   décide si une heure au-delà est complémentaire ou supplémentaire. */
async function effectif(codeClient) {
  const { tokenGraph, idsListes, items, SELECT_SALARIES } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids["Salariés"]) return [];
  return (await items(tok, ids["Salariés"], SELECT_SALARIES))
    .filter((s) => s.CodeClient === codeClient && s.Statut !== "Sorti")
    .map((s) => ({
      cle: cleDe(s.Nom, s.Prenom),
      nom: String(s.Nom || "").toUpperCase(), prenom: s.Prenom || "",
      matricule: s.Matricule || "", poste: s.Poste || "",
      // La fiche ne porte pas la durée mensuelle : elle vit sur le
      // contrat. À défaut, on retient la durée légale, et le contrôle
      // du temps partiel ne se déclenche pas — mieux vaut ne rien dire
      // que d'inventer un temps partiel.
      dureeMensuelle: Number(s.DureeMensuelle) || 0,
    }));
}

/* ── Actions ─────────────────────────────────────────────────────── */

/* Le planning d'une période, avec les heures déjà réparties et les
   points de vigilance — le client voit ce que sa semaine produira
   AVANT de la faire travailler. */
async function lire(clientInfo, d) {
  const depuis = estDate(d.depuis) ? d.depuis : temps.lundiDe(new Date().toISOString().slice(0, 10));
  const jusqu = estDate(d.jusqu) ? d.jusqu : new Date(Date.parse(depuis) + 27 * 86400000).toISOString().slice(0, 10);
  const [creneaux, salaries] = await Promise.all([creneauxDu(clientInfo.codeClient, depuis, jusqu), effectif(clientInfo.codeClient)]);

  const parSalarie = salaries.map((s) => {
    const siens = creneaux.filter((c) => c.cle === s.cle);
    const hebdo = s.dureeMensuelle > 0 ? (s.dureeMensuelle * 12) / 52 : temps.DUREE_LEGALE_HEBDO;
    const semaines = [...temps.parSemaine(siens)]
      .sort()
      .map(([lundi, sem]) => ({ lundi, ...temps.repartirSemaine(sem, hebdo) }));
    return { ...s, hebdoContractuel: Math.round(hebdo * 100) / 100, semaines,
      points: temps.controles(siens, { hebdoContractuel: hebdo, nom: `${s.nom} ${s.prenom} :` }) };
  });

  return { status: 200, jsonBody: {
    depuis, jusqu, creneaux, salaries: parSalarie,
    points: parSalarie.flatMap((s) => s.points),
    pointage: pointageConfigure()
      ? { actif: true, jeton: jetonPointage(clientInfo.codeClient) }
      : { actif: false },
  } };
}

/* Pose ou remplace des créneaux. Écriture en lot : une semaine d'équipe
   se saisit d'un coup, pas créneau par créneau. */
async function poser(clientInfo, d) {
  const liste = Array.isArray(d.creneaux) ? d.creneaux : [];
  if (!liste.length) return { status: 400, jsonBody: { erreur: "Aucun créneau à enregistrer." } };
  if (liste.length > MAX_CRENEAUX) return { status: 400, jsonBody: { erreur: `Trop de créneaux (${MAX_CRENEAUX} au maximum par envoi).` } };

  const salaries = await effectif(clientInfo.codeClient);
  const propres = [];
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i];
    if (!estDate(c.jour)) return { status: 400, jsonBody: { erreur: `Créneau ${i + 1} : date invalide.` } };
    if (!estHeure(c.debut) || !estHeure(c.fin)) return { status: 400, jsonBody: { erreur: `Créneau ${i + 1} : horaires invalides (format 09:00).` } };
    const s = salaries.find((x) => x.cle === cleDe(c.nom, c.prenom) || x.cle === String(c.cle || "").toUpperCase());
    if (!s) return { status: 400, jsonBody: { erreur: `Créneau ${i + 1} : salarié inconnu dans votre effectif.` } };
    if (temps.dureeMinutes(c) === 0) return { status: 400, jsonBody: { erreur: `Créneau ${i + 1} : durée nulle (vérifiez les horaires et la pause).` } };
    propres.push({ ...c, nom: s.nom, prenom: s.prenom });
  }

  // Les contrôles sont rendus AVEC la réponse, jamais bloquants : un
  // planning peut légitimement dépasser (dérogation, astreinte, accord
  // d'entreprise). On informe celui qui décide, on ne décide pas.
  const existants = await creneauxDu(clientInfo.codeClient);
  for (const c of propres) await ecrireCreneau(clientInfo.codeClient, c, "Planning", "Prévu");

  const points = [];
  for (const s of salaries) {
    const siens = [...existants, ...propres].filter((c) => cleDe(c.nom, c.prenom) === s.cle);
    if (!siens.length) continue;
    const hebdo = s.dureeMensuelle > 0 ? (s.dureeMensuelle * 12) / 52 : temps.DUREE_LEGALE_HEBDO;
    points.push(...temps.controles(siens, { hebdoContractuel: hebdo, nom: `${s.nom} ${s.prenom} :` }));
  }
  return { status: 201, jsonBody: { enregistres: propres.length, points } };
}

/* Le mois de planning devient les variables de paie. Ce n'est pas un
   envoi automatique : le client voit les lignes calculées et valide. */
async function versVariables(clientInfo, email, d) {
  const mois = /^\d{4}-\d{2}$/.test(String(d.mois || "")) ? d.mois : new Date().toISOString().slice(0, 7);
  const [creneaux, salaries] = await Promise.all([
    creneauxDu(clientInfo.codeClient, `${mois}-01`, `${mois}-31`),
    effectif(clientInfo.codeClient),
  ]);
  const lignes = temps.versVariables(creneaux, salaries, mois);
  if (!lignes.length) return { status: 400, jsonBody: { erreur: `Aucun temps de travail saisi pour ${mois}.` } };
  if (d.mode === "apercu") return { status: 200, jsonBody: { mois, lignes } };

  const { creerVariablesPaie } = require("./annuaire");
  await creerVariablesPaie(email, clientInfo, mois, lignes);
  return { status: 202, jsonBody: { mois, lignes: lignes.length } };
}

/* ── Pointage public ─────────────────────────────────────────────────
   Aucun compte, aucun mot de passe : le jeton du QR code vaut accès à
   la seule chose qu'il ouvre — déclarer une arrivée ou un départ pour
   ce client. Rien ne s'y lit qui ne soit affiché près de la porte. */
async function pointage(d, context) {
  if (!pointageConfigure()) return { status: 503, jsonBody: { erreur: "Pointage non configuré." } };
  const { tokenGraph, idsListes, items, SELECT_CLIENTS } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const clients = (await items(tok, ids["Paramètres clients"], SELECT_CLIENTS)).filter((c) => c.Actif !== false);
  const client = clientDuJeton(d.jeton, clients);
  if (!client) return { status: 404, jsonBody: { erreur: "Lien de pointage inconnu ou expiré." } };

  const salaries = await effectif(client.CodeClient);
  if (d.mode === "info") {
    // On ne renvoie que les prénoms et noms : le strict nécessaire pour
    // se reconnaître dans une liste, rien du dossier.
    return { status: 200, jsonBody: {
      raisonSociale: client.RaisonSociale || client.CodeClient,
      salaries: salaries.map((s) => ({ cle: s.cle, nom: s.nom, prenom: s.prenom })),
    } };
  }

  const s = salaries.find((x) => x.cle === String(d.cle || "").toUpperCase());
  if (!s) return { status: 400, jsonBody: { erreur: "Salarié inconnu." } };

  // L'heure vient du SERVEUR, calée sur Paris : le téléphone ne décide
  // de rien, et une horloge déréglée ne fabrique pas des heures.
  const maintenant = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const jour = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
  const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;

  const dujour = (await creneauxDu(client.CodeClient, jour, jour))
    .filter((c) => c.cle === s.cle && c.source === "Pointage");
  const ouvert = dujour.find((c) => !c.fin);

  if (d.mode === "depart") {
    if (!ouvert) return { status: 409, jsonBody: { erreur: "Aucune arrivée enregistrée aujourd'hui — pointez d'abord votre arrivée." } };
    await majCreneau(ouvert.id, { Fin: heure, Statut: "Réalisé" });
    return { status: 200, jsonBody: { sens: "depart", heure, salarie: `${s.prenom} ${s.nom}`.trim() } };
  }
  if (ouvert) return { status: 409, jsonBody: { erreur: `Une arrivée est déjà enregistrée à ${ouvert.debut} — pointez votre départ.` } };
  await ecrireCreneau(client.CodeClient, { nom: s.nom, prenom: s.prenom, jour, debut: heure, fin: "", pause: 0 }, "Pointage", "Prévu");
  context?.log?.(`pointage ${client.CodeClient} ${s.cle} arrivée ${heure}`);
  return { status: 201, jsonBody: { sens: "arrivee", heure, salarie: `${s.prenom} ${s.nom}`.trim() } };
}

async function majCreneau(id, fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}/fields`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw { status: 502, erreur: "Enregistrement du pointage impossible — réessayez." };
  viderCacheItems();
}

module.exports = {
  lire, poser, supprimer: supprimerCreneau, versVariables, pointage,
  jetonPointage, pointageConfigure, clientDuJeton, creneauxDu, effectif,
};
