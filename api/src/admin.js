// api/src/admin.js — activation des demandes d'accès en un clic.
// Réservé aux gestionnaires : la variable ADMIN_EMAILS (adresses séparées
// par des virgules) est la liste blanche ; le jeton External ID reste
// vérifié comme partout — un gestionnaire se connecte au portail avec un
// compte dont l'adresse figure dans ADMIN_EMAILS.
//
// Ce module n'enregistre PAS ses routes : il exporte les handlers, et
// c'est me.js qui les déclare auprès du runtime (voir le commentaire de
// contournement SWA dans me.js).
//
// GET  /api/adminDonnees : demandes d'accès « Nouvelle » + clients actifs.
// POST /api/adminActiver : { email, demandeId?, codeClient } pour un client
//   existant, ou { email, demandeId?, nouveau: { codeClient, raisonSociale,
//   options[], adresseEntreprise?, siret?, representant?,
//   fonctionRepresentant?, lieuEdition?, emailGestionnaire? } }.
//   Écrit « Paramètres clients » (si nouveau) + « Utilisateurs portail »,
//   passe la demande en « Traitée », vide le cache de lecture (effet
//   immédiat pour le client qui recharge).

const { verifierJeton, tokenGraph, idsListes, items, viderCacheItems } = require("./annuaire");

const OPTIONS_VALIDES = ["embauche", "acompte", "attestation", "paie"];

function adminAutorise(email) {
  const liste = (process.env.ADMIN_EMAILS || "")
    .split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  return liste.includes(email);
}

async function exigerAdmin(request) {
  const { email } = await verifierJeton(request);
  if (!adminAutorise(email))
    throw { status: 403, erreur: "Accès réservé aux gestionnaires Osmose RH." };
  return email;
}

const graphListe = (listeId, suite = "") =>
  `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}${suite}`;

/* ── GET /api/adminDonnees ────────────────────────────────────────────── */
async function donnees(request, context) {
  try {
    await exigerAdmin(request);
    const tok = await tokenGraph();
    const ids = await idsListes(tok);
    if (!ids["Demandes d'accès portail"]) throw { status: 502, erreur: "Liste des demandes introuvable." };

    // Demandes avec leur id d'élément (nécessaire pour le passage en Traitée)
    const demandes = [];
    let url = graphListe(ids["Demandes d'accès portail"],
      "/items?$expand=fields($select=Email,NomComplet,Entreprise,Telephone,Message,Statut)&$top=200");
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
      if (!r.ok) throw { status: 502, erreur: "Lecture des demandes impossible." };
      const j = await r.json();
      for (const i of j.value) {
        if (i.fields.Statut === "Nouvelle") demandes.push({
          id: i.id,
          email: (i.fields.Email || "").toLowerCase(),
          nom: i.fields.NomComplet || "",
          entreprise: i.fields.Entreprise || "",
          telephone: i.fields.Telephone || "",
          message: i.fields.Message || "",
          recueLe: i.createdDateTime || null,
        });
      }
      url = j["@odata.nextLink"] || null;
    }

    const clients = (await items(tok, ids["Paramètres clients"], "CodeClient,RaisonSociale,Actif"))
      .filter((c) => c.CodeClient && c.Actif !== false)
      .map((c) => ({ codeClient: c.CodeClient, raisonSociale: c.RaisonSociale || "" }))
      .sort((a, b) => a.codeClient.localeCompare(b.codeClient));

    return { status: 200, jsonBody: { demandes, clients, options: OPTIONS_VALIDES } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/donnees :", e);
    return { status: 502, jsonBody: { erreur: "Données d'administration indisponibles." } };
  }
}

