// api/src/functions/me.js — « qui suis-je ? » pour le front.
// Le portail l'appelle au chargement : jeton validé + résolution client,
// et renvoie de quoi afficher le bon client (ou l'écran « non rattaché »).
// Ne renvoie que le nécessaire à l'affichage — pas le gestionnaire ni le SIRET.

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient } = require("../annuaire");

app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { email } = await verifierJeton(request);
      // Gestionnaire (ADMIN_EMAILS) : pas de résolution client — le portail
      // affiche l'écran d'activation des demandes d'accès.
      const admins = (process.env.ADMIN_EMAILS || "")
        .split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
      if (admins.includes(email))
        return { status: 200, jsonBody: { email, admin: true } };
      const c = await resoudreClient(email);
      return { status: 200, jsonBody: { email, client: c.codeClient, raisonSociale: c.raisonSociale, options: c.options } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("me :", e);
      return { status: 502, jsonBody: { erreur: "Vérification du compte impossible, réessayez." } };
    }
  }
});

/* Fonction-témoin de diagnostic (18/08) : enregistrée depuis un fichier
   qui charge à coup sûr, pour discriminer « nouveau fichier non indexé »
   de « nouvelle fonction non enregistrée ». À retirer une fois l'écran
   d'administration validé. */
app.http("ping", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ status: 200, jsonBody: { ok: true, quand: new Date().toISOString() } }),
});

/* Contournement SWA (18/08) : cette Static Web App n'indexe pas les
   NOUVEAUX fichiers de src/functions (constat : ping enregistrée ici
   fonctionne, adminDonnees dans son propre fichier restait en 404).
   Les modules admin et lead vivent donc dans src/ (hors du dossier
   scanné, pour éviter tout double enregistrement) et sont chargés d'ici :
   le require exécute leurs app.http(). */
require("../admin");
require("../lead");
