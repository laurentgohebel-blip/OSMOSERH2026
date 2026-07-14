// api/src/functions/echeances.js — échéances de fins de CDD.
// Deux modes sur la même route GET /api/echeances :
//  • en-tête x-rappel-secret (flux hebdomadaire « Alertes échéances ») :
//    CDD finissant sous 30 jours jamais alertés → marque AlerteFinCDD
//    (anti-doublon) et renvoie un destinataire par contact du client
//    + le gestionnaire. Le flux n'a plus qu'à envoyer les e-mails.
//  • jeton utilisateur (page « Échéances » du portail) : fins de CDD du
//    client connecté — à venir et terminées récemment — SANS marquage,
//    la consultation ne consomme pas l'alerte e-mail.

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, tokenGraph, idsListes, items } = require("../annuaire");

const FENETRE_JOURS = 30;   // fenêtre d'alerte e-mail
const RECENT_JOURS = 60;    // fins passées encore affichées sur le portail

app.http("echeances", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const secret = request.headers.get("x-rappel-secret");
    try {
      if (secret) {
        if (!process.env.RAPPEL_SECRET || secret !== process.env.RAPPEL_SECRET)
          return { status: 401, jsonBody: { erreur: "Non autorisé." } };
        return await modeAlertes(context);
      }
      return await modePortail(request);
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("echeances :", e);
      return { status: 502, jsonBody: { erreur: "Calcul des échéances impossible." } };
    }
  }
});

/* ── Mode portail : le client consulte SES échéances ─────────────────── */
async function modePortail(request) {
  const { email } = await verifierJeton(request);
  const c = await resoudreClient(email);
  const tok = await tokenGraph();
  const ids = await idsListes(tok);

  const contrats = await items(tok, ids["Production contrat"],
    "CodeClient,Nom,Pr_x00e9_nom,Type_x0020_contrat,Datedefin,AlerteFinCDD,Postedetravail");

  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const ligne = (x) => ({
    salarie: `${(x.Nom || "").toUpperCase()} ${x.Pr_x00e9_nom || ""}`.trim(),
    poste: x.Postedetravail || "",
    dateFin: x.Datedefin,
    joursRestants: Math.round((new Date(x.Datedefin) - aujourdhui) / 86400000),
    alerte: x.AlerteFinCDD || null,
  });

  const cdd = contrats.filter((x) =>
    x.CodeClient === c.codeClient && x.Type_x0020_contrat === "CDD" && x.Datedefin);

  const echeances = cdd
    .filter((x) => new Date(x.Datedefin) >= aujourdhui)
    .sort((a, b) => new Date(a.Datedefin) - new Date(b.Datedefin))
    .map(ligne);
  const recentes = cdd
    .filter((x) => new Date(x.Datedefin) < aujourdhui &&
      new Date(x.Datedefin) >= new Date(aujourdhui.getTime() - RECENT_JOURS * 86400000))
    .sort((a, b) => new Date(b.Datedefin) - new Date(a.Datedefin))
    .slice(0, 10)
    .map(ligne);

  return { status: 200, jsonBody: { echeances, recentes } };
}

/* ── Mode alertes : appelé par le flux hebdomadaire ──────────────────── */
async function modeAlertes(context) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const listeId = ids["Production contrat"];

  // lecture directe (id d'élément nécessaire pour marquer l'alerte)
  const rl = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$select=id&$expand=fields($select=CodeClient,Nom,Pr_x00e9_nom,Type_x0020_contrat,Datedefin,AlerteFinCDD)&$top=500`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!rl.ok) throw { status: 502, erreur: "Lecture des contrats impossible." };
  const contrats = (await rl.json()).value;

  const maintenant = new Date();
  const borne = new Date(maintenant.getTime() + FENETRE_JOURS * 86400000);

  const aAlerter = contrats.filter((x) => {
    const f = x.fields;
    if (f.Type_x0020_contrat !== "CDD" || !f.Datedefin || f.AlerteFinCDD) return false;
    const fin = new Date(f.Datedefin);
    return fin >= maintenant && fin <= borne;
  });

  if (aAlerter.length === 0) return { status: 200, jsonBody: { alertes: [] } };

  const clients = await items(tok, ids["Paramètres clients"], "CodeClient,RaisonSociale,EmailGestionnaire,Actif");
  const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email,CodeClient,Actif");

  const alertes = [];
  for (const x of aAlerter) {
    const f = x.fields;
    const client = clients.find((c) => c.CodeClient === f.CodeClient && c.Actif !== false);
    const salarie = `${(f.Nom || "").toUpperCase()} ${f.Pr_x00e9_nom || ""}`.trim();
    const dateFin = new Date(f.Datedefin).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    const joursRestants = Math.max(0, Math.round((new Date(f.Datedefin) - maintenant) / 86400000));

    const destinataires = new Set();
    if (client) {
      for (const u of utilisateurs.filter((u) => u.CodeClient === f.CodeClient && u.Actif !== false && u.Email))
        destinataires.add(u.Email);
      if (client.EmailGestionnaire) destinataires.add(client.EmailGestionnaire);
    } else if (process.env.ALERTE_DEFAUT) {
      destinataires.add(process.env.ALERTE_DEFAUT); // contrat sans client identifiable : gestionnaire par défaut
    }
    for (const email of destinataires) {
      alertes.push({ email, salarie, dateFin, joursRestants, raisonSociale: client?.RaisonSociale || f.CodeClient || "—" });
    }

    // marquage anti-doublon (best-effort)
    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteFinCDD: new Date().toISOString() }),
    }).catch(() => {});
  }

  context.log(`Échéances CDD : ${aAlerter.length} contrat(s), ${alertes.length} destinataire(s).`);
  return { status: 200, jsonBody: { alertes } };
}
