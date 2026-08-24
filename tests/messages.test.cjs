/* tests/messages.test.cjs — banc d'essai du module de messagerie.
   `node tests/messages.test.cjs` (aucune dépendance, aucun réseau).
   ─────────────────────────────────────────────────────────────────────
   L'API n'a pas de tests unitaires : ce banc simule l'annuaire et
   Microsoft Graph pour exécuter POUR DE VRAI api/src/messages.js —
   cloisonnement entre clients, fusion des réponses, conflits d'écriture,
   colonnes SharePoint absentes. Le scénario [14] est le garde-fou du
   verrou opportuniste : si l'etag If-Match était refusé en bloc par
   Graph sur …/items/{id}/fields (comportement non documenté), toute
   réponse deviendrait impossible — le module doit malgré tout aboutir. */
const path = require("path");
const RACINE = path.join(__dirname, "..", "api", "src");

// ── État SharePoint simulé ──────────────────────────────────────────
let LISTE_ID = "L1";
let etat, journalPatch;
let forcerConflit = 0; // nombre de 412 à renvoyer avant d'accepter
let ifMatchToujoursRefuse = false; // Graph rejette tout If-Match sur /fields (412)
let ifMatchRefuseEn400 = false;    // … ou en 400, hors périmètre du sous-chemin
let erreurItems = null;            // panne simulée de la lecture de liste
function reset(lignes) {
  forcerConflit = 0; ifMatchToujoursRefuse = false; ifMatchRefuseEn400 = false; erreurItems = null; // sinon un scénario contamine le suivant
  etat = new Map(lignes.map((l) => [String(l.id), { fields: { ...l }, etag: `"e${l.id},1"` }]));
  journalPatch = [];
}

// ── Stub du module annuaire (injecté dans le cache require) ─────────
const cheminAnnuaire = path.join(RACINE, "annuaire.js");
let EMAIL_JETON = "client@exemple.fr";
let CLIENT_RESOLU = { codeClient: "DELICES", raisonSociale: "Délices" };
let cacheVide = 0;
require.cache[cheminAnnuaire] = {
  id: cheminAnnuaire, filename: cheminAnnuaire, loaded: true, exports: {
    verifierJeton: async () => ({ email: EMAIL_JETON }),
    resoudreClient: async (email) => {
      if (!CLIENT_RESOLU) throw { status: 403, erreur: "Compte non rattaché" };
      return CLIENT_RESOLU;
    },
    tokenGraph: async () => "TOK",
    idsListes: async () => ({ "Messages gestionnaire": LISTE_ID }),
    items: async (tok, id, champs) => {
      // messages.js capture `items` à l'import : l'interrupteur doit être
      // DANS le stub, le remplacer après coup n'aurait aucun effet.
      if (erreurItems) throw erreurItems;
      if (id !== LISTE_ID) throw { status: 502, erreur: "liste inconnue" };
      // Simule la sélection de colonnes de Graph : seuls les champs
      // demandés reviennent (+ id). Une colonne absente du schéma fait
      // échouer toute la requête, comme Graph.
      const demandes = champs.split(",");
      for (const c of demandes)
        if (!COLONNES.includes(c) && c !== "Created")
          throw { status: 502, erreur: `colonne inconnue: ${c}`, codeHttp: 400 };
      return [...etat.values()].map((x) => {
        const o = { id: String(x.fields.id) };
        for (const c of demandes) if (c in x.fields) o[c] = x.fields[c];
        return o;
      });
    },
    viderCacheItems: () => { cacheVide++; },
  },
};

// Colonnes existantes côté SharePoint (modifiable par les scénarios)
let COLONNES = ["CodeClient", "Title", "Message", "Reference", "Statut", "Echanges",
  "DerniereMaj", "DernierAuteur", "Clos", "NonLuClient", "RaisonSociale",
  "EmailDemandeur", "NonLuGestionnaire", "DerniereReponse", "NotifEnvoyee"];

