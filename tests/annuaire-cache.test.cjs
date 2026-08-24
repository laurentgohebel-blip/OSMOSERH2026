/* tests/annuaire-cache.test.cjs — non-régression du cache de lecture.
   `node tests/annuaire-cache.test.cjs` (aucune dépendance, aucun réseau).
   ─────────────────────────────────────────────────────────────────────
   annuaire.items() met en cache 60 s le résultat d'une lecture de liste.
   La clé DOIT inclure les colonnes demandées : plusieurs appelants lisent
   les mêmes listes avec des sélections différentes (admin.js lit
   « Paramètres clients » avec le seul CodeClient, resoudreClient a besoin
   des options, du SIRET et du représentant). Avec une clé réduite à la
   liste, ouvrir l'écran d'administration servait pendant 60 s des clients
   amputés à TOUT le portail : démarches refusées à tort et attestations
   émises sans mentions légales. */
const LISTES = { LP: "Paramètres clients", LU: "Utilisateurs portail" };
const CLIENTS = [{
  CodeClient: "DELICES", RaisonSociale: "Aux Délices de Provence", Actif: true,
  Options: ["embauche", "acompte", "attestation"], Siret: "12345678900011",
  Representant: "Camille Renard", AdresseEntreprise: "3 rue des Fleurs, Toulon",
  FonctionRepresentant: "Gérante", LieuEdition: "Toulon", EmailGestionnaire: "g@osmoserh.fr",
}];
const UTILISATEURS = [{ Email: "camille@delices.fr", CodeClient: "DELICES", Actif: true }];

// Graph simulé : ne renvoie QUE les colonnes demandées, comme le vrai.
global.fetch = async (url) => {
  const u = String(url);
  if (u.includes("oauth2")) return { ok: true, json: async () => ({ access_token: "T", expires_in: 3600 }) };
  if (/\/lists(\?|$)/.test(u)) return { ok: true, json: async () => ({ value: Object.entries(LISTES).map(([id, displayName]) => ({ id, displayName })) }) };
  const champs = (u.match(/\$select=([^)]*)/) || [, ""])[1].split(",");
  const source = u.includes("/lists/LU/") ? UTILISATEURS : CLIENTS;
  return { ok: true, json: async () => ({ value: source.map((l, i) => {
    const fields = {};
    for (const c of champs) if (c in l) fields[c] = l[c];
    return { id: String(i + 1), fields };
  }) }) };
};

// « jose » n'est pas installé hors déploiement de l'API ; seul verifierJeton
// s'en sert et il n'entre pas dans ce banc.
const Mod = require("module");
const resoudre = Mod._resolveFilename;
Mod._resolveFilename = function (r, ...a) {
  return r === "jose" ? require.resolve("path") : resoudre.call(this, r, ...a);
};
require.cache[require.resolve("path")] = {
  id: "jose", loaded: true,
  exports: { jwtVerify: async () => ({ payload: {} }), createRemoteJWKSet: () => null },
};

process.env.RH_SITE_ID = "S";
process.env.GRAPH_TENANT_ID = "T";
process.env.GRAPH_CLIENT_ID = "C";
process.env.GRAPH_CLIENT_SECRET = "X";

let ko = 0;
const verifier = (nom, condition, detail) => {
  if (condition) console.log(`  ok   ${nom}`);
  else { ko++; console.log(`  ÉCHEC ${nom}${detail ? " — " + detail : ""}`); }
};

(async () => {
  const A = require("../api/src/annuaire.js");
  const tok = await A.tokenGraph();
  const ids = await A.idsListes(tok);

  console.log("\n[1] resoudreClient sans interférence");
  A.viderCacheItems();
  const sain = await A.resoudreClient("camille@delices.fr");
  verifier("identité employeur complète", sain.siret === "12345678900011" && sain.representant === "Camille Renard");
  verifier("options souscrites", sain.options.join(",") === "embauche,acompte,attestation", JSON.stringify(sain.options));

  console.log("\n[2] après une lecture étroite de la MÊME liste (écran d'administration)");
  A.viderCacheItems();
  await A.items(tok, ids["Paramètres clients"], "CodeClient"); // admin.js
  const apres = await A.resoudreClient("camille@delices.fr");
  verifier("SIRET toujours renseigné", apres.siret === "12345678900011", `reçu ${JSON.stringify(apres.siret)}`);
  verifier("représentant toujours renseigné", apres.representant === "Camille Renard", `reçu ${JSON.stringify(apres.representant)}`);
  verifier("options toujours présentes", apres.options.length === 3, JSON.stringify(apres.options));
  verifier("gestionnaire toujours résolu", apres.emailGestionnaire === "g@osmoserh.fr", JSON.stringify(apres.emailGestionnaire));

  console.log("\n[3] la lecture étroite reste correcte de son côté");
  const etroite = await A.items(tok, ids["Paramètres clients"], "CodeClient");
  verifier("colonnes demandées servies", etroite.length === 1 && etroite[0].CodeClient === "DELICES");
  verifier("pas de colonne parasite", !("Siret" in etroite[0]), JSON.stringify(etroite[0]));

  console.log("\n[4] rattachement du compte (liste Utilisateurs portail)");
  A.viderCacheItems();
  await A.items(tok, ids["Utilisateurs portail"], "Email"); // admin.js
  const encore = await A.resoudreClient("camille@delices.fr");
  verifier("compte toujours rattaché", encore.codeClient === "DELICES");

  console.log(ko ? `\n─── ${ko} échec(s) ───` : "\n─── 9 ok, 0 échec ───");
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("banc interrompu :", e); process.exit(1); });
