// api/src/abonnements.js — suivi commercial des options souscrites.
// GET /api/me?vue=admin&onglet=abonnements (verrou ADMIN_EMAILS fait par
// me.js AVANT d'arriver ici) : pour chaque client, les options en cours,
// depuis quand, l'effectif réellement suivi, le forfait mensuel — plus
// la détection d'OPPORTUNITÉS : les clients dont les données montrent un
// besoin non souscrit (salariés étrangers sans l'option « etrangers »,
// habilitations déclarées sans l'option « securite »).
//
// Tarifs : AUCUN prix n'est inventé. Le catalogue vient de la variable
// d'environnement TARIFS_OPTIONS (JSON : {"etrangers":15,"securite":20}) ;
// un forfait négocié saisi sur la fiche client (TarifMensuel) prime sur
// le calcul. Sans catalogue ni forfait, l'écran reste utile — il montre
// qui a quoi, sans montants.

const { tokenGraph, idsListes, items, dateParis, SELECT_SALARIES, SELECT_CLIENTS } = require("./annuaire");

const LIBELLES = {
  embauche: "Embauche & personnel",
  acompte: "Acomptes",
  attestation: "Attestations",
  paie: "Variables de paie",
  etrangers: "Salariés étrangers",
  securite: "Sécurité (habilitations)",
};

/* Catalogue de tarifs mensuels par option — vide par défaut. */
function catalogue() {
  try {
    const brut = JSON.parse(process.env.TARIFS_OPTIONS || "{}");
    const propre = {};
    for (const [k, v] of Object.entries(brut))
      if (Number.isFinite(Number(v))) propre[k] = Number(v);
    return propre;
  } catch { return {}; }
}

async function donneesAdmin(request, context) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const tarifs = catalogue();
  const avecTarifs = Object.keys(tarifs).length > 0;

  const clients = await items(tok, ids["Paramètres clients"], SELECT_CLIENTS);
  const salaries = await items(tok, ids["Salariés"], SELECT_SALARIES);
  const habilitations = ids["Habilitations"]
    ? await items(tok, ids["Habilitations"], "CodeClient,Title,SalarieNom,SalariePrenom,TypeHabilitation,Numero,Organisme,DateObtention,DateExpiration,AlerteHabilitation,Reference")
    : [];

  // Signaux d'usage par client : effectif suivi, salariés étrangers
  // (titre de séjour renseigné), habilitations déclarées.
  const signaux = {};
  const signal = (code) => (signaux[code] = signaux[code] || { effectif: 0, etrangers: 0, habilitations: 0 });
  for (const s of salaries) {
    if (!s.CodeClient || s.Statut === "Sorti") continue;
    const g = signal(s.CodeClient);
    g.effectif += 1;
    if (s.TitreSejourExpiration) g.etrangers += 1;
  }
  for (const h of habilitations)
    if (h.CodeClient) signal(h.CodeClient).habilitations += 1;

  const lignes = clients
    .filter((c) => c.CodeClient)
    .map((c) => {
      const options = Array.isArray(c.Options) ? c.Options : [];
      const g = signaux[c.CodeClient] || { effectif: 0, etrangers: 0, habilitations: 0 };
      // Forfait négocié prioritaire ; sinon somme du catalogue.
      const negocie = Number.isFinite(Number(c.TarifMensuel)) && Number(c.TarifMensuel) > 0
        ? Number(c.TarifMensuel) : null;
      const catalogueTotal = options.reduce((t, o) => t + (tarifs[o] || 0), 0);
      // Opportunités : un besoin visible dans les données, pas souscrit.
      const opportunites = [];
      if (g.etrangers > 0 && !options.includes("etrangers"))
        opportunites.push({ option: "etrangers", libelle: LIBELLES.etrangers,
          motif: `${g.etrangers} salarié${g.etrangers > 1 ? "s" : ""} avec titre de séjour suivi` });
      if (g.habilitations > 0 && !options.includes("securite"))
        opportunites.push({ option: "securite", libelle: LIBELLES.securite,
          motif: `${g.habilitations} habilitation${g.habilitations > 1 ? "s" : ""} déclarée${g.habilitations > 1 ? "s" : ""}` });
      return {
        codeClient: c.CodeClient,
        raisonSociale: c.RaisonSociale || "",
        actif: c.Actif !== false,
        options,
        libelles: options.map((o) => LIBELLES[o] || o),
        effectif: g.effectif,
        depuis: dateParis(c.DateSouscription),
        forfait: negocie,
        forfaitCatalogue: avecTarifs ? catalogueTotal : null,
        montant: negocie ?? (avecTarifs ? catalogueTotal : null),
        opportunites,
      };
    })
    .sort((a, b) => (b.montant || 0) - (a.montant || 0) || a.raisonSociale.localeCompare(b.raisonSociale));

  const actifs = lignes.filter((l) => l.actif);
  // Répartition par option (sur les clients actifs)
  const parOption = {};
  for (const o of Object.keys(LIBELLES))
    parOption[o] = { libelle: LIBELLES[o], clients: actifs.filter((l) => l.options.includes(o)).length,
      tarif: avecTarifs ? (tarifs[o] ?? null) : null };

  return { status: 200, jsonBody: {
    lignes,
    parOption,
    tarifsConfigures: avecTarifs,
    compteurs: {
      clientsActifs: actifs.length,
      effectifTotal: actifs.reduce((t, l) => t + l.effectif, 0),
      recurrentMensuel: avecTarifs || actifs.some((l) => l.forfait)
        ? Math.round(actifs.reduce((t, l) => t + (l.montant || 0), 0) * 100) / 100 : null,
      opportunites: actifs.reduce((t, l) => t + l.opportunites.length, 0),
    },
  } };
}

module.exports = { donneesAdmin, LIBELLES };