// ── Stub de fetch (Graph : GET item, PATCH fields) ──────────────────
global.fetch = async (url, opts = {}) => {
  const m = String(url).match(/\/items\/(\d+)(\/fields)?/);
  const rep = (status, corps) => ({
    ok: status >= 200 && status < 300, status,
    json: async () => corps, text: async () => JSON.stringify(corps),
  });
  if (!m) return rep(404, {});
  const item = etat.get(m[1]);
  if (!item) return rep(404, { error: "introuvable" });

  if ((opts.method || "GET") === "GET") {
    const sel = String(url).match(/\$select=([^)]*)/);
    const champs = sel ? sel[1].split(",") : Object.keys(item.fields);
    // Même sémantique que la lecture de liste : une colonne absente du
    // schéma fait échouer la requête (400). Sans cette symétrie, le banc
    // ne voyait pas que chargerFil rendait « Fil introuvable » sur un
    // tenant non re-provisionné.
    for (const c of champs)
      if (!COLONNES.includes(c) && c !== "Created") return rep(400, { error: `colonne inconnue: ${c}` });
    const f = {};
    for (const c of champs) if (c in item.fields) f[c] = item.fields[c];
    return rep(200, { "@odata.etag": item.etag, fields: f });
  }
  // PATCH /fields
  const corps = JSON.parse(opts.body);
  journalPatch.push({ id: m[1], corps, ifMatch: (opts.headers || {})["If-Match"] });
  for (const c of Object.keys(corps))
    if (!COLONNES.includes(c)) return rep(400, { error: `colonne inconnue: ${c}` });
  if (forcerConflit > 0) { forcerConflit--; return rep(412, { error: "conflit" }); }
  if (ifMatchToujoursRefuse && (opts.headers || {})["If-Match"]) return rep(412, { error: "etag hors périmètre" });
  if (ifMatchRefuseEn400 && (opts.headers || {})["If-Match"]) return rep(400, { error: "If-Match non supporté ici" });
  if ((opts.headers || {})["If-Match"] && (opts.headers || {})["If-Match"] !== item.etag)
    return rep(412, { error: "etag périmé" });
  Object.assign(item.fields, corps);
  item.etag = `"e${m[1]},${Number(item.etag.split(",")[1].replace('"', "")) + 1}"`;
  return rep(200, { fields: item.fields });
};

const M = require(path.join(RACINE, "messages.js"));
const ctx = { error: () => {}, warn: () => {}, log: () => {} };
const req = { headers: { get: () => "Bearer x" }, query: { get: () => null } };

// ── Scénarios ───────────────────────────────────────────────────────
let ko = 0, ok = 0;
const verifier = (nom, condition, detail) => {
  if (condition) { ok++; console.log(`  ok   ${nom}`); }
  else { ko++; console.log(`  ÉCHEC ${nom}${detail ? " — " + detail : ""}`); }
};

const LIGNES = [
  { id: 1, CodeClient: "DELICES", Title: "Paie", Message: "m1", Reference: "R1", Statut: "Nouveau", Created: "2026-08-01T10:00:00Z" },
  { id: 2, CodeClient: "DELICES", Title: "Contrat", Message: "m2", Reference: "R2", Statut: "Répondu",
    Created: "2026-08-02T10:00:00Z", DerniereMaj: "2026-08-05T10:00:00Z", DernierAuteur: "gestionnaire",
    Echanges: JSON.stringify([{ qui: "gestionnaire", quand: "2026-08-05T10:00:00Z", texte: "r2" }]), NonLuClient: true },
  { id: 3, CodeClient: "MARTIN", Title: "Autre client", Message: "m3", Reference: "R3", Statut: "Nouveau", Created: "2026-08-03T10:00:00Z" },
  { id: 4, CodeClient: "DELICES", Title: "Clos", Message: "m4", Reference: "R4", Statut: "Répondu", Clos: true, Created: "2026-07-01T10:00:00Z" },
];

