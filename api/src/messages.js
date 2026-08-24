// api/src/messages.js — fil de discussion client ↔ gestionnaire.
// Le canal « Mon gestionnaire » cesse d'être un aller simple : chaque
// élément de « Messages gestionnaire » est la TÊTE D'UN FIL (message
// initial dans `Message`), les réponses s'accumulent dans la colonne
// `Echanges` (JSON [{ qui: "client"|"gestionnaire", quand: ISO, texte }]).
// Voir docs/Fil-messagerie-portail.md — lot 1 : lecture côté client.
//
// Doctrine du 21/08 (me.js) : AUCUNE nouvelle route /api/<nom> — ce module
// n'exporte que des handlers, chargés paresseusement :
//   - GET  /api/me?vue=messages                → fils()     fils du client ;
//   - GET  /api/me?vue=admin&onglet=messages   → boite()    tous les fils (gestionnaire) ;
//   - POST /api/demande { action: "messageRepondre", id, texte } → repondre() ;
//   - POST /api/demande { action: "messageStatut", id, clos?, lu? } → statut().
// Chaque handler se suffit : jeton re-vérifié ICI, rôle déduit du jeton
// (adresse dans ADMIN_EMAILS → gestionnaire, sinon client résolu), et
// propriété du fil vérifiée sur le CodeClient AVANT toute écriture — un id
// d'un autre client répond 404, jamais une fuite. Rien n'est cru du payload.

const { verifierJeton, resoudreClient, tokenGraph, idsListes, items, viderCacheItems } = require("./annuaire");

const LISTE = "Messages gestionnaire";

/* Même liste blanche que admin.js : les adresses d'ADMIN_EMAILS sont les
   gestionnaires — pour la messagerie, ils voient et répondent à tous les fils. */
function estGestionnaire(email) {
  return (process.env.ADMIN_EMAILS || "")
    .split(",").map((a) => a.trim().toLowerCase()).filter(Boolean)
    .includes(email);
}

// Colonnes du fil — celles de creer_site_rh.py. Sur un tenant pas encore
// re-provisionné, Graph tolère la sélection de colonnes absentes (type
// ouvert) ; par prudence on retombe quand même sur les colonnes
// historiques si la lecture complète échoue : le canal reste lisible,
// simplement sans les réponses.
// UNE sélection pour toutes les lectures de la liste : le cache de
// items() est par liste (pas par champs) — deux sélections différentes
// se serviraient mutuellement des lignes incomplètes.
const CHAMPS_FIL = "CodeClient,Title,Message,Reference,Statut,Created,Echanges,DerniereMaj,DernierAuteur,Clos,NonLuClient,RaisonSociale,EmailDemandeur,NonLuGestionnaire";
const CHAMPS_HISTORIQUES = "CodeClient,Title,Message,Reference,Statut,Created,RaisonSociale,EmailDemandeur";

/* Ligne SharePoint → fil servi au portail. Toutes les nouvelles colonnes
   ont un défaut : une liste d'avant la messagerie reste servie à
   l'identique (echanges vides, dernière activité = création). */
function enFil(x) {
  let echanges = [];
  try {
    const j = JSON.parse(x.Echanges || "[]");
    if (Array.isArray(j)) echanges = j;
  } catch { /* JSON abîmé : le fil s'affiche sans ses réponses, jamais d'erreur */ }
  const derniereMaj = x.DerniereMaj || x.Created || "";
  return {
    id: x.id,
    objet: x.Title || "(sans objet)",
    reference: x.Reference || "",
    statut: x.Statut || "Nouveau",
    clos: x.Clos === true,
    nonLu: x.NonLuClient === true,
    message: x.Message || "",
    creeLe: x.Created || "",
    echanges,
    derniereMaj,
    dernierAuteur: x.DernierAuteur || "client",
    // Champs de la boîte gestionnaire (non sélectionnés côté client → défauts)
    codeClient: x.CodeClient || "",
    raisonSociale: x.RaisonSociale || "",
    emailDemandeur: x.EmailDemandeur || "",
    nonLuGestionnaire: x.NonLuGestionnaire === true,
  };
}

/* Lecture de la liste, avec repli sur les colonnes historiques UNIQUEMENT
   si le schéma est en cause (400 : tenant pas encore re-provisionné). Une
   panne passagère (429, 5xx) doit remonter telle quelle : se replier
   dessus servirait des fils amputés — échanges disparus, fil clos rouvert
   à l'écran — au lieu d'un honnête « réessayez ». */
async function lireFils(tok, listeId) {
  try { return await items(tok, listeId, CHAMPS_FIL); }
  catch (e) {
    if (e && e.codeHttp !== 400) throw e;
    return await items(tok, listeId, CHAMPS_HISTORIQUES);
  }
}

