// api/src/functions/rappel.js — calcule les rappels de cut-off paie.
// GET /api/rappel-variables (en-tête x-rappel-secret = RAPPEL_SECRET)
// Appelé par le flux planifié « Rappel variables de paie » en début de mois :
// pour chaque client ACTIF ayant l'option 'paie', si RIEN n'a été transmis
// pour le mois écoulé (ni lignes de grille, ni fichier Variables_{mois}_*
// déposé), renvoie un rappel par contact portail actif du client.
// L'API calcule, le flux envoie les e-mails (SMTP) — aucune logique côté flux.

const { app } = require("@azure/functions");
const { tokenGraph, idsListes, items, listerDocuments, majCyclePaie } = require("../annuaire");

app.http("rappel-variables", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (!process.env.RAPPEL_SECRET || request.headers.get("x-rappel-secret") !== process.env.RAPPEL_SECRET)
      return { status: 401, jsonBody: { erreur: "Non autorisé." } };

    try {
      // Mois écoulé, calé sur Paris (le run du 1er au matin vise M-1)
      const paris = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
      const m = new Date(paris.getFullYear(), paris.getMonth() - 1, 1);
      const mois = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      const moisLisible = m.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const limite = new Date(paris.getFullYear(), paris.getMonth(), 5).toLocaleDateString("fr-FR");

      const tok = await tokenGraph();
      const ids = await idsListes(tok);
      const clients = (await items(tok, ids["Paramètres clients"], "CodeClient,RaisonSociale,Actif,Options"))
        .filter((c) => c.Actif !== false && Array.isArray(c.Options) && c.Options.includes("paie") && c.CodeClient);
      const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email,CodeClient,Actif");
      const variables = await items(tok, ids["Variables de paie"], "CodeClient,Mois");

      const rappels = [];
      for (const c of clients) {
        const grilleTransmise = variables.some((v) => v.CodeClient === c.CodeClient && v.Mois === mois);
        let fichierDepose = false;
        if (!grilleTransmise) {
          const docs = await listerDocuments(c.CodeClient);
          fichierDepose = docs.some((d) => d.categorie === "Dépôts" && d.nom.startsWith(`Variables_${mois}_`));
        }
        if (grilleTransmise || fichierDepose) continue;
        // ligne de pilotage : le mois en retard apparaît dans « Cycle de paie »
        await majCyclePaie(c.CodeClient, mois, "En attente variables");
        for (const u of utilisateurs.filter((x) => x.CodeClient === c.CodeClient && x.Actif !== false && x.Email)) {
          rappels.push({
            email: u.Email,
            client: c.CodeClient,
            raisonSociale: c.RaisonSociale || c.CodeClient,
            mois, moisLisible, limite,
          });
        }
      }
      context.log(`Rappel variables ${mois} : ${rappels.length} destinataire(s).`);
      return { status: 200, jsonBody: { mois, moisLisible, limite, rappels } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("rappel :", e);
      return { status: 502, jsonBody: { erreur: "Calcul des rappels impossible." } };
    }
  }
});
