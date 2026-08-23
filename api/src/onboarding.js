// api/src/onboarding.js — onboarding salarié en self-service.
// Le CLIENT invite un salarié à compléter lui-même son dossier : le
// portail génère un lien à jeton (14 jours), le salarié ouvre un
// formulaire PUBLIC (sans compte) et remplit état civil, coordonnées,
// banque — la fiche « Salariés » est complétée à la soumission.
//
// Doctrine des routes (me.js) : AUCUNE nouvelle route. Tout passe par
// POST /api/demande :
//   action "onboardingInviter"  (client authentifié) → crée/rend le lien
//   action "onboarding" mode "info"      (public, jeton) → identité à afficher
//   action "onboarding" mode "soumettre" (public, jeton) → écrit la fiche
// Le dépôt des pièces du salarié passe par /api/depot?invitation=<jeton>
// (depot.js appelle clientDeInvitation ci-dessous).
//
// Sécurité : le jeton (48 hex, crypto) est l'unique clé — invitation
// expirée ou complétée = accès refusé ; la fiche visée est celle de
// l'invitation (IdFiche), jamais un id fourni par le navigateur ; les
// validations de champs sont les mêmes que majSalarie (miroir strict).

const crypto = require("crypto");
const { tokenGraph, idsListes, items, dateParis, viderCacheItems } = require("./annuaire");

const LISTE = "Invitations salariés";
const VALIDITE_JOURS = 14;
const PORTAIL_URL = () => (process.env.PORTAIL_URL || "https://espace.osmoserh.fr").replace(/\/$/, "");

async function listeInvitations(tok) {
  const ids = await idsListes(tok);
  if (!ids[LISTE]) throw { status: 502, erreur: "Liste « Invitations salariés » introuvable — relancer creer_site_rh.py." };
  return ids[LISTE];
}

/* Retrouve une invitation par jeton (lecture directe, jamais en cache :
   le statut doit être exact au moment de l'accès public). */