(async () => {
  process.env.ADMIN_EMAILS = "gestion@osmoserh.fr, Autre@osmoserh.fr";
  process.env.RH_SITE_ID = "S1";

  console.log("\n[1] fils() — cloisonnement, tri, défauts");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  let r = await M.fils(req, ctx);
  const f = r.jsonBody.fils;
  verifier("seuls les fils du client", f.every((x) => x.codeClient === "DELICES") && f.length === 3, `reçu ${f.length}`);
  verifier("tri par activité décroissante", f[0].id === "2", `premier = ${f[0].id}`);
  verifier("repli DerniereMaj → Created", f.find((x) => x.id === "1").derniereMaj === "2026-08-01T10:00:00Z");
  verifier("échanges relus", f.find((x) => x.id === "2").echanges.length === 1);
  verifier("non-lu remonté", f.find((x) => x.id === "2").nonLu === true);
  verifier("clos remonté", f.find((x) => x.id === "4").clos === true);

  console.log("\n[2] boite() — réservée aux gestionnaires");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr";
  try { await M.boite(req, ctx); verifier("client refusé", false, "aucune erreur levée"); }
  catch (e) { verifier("client refusé", e.status === 403, JSON.stringify(e)); }
  EMAIL_JETON = "gestion@osmoserh.fr";
  r = await M.boite(req, ctx);
  verifier("gestionnaire voit tous les clients", r.jsonBody.fils.length === 4 && r.jsonBody.total === 4);

  console.log("\n[3] repondre() — client sur son fil");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  r = await M.repondre(req, ctx, { id: "1", texte: "ma relance" });
  verifier("réponse acceptée", r.status === 200, JSON.stringify(r.jsonBody));
  let ligne = etat.get("1").fields;
  verifier("échange ajouté", JSON.parse(ligne.Echanges || "[]").length === 1);
  verifier("auteur = client", ligne.DernierAuteur === "client");
  verifier("statut repassé à Nouveau", ligne.Statut === "Nouveau");
  verifier("non-lu côté gestionnaire", ligne.NonLuGestionnaire === true);
  verifier("notification due (relance client)", ligne.NotifEnvoyee === false && ligne.DerniereReponse === "ma relance");
  verifier("If-Match transmis", !!journalPatch[0].ifMatch, JSON.stringify(journalPatch[0]));

  console.log("\n[4] repondre() — gestionnaire");
  reset(LIGNES); EMAIL_JETON = "gestion@osmoserh.fr";
  r = await M.repondre(req, ctx, { id: "1", texte: "ma réponse" });
  ligne = etat.get("1").fields;
  verifier("réponse acceptée", r.status === 200, JSON.stringify(r.jsonBody));
  verifier("statut = Répondu", ligne.Statut === "Répondu");
  verifier("DerniereReponse recopiée", ligne.DerniereReponse === "ma réponse");
  verifier("NotifEnvoyee remise à faux", ligne.NotifEnvoyee === false);
  verifier("non-lu côté client", ligne.NonLuClient === true);

  console.log("\n[5] repondre() — cloisonnement et fil clos");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  try { r = await M.repondre(req, ctx, { id: "3", texte: "chez le voisin" }); verifier("fil d'un autre client refusé", r.status === 404, JSON.stringify(r)); }
  catch (e) { verifier("fil d'un autre client refusé", e.status === 404, JSON.stringify(e)); }
  verifier("aucune écriture chez le voisin", journalPatch.length === 0, JSON.stringify(journalPatch));
  r = await M.repondre(req, ctx, { id: "4", texte: "sur un fil clos" });
  verifier("fil clos refusé", r.status === 400, JSON.stringify(r));
  r = await M.repondre(req, ctx, { id: "1", texte: "   " });
  verifier("réponse vide refusée", r.status === 400, JSON.stringify(r));

  console.log("\n[6] repondre() — conflit d'écriture (412)");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; forcerConflit = 1;
  r = await M.repondre(req, ctx, { id: "1", texte: "malgré le conflit" });
  verifier("rejeu après un conflit", r.status === 200, JSON.stringify(r.jsonBody));
  reset(LIGNES); forcerConflit = 5;
  r = await M.repondre(req, ctx, { id: "1", texte: "conflits en série" });
  verifier("conflit persistant → 409, pas un faux diagnostic de schéma",
    r.status === 409 && !/creer_site_rh/.test(r.jsonBody.erreur), JSON.stringify(r));

  console.log("\n[7] statut() — clore, rouvrir, marquer lu");
  reset(LIGNES); EMAIL_JETON = "gestion@osmoserh.fr";
  r = await M.statut(req, ctx, { id: "1", clos: true });
  verifier("clôture", r.status === 200 && etat.get("1").fields.Clos === true, JSON.stringify(r));
  r = await M.statut(req, ctx, { id: "1", clos: false });
  verifier("réouverture", etat.get("1").fields.Clos === false);
  r = await M.statut(req, ctx, { id: "2", lu: true });
  verifier("gestionnaire marque SON côté lu", etat.get("2").fields.NonLuGestionnaire === false && etat.get("2").fields.NonLuClient === true);
  EMAIL_JETON = "client@exemple.fr";
  r = await M.statut(req, ctx, { id: "2", lu: true });
  verifier("client marque SON côté lu", etat.get("2").fields.NonLuClient === false);
  r = await M.statut(req, ctx, { id: "2" });
  verifier("requête vide refusée", r.status === 400, JSON.stringify(r));

  console.log("\n[8] ADMIN_EMAILS — casse et espaces");
  reset(LIGNES); EMAIL_JETON = "autre@osmoserh.fr"; // déclaré « Autre@ » avec une majuscule
  try { r = await M.boite(req, ctx); verifier("adresse admin avec majuscule reconnue", r.status === 200, "403 renvoyé"); }
  catch (e) { verifier("adresse admin avec majuscule reconnue", false, `403 : ${e.erreur}`); }

  console.log("\n[9] tenant pas re-provisionné (colonnes absentes)");
  const COMPLET = COLONNES;
  COLONNES = ["CodeClient", "Title", "Message", "Reference", "Statut", "RaisonSociale", "EmailDemandeur"];
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  try {
    r = await M.fils(req, ctx);
    verifier("lecture en repli sur colonnes historiques", r.status === 200 && r.jsonBody.fils.length === 3, JSON.stringify(r.jsonBody).slice(0, 120));
  } catch (e) { verifier("lecture en repli sur colonnes historiques", false, `exception : ${JSON.stringify(e)}`); }
  try {
    r = await M.repondre(req, ctx, { id: "1", texte: "sans colonnes" });
    verifier("réponse → erreur explicite (pas de 500)", r.status === 502 && /creer_site_rh/.test(r.jsonBody.erreur), JSON.stringify(r));
  } catch (e) {
    // chargerFil lève : le diagnostic doit désigner le script, jamais
    // « Fil introuvable » sur un fil que l'utilisateur a sous les yeux.
    verifier("réponse → erreur explicite (pas de 500)",
      e.status === 502 && /creer_site_rh/.test(e.erreur || ""), `levée : ${JSON.stringify(e)}`);
  }
  COLONNES = COMPLET;

  console.log("\n[9 bis] panne passagère (429) : pas de repli sur des fils amputés");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  erreurItems = { status: 502, erreur: "throttling", codeHttp: 429 };
  try {
    r = await M.fils(req, ctx);
    verifier("le 429 remonte au lieu d'amputer les fils", false, `réponse ${JSON.stringify(r).slice(0, 90)}`);
  } catch (e) { verifier("le 429 remonte au lieu d'amputer les fils", e.codeHttp === 429, JSON.stringify(e)); }
  erreurItems = null;

  console.log("\n[10] cas limites de lecture");
  reset([{ id: 9, CodeClient: "DELICES", Title: "JSON abîmé", Message: "m", Statut: "Nouveau",
           Created: "2026-08-01T10:00:00Z", Echanges: "{pas du JSON" },
         { id: 10, CodeClient: "DELICES", Title: "JSON objet", Message: "m", Statut: "Nouveau",
           Created: "2026-08-01T11:00:00Z", Echanges: '{"qui":"client"}' }]);
  EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  try {
    r = await M.fils(req, ctx);
    verifier("JSON abîmé → fil lisible sans réponses", r.jsonBody.fils.every((x) => Array.isArray(x.echanges) && x.echanges.length === 0), JSON.stringify(r.jsonBody.fils.map((x) => x.echanges)));
  } catch (e) { verifier("JSON abîmé → fil lisible sans réponses", false, `exception : ${e.message || JSON.stringify(e)}`); }

  console.log("\n[11] fil saturé — la colonne SharePoint tient ~64 000 caractères");
  const gros = Array.from({ length: 20 }, (_, i) => ({ qui: "client", quand: "2026-08-01T10:00:00Z", texte: "x".repeat(3000) + i }));
  reset([{ id: 11, CodeClient: "DELICES", Title: "Long", Message: "m", Statut: "Nouveau", Created: "2026-08-01T10:00:00Z", Echanges: JSON.stringify(gros) }]);
  EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  r = await M.repondre(req, ctx, { id: "11", texte: "une de trop" });
  verifier("refus AVANT de dépasser la colonne", r.status === 400 && /taille maximale/.test(r.jsonBody.erreur), JSON.stringify(r));
  verifier("rien n'a été écrit", journalPatch.length === 0, JSON.stringify(journalPatch).slice(0, 80));
  reset([{ id: 12, CodeClient: "DELICES", Title: "Court", Message: "m", Statut: "Nouveau", Created: "2026-08-01T10:00:00Z" }]);
  r = await M.repondre(req, ctx, { id: "12", texte: "réponse normale" });
  verifier("un fil normal passe toujours", r.status === 200, JSON.stringify(r));

  console.log("\n[11 bis] clore : geste réservé au gestionnaire");
  reset(LIGNES); EMAIL_JETON = "client@exemple.fr"; CLIENT_RESOLU = { codeClient: "DELICES" };
  r = await M.statut(req, ctx, { id: "4", clos: false });
  verifier("le client ne rouvre pas un fil clos", r.status === 403, JSON.stringify(r));
  verifier("le fil reste clos", etat.get("4").fields.Clos === true);
  r = await M.statut(req, ctx, { id: "2", lu: true });
  verifier("le client marque toujours lu", r.status === 200, JSON.stringify(r));

  console.log("\n[11 ter] Graph rend 400 (et non 412) sur un If-Match hors périmètre");
  reset(LIGNES); EMAIL_JETON = "gestion@osmoserh.fr"; ifMatchRefuseEn400 = true;
  r = await M.repondre(req, ctx, { id: "1", texte: "malgré un 400 sur l'etag" });
  verifier("la réponse aboutit quand même", r.status === 200, JSON.stringify(r.jsonBody));
  verifier("échange bien écrit", JSON.parse(etat.get("1").fields.Echanges || "[]").length === 1);

  console.log("\n[12] nonLus() — pastille");
  reset(LIGNES);
  const n = await M.nonLus("DELICES");
  verifier("compte les non-lus du client", n === 1, `reçu ${n}`);
  const n2 = await M.nonLus("MARTIN");
  verifier("aucun non-lu chez l'autre client", n2 === 0, `reçu ${n2}`);

  console.log("\n[13] compte non rattaché (403)");
  reset(LIGNES); EMAIL_JETON = "inconnu@exemple.fr"; CLIENT_RESOLU = null;
  try { await M.fils(req, ctx); verifier("403 propagé", false, "aucune erreur"); }
  catch (e) { verifier("403 propagé", e.status === 403, JSON.stringify(e)); }
  try { await M.repondre(req, ctx, { id: "1", texte: "x" }); verifier("403 propagé sur réponse", false, "aucune erreur"); }
  catch (e) { verifier("403 propagé sur réponse", e.status === 403, JSON.stringify(e)); }
  CLIENT_RESOLU = { codeClient: "DELICES" };

  console.log("\n[14] Graph rejette TOUT If-Match sur /fields (risque réel non vérifiable)");
  reset(LIGNES); ifMatchToujoursRefuse = true; EMAIL_JETON = "gestion@osmoserh.fr";
  r = await M.repondre(req, ctx, { id: "1", texte: "réponse malgré l'etag refusé" });
  verifier("la réponse aboutit quand même", r.status === 200, JSON.stringify(r.jsonBody));
  verifier("échange bien écrit", JSON.parse(etat.get("1").fields.Echanges || "[]").length === 1);
  r = await M.statut(req, ctx, { id: "1", clos: true });
  verifier("la clôture aboutit quand même", r.status === 200 && etat.get("1").fields.Clos === true, JSON.stringify(r));

  console.log("\n[15] concurrence réelle : deux réponses simultanées");
  reset(LIGNES); ifMatchToujoursRefuse = false;
  EMAIL_JETON = "gestion@osmoserh.fr";
  const p1 = M.repondre(req, ctx, { id: "1", texte: "réponse A" });
  const p2 = M.repondre(req, ctx, { id: "1", texte: "réponse B" });
  await Promise.all([p1, p2]);
  const ech = JSON.parse(etat.get("1").fields.Echanges || "[]");
  verifier("aucune réponse perdue", ech.length === 2, `${ech.length} échange(s) : ${ech.map((x) => x.texte).join(" | ")}`);

  console.log(`\n─── ${ok} ok, ${ko} échec(s) ───`);
  process.exit(ko ? 1 : 0);
})();
