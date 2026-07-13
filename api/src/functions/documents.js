// api/src/functions/documents.js — l'onglet Documents du portail.
// GET /api/documents           → liste des documents du client résolu
// GET /api/document?id={itemId} → téléchargement (streaming via l'API :
//   aucune URL SharePoint n'est exposée, et telechargerDocument vérifie
//   que le fichier appartient bien au dossier du client).

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, listerDocuments, telechargerDocument } = require("../annuaire");

app.http("documents", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { email } = await verifierJeton(request);
      const c = await resoudreClient(email);
      const docs = await listerDocuments(c.codeClient);
      return { status: 200, jsonBody: { client: c.codeClient, documents: docs } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("documents :", e);
      return { status: 502, jsonBody: { erreur: "Documents momentanément indisponibles." } };
    }
  }
});

app.http("document", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { email } = await verifierJeton(request);
      const c = await resoudreClient(email);
      const doc = await telechargerDocument(c.codeClient, request.query.get("id"));
      return {
        status: 200,
        body: doc.contenu,
        headers: {
          "Content-Type": doc.contentType,
          "Content-Disposition": `attachment; filename="${doc.nom.replace(/"/g, "")}"`,
          "Cache-Control": "private, no-store",
        },
      };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("document :", e);
      return { status: 502, jsonBody: { erreur: "Téléchargement momentanément indisponible." } };
    }
  }
});
