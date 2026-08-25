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
const { verifierJeton, resoudreClient, tokenGraph, idsListes, items, dateParis, SELECT_SALARIES, SELECT_CLIENTS } = require("../annuaire");

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

// Entretiens professionnels (23/08) : obligatoires tous les 2 ans
// (art. L.6315-1 — état des lieux à 6 ans, sanction abondement CPF).
// Échéance = dernier entretien + 24 mois, sinon date d'entrée + 24 mois.
// Mêmes paliers que les visites : J-60, J-30, puis RETARD.
const ENTRETIEN_MOIS = 24;
const echeanceEntretien = (f) => {
  const dernier = dateParis(f.DernierEntretienPro);
  if (dernier) return ajouterMois(dernier, ENTRETIEN_MOIS);
  const entree = dateParis(f.DateEntree);
  return entree ? ajouterMois(entree, ENTRETIEN_MOIS) : null;
};

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

/* ── Visites de REPRISE après arrêt (23/08, art. R.4624-31) ───────────
   Obligatoires dans les 8 jours du retour, selon le motif et la durée
   de l'arrêt DÉJÀ DÉCLARÉ dans le portail (liste « Absences ») :
     • congé maternité et maladie professionnelle : quelle que soit la durée ;
     • accident du travail : arrêt d'au moins 30 jours (accident de trajet
       traité pareil — prudence : mieux vaut une alerte de trop) ;
     • maladie ou accident non professionnel : au moins 60 jours.
   L'obligation s'éteint dès qu'une visite médicale datée du retour (ou
   après) existe — y compris une simple demande « À planifier » : le
   client a fait le geste attendu, les relances s'arrêtent. */
const SEUIL_REPRISE_JOURS = {
  "Congé maternité": 0,
  "Maladie professionnelle": 0,
  "Accident du travail": 30,
  "Accident de trajet": 30,
  "Maladie (arrêt de travail)": 60,
};
const DELAI_REPRISE_JOURS = 8;
const PALIERS_REPRISE = ["REPRISE", "RETARD"];
// Le flux d'alertes est HEBDOMADAIRE : on annonce le retour une semaine à
// l'avance (échéance ≤ 15 j = retour dans 7 j au plus), sinon un retour
// survenant juste après un envoi ne serait signalé qu'à 3 jours de la
// date limite — trop court pour obtenir un rendez-vous.
const ANTICIPATION_REPRISE = 7;
const palierReprise = (jours) =>
  (jours < 0 ? "RETARD" : jours <= DELAI_REPRISE_JOURS + ANTICIPATION_REPRISE ? "REPRISE" : null);
