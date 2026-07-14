// api/src/functions/personnel.js — dossier « gestion du personnel » du client.
// GET /api/personnel (jeton utilisateur) : salariés déclarés (Production
// contrat) + absences, visites médicales, adhésions mutuelles et fins de
// contrat — le tout FILTRÉ CÔTÉ SERVEUR sur le CodeClient résolu.
// Le rapprochement fiche ↔ déclarations se fait par clé nom+prénom
// normalisée (les démarches saisissent le salarié en texte libre).

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, tokenGraph, idsListes, items, dateParis } = require("../annuaire");

const cle = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();

app.http("personnel", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { email } = await verifierJeton(request);
      const c = await resoudreClient(email);
      if (!c.options.includes("embauche"))
        return { status: 403, jsonBody: { erreur: "Option non incluse dans votre contrat — contactez votre gestionnaire Osmose RH." } };

      const tok = await tokenGraph();
      const ids = await idsListes(tok);
      const [contrats, absences, visites, mutuelles, fins] = await Promise.all([
        items(tok, ids["Production contrat"], "CodeClient,Nom,Pr_x00e9_nom,Type_x0020_contrat,Postedetravail,Dateded_x00e9_but,Datedefin,Created"),
        items(tok, ids["Absences"], "CodeClient,Title,SalarieNom,SalariePrenom,DateDebut,DateFin,Motif,JustificatifUrl,Statut,Reference"),
        items(tok, ids["Visites médicales"], "CodeClient,Title,SalarieNom,SalariePrenom,DateVisite,Statut,Reference"),
        items(tok, ids["Adhésions mutuelles"], "CodeClient,Title,SalarieNom,SalariePrenom,Mutuelle,DateAdhesion,Statut,Reference"),
        items(tok, ids["Fins de contrat"], "CodeClient,Title,Nom,Prenom,TypeContrat,Motif,DateFin,Statut"),
      ]);
      const du = (liste) => liste.filter((x) => x.CodeClient === c.codeClient);

      const salaries = du(contrats)
        .map((x) => ({
          cle: cle(x.Nom, x.Pr_x00e9_nom),
          nom: String(x.Nom || "").toUpperCase(),
          prenom: x.Pr_x00e9_nom || "",
          type: x.Type_x0020_contrat || "",
          poste: x.Postedetravail || "",
          debut: dateParis(x.Dateded_x00e9_but),
          fin: dateParis(x.Datedefin),
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

      return { status: 200, jsonBody: {
        salaries,
        absences: du(absences).map((x) => ({
          cle: cle(x.SalarieNom, x.SalariePrenom), salarie: x.Title || "",
          du: dateParis(x.DateDebut), au: dateParis(x.DateFin),
          motif: x.Motif || "", justificatifUrl: x.JustificatifUrl || "",
          statut: x.Statut || "Nouvelle", reference: x.Reference || "",
        })).sort((a, b) => String(b.du).localeCompare(String(a.du))),
        visites: du(visites).map((x) => ({
          cle: cle(x.SalarieNom, x.SalariePrenom), salarie: x.Title || "",
          date: dateParis(x.DateVisite), statut: x.Statut || "À planifier", reference: x.Reference || "",
        })).sort((a, b) => String(b.date).localeCompare(String(a.date))),
        mutuelles: du(mutuelles).map((x) => ({
          cle: cle(x.SalarieNom, x.SalariePrenom), salarie: x.Title || "",
          mutuelle: x.Mutuelle || "", date: dateParis(x.DateAdhesion),
          statut: x.Statut || "Demande", reference: x.Reference || "",
        })).sort((a, b) => String(b.date).localeCompare(String(a.date))),
        fins: du(fins).map((x) => ({
          cle: cle(x.Nom, x.Prenom), salarie: cle(x.Nom, x.Prenom),
          type: x.TypeContrat || "", motif: x.Motif || "",
          date: dateParis(x.DateFin), statut: x.Statut || "Nouvelle", reference: x.Title || "",
        })).sort((a, b) => String(b.date).localeCompare(String(a.date))),
      } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("personnel :", e);
      return { status: 502, jsonBody: { erreur: "Dossier du personnel momentanément indisponible." } };
    }
  }
});
