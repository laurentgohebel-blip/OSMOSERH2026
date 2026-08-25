// api/src/notesdefrais.js — la brique Notes de frais : accès aux
// données, circuit de validation, alimentation de la paie.
//
// Le calcul vit dans frais.js, qui ne connaît ni Graph ni jeton : les
// barèmes, les limites d'exonération et les contrôles s'éprouvent au
// banc, sans réseau. Ce module-ci lit, écrit et autorise.
//
// LE PARCOURS, tel qu'il se vit. Le salarié photographie le ticket avec
// son téléphone, depuis un lien public — aucun compte, comme le
// pointage. L'OCR lit l'enseigne, la date, le montant et la TVA ; il ne
// reste qu'à choisir la catégorie. La note part en validation. Le
// gestionnaire — ou le patron — voit d'un coup d'œil ce qui est
// validable et ce qui ne l'est pas, valide en lot, et envoie le tout en
// variables de paie. L'enveloppe de fin de mois et le tableur
// disparaissent.
//
// L'EMPLOYEUR PEUT AUSSI SAISIR pour son équipe : tout le monde n'a pas
// de smartphone, et une note se rattrape parfois à la main. Le circuit
// est le même, la source est simplement notée.
//
// CE QUE VAUT LE LIEN PUBLIC, dit franchement. Comme le QR de pointage,
// il n'ouvre qu'une chose : déposer une note pour ce client. Quelqu'un
// pourrait en déposer une au nom d'un collègue. C'est sans portée : rien
// n'est payé sans validation explicite de l'employeur, note par note, et
// chaque dépôt est daté à la seconde. Le lien se révoque en changeant le
// secret.

const crypto = require("crypto");
const F = require("./frais");

const LISTE = "Notes de frais";
const MAX_NOTES_LOT = 200;
const MAX_EN_ATTENTE = 60;         // garde-fou du lien public, par salarié
const STATUTS = ["Nouvelle", "Validée", "Refusée", "En paie"];

const estDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const estMois = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));
const cleDe = (nom, prenom) =>
  `${String(nom || "").trim().toUpperCase()} ${String(prenom || "").trim().toUpperCase()}`.trim();

/* ── Jeton du lien public ────────────────────────────────────────────
   Dérivé du code client par HMAC, jamais stocké. Secret propre si la
   Static Web App en porte un (FRAIS_SECRET), à défaut celui du pointage
   — les deux briques s'adressent au même public, et n'exiger qu'une
   variable évite qu'une moitié de la maison reste fermée. Le préfixe
   « frais: » garantit qu'un jeton de pointage ne vaut pas ici, et
   réciproquement, même quand le secret est commun. */
const secret = () => process.env.FRAIS_SECRET || process.env.POINTAGE_SECRET;
const fraisConfigure = () => !!secret();
const jetonFrais = (codeClient) =>
  crypto.createHmac("sha256", String(secret())).update(`frais:${codeClient}`).digest("hex").slice(0, 32);

function clientDuJeton(jeton, clients) {
  if (!fraisConfigure() || !/^[0-9a-f]{32}$/.test(String(jeton || ""))) return null;
  for (const c of clients) {
    const attendu = jetonFrais(c.CodeClient);
    if (attendu.length === jeton.length
      && crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(String(jeton)))) return c;
  }
  return null;
}

/* ── Lecture ─────────────────────────────────────────────────────── */
const CHAMPS = "Reference,CodeClient,SalarieNom,SalariePrenom,EmailDemandeur,Categorie,"
  + "DateFrais,Montant,Quantite,TVA,Km,PuissanceFiscale,Commercant,Motif,Justificatif,"
  + "Statut,MotifRefus,Source,MoisPaie";