/** GET /api/me?vue=messages — fils du client, du plus récent au plus ancien. */
async function fils(request, context) {
  const { email } = await verifierJeton(request);
  const c = await resoudreClient(email);
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  // Liste absente (site pas encore provisionné) : canal vide, pas une panne.
  if (!ids["Messages gestionnaire"]) return { status: 200, jsonBody: { fils: [] } };

  const lignes = await lireFils(tok, ids["Messages gestionnaire"]);

  const duClient = lignes
    .filter((x) => x.CodeClient === c.codeClient)
    .map(enFil)
    .sort((a, b) => String(b.derniereMaj).localeCompare(String(a.derniereMaj)));
  return { status: 200, jsonBody: { fils: duClient } };
}

/** GET /api/me?vue=admin&onglet=messages — TOUS les fils, pour le gestionnaire. */
async function boite(request, context) {
  const { email } = await verifierJeton(request);
  if (!estGestionnaire(email)) throw { status: 403, erreur: "Accès réservé aux gestionnaires Osmose RH." };
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) return { status: 200, jsonBody: { fils: [], total: 0 } };
  const lignes = await lireFils(tok, ids[LISTE]);
  const tous = lignes.map(enFil)
    .sort((a, b) => String(b.derniereMaj).localeCompare(String(a.derniereMaj)));
  // Cap d'affichage : les 200 fils les plus récents (le total dit le reste).
  return { status: 200, jsonBody: { fils: tous.slice(0, 200), total: tous.length } };
}

/* Rôle + fil relu et VÉRIFIÉ avant toute écriture. Renvoie de quoi
   patcher : l'URL de l'élément, ses champs actuels et son etag (verrou
   optimiste : deux réponses simultanées ne s'écrasent pas). */
async function chargerFil(request, id) {
  const { email } = await verifierJeton(request);
  const gestionnaire = estGestionnaire(email);
  const clientInfo = gestionnaire ? null : await resoudreClient(email);
  if (!/^\d+$/.test(String(id || ""))) throw { status: 404, erreur: "Fil introuvable." };
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: "Canal gestionnaire indisponible." };
  const base = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}`;
  const r = await fetch(`${base}?$expand=fields($select=CodeClient,Statut,Clos,Echanges,NonLuClient,NonLuGestionnaire)`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  // Un 404 est un vrai « fil introuvable ». Tout le reste ne doit PAS être
  // travesti en 404 : un 400 sur ce $select signale des colonnes absentes
  // (tenant pas re-provisionné) — l'utilisateur voyait alors « Fil
  // introuvable » sur le fil qu'il était justement en train de lire.
  if (!r.ok) {
    if (r.status === 404) throw { status: 404, erreur: "Fil introuvable." };
    if (r.status === 400) throw { status: 502, erreur: "Fil illisible — colonnes de la messagerie absentes. Relancer creer_site_rh.py." };
    throw { status: 502, erreur: "Messagerie momentanément indisponible — réessayez." };
  }
  const item = await r.json();
  if (!gestionnaire && item.fields?.CodeClient !== clientInfo.codeClient)
    throw { status: 404, erreur: "Fil introuvable." }; // jamais une fuite
  return { gestionnaire, tok, base, fields: item.fields || {}, etag: item["@odata.etag"] || "" };
}

/* If-Match n'est PAS documenté sur PATCH …/items/{id}/fields : selon le
   comportement de SharePoint, l'etag du listItem peut être hors périmètre
   pour ce sous-chemin et faire répondre 412 à TOUS les appels. Un verrou
   perdu est bénin (on réécrit à partir d'une relecture fraîche, donc rien
   n'est effacé) ; un fil définitivement bloqué ne l'est pas. L'etag est
   donc un verrou OPPORTUNISTE : posé tant qu'il aide, abandonné au dernier
   essai — passer etag = "" écrit sans If-Match. */
async function patcherFil(tok, base, etag, fields) {
  const r = await fetch(`${base}/fields`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tok}`, "Content-Type": "application/json",
      ...(etag ? { "If-Match": etag } : {}),
    },
    body: JSON.stringify(fields),
  });
  return r;
}

