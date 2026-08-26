// api/src/paie.js — la boîte de réception de la paie, côté gestionnaire.
//
// La liste « Variables de paie » était écrite par quatre briques (grille
// client, planning, notes de frais, saisies) et relue par personne : pour
// traiter la paie du mois, il fallait ouvrir SharePoint. Ce module est la
// LECTURE qui manquait — le portail devient l'écran de travail du mois,
// SharePoint redevient le stockage.
//
// GET /api/me?vue=admin&onglet=paie[&mois=AAAA-MM] (verrou ADMIN_EMAILS
// fait par me.js) : les lignes du mois regroupées par client, la nature
// de chaque ligne déduite de ses colonnes, l'état du cycle de paie — et
// surtout les clients qui n'ont RIEN envoyé, car ce sont eux qu'on
// relance.
//
// POST /api/demande { action: "adminPaie", ids: [...] } : passage
// « Nouvelle » → « Intégrée » en lot — le pointage d'avancement du mois.
// Le module revérifie lui-même le jeton ET ADMIN_EMAILS : la route
// demande est publique, le verrou ne se délègue pas.

const LISTE = "Variables de paie";
const estMois = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));
const n0 = (v) => (Number(v) > 0 ? Number(v) : 0);

const CHAMPS = "CodeClient,EmailDemandeur,Mois,Matricule,Nom,Prenom,"
  + "HeuresNormales,HeuresComplementaires,HeuresSup25,HeuresSup50,HeuresNuit,HeuresDimancheFerie,"
  + "AbsenceType,AbsenceDu,AbsenceAu,PrimeLibelle,PrimeMontant,Acompte,"
  + "TitresResto,FraisPro,AvantagesNature,SaisieArret,Commentaire,Statut";

/* La nature d'une ligne se lit dans ses colonnes remplies — c'est elle
   qui dit au gestionnaire quelle rubrique du bulletin est concernée. Une
   ligne peut en cumuler plusieurs (heures + prime sur la même grille). */
function natures(l) {
  const t = [];
  if (n0(l.HeuresNormales) || n0(l.HeuresComplementaires) || n0(l.HeuresSup25)
    || n0(l.HeuresSup50) || n0(l.HeuresNuit) || n0(l.HeuresDimancheFerie)) t.push("heures");
  if (l.AbsenceType) t.push("absence");
  if (n0(l.PrimeMontant)) t.push("prime");
  if (n0(l.Acompte)) t.push("acompte");
  if (n0(l.TitresResto)) t.push("titres-resto");
  if (n0(l.FraisPro)) t.push("frais");
  if (n0(l.AvantagesNature)) t.push("avantage-nature");
  if (n0(l.SaisieArret)) t.push("saisie");
  return t.length ? t : ["autre"];
}

