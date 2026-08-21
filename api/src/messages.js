// api/src/messages.js — fil de discussion client ↔ gestionnaire.
// Le canal « Mon gestionnaire » cesse d'être un aller simple : chaque
// élément de « Messages gestionnaire » est la TÊTE D'UN FIL (message
// initial dans `Message`), les réponses s'accumulent dans la colonne
// `Echanges` (JSON [{ qui: "client"|"gestionnaire", quand: ISO, texte }]).
// Voir docs/Fil-messagerie-portail.md — lot 1 : lecture côté client.
//
// Doctrine du 21/08 (me.js) : AUCUNE nouvelle route /api/<nom> — ce module
// n'exporte que des handlers, chargés paresseusement :
//   - GET /api/me?vue=messages → fils(request) : les fils du client connecté.
// Le module se suffit (jeton re-vérifié, client résolu) : le filtrage sur
// le CodeClient est fait ICI, côté serveur — jamais confié au navigateur.

const { verifierJeton, resoudreClient, tokenGraph, idsListes, items } = require("./annuaire");

// Colonnes du fil — celles de creer_site_rh.py. Sur un tenant pas encore
// re-provisionné, Graph tolère la sélection de colonnes absentes (type
// ouvert) ; par prudence on retombe quand même sur les colonnes
// historiques si la lecture complète échoue : le canal reste lisible,
// simplement sans les réponses.
const CHAMPS_FIL = "CodeClient,Title,Message,Reference,Statut,Created,Echanges,DerniereMaj,DernierAuteur,Clos,NonLuClient";
const CHAMPS_HISTORIQUES = "CodeClient,Title,Message,Reference,Statut,Created";

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
  };
}

/** GET /api/me?vue=messages — fils du client, du plus récent au plus ancien. */
async function fils(request, context) {
  const { email } = await verifierJeton(request);
  const c = await resoudreClient(email);
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  // Liste absente (site pas encore provisionné) : canal vide, pas une panne.
  if (!ids["Messages gestionnaire"]) return { status: 200, jsonBody: { fils: [] } };

  let lignes;
  try { lignes = await items(tok, ids["Messages gestionnaire"], CHAMPS_FIL); }
  catch { lignes = await items(tok, ids["Messages gestionnaire"], CHAMPS_HISTORIQUES); }

  const duClient = lignes
    .filter((x) => x.CodeClient === c.codeClient)
    .map(enFil)
    .sort((a, b) => String(b.derniereMaj).localeCompare(String(a.derniereMaj)));
  return { status: 200, jsonBody: { fils: duClient } };
}

module.exports = { fils };