/** POST /api/demande { action: "messageRepondre", id, texte } — les 2 côtés. */
async function repondre(request, context, d) {
  const texte = String(d.texte || "").trim().slice(0, 4000);
  if (texte.length < 1) return { status: 400, jsonBody: { erreur: "Réponse vide." } };

  // Trois tentatives : sur conflit (412) on RELIT et on rejoue — l'ajout
  // se refait à partir des échanges frais, donc rien n'est jamais écrasé.
  // Le dernier essai part sans If-Match (voir patcherFil) : ainsi un
  // 412 systémique ne peut pas condamner le fil.
  const ESSAIS = 3;
  for (let essai = 0; essai < ESSAIS; essai++) {
    const { gestionnaire, tok, base, fields, etag } = await chargerFil(request, d.id);
    if (fields.Clos === true)
      return { status: 400, jsonBody: { erreur: "Fil clos — écrivez un nouveau message." } };
    let echanges = [];
    try { const j = JSON.parse(fields.Echanges || "[]"); if (Array.isArray(j)) echanges = j; } catch { /* reparti de zéro plutôt que bloqué */ }
    const quand = new Date().toISOString();
    const qui = gestionnaire ? "gestionnaire" : "client";
    echanges.push({ qui, quand, texte });
    // La colonne Echanges est un « texte long » SharePoint : ~64 000
    // caractères. Compter les échanges ne protège de rien (200 × 4 000 =
    // 800 000) — c'est la taille SÉRIALISÉE qui décide, sinon le fil
    // devient définitivement inécrivable, avec un diagnostic trompeur.
    const charge = JSON.stringify(echanges);
    if (charge.length > 55000)
      return { status: 400, jsonBody: { erreur: "Ce fil a atteint sa taille maximale — ouvrez un nouveau message." } };

    // Statut = à qui est la balle : réponse gestionnaire → « Répondu »,
    // relance client → « Nouveau » (le fil réapparaît côté gestionnaire).
    //
    // DerniereReponse + NotifEnvoyee sont posées dans LES DEUX SENS : le
    // flux « à la modification » se déclenche sur NotifEnvoyee = faux puis
    // choisit son destinataire d'après DernierAuteur (gestionnaire → mail
    // au client, client → mail au gestionnaire). Sans cela, une relance du
    // client n'aurait prévenu personne — le flux de notification existant
    // ne se déclenche qu'à la CRÉATION du fil.
    const r = await patcherFil(tok, base, essai < ESSAIS - 1 ? etag : "", {
      Echanges: charge,
      DerniereMaj: quand,
      DernierAuteur: qui,
      Statut: gestionnaire ? "Répondu" : "Nouveau",
      // Recopie à plat du dernier message : le flux le cite d'un jeton,
      // sans avoir à analyser le JSON de Echanges.
      DerniereReponse: texte,
      NotifEnvoyee: false,
      ...(gestionnaire
        ? { NonLuClient: true, NonLuGestionnaire: false }
        : { NonLuGestionnaire: true, NonLuClient: false }),
    });
    if (r.ok) {
      viderCacheItems(); // le fil mis à jour doit se relire immédiatement
      return { status: 200, jsonBody: { ok: true, quand } };
    }
    // Tant qu'il reste un essai : relire et rejouer. Cela couvre le 412
    // attendu, mais aussi un 400 rendu par un If-Match hors périmètre —
    // l'essai suivant repart alors sans verrou. Seul le dernier échec est
    // rapporté, avec son diagnostic.
    if (essai < ESSAIS - 1) continue;
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    context.error("messages/repondre :", r.status, corps);
    // Diagnostic accordé à l'échec réel : un fil disputé n'est pas un
    // schéma manquant, et envoyer relancer le mauvais script coûte cher.
    if (r.status === 412)
      return { status: 409, jsonBody: { erreur: "Fil modifié pendant l'envoi — rechargez et réessayez." } };
    if (r.status === 400)
      return { status: 502, jsonBody: { erreur: "Réponse non enregistrée — colonnes de la messagerie absentes. Relancer creer_site_rh.py." } };
    return { status: 502, jsonBody: { erreur: "Réponse non enregistrée — réessayez." } };
  }
}

/** POST /api/demande { action: "messageStatut", id, clos?, lu? } —
    clore/rouvrir un fil (les 2 côtés, chacun sur les siens) et marquer
    lu SON côté du fil (pastilles non-lu). */
async function statut(request, context, d) {
  if (typeof d.clos !== "boolean" && d.lu !== true)
    return { status: 400, jsonBody: { erreur: "Rien à modifier." } };
  const { gestionnaire, tok, base, etag } = await chargerFil(request, d.id);
  // Clore ou rouvrir est un geste de gestionnaire : l'interface cliente ne
  // l'offre pas, l'API ne doit pas être plus permissive (un appel direct
  // rouvrirait un fil archivé pour y écrire de nouveau).
  if (typeof d.clos === "boolean" && !gestionnaire)
    return { status: 403, jsonBody: { erreur: "Seul votre gestionnaire peut clore ou rouvrir un fil." } };
  const fields = {
    ...(typeof d.clos === "boolean" ? { Clos: d.clos } : {}),
    ...(d.lu === true ? (gestionnaire ? { NonLuGestionnaire: false } : { NonLuClient: false }) : {}),
  };
  // Ces champs sont des drapeaux indépendants (pas de fusion à préserver) :
  // sur 412 on réécrit directement sans If-Match, même raison que repondre().
  let r = await patcherFil(tok, base, etag, fields);
  if (r.status === 412) r = await patcherFil(tok, base, "", fields);
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    context.error("messages/statut :", r.status, corps);
    return { status: 502, jsonBody: { erreur: "Statut non enregistré — réessayez. (Colonnes du fil absentes ? Relancer creer_site_rh.py.)" } };
  }
  viderCacheItems();
  return { status: 200, jsonBody: { ok: true } };
}

/** Nombre de fils du client avec du non-lu côté client — pastille de la
    tuile « Mon gestionnaire », servie avec /api/me (best effort). */
async function nonLus(codeClient) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) return 0;
  const lignes = await items(tok, ids[LISTE], CHAMPS_FIL);
  return lignes.filter((x) => x.CodeClient === codeClient && x.NonLuClient === true).length;
}

module.exports = { fils, boite, repondre, statut, nonLus };