async function donneesAdmin(request, context) {
  const { tokenGraph, idsListes, items, SELECT_CLIENTS } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const mois = estMois(request.query?.get?.("mois"))
    ? request.query.get("mois")
    : new Date().toISOString().slice(0, 7);

  const clients = (await items(tok, ids["Paramètres clients"], SELECT_CLIENTS))
    .filter((c) => c.Actif !== false);
  const lignesDuMois = (await items(tok, ids[LISTE], CHAMPS))
    .filter((x) => x.Mois === mois);

  // L'état du cycle par client — la liste est optionnelle : son absence
  // retire la colonne « étape », elle ne casse pas l'écran.
  const cycles = {};
  if (ids["Cycle de paie"]) {
    for (const c of await items(tok, ids["Cycle de paie"], "CodeClient,Mois,Statut,VariablesRecuesLe"))
      if (c.Mois === mois) cycles[c.CodeClient] = { statut: c.Statut || "", recuesLe: c.VariablesRecuesLe || "" };
  }

  // Un bloc par client ACTIF — y compris ceux sans aucune ligne : ce
  // sont eux que le gestionnaire relance avant la clôture.
  const blocs = clients.map((c) => {
    const siennes = lignesDuMois
      .filter((l) => l.CodeClient === c.CodeClient)
      .map((l) => ({
        id: l.id,
        nom: String(l.Nom || "").toUpperCase(), prenom: l.Prenom || "",
        matricule: l.Matricule || "",
        natures: natures(l),
        heures: {
          normales: n0(l.HeuresNormales), complementaires: n0(l.HeuresComplementaires),
          sup25: n0(l.HeuresSup25), sup50: n0(l.HeuresSup50),
          nuit: n0(l.HeuresNuit), dimancheFerie: n0(l.HeuresDimancheFerie),
        },
        absence: l.AbsenceType ? { type: l.AbsenceType, du: l.AbsenceDu || "", au: l.AbsenceAu || "" } : null,
        prime: n0(l.PrimeMontant) ? { libelle: l.PrimeLibelle || "Prime", montant: n0(l.PrimeMontant) } : null,
        acompte: n0(l.Acompte), titresResto: n0(l.TitresResto), fraisPro: n0(l.FraisPro),
        avantagesNature: n0(l.AvantagesNature), saisieArret: n0(l.SaisieArret),
        commentaire: l.Commentaire || "",
        statut: l.Statut === "Intégrée" ? "Intégrée" : "Nouvelle",
        demandeur: l.EmailDemandeur || "",
      }))
      .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
    return {
      codeClient: c.CodeClient,
      raisonSociale: c.RaisonSociale || c.CodeClient,
      cycle: cycles[c.CodeClient] || null,
      lignes: siennes,
      nouvelles: siennes.filter((l) => l.statut === "Nouvelle").length,
      integrees: siennes.filter((l) => l.statut === "Intégrée").length,
    };
  });

  // Les clients qui ont envoyé d'abord (le travail), les silencieux
  // ensuite (la relance) — chacun trié par raison sociale.
  blocs.sort((a, b) => (b.lignes.length ? 1 : 0) - (a.lignes.length ? 1 : 0)
    || a.raisonSociale.localeCompare(b.raisonSociale));

  return { status: 200, jsonBody: {
    mois,
    blocs,
    compteurs: {
      clients: blocs.length,
      ontEnvoye: blocs.filter((b) => b.lignes.length > 0).length,
      sansEnvoi: blocs.filter((b) => b.lignes.length === 0).length,
      nouvelles: blocs.reduce((s, b) => s + b.nouvelles, 0),
      integrees: blocs.reduce((s, b) => s + b.integrees, 0),
    },
  } };
}

/* Passage « Nouvelle » → « Intégrée » (ou retour arrière — une erreur de
   clic se corrige) en LOT : on intègre un client d'un coup, pas ligne à
   ligne. Chaque id est vérifié contre la liste avant écriture. */
async function statut(request, context, d) {
  const { exigerAdmin } = require("./admin");
  await exigerAdmin(request);

  const cible = d.statut === "Nouvelle" ? "Nouvelle" : "Intégrée";
  const idsCibles = (Array.isArray(d.ids) ? d.ids : [d.id]).filter(Boolean).map(String);
  if (!idsCibles.length) return { status: 400, jsonBody: { erreur: "Aucune ligne sélectionnée." } };
  if (idsCibles.length > 300) return { status: 400, jsonBody: { erreur: "Trop de lignes d'un coup (300 au maximum)." } };

  const { tokenGraph, idsListes, items, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const existantes = new Set((await items(tok, ids[LISTE], "Mois")).map((x) => String(x.id)));

  let faites = 0;
  for (const id of idsCibles) {
    if (!existantes.has(id)) return { status: 404, jsonBody: { erreur: `Ligne ${id} introuvable — actualisez l'écran.` } };
    const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}/fields`, {
      method: "PATCH", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Statut: cible }),
    });
    if (!r.ok) return { status: 502, jsonBody: { erreur: `Mise à jour interrompue après ${faites} ligne(s) — réessayez.` } };
    faites++;
  }
  viderCacheItems();
  return { status: 200, jsonBody: { faites, statut: cible } };
}

module.exports = { donneesAdmin, statut, natures };
