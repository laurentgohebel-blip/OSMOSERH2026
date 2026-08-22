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
          // &onglet=messages : boîte de réception des fils clients —
          // même contournement, logique dans le module messages.
          if (request.query.get("onglet") === "messages") {
            try {
              return await require("../messages").boite(request, context);
            } catch (e) {
              if (e && e.status) throw e;
              context.error("me/vue=admin/messages :", e);
              return { status: 500, jsonBody: { erreur: `Module messages inchargeable : ${e.message}` } };
            }
          }
          try {
            return await require("../admin").donnees(request, context);
          } catch (e) {
            context.error("me/vue=admin :", e);
            return { status: 500, jsonBody: { erreur: `Module admin inchargeable : ${e.message}` } };
          }
        }
        return { status: 200, jsonBody: { email, admin: true } };
      }
      // ?vue=messages : fils de discussion du client — servi par CETTE
      // route (doctrine ci-dessous : pas de nouveau /api/<nom>), logique
      // dans le module paresseux src/messages.js, comme admin et lead.
      if ((request.query && request.query.get && request.query.get("vue")) === "messages") {
        try {
          return await require("../messages").fils(request, context);
        } catch (e) {
          if (e && e.status) throw e; // 401/403 métier → catch global ci-dessous
          context.error("me/vue=messages :", e);
          return { status: 500, jsonBody: { erreur: `Module messages inchargeable : ${e.message}` } };
        }
      }
      const c = await resoudreClient(email);
      // Pastille « messages non lus » de la tuile Mon gestionnaire —
      // best effort : une panne de lecture ne bloque jamais l'entrée.
      let messagesNonLus = 0;
      try { messagesNonLus = await require("../messages").nonLus(c.codeClient); } catch { /* pastille absente, portail intact */ }
      return { status: 200, jsonBody: { email, client: c.codeClient, raisonSociale: c.raisonSociale, options: c.options, messagesNonLus } };
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
const VERSION_API = "2026-08-22-reprise-complete";
app.http("ping", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ status: 200, jsonBody: { ok: true, version: VERSION_API, quand: new Date().toISOString() } }),
});

/* ═══ DOCTRINE DÉFINITIVE (21/08) — À LIRE AVANT TOUTE NOUVELLE ROUTE ═══
   La découverte des fonctions par la plateforme Static Web Apps est
   OPAQUE ET NON FIABLE : cinq hypothèses testées et éliminées sur une
   SWA NEUVE (table figée, casse du nom, handler non littéral, nombre de
   déclarations par fichier, position dans le fichier — admin-activer
   déclarée ligne 14 restait en 404 quand ping ligne 49 passait). Seules
   les 10 routes historiques de juillet + ping sont servies, sur les
   deux SWA, quel que soit le code.
   RÈGLE : ne JAMAIS compter sur une nouvelle route /api/<nom>. Toute
   nouvelle capacité passe par les routes existantes :
   - gestionnaire : GET /api/me?vue=admin (données d'administration) et
     POST /api/demande { action: "adminActiver" | "adminImportSalaries" } ;
   - formulaires publics vitrine : POST /api/demande { action: "lead" }
     en Content-Type text/plain (requête simple, pas de préflight) ;
   - santé/version : GET /api/ping (champ `version` = déploiement servi).
   Les modules admin et lead (src/) n'exportent que des handlers,
   chargés paresseusement — un module inchargeable donne un 500 avec la
   cause, jamais un 404 muet. Dossier d'expériences complet :
   Point-de-reprise-2026-08-17.md (§ 18/08 et 21/08). */
