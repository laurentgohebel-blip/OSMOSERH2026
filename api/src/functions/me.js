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
      if (admins.includes(email)) {
        // ?vue=admin : données de l'écran d'activation, servies par CETTE
        // route car la table de routage de la SWA n'accepte plus de
        // nouveau nom (voir le commentaire de contournement en fin de fichier).
        if ((request.query && request.query.get && request.query.get("vue")) === "admin") {
          try {
            return await require("../admin").donnees(request, context);
          } catch (e) {
            context.error("me/vue=admin :", e);
            return { status: 500, jsonBody: { erreur: `Module admin inchargeable : ${e.message}` } };
          }
        }
        return { status: 200, jsonBody: { email, admin: true } };
      }
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
   de « nouvelle fonction non enregistrée ». Le champ `version` identifie
   le déploiement réellement servi (s'il manque : contenu périmé côté
   plateforme). À retirer une fois l'écran d'administration validé. */
const VERSION_API = "2026-08-21-repartition";
app.http("ping", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ status: 200, jsonBody: { ok: true, version: VERSION_API, quand: new Date().toISOString() } }),
});

/* Contournement SWA (18/08) — bilan de la journée de diagnostic :
   la table de routage de CETTE Static Web App est figée côté plateforme.
   Le code exécuté est bien le dernier (prouvé : ping renvoie `version`),
   mais AUCUN nouveau nom de fonction n'entre dans la table — ni en
   nouveau fichier, ni via require(), ni déclaré directement ici (seule
   ping, à 16h34, est passée ; adminDonnees déclarée à l'identique dans
   ce même fichier reste en 404). Conséquences :
   1. L'écran d'administration passe par les routes HISTORIQUES,
      indexées depuis juillet : GET /api/me?vue=admin (données) et
      POST /api/demande { action: "adminActiver", … } (activation).
   2. Les déclarations ci-dessous restent : inopérantes ici, elles
      donneront les vraies routes sur la NOUVELLE SWA (migration Osmose),
      où /api/lead est de toute façon indispensable au site vitrine.
   Modules en chargement paresseux : un module inchargeable donne un 500
   avec la cause — jamais un 404 muet. */
/* Découverte du 21/08 (SWA neuve, données complètes) : l'indexation ne
   retient que les DEUX premières déclarations app.http d'un même fichier
   (documents.js : 2/2 routées ; me.js : me et ping routées, les trois
   suivantes ignorées quelle que soit leur forme). Les routes admin et
   lead sont donc déclarées dans des fichiers n'en portant qu'une :
   admin-donnees → demande.js, admin-activer → dashboard.js,
   lead → echeances.js. Ce fichier reste à 2 déclarations — ne JAMAIS
   en ajouter une troisième ici (ni ailleurs). */