/* ── POST /api/adminActiver ───────────────────────────────────────────── */
async function activer(request, context) {
  try {
    await exigerAdmin(request);
    let d;
    try { d = await request.json(); } catch { return { status: 400, jsonBody: { erreur: "JSON attendu" } }; }

    const email = String(d.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return { status: 400, jsonBody: { erreur: "Adresse e-mail du demandeur invalide." } };

    const tok = await tokenGraph();
    const ids = await idsListes(tok);

    let codeClient;
    if (d.nouveau) {
      const n = d.nouveau;
      codeClient = String(n.codeClient || "").trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(codeClient))
        return { status: 400, jsonBody: { erreur: "Code client invalide (2 à 20 lettres/chiffres/tirets)." } };
      if (!n.raisonSociale || String(n.raisonSociale).trim().length < 2)
        return { status: 400, jsonBody: { erreur: "Raison sociale requise." } };
      const options = Array.isArray(n.options) ? n.options.filter((o) => OPTIONS_VALIDES.includes(o)) : [];

      // Unicité du code : refuser un doublon plutôt que créer un clone
      const clients = await items(tok, ids["Paramètres clients"], "CodeClient");
      if (clients.some((c) => (c.CodeClient || "").toUpperCase() === codeClient))
        return { status: 409, jsonBody: { erreur: `Le code client ${codeClient} existe déjà — choisissez « client existant ».` } };

      const rc = await fetch(graphListe(ids["Paramètres clients"], "/items"), {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          Title: String(n.raisonSociale).trim().slice(0, 255),
          CodeClient: codeClient,
          RaisonSociale: String(n.raisonSociale).trim().slice(0, 255),
          AdresseEntreprise: String(n.adresseEntreprise || "").trim().slice(0, 255),
          Siret: String(n.siret || "").trim().slice(0, 20),
          Representant: String(n.representant || "").trim().slice(0, 120),
          FonctionRepresentant: String(n.fonctionRepresentant || "").trim().slice(0, 120),
          LieuEdition: String(n.lieuEdition || "").trim().slice(0, 120),
          EmailGestionnaire: String(n.emailGestionnaire || "").trim().slice(0, 200),
          Actif: true,
          "Options@odata.type": "Collection(Edm.String)",
          Options: options,
        } }),
      });
      if (!rc.ok) {
        context.error("admin/activer client :", rc.status, (await rc.text().catch(() => "")).slice(0, 300));
        throw { status: 502, erreur: "Création de la fiche client impossible." };
      }
    } else {
      codeClient = String(d.codeClient || "").trim();
      const clients = await items(tok, ids["Paramètres clients"], "CodeClient,Actif");
      if (!clients.some((c) => c.CodeClient === codeClient && c.Actif !== false))
        return { status: 400, jsonBody: { erreur: `Client ${codeClient} introuvable ou inactif.` } };
    }

    // Rattachement — refuser le doublon d'utilisateur
    const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email");
    if (utilisateurs.some((u) => (u.Email || "").toLowerCase() === email))
      return { status: 409, jsonBody: { erreur: "Cette adresse est déjà rattachée — vérifiez « Utilisateurs portail »." } };

    const ru = await fetch(graphListe(ids["Utilisateurs portail"], "/items"), {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { Title: email, Email: email, CodeClient: codeClient, Actif: true } }),
    });
    if (!ru.ok) {
      context.error("admin/activer utilisateur :", ru.status, (await ru.text().catch(() => "")).slice(0, 300));
      throw { status: 502, erreur: "Rattachement du compte impossible." };
    }

    // Demande → Traitée (best-effort : l'activation elle-même est faite)
    if (d.demandeId && ids["Demandes d'accès portail"]) {
      await fetch(graphListe(ids["Demandes d'accès portail"], `/items/${encodeURIComponent(String(d.demandeId))}/fields`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Statut: "Traitée" }),
      }).catch(() => {});
    }

    viderCacheItems(); // effet immédiat : le client entre dès son rechargement
    return { status: 200, jsonBody: { ok: true, email, codeClient } };
  } catch (e) {
    if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
    context.error("admin/activer :", e);
    return { status: 502, jsonBody: { erreur: "Activation impossible — réessayez." } };
  }
}

module.exports = { donnees, activer };
