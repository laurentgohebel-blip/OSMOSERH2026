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
  const m = /^(J-90|J-60|J-30|J-15|J-7|RETARD|EXPIRE)/.exec(String(v || ""));
  return m ? m[1] : (String(v || "").trim() ? "J-90" : null);
};

// Périodes d'essai (23/08) : décision à prendre AVANT le terme
// (confirmation, renouvellement avec délai de prévenance, ou rupture) —
// relances J-15 puis J-7, plus rien après le terme (essai passé).
const PALIERS_ESSAI = ["J-15", "J-7"];
const palierEssai = (jours) => (jours < 0 ? null : jours <= 7 ? "J-7" : jours <= 15 ? "J-15" : null);

// Visites médicales périodiques (23/08) : échéance = dernière visite
// réalisée + périodicité (60 mois par défaut, 48 en suivi renforcé…) ;
// nouvel entrant sans visite : dans les 3 mois de l'embauche (VIP).
// Relances J-60 puis J-30, puis RETARD une fois l'échéance dépassée.
const PALIERS_VISITE = ["J-60", "J-30", "RETARD"];

// Habilitations & CACES (23/08) : le recyclage ajoute une LIGNE dans la
// liste « Habilitations » — seule la plus récente par salarié + type
// compte (une habilitation recyclée cesse d'alerter d'elle-même).
// Relances J-90 → J-60 → J-30 → EXPIRÉE (mêmes paliers que les titres :
// une session de recyclage se réserve des semaines à l'avance).
const PALIERS_HABILITATION = PALIERS_TITRE;
/* Réduit une liste d'habilitations à la plus récente par clé
   (CodeClient|SALARIÉ|type, expiration max) — partagée portail/alertes. */
function dernieresHabilitations(lignes, champExpiration) {
  const parCle = {};
  for (const h of lignes) {
    if (!h[champExpiration]) continue;
    const k = `${h.CodeClient}|${String(h.SalarieNom || "").trim().toUpperCase()} ${String(h.SalariePrenom || "").trim().toUpperCase()}|${String(h.TypeHabilitation || "").trim().toUpperCase()}`;
    if (!parCle[k] || String(parCle[k][champExpiration]) < String(h[champExpiration])) parCle[k] = h;
  }
  return Object.values(parCle);
}
const palierVisite = (jours) => (jours < 0 ? "RETARD" : jours <= 30 ? "J-30" : jours <= 60 ? "J-60" : null);
const PERIODICITE_DEFAUT_MOIS = 60;
const ajouterMois = (aaaammjj, mois) => {
  const [a, m, j] = String(aaaammjj).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + mois, j));
  return d.toISOString().slice(0, 10);
};
/* Échéance de visite d'une fiche : max(DerniereVisiteMedicale, dernière
   visite « Réalisée » de la liste par clé nom+prénom) + périodicité ;
   à défaut DateEntree + 3 mois ; null si rien d'exploitable. */