async function notesDu(codeClient) {
  const { tokenGraph, idsListes, items, dateParis } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: `Liste « ${LISTE} » introuvable — relancer creer_site_rh.py.` };
  return (await items(tok, ids[LISTE], CHAMPS))
    .filter((x) => x.CodeClient === codeClient)
    .map((x) => ({
      id: x.id, reference: x.Reference || "",
      cle: cleDe(x.SalarieNom, x.SalariePrenom),
      nom: String(x.SalarieNom || "").toUpperCase(), prenom: x.SalariePrenom || "",
      categorie: x.Categorie || "autre",
      date: dateParis(x.DateFrais) || "",
      montant: Number(x.Montant) || 0,
      quantite: Number(x.Quantite) || 1,
      tva: Number(x.TVA) || 0,
      km: Number(x.Km) || 0,
      cv: Number(x.PuissanceFiscale) || 0,
      commercant: x.Commercant || "",
      motif: x.Motif || "",
      justificatif: x.Justificatif || "",
      statut: STATUTS.includes(x.Statut) ? x.Statut : "Nouvelle",
      motifRefus: x.MotifRefus || "",
      source: x.Source || "Salarié",
      moisPaie: x.MoisPaie || "",
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function ecrire(fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: `Liste « ${LISTE} » introuvable — relancer creer_site_rh.py.` };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items`, {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: "Enregistrement de la note impossible — réessayez.", detail: corps };
  }
  viderCacheItems();
}

async function majNote(id, fields) {
  const { tokenGraph, idsListes, viderCacheItems } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[LISTE]}/items/${id}/fields`, {
    method: "PATCH", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw { status: 502, erreur: "Mise à jour de la note impossible — réessayez." };
  viderCacheItems();
}

/* Le contexte de l'examen : le lot complet, et le temps de travail du
   mois quand il existe — c'est lui qui permet de repérer un repas de
   déplacement un jour où personne n'a travaillé. */
async function contexteExamen(codeClient, notes) {
  let creneaux = null;
  try {
    const dates = notes.map((n) => n.date).filter(estDate).sort();
    if (dates.length) creneaux = await require("./planning").creneauxDu(codeClient, dates[0], dates[dates.length - 1]);
  } catch {
    // Le planning est une brique optionnelle : son absence retire un
    // contrôle de confort, elle n'empêche pas de traiter les frais.
    creneaux = null;
  }
  return { creneaux, aujourdhui: new Date().toISOString().slice(0, 10) };
}

/* ── Actions du client authentifié ───────────────────────────────── */

async function lister(clientInfo, d) {
  const notes = await notesDu(clientInfo.codeClient);
  const ctx = await contexteExamen(clientInfo.codeClient, notes);
  const examinees = F.examinerLot(notes, ctx);
  const filtre = String(d.statut || "");
  const visibles = STATUTS.includes(filtre) ? examinees.filter((n) => n.statut === filtre) : examinees;

  const enAttente = examinees.filter((n) => n.statut === "Nouvelle");
  const validees = examinees.filter((n) => n.statut === "Validée");
  const total = (liste, champ) => F.sou(liste.reduce((s, n) => s + n.qualification[champ], 0));

  return { status: 200, jsonBody: {
    notes: visibles,
    categories: F.CATEGORIES.map((c) => ({ cle: c.cle, libelle: c.libelle, regime: c.regime, unite: c.unite || null, aide: c.aide })),
    bareme: F.bareme(new Date().getFullYear()),
    resume: {
      enAttente: enAttente.length,
      bloquees: enAttente.filter((n) => !n.validable).length,
      aRembourser: total(validees, "exonere"),
      aReintegrer: total(validees, "reintegre"),
      enAttenteMontant: total(enAttente, "demande"),
    },
    lien: fraisConfigure()
      ? { actif: true, jeton: jetonFrais(clientInfo.codeClient) }
      : { actif: false },
  } };
}

/* Saisie par l'employeur, pour un salarié de son effectif. */
async function saisir(clientInfo, email, d) {
  const salaries = await require("./planning").effectif(clientInfo.codeClient);
  const s = salaries.find((x) => x.cle === String(d.cle || "").toUpperCase()
    || x.cle === cleDe(d.nom, d.prenom));
  if (!s) return { status: 400, jsonBody: { erreur: "Salarié inconnu dans votre effectif." } };
  return await enregistrer(clientInfo.codeClient, clientInfo, s, d, "Employeur", email);
}

/* Écriture commune aux deux entrées — publique et authentifiée. Les
   contrôles bloquants sont rendus AVEC la note, jamais opposés au
   dépôt : refuser une photo de ticket parce qu'il manque une catégorie,
   c'est renvoyer le salarié à son enveloppe. La note existe, elle est
   simplement marquée « à compléter » sous les yeux de l'employeur. */
async function enregistrer(codeClient, clientInfo, salarie, d, source, email) {
  const note = {
    cle: salarie.cle, nom: salarie.nom, prenom: salarie.prenom,
    categorie: F.categorieValide(d.categorie) ? d.categorie : "autre",
    date: estDate(d.date) ? d.date : "",
    montant: Math.max(0, Math.min(100000, Number(String(d.montant ?? "").replace(",", ".")) || 0)),
    quantite: Math.max(1, Math.min(31, Math.round(Number(d.quantite) || 1))),
    tva: Math.max(0, Number(String(d.tva ?? "").replace(",", ".")) || 0),
    km: Math.max(0, Math.min(5000, Number(d.km) || 0)),
    cv: Math.max(0, Math.min(20, Math.round(Number(d.cv) || 0))),
    commercant: String(d.commercant || "").trim().slice(0, 120),
    motif: String(d.motif || "").trim().slice(0, 500),
    justificatif: String(d.justificatif || "").trim().slice(0, 255),
  };
  if (!note.date && !estDate(d.date)) return { status: 400, jsonBody: { erreur: "Date du frais requise (AAAA-MM-JJ)." } };
  if (note.categorie === "km" && !note.km) return { status: 400, jsonBody: { erreur: "Nombre de kilomètres requis." } };
  if (note.categorie !== "km" && !note.montant) return { status: 400, jsonBody: { erreur: "Montant requis." } };

  const reference = `FRAIS-${Date.now().toString(36).toUpperCase()}`;
  const q = F.qualifier(note);
  await ecrire({
    Title: `${note.date} — ${note.nom} ${note.prenom} — ${q.libelle}`.slice(0, 255),
    Reference: reference,
    CodeClient: codeClient,
    RaisonSociale: clientInfo?.raisonSociale || clientInfo?.RaisonSociale || "",
    SalarieNom: note.nom.slice(0, 120), SalariePrenom: note.prenom.slice(0, 120),
    EmailDemandeur: email || "",
    EmailGestionnaire: clientInfo?.emailGestionnaire || clientInfo?.EmailGestionnaire || "",
    Categorie: note.categorie, DateFrais: note.date,
    Montant: note.categorie === "km" ? q.demande : note.montant,
    Quantite: note.quantite, TVA: note.tva, Km: note.km, PuissanceFiscale: note.cv,
    ...(note.commercant ? { Commercant: note.commercant } : {}),
    ...(note.motif ? { Motif: note.motif } : {}),
    ...(note.justificatif ? { Justificatif: note.justificatif } : {}),
    Statut: "Nouvelle", Source: source,
  });
  const examinee = F.examiner({ ...note, statut: "Nouvelle" }, {});
  return { status: 201, jsonBody: { reference, qualification: q, points: examinee.points, validable: examinee.validable } };
}

/* Validation ou refus, en lot. Le lot est le geste réel : on ne valide
   pas des notes de frais une par une, on passe la pile du mois. */
async function statuer(clientInfo, d) {
  const cible = d.statut === "Refusée" ? "Refusée" : d.statut === "Validée" ? "Validée" : null;
  if (!cible) return { status: 400, jsonBody: { erreur: "Décision attendue : Validée ou Refusée." } };
  const ids = (Array.isArray(d.ids) ? d.ids : [d.id]).filter(Boolean).map(String);
  if (!ids.length) return { status: 400, jsonBody: { erreur: "Aucune note sélectionnée." } };
  if (ids.length > MAX_NOTES_LOT) return { status: 400, jsonBody: { erreur: `Trop de notes d'un coup (${MAX_NOTES_LOT} au maximum).` } };

  const notes = await notesDu(clientInfo.codeClient);
  const ctx = await contexteExamen(clientInfo.codeClient, notes);
  const examinees = F.examinerLot(notes, ctx);

  const traitees = [], refusees = [];
  for (const id of ids) {
    const n = examinees.find((x) => String(x.id) === id);
    // Cloisonnement : `notesDu` a déjà filtré sur le CodeClient du jeton.
    if (!n) return { status: 404, jsonBody: { erreur: "Note introuvable." } };
    if (n.statut === "En paie") { refusees.push({ id, motif: "Déjà envoyée en paie." }); continue; }
    // On ne valide pas une note bloquée : justificatif manquant, date
    // absente, catégorie non qualifiée. Refuser, en revanche, est
    // toujours possible — c'est même la sortie normale d'une note
    // incomplète que personne ne complétera.
    if (cible === "Validée" && !n.validable) {
      refusees.push({ id, reference: n.reference, motif: n.points.find((p) => p.niveau === "bloquant")?.texte || "Note incomplète." });
      continue;
    }
    await majNote(id, {
      Statut: cible,
      ...(cible === "Refusée" ? { MotifRefus: String(d.motifRefus || "").slice(0, 500) } : { MotifRefus: null }),
    });
    traitees.push(id);
  }
  return { status: 200, jsonBody: { traitees: traitees.length, refusees } };
}

/* Le mois de notes validées devient des variables de paie. Aperçu
   d'abord — on ne transmet jamais un chiffre que le client n'a pas vu. */
async function versVariables(clientInfo, email, d) {
  const mois = estMois(d.mois) ? d.mois : new Date().toISOString().slice(0, 7);
  const notes = await notesDu(clientInfo.codeClient);
  const ctx = await contexteExamen(clientInfo.codeClient, notes);
  const examinees = F.examinerLot(notes, ctx).filter((n) => n.statut === "Validée");
  const salaries = await require("./planning").effectif(clientInfo.codeClient).catch(() => []);
  const lignes = F.versVariables(examinees, salaries, mois);
  if (!lignes.length) return { status: 400, jsonBody: { erreur: `Aucune note validée à transmettre pour ${mois}.` } };
  if (d.mode === "apercu") return { status: 200, jsonBody: { mois, lignes } };

  const { creerVariablesPaie } = require("./annuaire");
  await creerVariablesPaie(email, clientInfo, mois, lignes);
  // Marquées « En paie » APRÈS l'envoi : si la transmission échoue, les
  // notes restent validées et l'envoi se rejoue sans rien perdre.
  for (const n of examinees) {
    if (String(n.date || "").slice(0, 7) > mois) continue;
    await majNote(n.id, { Statut: "En paie", MoisPaie: mois });
  }
  return { status: 202, jsonBody: { mois, lignes: lignes.length } };
}

/* ── Entrée publique ─────────────────────────────────────────────────
   Le lien du QR code, ou celui que l'employeur envoie par SMS. Deux
   modes : « info » pour peupler l'écran, « note » pour déposer. */
async function depot(d, context) {
  if (!fraisConfigure()) return { status: 503, jsonBody: { erreur: "Notes de frais non configurées." } };
  const { tokenGraph, idsListes, items, SELECT_CLIENTS } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const clients = (await items(tok, ids["Paramètres clients"], SELECT_CLIENTS)).filter((c) => c.Actif !== false);
  const client = clientDuJeton(d.jeton, clients);
  if (!client) return { status: 404, jsonBody: { erreur: "Lien inconnu ou expiré." } };

  const salaries = await require("./planning").effectif(client.CodeClient);
  if (d.mode === "info") {
    return { status: 200, jsonBody: {
      raisonSociale: client.RaisonSociale || client.CodeClient,
      // Le strict nécessaire pour se reconnaître dans une liste.
      salaries: salaries.map((s) => ({ cle: s.cle, nom: s.nom, prenom: s.prenom })),
      categories: F.CATEGORIES.map((c) => ({ cle: c.cle, libelle: c.libelle, regime: c.regime, unite: c.unite || null, aide: c.aide })),
    } };
  }

  const s = salaries.find((x) => x.cle === String(d.cle || "").toUpperCase());
  if (!s) return { status: 400, jsonBody: { erreur: "Salarié inconnu." } };

  // Garde-fou : un lien public ne doit pas pouvoir remplir une liste.
  const siennes = (await notesDu(client.CodeClient)).filter((n) => n.cle === s.cle && n.statut === "Nouvelle");
  if (siennes.length >= MAX_EN_ATTENTE)
    return { status: 429, jsonBody: { erreur: "Trop de notes en attente de validation — prévenez votre responsable." } };

  context?.log?.(`note de frais ${client.CodeClient} ${s.cle} ${d.categorie || "?"}`);
  return await enregistrer(client.CodeClient, client, s, d, "Salarié", "");
}

/* Le code client d'un jeton de frais — utilisé par /api/depot pour
   ranger la photo du ticket dans le bon dossier. */
async function clientDeJeton(jeton) {
  if (!fraisConfigure()) throw { status: 503, erreur: "Notes de frais non configurées." };
  const { tokenGraph, idsListes, items, SELECT_CLIENTS } = require("./annuaire");
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const clients = (await items(tok, ids["Paramètres clients"], SELECT_CLIENTS)).filter((c) => c.Actif !== false);
  const client = clientDuJeton(jeton, clients);
  if (!client) throw { status: 404, erreur: "Lien inconnu ou expiré." };
  return { codeClient: client.CodeClient, raisonSociale: client.RaisonSociale || client.CodeClient };
}

/* ── Alertes ─────────────────────────────────────────────────────────
   Une note de frais oubliée, c'est un salarié qui a avancé son argent et
   qui attend. Personne ne réclame, et la note ressort trois mois plus
   tard, hors du mois de paie. UNE alerte par client — pas une par note :
   le geste attendu est d'ouvrir l'écran et de passer la pile, et douze
   courriels pour douze tickets, personne ne les lit.

   Ce délai-ci se compte en semaines : un flux hebdomadaire suffit
   parfaitement, contrairement aux procédures. */
const SEUIL_OUBLI_JOURS = 14;

async function alertesFrais(tok, ids, items, clients) {
  if (!ids[LISTE]) return [];
  const { dateParis } = require("./annuaire");
  const jour = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() - SEUIL_OUBLI_JOURS * 86400000).toISOString().slice(0, 10);
  const lignes = await items(tok, ids[LISTE], "CodeClient,SalarieNom,SalariePrenom,EmailDemandeur,EmailGestionnaire,DateFrais,Montant,Statut");
  // Le destinataire, c'est celui qui valide : le contact portail du
  // client. Une note déposée par un salarié depuis le lien public n'a pas
  // d'EmailDemandeur — sans cette table, l'alerte n'aurait personne à qui
  // s'adresser. Le gestionnaire Osmose reste le dernier recours.
  const utilisateurs = ids["Utilisateurs portail"]
    ? await items(tok, ids["Utilisateurs portail"], "Email,CodeClient,Actif")
    : [];

  const parClient = new Map();
  for (const l of lignes) {
    if (l.Statut !== "Nouvelle") continue;
    const client = clients.find((c) => c.CodeClient === l.CodeClient);
    if (!client || client.Actif === false) continue;
    // On date l'attente par le frais lui-même : c'est cette date que le
    // salarié a en tête, et `Created` n'est pas toujours retourné.
    const depuis = dateParis(l.DateFrais) || "";
    if (!depuis || depuis > limite) continue;
    const cur = parClient.get(l.CodeClient) || { client, nb: 0, montant: 0, plusAncienne: depuis, emails: new Set() };
    cur.nb += 1;
    cur.montant += Number(l.Montant) || 0;
    if (depuis < cur.plusAncienne) cur.plusAncienne = depuis;
    if (l.EmailDemandeur) cur.emails.add(l.EmailDemandeur);
    parClient.set(l.CodeClient, cur);
  }

  return [...parClient.values()].map((g) => {
    const raisonSociale = g.client.RaisonSociale || g.client.CodeClient;
    const attente = Math.round((Date.parse(jour) - Date.parse(g.plusAncienne)) / 86400000);
    return {
      email: [...g.emails][0]
        || (utilisateurs.find((u) => u.CodeClient === g.client.CodeClient && u.Actif !== false)?.Email || "")
        || g.client.EmailGestionnaire || "",
      salarie: "", raisonSociale, palier: `frais ${jour}`, type: "frais",
      objet: `${g.nb} note${g.nb > 1 ? "s" : ""} de frais en attente de votre validation`,
      corps: `${raisonSociale}\n\n${g.nb} note${g.nb > 1 ? "s" : ""} de frais attend${g.nb > 1 ? "ent" : ""} votre validation, pour un total de ${g.montant.toFixed(2).replace(".", ",")} €. La plus ancienne remonte au ${g.plusAncienne.split("-").reverse().join("/")}, soit ${attente} jours.\n\nVos salariés ont avancé cette somme. Ouvrez la brique « Notes de frais » de votre portail : la validation se fait en lot, et le récapitulatif part directement en variables de paie.`,
    };
  }).filter((a) => a.email);
}

module.exports = {
  lister, saisir, statuer, versVariables, depot, alertesFrais,
  jetonFrais, fraisConfigure, clientDuJeton, clientDeJeton, notesDu, LISTE, STATUTS,
};