async function invitationParJeton(tok, jeton) {
  if (!/^[a-f0-9]{48}$/.test(String(jeton || ""))) return null;
  const listeId = await listeInvitations(tok);
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$select=id&$expand=fields($select=CodeClient,RaisonSociale,Nom,Prenom,IdFiche,EmailSalarie,Jeton,ExpireLe,Statut,Reference)&$top=500`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw { status: 502, erreur: "Invitations momentanément indisponibles." };
  const item = (await r.json()).value.find((x) => x.fields?.Jeton === jeton);
  return item ? { id: item.id, ...item.fields } : null;
}

const invitationValide = (inv) =>
  inv && inv.Statut !== "Complétée" && inv.ExpireLe && new Date(inv.ExpireLe) > new Date();

/* ── Pour depot.js : résout le CodeClient d'un jeton d'invitation ────── */
async function clientDeInvitation(jeton) {
  const tok = await tokenGraph();
  const inv = await invitationParJeton(tok, jeton);
  if (!invitationValide(inv)) throw { status: 401, erreur: "Lien d'invitation invalide ou expiré." };
  return { codeClient: inv.CodeClient, nom: inv.Nom, prenom: inv.Prenom };
}

/* ── Client authentifié : créer (ou retrouver) l'invitation d'une fiche ─
   POST /api/demande { action: "onboardingInviter", id, emailSalarie? }
   Verrous faits par l'appelant (demande.js) : jeton + client résolu +
   option embauche. Ici : propriété de la fiche vérifiée avant tout. */
async function inviter(email, clientInfo, d, context) {
  const id = String(d.id || "").trim();
  if (!/^\d+$/.test(id)) return { status: 400, jsonBody: { erreur: "Fiche salarié introuvable." } };
  const emailSalarie = String(d.emailSalarie || "").trim().toLowerCase().slice(0, 200);
  if (emailSalarie && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailSalarie))
    return { status: 400, jsonBody: { erreur: "E-mail du salarié invalide." } };

  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  const rf = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${id}?$expand=fields($select=CodeClient,Nom,Prenom)`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!rf.ok) return { status: 404, jsonBody: { erreur: "Fiche salarié introuvable." } };
  const fiche = (await rf.json()).fields || {};
  if (fiche.CodeClient !== clientInfo.codeClient)
    return { status: 404, jsonBody: { erreur: "Fiche salarié introuvable." } };

  // Invitation active déjà émise pour cette fiche → on rend le MÊME lien
  // (idempotent : re-cliquer ne fabrique pas une forêt de jetons).
  const listeId = await listeInvitations(tok);
  const rl = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items?$select=id&$expand=fields($select=IdFiche,Jeton,ExpireLe,Statut)&$top=500`,
    { headers: { Authorization: `Bearer ${tok}` } });
  const existante = rl.ok
    ? (await rl.json()).value.map((x) => x.fields).find((f) => f?.IdFiche === id && invitationValide(f))
    : null;
  if (existante)
    return { status: 200, jsonBody: { lien: `${PORTAIL_URL()}/?onboarding=${existante.Jeton}`, expireLe: existante.ExpireLe, reference: existante.Reference || "", deja: true } };

  const jeton = crypto.randomBytes(24).toString("hex");
  const expireLe = new Date(Date.now() + VALIDITE_JOURS * 86400000).toISOString();
  const reference = `INV-${Date.now().toString(36).toUpperCase()}`;
  const nom = String(fiche.Nom || "").toUpperCase();
  const rc = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      Title: `${nom} ${fiche.Prenom || ""}`.trim(),
      CodeClient: clientInfo.codeClient,
      RaisonSociale: clientInfo.raisonSociale || "",
      Nom: nom, Prenom: fiche.Prenom || "", IdFiche: id,
      EmailSalarie: emailSalarie, Jeton: jeton, ExpireLe: expireLe,
      Statut: "Envoyée", Reference: reference,
      EmailDemandeur: email || "",
      EmailGestionnaire: clientInfo.emailGestionnaire || "",
    } }),
  });
  if (!rc.ok) {
    context.error("onboarding/inviter :", rc.status, (await rc.text().catch(() => "")).slice(0, 300));
    return { status: 502, jsonBody: { erreur: "Création de l'invitation impossible — réessayez. (Liste absente ? Relancer creer_site_rh.py.)" } };
  }
  return { status: 201, jsonBody: { lien: `${PORTAIL_URL()}/?onboarding=${jeton}`, expireLe, reference, deja: false } };
}

/* ── Public : identité à afficher sur le formulaire ──────────────────── */
async function info(d, context) {
  const tok = await tokenGraph();
  const inv = await invitationParJeton(tok, d.jeton);
  if (!inv) return { status: 404, jsonBody: { erreur: "Lien d'invitation introuvable — demandez un nouveau lien à votre employeur." } };
  if (inv.Statut === "Complétée") return { status: 410, jsonBody: { erreur: "Ce dossier a déjà été transmis — merci ! Pour toute correction, contactez votre employeur." } };
  if (!invitationValide(inv)) return { status: 410, jsonBody: { erreur: "Ce lien a expiré — demandez un nouveau lien à votre employeur." } };
  return { status: 200, jsonBody: { nom: inv.Nom, prenom: inv.Prenom, raisonSociale: inv.RaisonSociale || "" } };
}

/* ── Public : soumission du dossier par le salarié ───────────────────── */
const SEXES = ["", "Masculin", "Féminin"];
const SITUATIONS = ["", "Célibataire", "Marié(e)", "Pacsé(e)", "Divorcé(e)", "Séparé(e)", "Veuf(ve)", "Union libre"];
async function soumettre(d, context) {
  const tok = await tokenGraph();
  const inv = await invitationParJeton(tok, d.jeton);
  if (!invitationValide(inv))
    return { status: 401, jsonBody: { erreur: "Lien d'invitation invalide, expiré ou déjà utilisé." } };

  const f = d.fiche || {};
  const txt = (v, max) => String(v ?? "").trim().slice(0, max);
  const dateOuVide = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
  const nir = String(f.numeroSS ?? "").replace(/\s/g, "").slice(0, 15);
  if (!/^[12]\d{12}(\d{2})?$/.test(nir))
    return { status: 400, jsonBody: { erreur: "Numéro de sécurité sociale invalide (13 ou 15 chiffres)." } };
  const iban = String(f.iban ?? "").replace(/\s/g, "").toUpperCase().slice(0, 34);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban))
    return { status: 400, jsonBody: { erreur: "IBAN invalide." } };
  const bic = txt(f.bic, 11).replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))
    return { status: 400, jsonBody: { erreur: "BIC invalide." } };
  const email = txt(f.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return { status: 400, jsonBody: { erreur: "Adresse e-mail invalide." } };
  if (!SEXES.includes(txt(f.sexe, 20)) || !txt(f.sexe, 20))
    return { status: 400, jsonBody: { erreur: "Sexe requis." } };
  if (!SITUATIONS.includes(txt(f.situationFamiliale, 30)) || !txt(f.situationFamiliale, 30))
    return { status: 400, jsonBody: { erreur: "Situation familiale requise." } };
  const REQUIS = {
    adressePostale: "adresse postale", dateNaissance: "date de naissance",
    nomNaissance: "nom de naissance", departementNaissance: "département de naissance",
    codeDepartementNaissance: "code département", paysNaissance: "pays de naissance",
    codePaysNaissance: "code pays", telephone: "téléphone",
  };
  const valeurs = { ...f, dateNaissance: dateOuVide(f.dateNaissance) };
  const manquants = Object.keys(REQUIS).filter((k) => !String(valeurs[k] ?? "").trim());
  if (manquants.length)
    return { status: 400, jsonBody: { erreur: `Champs manquants : ${manquants.map((k) => REQUIS[k]).join(", ")}.` } };

  // Écriture sur la fiche de L'INVITATION (jamais un id du navigateur),
  // propriété re-vérifiée : la fiche doit toujours porter le CodeClient.
  const ids = await idsListes(tok);
  const base = `https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Salariés"]}/items/${inv.IdFiche}`;
  const rf = await fetch(`${base}?$expand=fields($select=CodeClient)`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!rf.ok || (await rf.json()).fields?.CodeClient !== inv.CodeClient)
    return { status: 409, jsonBody: { erreur: "La fiche liée à cette invitation n'existe plus — contactez votre employeur." } };

  const champs = {
    AdressePostale: txt(f.adressePostale, 250),
    NumeroSS: nir,
    DateNaissance: dateOuVide(f.dateNaissance),
    Sexe: txt(f.sexe, 20),
    NomNaissance: txt(f.nomNaissance, 120),
    NomMarital: txt(f.nomMarital, 120),
    SituationFamiliale: txt(f.situationFamiliale, 30),
    DepartementNaissance: txt(f.departementNaissance, 80),
    CodeDepartementNaissance: txt(f.codeDepartementNaissance, 3).toUpperCase(),
    PaysNaissance: txt(f.paysNaissance, 80),
    CodePaysNaissance: txt(f.codePaysNaissance, 2).toUpperCase(),
    Email: email,
    Telephone: txt(f.telephone, 40),
    Iban: iban,
    Bic: bic,
    BulletinDematerialise: f.bulletinDematerialise === true,
    ...(txt(f.nationalite, 80) ? { Nationalite: txt(f.nationalite, 80) } : {}),
  };
  const rw = await fetch(`${base}/fields`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(champs),
  });
  if (!rw.ok) {
    context.error("onboarding/soumettre :", rw.status, (await rw.text().catch(() => "")).slice(0, 300));
    return { status: 502, jsonBody: { erreur: "Enregistrement impossible — réessayez dans un instant." } };
  }

  // Invitation consommée (le lien devient inerte) — best-effort APRÈS
  // l'écriture de la fiche : un échec ici ne perd aucune donnée.
  const listeId = await listeInvitations(tok);
  await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${listeId}/items/${inv.id}/fields`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ Statut: "Complétée" }),
  }).catch(() => {});
  viderCacheItems();
  return { status: 200, jsonBody: { ok: true, message: "Dossier transmis à votre employeur — merci !" } };
}

module.exports = { inviter, info, soumettre, clientDeInvitation };