function echeanceVisite(f, visitesRealiseesParCle, cle) {
  const derniereListe = visitesRealiseesParCle[cle] || "";
  const derniereFiche = dateParis(f.DerniereVisiteMedicale) || "";
  const derniere = [derniereListe, derniereFiche].filter(Boolean).sort().pop() || "";
  if (derniere) return ajouterMois(derniere, Number(f.PeriodiciteVisiteMois) || PERIODICITE_DEFAUT_MOIS);
  const entree = dateParis(f.DateEntree);
  return entree ? ajouterMois(entree, 3) : null;
}

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

  // Périodes d'essai en cours (à venir, ≤ 60 j) et visites médicales
  // (échéance ≤ 120 j ou en retard) — mêmes fiches « Salariés ».
  const fiches = (await items(tok, ids["Salariés"], SELECT_SALARIES))
    .filter((s) => s.CodeClient === c.codeClient && s.Statut !== "Sorti");
  const nomDe = (s) => `${String(s.Nom || "").toUpperCase()} ${s.Prenom || ""}`.trim();
  const joursDepuis = (date) => Math.round((new Date(date) - new Date(aujourdhui)) / 86400000);

  const essais = fiches
    .filter((s) => s.FinPeriodeEssai)
    .map((s) => ({ salarie: nomDe(s), poste: s.Poste || "", dateFin: dateParis(s.FinPeriodeEssai),
      joursRestants: joursDepuis(dateParis(s.FinPeriodeEssai)), alerte: s.AlertePeriodeEssai || null }))
    .filter((e) => e.joursRestants >= 0 && e.joursRestants <= 60)
    .sort((a, b) => a.dateFin.localeCompare(b.dateFin));

  const visitesRealisees = {};
  // Même $select que personnel.js (cache items() par liste — cohérence).
  for (const v of (await items(tok, ids["Visites médicales"], "CodeClient,Title,SalarieNom,SalariePrenom,DateVisite,Statut,Reference"))
    .filter((v) => v.CodeClient === c.codeClient)) {
    if (v.Statut !== "Réalisée" || !v.DateVisite) continue;
    const k = `${String(v.SalarieNom || "").trim().toUpperCase()} ${String(v.SalariePrenom || "").trim().toUpperCase()}`.trim();
    const date = dateParis(v.DateVisite);
    if (!visitesRealisees[k] || visitesRealisees[k] < date) visitesRealisees[k] = date;
  }
  const visitesMedicales = fiches
    .map((s) => {
      const echeance = echeanceVisite(s, visitesRealisees, nomDe(s).toUpperCase());
      return echeance ? { salarie: nomDe(s), poste: s.Poste || "", echeance,
        joursRestants: joursDepuis(echeance), alerte: s.AlerteVisiteMedicale || null } : null;
    })
    .filter((v) => v && v.joursRestants <= 120)
    .sort((a, b) => a.echeance.localeCompare(b.echeance));

  // Habilitations & CACES : la plus récente par salarié + type — à
  // recycler (≤ 120 j) et expirées récentes. Même $select que
  // personnel.js (cache items() par liste — cohérence).
  const habilitations = !ids["Habilitations"] ? [] :
    dernieresHabilitations(
      (await items(tok, ids["Habilitations"], "CodeClient,Title,SalarieNom,SalariePrenom,TypeHabilitation,Numero,Organisme,DateObtention,DateExpiration,AlerteHabilitation,Reference"))
        .filter((h) => h.CodeClient === c.codeClient), "DateExpiration")
      .map((h) => ({
        salarie: `${String(h.SalarieNom || "").toUpperCase()} ${h.SalariePrenom || ""}`.trim() || h.Title || "",
        type: h.TypeHabilitation || "", numero: h.Numero || "",
        dateExpiration: dateParis(h.DateExpiration),
        joursRestants: joursDepuis(dateParis(h.DateExpiration)),
        alerte: h.AlerteHabilitation || null,
      }))
      .filter((h) => h.joursRestants <= 120 && h.joursRestants >= -TITRE_EXPIRE_RECENT)
      .sort((a, b) => a.dateExpiration.localeCompare(b.dateExpiration));

  return { status: 200, jsonBody: { echeances, recentes, titres, essais, visitesMedicales, habilitations } };
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
  const rs = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items?$select=id&$expand=fields($select=CodeClient,Nom,Prenom,Statut,DateEntree,TitreSejourType,TitreSejourNumero,TitreSejourExpiration,RecepisseFin,AlerteTitreSejour,FinPeriodeEssai,AlertePeriodeEssai,PeriodiciteVisiteMois,DerniereVisiteMedicale,AlerteVisiteMedicale)&$top=999`,
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

  // Périodes d'essai : palier J-15/J-7 avant le terme (rien après).
  const essaisAAlerter = salaries.map((x) => {
    const f = x.fields;
    if (!f.FinPeriodeEssai || f.Statut === "Sorti") return null;
    const jours = Math.round((new Date(f.FinPeriodeEssai) - maintenant) / 86400000);
    const palier = palierEssai(jours);
    if (!palier) return null;
    const fait = /^(J-15|J-7)/.exec(String(f.AlertePeriodeEssai || ""))?.[1] || null;
    if (fait && PALIERS_ESSAI.indexOf(palier) <= PALIERS_ESSAI.indexOf(fait)) return null;
    return { x, palier, jours };
  }).filter(Boolean);

  // Visites médicales : palier J-60/J-30/RETARD sur l'échéance calculée
  // (retard > 180 j jamais alerté : dossier gestionnaire, pas de réveil).
  const visitesRealiseesTous = {};
  const rv = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Visites médicales"]}/items?$select=id&$expand=fields($select=CodeClient,SalarieNom,SalariePrenom,DateVisite,Statut)&$top=999`,
    { headers: { Authorization: `Bearer ${tok}` } });
  for (const v of (rv.ok ? (await rv.json()).value : [])) {
    const f = v.fields;
    if (f.Statut !== "Réalisée" || !f.DateVisite) continue;
    const k = `${f.CodeClient}|${String(f.SalarieNom || "").trim().toUpperCase()} ${String(f.SalariePrenom || "").trim().toUpperCase()}`.trim();
    const date = dateParis(f.DateVisite);
    if (!visitesRealiseesTous[k] || visitesRealiseesTous[k] < date) visitesRealiseesTous[k] = date;
  }
  const visitesAAlerter = salaries.map((x) => {
    const f = x.fields;
    if (f.Statut === "Sorti") return null;
    const cle = `${f.CodeClient}|${String(f.Nom || "").trim().toUpperCase()} ${String(f.Prenom || "").trim().toUpperCase()}`.trim();
    const echeance = echeanceVisite(f, visitesRealiseesTous, cle);
    if (!echeance) return null;
    const jours = Math.round((new Date(echeance) - maintenant) / 86400000);
    const palier = palierVisite(jours);
    if (!palier) return null;
    const fait = /^(J-60|J-30|RETARD)/.exec(String(f.AlerteVisiteMedicale || ""))?.[1] || null;
    if (fait && PALIERS_VISITE.indexOf(palier) <= PALIERS_VISITE.indexOf(fait)) return null;
    if (palier === "RETARD" && !fait && jours < -180) return null;
    return { x, palier, jours, echeance };
  }).filter(Boolean);

  // Habilitations & CACES : paliers J-90/J-60/J-30/EXPIRÉE sur la plus
  // récente par salarié + type (le recyclage déclaré éteint l'ancienne
  // ligne). Expirée > 180 j jamais alertée : silence (stock historique).
  let habilitationsAAlerter = [];
  if (ids["Habilitations"]) {
    const rh = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Habilitations"]}/items?$select=id&$expand=fields($select=CodeClient,Title,SalarieNom,SalariePrenom,TypeHabilitation,Numero,DateExpiration,AlerteHabilitation)&$top=999`,
      { headers: { Authorization: `Bearer ${tok}` } });
    const lignes = rh.ok ? (await rh.json()).value : [];
    habilitationsAAlerter = dernieresHabilitations(
      lignes.map((x) => ({ ...x.fields, _id: x.id })), "DateExpiration"
    ).map((f) => {
      const jours = Math.round((new Date(f.DateExpiration) - maintenant) / 86400000);
      const palier = palierCourant(jours);
      if (!palier) return null;
      const fait = palierDejaFait(f.AlerteHabilitation);
      if (fait && PALIERS_HABILITATION.indexOf(palier) <= PALIERS_HABILITATION.indexOf(fait)) return null;
      if (palier === "EXPIRE" && !fait && jours < -180) return null;
      return { f, palier, jours };
    }).filter(Boolean);
  }

  if (aAlerter.length === 0 && titresAAlerter.length === 0 && essaisAAlerter.length === 0 && visitesAAlerter.length === 0 && habilitationsAAlerter.length === 0)
    return { status: 200, jsonBody: { alertes: [], notifications: [] } };

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
      alertesTitres.push({ email, salarie, raisonSociale, palier, type: "titre-sejour", objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteTitreSejour: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  // Périodes d'essai — décision avant le terme.
  const alertesEssai = [];
  for (const { x, palier, jours } of essaisAAlerter) {
    const f = x.fields;
    const salarie = `${(f.Nom || "").toUpperCase()} ${f.Prenom || ""}`.trim();
    const dateFin = new Date(f.FinPeriodeEssai).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    const { dest, client } = destinatairesDe(f.CodeClient);
    const raisonSociale = client?.RaisonSociale || f.CodeClient || "—";
    const objet = palier === "J-7"
      ? `URGENT — période d'essai de ${salarie} : ${jours} jour${jours > 1 ? "s" : ""} avant le terme`
      : `Période d'essai de ${salarie} — terme le ${dateFin}`;
    const corps = `La période d'essai de ${salarie} se termine le ${dateFin} (dans ${jours} jour${jours > 1 ? "s" : ""}).\n\nTrois issues possibles, à décider AVANT le terme :\n• confirmation (rien à faire, le contrat se poursuit) ;\n• renouvellement, s'il est prévu par votre convention collective ET le contrat — à notifier par écrit avant le terme, avec l'accord du salarié ;\n• rupture de la période d'essai — attention au délai de prévenance (jusqu'à 2 semaines selon la présence).\n\nBesoin d'aide sur la décision ou les courriers ? Contactez votre gestionnaire Osmose RH depuis votre espace.`;
    for (const email of dest)
      alertesEssai.push({ email, salarie, raisonSociale, palier, type: "periode-essai", objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlertePeriodeEssai: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  // Visites médicales périodiques.
  const alertesVisites = [];
  for (const { x, palier, jours, echeance } of visitesAAlerter) {
    const f = x.fields;
    const salarie = `${(f.Nom || "").toUpperCase()} ${f.Prenom || ""}`.trim();
    const dateEch = echeance.split("-").reverse().join("/");
    const { dest, client } = destinatairesDe(f.CodeClient);
    const raisonSociale = client?.RaisonSociale || f.CodeClient || "—";
    const objet = palier === "RETARD"
      ? `Visite médicale EN RETARD : ${salarie} (${raisonSociale})`
      : `Visite médicale de ${salarie} à programmer — échéance le ${dateEch}`;
    const corps = palier === "RETARD"
      ? `La visite médicale de ${salarie} est en retard (échéance dépassée le ${dateEch}).\n\nLe suivi médical des salariés est une obligation de l'employeur : demandez la visite sans attendre depuis votre espace Osmose RH (fiche du salarié → Visites) — votre gestionnaire prendra le relais avec le service de santé au travail.`
      : `La visite médicale périodique de ${salarie} arrive à échéance le ${dateEch} (dans ${jours} jours).\n\nDemandez la visite depuis votre espace Osmose RH (fiche du salarié → Visites) : votre gestionnaire organisera le rendez-vous avec le service de santé au travail.`;
    for (const email of dest)
      alertesVisites.push({ email, salarie, raisonSociale, palier, type: "visite-medicale", objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteVisiteMedicale: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  // Habilitations & CACES — un salarié sans habilitation valide ne peut
  // plus être affecté aux tâches concernées (conduite, électricité…).
  const alertesHabilitations = [];
  for (const { f, palier, jours } of habilitationsAAlerter) {
    const salarie = `${String(f.SalarieNom || "").toUpperCase()} ${f.SalariePrenom || ""}`.trim() || f.Title || "—";
    const dateExp = new Date(f.DateExpiration).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    const { dest, client } = destinatairesDe(f.CodeClient);
    const raisonSociale = client?.RaisonSociale || f.CodeClient || "—";
    const habilitation = `${f.TypeHabilitation || "habilitation"}${f.Numero ? ` n° ${f.Numero}` : ""}`;
    const relais = "Une fois le recyclage passé, déclarez la nouvelle habilitation dans votre espace Osmose RH (fiche du salarié → Habilitations) — les relances s'arrêteront.";
    const objet = palier === "EXPIRE"
      ? `Habilitation EXPIRÉE : ${salarie} — ${f.TypeHabilitation || "habilitation"}`
      : `Habilitation de ${salarie} à recycler — ${f.TypeHabilitation || "habilitation"} expire le ${dateExp}`;
    const corps = palier === "EXPIRE"
      ? `L'habilitation de ${salarie} (${habilitation}) a expiré le ${dateExp} et aucun recyclage n'a été déclaré.\n\nSans habilitation en cours de validité, le salarié ne doit plus être affecté aux tâches concernées (conduite d'engins, travaux électriques…) — la responsabilité de l'employeur est engagée en cas d'accident. ${relais}`
      : `L'habilitation de ${salarie} (${habilitation}) expire le ${dateExp}, dans ${jours} jours.\n\nPlanifiez la session de recyclage dès maintenant — les organismes demandent souvent plusieurs semaines de délai. ${relais}`;
    for (const email of dest)
      alertesHabilitations.push({ email, salarie, raisonSociale, palier, type: "habilitation", objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Habilitations"]}/items/${f._id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteHabilitation: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  // UN SEUL tableau pour le flux : « Pour chaque notifications » →
  // Envoyer un e-mail (À = email, Objet = objet, Corps = corps). Couvre
  // titres de séjour, périodes d'essai, visites médicales et habilitations.
  const notifications = [...alertesTitres, ...alertesEssai, ...alertesVisites, ...alertesHabilitations];
  context.log(`Échéances : ${aAlerter.length} CDD (${alertes.length} dest.), ${titresAAlerter.length} titre(s), ${essaisAAlerter.length} essai(s), ${visitesAAlerter.length} visite(s), ${habilitationsAAlerter.length} habilitation(s) — ${notifications.length} notification(s).`);
  return { status: 200, jsonBody: { alertes, notifications } };
}

