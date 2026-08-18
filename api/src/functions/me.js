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
   de « nouvelle fonction non enregistrée ». Le champ `version` identifie
   le déploiement réellement servi (s'il manque : contenu périmé côté
   plateforme). À retirer une fois l'écran d'administration validé. */
const VERSION_API = "2026-08-18-inline";
app.http("ping", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({ status: 200, jsonBody: { ok: true, version: VERSION_API, quand: new Date().toISOString() } }),
});

/* Contournement SWA (18/08) : cette Static Web App n'indexe pas les
   NOUVEAUX fichiers de src/functions (constat : ping enregistrée ici
   fonctionne, adminDonnees dans son propre fichier restait en 404 — et
   un simple require() des modules depuis ici n'a pas suffi non plus).
   Donc : les routes sont déclarées ICI, dans le seul fichier dont
   l'indexation est prouvée ; les modules admin et lead (dans src/,
   hors du dossier scanné) n'exportent que leurs handlers, chargés
   paresseusement à la première requête. Si un module refuse de charger,
   on renvoie un 500 avec la cause — jamais un 404 muet. */
const paresseux = (chemin, nom) => async (request, context) => {
  let h;
  try {
    h = require(chemin)[nom];
    if (typeof h !== "function") throw new Error(`export « ${nom} » absent`);
  } catch (e) {
    context.error(`chargement ${chemin} :`, e);
    return { status: 500, jsonBody: { erreur: `Module ${chemin} inchargeable : ${e.message}` } };
  }
  return h(request, context);
};

app.http("adminDonnees", { methods: ["GET"], authLevel: "anonymous", handler: paresseux("../admin", "donnees") });
app.http("adminActiver", { methods: ["POST"], authLevel: "anonymous", handler: paresseux("../admin", "activer") });
app.http("lead", { methods: ["POST", "OPTIONS"], authLevel: "anonymous", handler: paresseux("../lead", "lead") });