const ajouterJours = (aaaammjj, n) =>
  new Date(new Date(`${aaaammjj}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const cleAbsence = (a) =>
  `${a.CodeClient}|${String(a.SalarieNom || "").trim().toUpperCase()} ${String(a.SalariePrenom || "").trim().toUpperCase()}`.trim();
/* Reprises exigibles : { a, salarie, fin, duree, echeance } — la date
   limite est la fin de l'arrêt + 8 jours. */
function reprisesRequises(absences, visitesParCle) {
  const out = [];
  for (const a of absences) {
    const seuil = SEUIL_REPRISE_JOURS[a.Motif];
    if (seuil === undefined) continue;
    const debut = dateParis(a.DateDebut);
    const fin = dateParis(a.DateFin);
    if (!debut || !fin) continue; // arrêt sans terme connu : rien à calculer
    const duree = Math.round((new Date(fin) - new Date(debut)) / 86400000) + 1;
    if (duree < seuil) continue;
    const visite = visitesParCle[cleAbsence(a)];
    if (visite && visite >= fin) continue; // visite demandée/faite depuis le retour
    out.push({
      a, fin, duree,
      salarie: `${String(a.SalarieNom || "").toUpperCase()} ${a.SalariePrenom || ""}`.trim() || a.Title || "—",
      motif: a.Motif,
      echeance: ajouterJours(fin, DELAI_REPRISE_JOURS),
    });
  }
  return out;
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
  const visitesDemandees = {}; // tous statuts, clé « CODE|NOM PRÉNOM » — voir reprises
  // Même $select que personnel.js (cache items() par liste — cohérence).
  for (const v of (await items(tok, ids["Visites médicales"], "CodeClient,Title,SalarieNom,SalariePrenom,DateVisite,TypeVisite,Statut,Reference"))
    .filter((v) => v.CodeClient === c.codeClient)) {
    if (!v.DateVisite) continue;
    const nom = `${String(v.SalarieNom || "").trim().toUpperCase()} ${String(v.SalariePrenom || "").trim().toUpperCase()}`.trim();
    const date = dateParis(v.DateVisite);
    const kd = `${v.CodeClient}|${nom}`;
    if (!visitesDemandees[kd] || visitesDemandees[kd] < date) visitesDemandees[kd] = date;
    if (v.Statut !== "Réalisée") continue;
    if (!visitesRealisees[nom] || visitesRealisees[nom] < date) visitesRealisees[nom] = date;
  }
  const visitesMedicales = fiches
    .map((s) => {
      const echeance = echeanceVisite(s, visitesRealisees, nomDe(s).toUpperCase());
      return echeance ? { salarie: nomDe(s), poste: s.Poste || "", echeance,
        joursRestants: joursDepuis(echeance), alerte: s.AlerteVisiteMedicale || null } : null;
    })
    .filter((v) => v && v.joursRestants <= 120)
    .sort((a, b) => a.echeance.localeCompare(b.echeance));

  // Visites de reprise après arrêt : retour imminent (≤ 30 j) ou passé,
  // tant que la visite n'a pas été demandée (retards ≤ 90 j affichés).
  const reprises = reprisesRequises(
    (await items(tok, ids["Absences"], "CodeClient,Title,SalarieNom,SalariePrenom,DateDebut,DateFin,Motif,JustificatifUrl,Statut,Reference,AlerteReprise"))
      .filter((a) => a.CodeClient === c.codeClient), visitesDemandees)
    .map((r) => ({ salarie: r.salarie, motif: r.motif, dureeJours: r.duree,
      retourLe: r.fin, echeance: r.echeance, joursRestants: joursDepuis(r.echeance),
      alerte: r.a.AlerteReprise || null }))
    .filter((r) => r.joursRestants <= 30 && r.joursRestants >= -90)
    .sort((a, b) => a.echeance.localeCompare(b.echeance));

  // Entretiens professionnels : échéance ≤ 120 j ou en retard.
  const entretiens = fiches
    .map((s) => {
      const echeance = echeanceEntretien(s);
      return echeance ? { salarie: nomDe(s), poste: s.Poste || "", echeance,
        joursRestants: joursDepuis(echeance), alerte: s.AlerteEntretienPro || null } : null;
    })
    .filter((e) => e && e.joursRestants <= 120)
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

  return { status: 200, jsonBody: { echeances, recentes, titres, essais, visitesMedicales, reprises, entretiens, habilitations } };
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
  const rs = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items?$select=id&$expand=fields($select=CodeClient,Nom,Prenom,Statut,DateEntree,TitreSejourType,TitreSejourNumero,TitreSejourExpiration,RecepisseFin,AlerteTitreSejour,FinPeriodeEssai,AlertePeriodeEssai,PeriodiciteVisiteMois,DerniereVisiteMedicale,AlerteVisiteMedicale,DernierEntretienPro,AlerteEntretienPro)&$top=999`,
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
  const visitesDemandeesTous = {}; // tous statuts — éteint les reprises
  const rv = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Visites médicales"]}/items?$select=id&$expand=fields($select=CodeClient,SalarieNom,SalariePrenom,DateVisite,TypeVisite,Statut)&$top=999`,
    { headers: { Authorization: `Bearer ${tok}` } });
  for (const v of (rv.ok ? (await rv.json()).value : [])) {
    const f = v.fields;
    if (!f.DateVisite) continue;
    const k = `${f.CodeClient}|${String(f.SalarieNom || "").trim().toUpperCase()} ${String(f.SalariePrenom || "").trim().toUpperCase()}`.trim();
    const date = dateParis(f.DateVisite);
    if (!visitesDemandeesTous[k] || visitesDemandeesTous[k] < date) visitesDemandeesTous[k] = date;
    if (f.Statut !== "Réalisée") continue;
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

  // Visites de REPRISE : déclenchées par les absences déclarées, échéance
  // = retour + 8 jours. Palier REPRISE (retour imminent ou tout juste
  // passé) puis RETARD. Silence sur les arrêts anciens jamais alertés
  // (> 90 j de retard) : reprise du stock, pas de réveil intempestif.
  const ra = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Absences"]}/items?$select=id&$expand=fields($select=CodeClient,Title,SalarieNom,SalariePrenom,DateDebut,DateFin,Motif,AlerteReprise)&$top=999`,
    { headers: { Authorization: `Bearer ${tok}` } });
  const absences = (ra.ok ? (await ra.json()).value : []);
  const reprisesAAlerter = reprisesRequises(
    absences.map((x) => ({ ...x.fields, _id: x.id })), visitesDemandeesTous
  ).map((r) => {
    const jours = Math.round((new Date(r.echeance) - maintenant) / 86400000);
    const palier = palierReprise(jours);
    if (!palier) return null;
    const fait = /^(REPRISE|RETARD)/.exec(String(r.a.AlerteReprise || ""))?.[1] || null;
    if (fait && PALIERS_REPRISE.indexOf(palier) <= PALIERS_REPRISE.indexOf(fait)) return null;
    if (palier === "RETARD" && !fait && jours < -90) return null;
    return { r, palier, jours };
  }).filter(Boolean);

  // Entretiens professionnels : paliers J-60/J-30/RETARD sur l'échéance
  // des 2 ans (retard > 180 j jamais alerté : stock historique, silence).
  const entretiensAAlerter = salaries.map((x) => {
    const f = x.fields;
    if (f.Statut === "Sorti") return null;
    const echeance = echeanceEntretien(f);
    if (!echeance) return null;
    const jours = Math.round((new Date(echeance) - maintenant) / 86400000);
    const palier = palierVisite(jours);
    if (!palier) return null;
    const fait = /^(J-60|J-30|RETARD)/.exec(String(f.AlerteEntretienPro || ""))?.[1] || null;
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

  // Invitations d'onboarding dormantes (23/08 soir) : rappel à J+3
  // (11 j restants sur 14), dernier rappel à 2 j de l'expiration, puis
  // notification au client à l'expiration (lien mort, à régénérer).
  // Expirée > 30 j jamais alertée : silence (stock historique).
  const PALIERS_INVITATION = ["J3", "J-2", "EXPIREE"];
  const palierInvitation = (jours) => (jours < 0 ? "EXPIREE" : jours <= 2 ? "J-2" : jours <= 11 ? "J3" : null);
  let invitationsAAlerter = [];
  if (ids["Invitations salariés"]) {
    const ri = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Invitations salariés"]}/items?$select=id&$expand=fields($select=CodeClient,Nom,Prenom,EmailSalarie,EmailDemandeur,Jeton,ExpireLe,Statut,TypeContrat,AlerteInvitation)&$top=999`,
      { headers: { Authorization: `Bearer ${tok}` } });
    invitationsAAlerter = (ri.ok ? (await ri.json()).value : []).map((x) => {
      const f = x.fields;
      if (f.Statut !== "Envoyée" || !f.ExpireLe) return null;
      const jours = Math.round((new Date(f.ExpireLe) - maintenant) / 86400000);
      const palier = palierInvitation(jours);
      if (!palier) return null;
      const fait = /^(J3|J-2|EXPIREE)/.exec(String(f.AlerteInvitation || ""))?.[1] || null;
      if (fait && PALIERS_INVITATION.indexOf(palier) <= PALIERS_INVITATION.indexOf(fait)) return null;
      if (palier === "EXPIREE" && !fait && jours < -30) return null;
      return { x, palier, jours };
    }).filter(Boolean);
  }

  if (aAlerter.length === 0 && titresAAlerter.length === 0 && essaisAAlerter.length === 0 && visitesAAlerter.length === 0 && habilitationsAAlerter.length === 0 && entretiensAAlerter.length === 0 && invitationsAAlerter.length === 0 && reprisesAAlerter.length === 0)
    return { status: 200, jsonBody: { alertes: [], notifications: [] } };

  const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
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

  // Entretiens professionnels — rendez-vous de parcours (L.6315-1).
  const alertesEntretiens = [];
  for (const { x, palier, jours, echeance } of entretiensAAlerter) {
    const f = x.fields;
    const salarie = `${(f.Nom || "").toUpperCase()} ${f.Prenom || ""}`.trim();
    const dateEch = echeance.split("-").reverse().join("/");
    const { dest, client } = destinatairesDe(f.CodeClient);
    const raisonSociale = client?.RaisonSociale || f.CodeClient || "—";
    const objet = palier === "RETARD"
      ? `Entretien professionnel EN RETARD : ${salarie} (${raisonSociale})`
      : `Entretien professionnel de ${salarie} à planifier — échéance le ${dateEch}`;
    const corps = palier === "RETARD"
      ? `L'entretien professionnel de ${salarie} est en retard (échéance des 2 ans dépassée le ${dateEch}).\n\nCet entretien est obligatoire tous les 2 ans (art. L.6315-1 du code du travail) ; à 6 ans, l'état des lieux récapitulatif est exigé et son absence peut coûter un abondement de 3 000 € au CPF du salarié. Planifiez-le sans attendre, puis reportez sa date dans la fiche du salarié (onglet Dossier).\n\nBesoin d'une trame d'entretien ? Contactez votre gestionnaire Osmose RH.`
      : `L'entretien professionnel de ${salarie} arrive à échéance le ${dateEch} (dans ${jours} jours) — il est obligatoire tous les 2 ans (art. L.6315-1).\n\nPlanifiez-le (perspectives d'évolution, formation, VAE…), puis reportez sa date dans la fiche du salarié (onglet Dossier) : le prochain rappel se calera automatiquement 2 ans plus tard.\n\nBesoin d'une trame d'entretien ? Contactez votre gestionnaire Osmose RH.`;
    for (const email of dest)
      alertesEntretiens.push({ email, salarie, raisonSociale, palier, type: "entretien-pro", objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteEntretienPro: `${palier} ${new Date().toISOString()}` }),
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

  // Visites de reprise — obligation à date fixe (8 jours après le retour),
  // la plus courte fenêtre du portail : ton direct, geste unique.
  const alertesReprises = [];
  for (const { r, palier, jours } of reprisesAAlerter) {
    const f = r.a;
    const { dest, client } = destinatairesDe(f.CodeClient);
    const raisonSociale = client?.RaisonSociale || f.CodeClient || "—";
    const retour = r.fin.split("-").reverse().join("/");
    const limite = r.echeance.split("-").reverse().join("/");
    const cause = f.Motif === "Congé maternité"
      ? "un congé maternité"
      : `un arrêt de ${r.duree} jours (${String(f.Motif || "").toLowerCase()})`;
    const objet = palier === "RETARD"
      ? `Visite de reprise EN RETARD : ${r.salarie} (${raisonSociale})`
      : `Visite de reprise à organiser : ${r.salarie} — au plus tard le ${limite}`;
    const corps = palier === "RETARD"
      ? `La visite de reprise de ${r.salarie}, de retour le ${retour} après ${cause}, devait avoir lieu au plus tard le ${limite}.\n\nElle est obligatoire (art. R.4624-31 du code du travail) et incombe à l'employeur : tant qu'elle n'a pas eu lieu, l'aptitude du salarié à reprendre son poste n'est pas établie et votre responsabilité est engagée en cas d'accident.\n\nDemandez-la sans attendre depuis votre espace Osmose RH (fiche du salarié → Visites) : votre gestionnaire saisit le service de santé au travail.`
      : `${r.salarie} reprend le travail le ${retour} après ${cause} : une visite de reprise est obligatoire, à organiser dans les 8 jours — soit au plus tard le ${limite} (art. R.4624-31).\n\nDemandez-la depuis votre espace Osmose RH (fiche du salarié → Visites) : votre gestionnaire prend rendez-vous avec le service de santé au travail. Cette visite conditionne la reprise effective du poste.`;
    for (const email of dest)
      alertesReprises.push({ email, salarie: r.salarie, raisonSociale, palier, type: "visite-reprise", objet, corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Absences"]}/items/${f._id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteReprise: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  // Relances d'onboarding — le salarié d'abord (s'il a un e-mail), le
  // client en copie au dernier rappel et seul destinataire à l'expiration.
  const alertesInvitations = [];
  const lienDe = (jeton) => `${(process.env.PORTAIL_URL || "https://espace.osmoserh.fr").replace(/\/$/, "")}/?onboarding=${jeton}`;
  for (const { x, palier, jours } of invitationsAAlerter) {
    const f = x.fields;
    const salarie = `${(f.Nom || "").toUpperCase()} ${f.Prenom || ""}`.trim();
    const dateExp = new Date(f.ExpireLe).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    const raisonSociale = (destinatairesDe(f.CodeClient).client)?.RaisonSociale || f.CodeClient || "—";
    const contrat = f.TypeContrat ? ` — votre ${f.TypeContrat} attend ce dossier pour être préparé` : "";
    const dest = [];
    if (palier === "EXPIREE") {
      dest.push({ email: f.EmailDemandeur || process.env.ALERTE_DEFAUT,
        objet: `Invitation expirée sans réponse : ${salarie}`,
        corps: `Le lien d'invitation envoyé à ${salarie} a expiré le ${dateExp} sans que le dossier soit transmis.\n\nRegénérez un nouveau lien depuis votre espace Osmose RH (fiche du salarié → « Inviter le salarié à compléter son dossier »${f.TypeContrat ? ", ou relancez l'embauche par invitation" : ""}) et renvoyez-le au salarié.` });
    } else {
      const cible = f.EmailSalarie || f.EmailDemandeur || process.env.ALERTE_DEFAUT;
      const objet = palier === "J-2"
        ? `Dernier rappel — votre dossier salarié expire le ${dateExp}`
        : `N'oubliez pas votre dossier salarié (${raisonSociale})`;
      const corps = `Bonjour ${f.Prenom || ""},\n\n${raisonSociale} attend votre dossier salarié${contrat}. Comptez 5 minutes, munissez-vous de votre carte Vitale et d'un RIB :\n\n${lienDe(f.Jeton)}\n\nCe lien est valable jusqu'au ${dateExp}.`;
      dest.push({ email: cible, objet, corps });
      if (palier === "J-2" && f.EmailSalarie && f.EmailDemandeur)
        dest.push({ email: f.EmailDemandeur,
          objet: `Le dossier de ${salarie} n'est toujours pas transmis (expire le ${dateExp})`,
          corps: `Le lien d'invitation envoyé à ${salarie} expire le ${dateExp} et le dossier n'a pas été transmis.\n\nUn dernier rappel vient d'être adressé au salarié — vous pouvez aussi le relancer directement ou lui renvoyer le lien :\n${lienDe(f.Jeton)}` });
    }
    for (const d of dest)
      if (d.email) alertesInvitations.push({ email: d.email, salarie, raisonSociale, palier, type: "onboarding", objet: d.objet, corps: d.corps });

    await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Invitations salariés"]}/items/${x.id}/fields`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ AlerteInvitation: `${palier} ${new Date().toISOString()}` }),
    }).catch(() => {});
  }

  // Procédures en cours (24/08) : délais dépassés ou imminents.
  // ATTENTION AU RYTHME : ces délais se comptent en jours, parfois deux.
  // Un flux HEBDOMADAIRE les manquera — ces alertes appellent un flux
  // quotidien. Le portail, lui, les affiche en direct. Lecture
  // conditionnelle tant que la liste n'existe pas.
  const alertesProc = [];
  try {
    const proc = require("../procedures");
    const brutes = await proc.alertesProcedures(tok, ids, items, clients);
    for (const a of brutes) {
      if (a.email) alertesProc.push({ email: a.email, salarie: a.salarie, raisonSociale: a.raisonSociale,
        palier: a.niveau, type: "procedure", objet: a.objet, corps: a.corps });
      await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Procédures"]}/items/${a.id}/fields`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ AlerteProcedure: a.palier }),
      }).catch(() => {});
    }
  } catch (e) { context.log("Procédures : alertes indisponibles —", e?.erreur || e?.message || e); }

  // Notes de frais oubliées (25/08) : une seule alerte par client, pas
  // une par note. Ce délai-là se compte en semaines — le flux
  // hebdomadaire suffit. Lecture conditionnelle tant que la liste
  // n'existe pas chez le client.
  const alertesFrais = [];
  try {
    alertesFrais.push(...await require("../notesdefrais").alertesFrais(tok, ids, items, clients));
  } catch (e) { context.log("Notes de frais : alertes indisponibles —", e?.erreur || e?.message || e); }

  // UN SEUL tableau pour le flux : « Pour chaque notifications » →
  // Envoyer un e-mail (À = email, Objet = objet, Corps = corps). Couvre
  // titres de séjour, périodes d'essai, visites médicales, habilitations,
  // procédures et notes de frais.
  const notifications = [...alertesTitres, ...alertesEssai, ...alertesVisites, ...alertesReprises, ...alertesEntretiens, ...alertesHabilitations, ...alertesInvitations, ...alertesProc, ...alertesFrais];
  context.log(`Échéances : ${aAlerter.length} CDD (${alertes.length} dest.), ${titresAAlerter.length} titre(s), ${essaisAAlerter.length} essai(s), ${visitesAAlerter.length} visite(s), ${reprisesAAlerter.length} reprise(s), ${entretiensAAlerter.length} entretien(s), ${habilitationsAAlerter.length} habilitation(s), ${invitationsAAlerter.length} invitation(s) — ${notifications.length} notification(s).`);
  return { status: 200, jsonBody: { alertes, notifications } };
}

// Calculateurs partagés avec la vue gestionnaire « toutes échéances »
// (../echeancier.js) — source unique des règles d'échéance.
module.exports = { ajouterMois, echeanceVisite, echeanceEntretien, dernieresHabilitations, reprisesRequises };

