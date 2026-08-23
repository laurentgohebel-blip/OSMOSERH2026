// api/src/echeancier.js — vue gestionnaire « toutes échéances ».
// GET /api/me?vue=admin&onglet=echeances (verrou ADMIN_EMAILS fait par
// me.js AVANT d'arriver ici) : agrège les échéances de TOUS les clients
// — fins de CDD, périodes d'essai, visites médicales, entretiens
// professionnels, titres de séjour, habilitations — triées par urgence.
// Fenêtre : échéances à 120 jours + retards récents (60 j). Les règles
// de calcul sont IMPORTÉES d'echeances.js (source unique).

const { tokenGraph, idsListes, items, dateParis, SELECT_SALARIES } = require("./annuaire");
const { echeanceVisite, echeanceEntretien, dernieresHabilitations } = require("./functions/echeances");
const { etatTitre } = require("./etrangers");

const FENETRE_JOURS = 120;
const RETARD_JOURS = 60;

async function donneesAdmin(request, context) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const aujourdhui = dateParis(new Date());
  const jusqua = (date) => Math.round((new Date(date) - new Date(aujourdhui)) / 86400000);
  const dansFenetre = (j) => j <= FENETRE_JOURS && j >= -RETARD_JOURS;

  const clients = await items(tok, ids["Paramètres clients"], "CodeClient,RaisonSociale,Actif");
  const raisonDe = (code) => clients.find((c) => c.CodeClient === code)?.RaisonSociale || code || "—";

  const lignes = [];
  const ajouter = (codeClient, salarie, type, detail, echeance) => {
    const joursRestants = jusqua(echeance);
    if (!dansFenetre(joursRestants)) return;
    lignes.push({ codeClient, raisonSociale: raisonDe(codeClient), salarie, type, detail, echeance, joursRestants });
  };

  // Fins de CDD (Production contrat — pipeline, tous clients)
  for (const x of await items(tok, ids["Production contrat"],
    "CodeClient,Nom,Pr_x00e9_nom,Type_x0020_contrat,Datedefin,Postedetravail")) {
    if (x.Type_x0020_contrat !== "CDD" || !x.Datedefin) continue;
    const fin = dateParis(x.Datedefin);
    if (fin < aujourdhui) continue; // les CDD passés relèvent des fins de contrat
    ajouter(x.CodeClient, `${(x.Nom || "").toUpperCase()} ${x.Pr_x00e9_nom || ""}`.trim(),
      "Fin de CDD", x.Postedetravail || "", fin);
  }

  // Fiches salariés : essais, visites, entretiens, titres
  const fiches = (await items(tok, ids["Salariés"], SELECT_SALARIES)).filter((s) => s.Statut !== "Sorti");
  const visitesRealisees = {};
  for (const v of await items(tok, ids["Visites médicales"],
    "CodeClient,Title,SalarieNom,SalariePrenom,DateVisite,Statut,Reference")) {
    if (v.Statut !== "Réalisée" || !v.DateVisite) continue;
    const k = `${v.CodeClient}|${String(v.SalarieNom || "").trim().toUpperCase()} ${String(v.SalariePrenom || "").trim().toUpperCase()}`.trim();
    const date = dateParis(v.DateVisite);
    if (!visitesRealisees[k] || visitesRealisees[k] < date) visitesRealisees[k] = date;
  }
  for (const s of fiches) {
    const nom = `${String(s.Nom || "").toUpperCase()} ${s.Prenom || ""}`.trim();
    const cle = `${s.CodeClient}|${nom.toUpperCase()}`.trim();
    if (s.FinPeriodeEssai) {
      const fin = dateParis(s.FinPeriodeEssai);
      if (fin >= aujourdhui) ajouter(s.CodeClient, nom, "Période d'essai", s.Poste || "", fin);
    }
    const visite = echeanceVisite(s, visitesRealisees, cle);
    if (visite) ajouter(s.CodeClient, nom, "Visite médicale", s.Poste || "", visite);
    const entretien = echeanceEntretien(s);
    if (entretien) ajouter(s.CodeClient, nom, "Entretien professionnel", s.Poste || "", entretien);
    if (s.TitreSejourExpiration) {
      const { finDroits } = etatTitre(s, aujourdhui);
      if (finDroits) ajouter(s.CodeClient, nom, "Titre de séjour",
        s.TitreSejourType || "", finDroits);
    }
  }

  // Habilitations : la plus récente par salarié + type
  if (ids["Habilitations"]) {
    for (const h of dernieresHabilitations(await items(tok, ids["Habilitations"],
      "CodeClient,Title,SalarieNom,SalariePrenom,TypeHabilitation,Numero,Organisme,DateObtention,DateExpiration,AlerteHabilitation,Reference"), "DateExpiration")) {
      ajouter(h.CodeClient,
        `${String(h.SalarieNom || "").toUpperCase()} ${h.SalariePrenom || ""}`.trim() || h.Title || "—",
        "Habilitation", h.TypeHabilitation || "", dateParis(h.DateExpiration));
    }
  }

  lignes.sort((a, b) => a.joursRestants - b.joursRestants);
  return { status: 200, jsonBody: {
    echeances: lignes,
    compteurs: {
      total: lignes.length,
      retard: lignes.filter((l) => l.joursRestants < 0).length,
      sous30: lignes.filter((l) => l.joursRestants >= 0 && l.joursRestants <= 30).length,
    },
  } };
}

module.exports = { donneesAdmin };
