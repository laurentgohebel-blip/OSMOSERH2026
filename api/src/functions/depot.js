// api/src/functions/depot.js — dépôt de fichiers par le client.
// POST /api/depot?nom={fichier}  (corps = contenu binaire brut)
// Jeton vérifié → client résolu → fichier écrit dans {code}/Dépôts de la
// bibliothèque « Documents clients » (liste blanche d'extensions, 10 Mo max,
// renommage auto en cas de collision). Le fichier apparaît aussitôt dans
// l'onglet Documents, catégorie « Dépôts », côté client ET gestionnaire.

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, deposerFichier } = require("../annuaire");

app.http("depot", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { email } = await verifierJeton(request);
      const c = await resoudreClient(email);
      const contenu = Buffer.from(await request.arrayBuffer());
      const nomFinal = await deposerFichier(
        c.codeClient,
        request.query.get("nom"),
        request.headers.get("content-type"),
        contenu
      );
      context.log(`Dépôt ${c.codeClient} : ${nomFinal} (${contenu.byteLength} octets) par ${email}`);
      return { status: 201, jsonBody: { nom: nomFinal } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("depot :", e);
      return { status: 502, jsonBody: { erreur: "Dépôt momentanément indisponible, réessayez." } };
    }
  }
});
