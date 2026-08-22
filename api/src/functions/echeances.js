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
const { verifierJeton, resoudreClient, tokenGraph, idsListes, items, dateParis, SELECT_SALARIES } = require("../annuaire");

const FENETRE_JOURS = 30;   // fenêtre d'alerte e-mail
const RECENT_JOURS = 60;    // fins passées encore affichées sur le portail

// Titres de séjour (22/08, brique étrangers) : relances MULTI-PALIERS
// J-90 → J-60 → J-30 → EXPIRÉ, chaque palier une seule fois
// (AlerteTitreSejour mémorise le dernier palier envoyé). Un récépissé de
// renouvellement en cours de validité SUSPEND les relances ; la
// déclaration d'un récépissé ou d'un nouveau titre réarme le cycle.
const PORTAIL_TITRE_JOURS = 120;
const TITRE_EXPIRE_RECENT = 60;
const PALIERS_TITRE = ["J-90", "J-60", "J-30", "EXPIRE"];
const palierCourant = (jours) => (jours < 0 ? "EXPIRE" : jours <= 30 ? "J-30" : jours <= 60 ? "J-60" : jours <= 90 ? "J-90" : null);
// Compat : les alertes d'avant les paliers stockaient un ISO nu → J-90 fait.
const palierDejaFait = (v) => {
  const m = /^(J-90|J-60|J-30|EXPIRE)/.exec(String(v || ""));
  return m ? m[1] : (String(v || "").trim() ? "J-90" : null);
};

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

  // Comparaisons en « date vue de Paris » (AAAA-MM-JJ) : les colonnes date
  // stockent minuit Paris (22:00Z la veille), l'ISO brut décale d'un jour.
  const aujourdhui = dateParis(new Date());
  const jourFin = (x) => dateParis(x.Datedefin);
  const ligne = (x) => ({
    salarie: `${(x.Nom || "").toUpperCase()} ${x.Pr_x00e9_nom || ""}`.trim(),
    poste: x.Postedetravail || "",
    dateFin: jourFin(x),
    joursRestants: Math.round((new Date(jourFin(x)) - new Date(aujourdhui)) / 86400000),
    alerte: x.AlerteFinCDD || null,
  });

  const cdd = contrats.filter((x) =>
    x.CodeClient === c.codeClient && x.Type_x0020_contrat === "CDD" && x.Datedefin);

  const borneRecent = dateParis(new Date(Date.now() - RECENT_JOURS * 86400000));
  const echeances = cdd
    .filter((x) => jourFin(x) >= aujourdhui)
    .sort((a, b) => jourFin(a).localeCompare(jourFin(b)))
    .map(ligne);
  const recentes = cdd
    .filter((x) => jourFin(x) < aujourdhui && jourFin(x) >= borneRecent)
    .sort((a, b) => jourFin(b).localeCompare(jourFin(a)))
    .slice(0, 10)
    .map(ligne);

  // Titres de séjour du client : à renouveler (≤ 120 j de droits) et
  // expirés récents — état calculé par la brique étrangers (le récépissé
  // prolonge les droits).
  const { etatTitre } = require("../etrangers");
  const borneTitre = dateParis(new Date(Date.now() + PORTAIL_TITRE_JOURS * 86400000));
  const borneExpire = dateParis(new Date(Date.now() - TITRE_EXPIRE_RECENT * 86400000));
  const titres = (await items(tok, ids["Salariés"], SELECT_SALARIES))
    .filter((s) => s.CodeClient === c.codeClient && s.TitreSejourExpiration
      && s.Statut !== "Sorti")
    .map((s) => ({
      salarie: `${String(s.Nom || "").toUpperCase()} ${s.Prenom || ""}`.trim(),
      type: s.TitreSejourType || "",
      numero: s.TitreSejourNumero || "",
      dateExpiration: dateParis(s.TitreSejourExpiration),
      alerte: s.AlerteTitreSejour || null,
      ...etatTitre(s, aujourdhui), // etat, joursRestants, finDroits
    }))
    .filter((t) => t.finDroits && t.finDroits <= borneTitre && t.finDroits >= borneExpire)
    .sort((a, b) => a.finDroits.localeCompare(b.finDroits));

  return { status: 200, jsonBody: { echeances, recentes, titres } };
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

  // Titres de séjour : palier courant (J-90/J-60/J-30/EXPIRÉ) comparé au
  // dernier palier envoyé (AlerteTitreSejour) — chaque palier part une
  // fois. Un récépissé en cours de validité suspend le cycle ; les titres
  // expirés depuis plus de 180 j jamais alertés sont laissés au dossier
  // gestionnaire (éviter de réveiller l'historique).
  const { etatTitre } = require("../etrangers");
  const rs = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items?$select=id&$expand=fields($select=CodeClient,Nom,Prenom,Statut,TitreSejourType,TitreSejourNumero,TitreSejourExpiration,RecepisseFin,AlerteTitreSejour)&$top=999`,
    { headers: { Authorization: `Bearer ${tok}` } });
  const salaries = rs.ok ? (await rs.json()).value : [];
  const aujourdhuiParis = dateParis(maintenant);
  const ancien = new Date(maintenant.getTime() - 180 * 86400000);
  const titresAAlerter = salaries.map((x) => {
    const f = x.fields;
    if (!f.TitreSejourExpiration || f.Statut === "Sorti") return null;
    if (etatTitre(f, aujourdhuiParis).etat === "en-renouvellement") return null; // récépissé valide
    const jours = Math.round((new Date(f.TitreSejourExpiration) - maintenant) / 86400000);
    const palier = palierCourant(jours);
    if (!palier) return null;
    const fait = palierDejaFait(f.AlerteTitreSejour);
    if (fait && PALIERS_TITRE.indexOf(palier) <= PALIERS_TITRE.indexOf(fait)) return null;
    if (palier === "EXPIRE" && !fait && new Date(f.TitreSejourExpiration) < ancien) return null;
    return { x, palier, jours };
  }).filter(Boolean);

  if (aAlerter.length === 0 && titresAAlerter.length === 0)
    return { status: 200, jsonBody: { alertes: [], alertesTitres: [] } };

  const clients = await items(tok, ids["Paramètres clients"], "CodeClient,RaisonSociale,EmailGestionnaire,Actif");
  const utilisateurs = await items(tok, ids["Utilisateurs portail"], "Email,CodeClient,Actif");

  // Destinataires d'un client : ses contacts portail + le gestionnaire ;
  // repli ALERTE_DEFAUT si le client n'est pas identifiable.
  const destinatairesDe = (codeClient) => {
    const client = clients.find((c) => c.CodeClient === codeClient && c.Actif !== false);
    const dest = new Set();
    if (client) {
      for (const u of utilisateurs.filter((u) => u.CodeClient === codeClient && u.Actif !== false && u.Email))
        dest.add(u.Email);
      if (client.EmailGestionnaire) dest.add(client.EmailGestionnaire);
    } else if (process.env.ALERTE_DEFAUT) {
      dest.add(process.env.ALERTE_DEFAUT);
    }
    return { dest, client };
  };

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

  // Titres de séjour — tableau SÉPARÉ (alertesTitres) : le flux existant
  // continue d'envoyer les mails CDD sans modification, et une seconde
  // boucle « Pour chaque alertesTitres » envoie objet + corps tels quels.
  const alertesTitres = [];
  for (const { x, palier, jours } of titresAAlerter) {
    const f = x.fields;
    const salarie = `${(f.Nom || "").toUpperCase()} ${f.Prenom || ""}`.trim();
    const dateExpiration = new Date(f.TitreSejourExpiration).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    const { dest, client } = destinatairesDe(f.CodeClient);
    const raisonSociale = client?.RaisonSociale || f.CodeClient || "—";
    const titre = `${f.TitreSejourType || "titre de séjour"}${f.TitreSejourNumero ? ` n° ${f.TitreSejourNumero}` : ""}`;
    const relais = "Déclarez le récépissé de renouvellement (ou le nouveau titre) dans votre espace Osmose RH, page « Salariés étrangers » — les relances s'arrêteront et le dossier restera conforme.";
    const objet = palier === "EXPIRE"
      ? `URGENT — titre de séjour EXPIRÉ : ${salarie} (${raisonSociale})`
      : palier === "J-30"
        ? `URGENT — titre de séjour de ${salarie} : ${jours} jours avant expiration`
        : `Titre de séjour à renouveler : ${salarie} — expire le ${dateExpiration}`;
    const corps = palier === "EXPIRE"
      ? `Le titre de séjour de ${salarie} (${titre}) a expiré le ${dateExpiration} et aucun récépissé de renouvellement n'a été déclaré.\n\nSans titre valide ou récépissé, le salarié ne peut plus être employé (art. L.8251-1 du code du travail). Contactez immédiatement votre gestionnaire Osmose RH.`
      : palier === "J-30"
        ? `Le titre de séjour de ${salarie} (${titre}) expire le ${dateExpiration}, dans ${jours} jours, et aucun récépissé de renouvellement n'a été déclaré.\n\nAu terme, sans récépissé, l'emploi devra être suspendu (art. L.8251-1). ${relais}`
        : palier === "J-60"
          ? `Le titre de séjour de ${salarie} (${titre}) expire le ${dateExpiration} (dans ${jours} jours) et aucun récépissé n'a encore été déclaré.\n\nSi la demande de renouvellement n'est pas déposée, faites-le sans attendre. ${relais}`
          : `Le titre de séjour de ${salarie} (${titre}) expire le ${dateExpiration} (dans ${jours} jours).\n\nLa demande de renouvellement se dépose entre 4 et 2 mois avant l'expiration : c'est le moment de l'engager. ${relais}`;
    for (const email of dest)
      alertesTitres.push({ email, salarie, raisonSociale, palier, type: f.TitreSejourType || "", numero: f.TitreSejourNumero || "", dateExpiration, joursRestants: jours, objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteTitreSejour: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  context.log(`Échéances : ${aAlerter.length} CDD (${alertes.length} dest.), ${titresAAlerter.length} titre(s) (${alertesTitres.length} dest.).`);
  return { status: 200, jsonBody: { alertes, alertesTitres } };
}

