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
      // Onboarding salarié : le jeton d'invitation remplace le compte —
      // le fichier atterrit dans le dossier Dépôts du client, préfixé du
      // nom du salarié (le gestionnaire le retrouve d'un coup d'œil).
      const invitation = request.query.get("invitation");
      // Note de frais : le salarié photographie son ticket depuis le lien
      // public. Le jeton n'ouvre que le dossier de dépôt de SON
      // employeur, et le fichier est préfixé du nom pour que la pile de
      // fin de mois reste lisible.
      const frais = request.query.get("frais");
      let codeClient, auteur, prefixe = "";
      if (invitation) {
        const inv = await require("../onboarding").clientDeInvitation(invitation);
        codeClient = inv.codeClient;
        auteur = `onboarding ${inv.nom} ${inv.prenom}`;
        prefixe = `Onboarding_${inv.nom}_${inv.prenom}_`.replace(/\s+/g, "-");
      } else if (frais) {
        const c = await require("../notesdefrais").clientDeJeton(frais);
        codeClient = c.codeClient;
        const qui = String(request.query.get("salarie") || "").replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 60).trim();
        auteur = `note de frais ${qui || "—"}`;
        prefixe = `Frais_${qui || "salarie"}_`.replace(/\s+/g, "-");
      } else {
        const { email } = await verifierJeton(request);
        codeClient = (await resoudreClient(email)).codeClient;
        auteur = email;
      }
      const contenu = Buffer.from(await request.arrayBuffer());
      const nomFinal = await deposerFichier(
        codeClient,
        prefixe + String(request.query.get("nom") || ""),
        request.headers.get("content-type"),
        contenu
      );
      context.log(`Dépôt ${codeClient} : ${nomFinal} (${contenu.byteLength} octets) par ${auteur}`);

      // Lecture automatique (facultative) : ?analyser=arret|rib|vitale|
      // identite → champs proposés au formulaire, JAMAIS écrits d'office.
      // Le dépôt a déjà réussi : une extraction en échec ne dégrade pas
      // la réponse, elle ajoute seulement un motif consultable.
      const aAnalyser = request.query.get("analyser");
      let extraction;
      if (aAnalyser) {
        const ocr = require("../ocr");
        const r = await ocr.analyser(aAnalyser, contenu, request.headers.get("content-type"), context);
        extraction = r.champs ? { champs: r.champs } : { champs: null, motif: r.erreur };
      }
      return { status: 201, jsonBody: { nom: nomFinal, ...(extraction ? { extraction } : {}) } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("depot :", e);
      return { status: 502, jsonBody: { erreur: "Dépôt momentanément indisponible, réessayez." } };
    }
  }
});
