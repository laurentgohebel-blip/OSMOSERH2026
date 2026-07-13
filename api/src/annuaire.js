// api/src/annuaire.js — le verrou serveur du portail.
// 1. verifierJeton : valide le jeton External ID (osmoserh) reçu du navigateur
//    et en extrait l'email — c'est la SEULE identité à laquelle on se fie.
// 2. resoudreClient : email vérifié → ligne « Utilisateurs portail » → ligne
//    « Paramètres clients » (site RH, lues via Graph avec l'app Sites.Selected).
// Le payload envoyé par le navigateur (email, client) n'est jamais cru.
//
// Variables d'environnement (Static Web App) :
//   AUTH_TENANT_ID / AUTH_CLIENT_ID          — tenant External ID + app SPA (audience)
//   GRAPH_TENANT_ID / GRAPH_CLIENT_ID /
//   GRAPH_CLIENT_SECRET / RH_SITE_ID         — lecture des listes du site RH

const { createRemoteJWKSet, jwtVerify } = require("jose");

const AUTH_TENANT = process.env.AUTH_TENANT_ID;
const AUTH_CLIENT = process.env.AUTH_CLIENT_ID;

let jwks; // mis en cache entre les invocations (instance chaude)
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(
    new URL(`https://${AUTH_TENANT}.ciamlogin.com/${AUTH_TENANT}/discovery/v2.0/keys`)
  );
  return jwks;
}

/** Valide le jeton et renvoie { email } ou lève { status, erreur }.
    Le jeton est lu en priorité dans « x-osmose-jeton » : Static Web Apps
    écrase l'en-tête Authorization avant les fonctions managées, un en-tête
    personnalisé passe intact. Authorization reste en repli (dev local). */
async function verifierJeton(request) {
  const perso = request.headers.get("x-osmose-jeton") || "";
  const entete = request.headers.get("authorization") || "";
  const brut = perso || (entete.startsWith("Bearer ") ? entete.slice(7) : null);
  if (!brut) throw { status: 401, erreur: "Connexion requise." };

  let charge;
  try {
    ({ payload: charge } = await jwtVerify(brut, getJwks(), {
      issuer: `https://${AUTH_TENANT}.ciamlogin.com/${AUTH_TENANT}/v2.0`,
      audience: [AUTH_CLIENT, `api://${AUTH_CLIENT}`],
    }));
  } catch {
    throw { status: 401, erreur: "Session invalide ou expirée — reconnectez-vous." };
  }
  const email = (charge.email || charge.preferred_username || charge.upn || "").toLowerCase();
  if (!email.includes("@")) throw { status: 401, erreur: "Jeton sans email exploitable." };
  return { email };
}

/* ---------------- Graph : lecture des listes du site RH ---------------- */

let graphTok = { valeur: null, expire: 0 };
async function tokenGraph() {
  if (graphTok.valeur && Date.now() < graphTok.expire - 60000) return graphTok.valeur;
  const r = await fetch(`https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID,
      client_secret: process.env.GRAPH_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!r.ok) throw { status: 502, erreur: "Annuaire clients injoignable (jeton)." };
  const j = await r.json();
  graphTok = { valeur: j.access_token, expire: Date.now() + j.expires_in * 1000 };
  return graphTok.valeur;
}

let listeIds; // { "Utilisateurs portail": id, "Paramètres clients": id }
async function idsListes(tok) {
  if (listeIds) return listeIds;
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists?$select=id,displayName`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw { status: 502, erreur: "Annuaire clients injoignable (listes)." };
  const j = await r.json();
  listeIds = Object.fromEntries(j.value.map((l) => [l.displayName, l.id]));
  return listeIds;
}

// Les deux listes restent petites : on les lit en entier (pagination suivie)
// et on filtre en code — aucun besoin de colonnes indexées. Cache 60 s.
const cacheItems = new Map();
async function items(tok, listeId, champs) {
  const enCache = cacheItems.get(listeId);
  if (enCache && Date.now() < enCache.expire) return enCache.valeur;
  let url = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$expand=fields($select=${champs})&$top=200`;
  const tout = [];
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw { status: 502, erreur: "Annuaire clients injoignable (lecture)." };
    const j = await r.json();
    tout.push(...j.value.map((i) => i.fields));
    url = j["@odata.nextLink"] || null;
  }
  cacheItems.set(listeId, { valeur: tout, expire: Date.now() + 60000 });
  return tout;
}

/** email vérifié → { codeClient, entreprise… } ou lève 403. */
async function resoudreClient(email) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);

  const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email,CodeClient,Actif");
  const u = utilisateurs.find((x) => (x.Email || "").toLowerCase() === email && x.Actif !== false);
  if (!u || !u.CodeClient) throw { status: 403, erreur: "Compte non rattaché à un client — contactez votre gestionnaire Osmose RH." };

  const clients = await items(tok, ids["Paramètres clients"],
    "CodeClient,RaisonSociale,AdresseEntreprise,Siret,Representant,FonctionRepresentant,LieuEdition,EmailGestionnaire,Actif");
  const c = clients.find((x) => x.CodeClient === u.CodeClient && x.Actif !== false);
  if (!c) throw { status: 403, erreur: "Client inactif ou inconnu — contactez votre gestionnaire Osmose RH." };

  return {
    codeClient: c.CodeClient,
    raisonSociale: c.RaisonSociale || "",
    adresseEntreprise: c.AdresseEntreprise || "",
    siret: c.Siret || "",
    representant: c.Representant || "",
    fonctionRepresentant: c.FonctionRepresentant || "",
    lieuEdition: c.LieuEdition || "",
    emailGestionnaire: c.EmailGestionnaire || "",
  };
}

/** Enregistre une demande d'accès (compte authentifié mais non rattaché).
    Écrit dans la liste « Demandes d'accès portail » du site RH.
    Lève 409 si une demande est déjà en attente pour cet email. */
async function creerDemandeAcces(email, d) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Demandes d'accès portail"];
  if (!listeId) throw { status: 502, erreur: "Liste des demandes d'accès introuvable." };

  // Doublon ? (lecture directe, sans cache : il faut l'état réel)
  let url = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$expand=fields($select=Email,Statut)&$top=200`;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw { status: 502, erreur: "Demandes d'accès injoignables (lecture)." };
    const j = await r.json();
    if (j.value.some((i) => (i.fields.Email || "").toLowerCase() === email && i.fields.Statut === "Nouvelle"))
      throw { status: 409, erreur: "Votre demande d'accès est déjà en cours de traitement — vous serez prévenu par email." };
    url = j["@odata.nextLink"] || null;
  }

  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: email,
      Email: email,
      NomComplet: (d.nom || "").slice(0, 120),
      Entreprise: (d.entreprise || "").slice(0, 120),
      Telephone: (d.telephone || "").slice(0, 30),
      Message: (d.message || "").slice(0, 1000),
      Statut: "Nouvelle",
    } }),
  });
  if (!r.ok) throw { status: 502, erreur: "Enregistrement de la demande impossible, réessayez." };
}

module.exports = { verifierJeton, resoudreClient, creerDemandeAcces };
