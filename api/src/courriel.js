// api/src/courriel.js — la boîte mail comme point d'entrée du portail.
//
// Le patron de chantier ne se connecte pas à un portail : il reçoit
// l'arrêt de son salarié par SMS ou par mail, et il le TRANSFÈRE. Cette
// brique accepte ce geste-là. Le client écrit à l'adresse de dépôt du
// cabinet, le portail reconnaît l'expéditeur, classe la pièce jointe,
// en extrait ce qu'il peut, enregistre la démarche et lui répond ce
// qu'il a compris. Aucune connexion, aucun mot de passe, aucune
// formation.
//
// Architecture, identique aux alertes et aux rappels de paie :
// l'API CALCULE, le flux ENVOIE. Le flux Power Automate se déclenche à
// l'arrivée d'un message dans la boîte partagée, poste ici le contenu,
// et répond à l'expéditeur avec l'objet et le corps rendus. Une seule
// action à configurer côté flux, rien à maintenir.
//
// Le client n'est JAMAIS déduit du contenu du message : il vient de
// l'adresse de l'expéditeur, rapprochée des « Utilisateurs portail »
// actifs (resoudreClient). Un expéditeur inconnu n'écrit nulle part —
// il reçoit une réponse qui l'invite à contacter son gestionnaire.
//
// Configuration : COURRIEL_SECRET dans la Static Web App (en-tête
// x-courriel-secret). Non posée = brique absente, pas en panne.

const crypto = require("crypto");
const { tokenGraph, idsListes, items, resoudreClient, deposerFichier, viderCacheItems, SELECT_SALARIES } = require("./annuaire");

const MAX_PIECES = 6;                   // au-delà, ce n'est plus un transfert de pièce
const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

const configure = () => !!process.env.COURRIEL_SECRET;

/* « Jean Dupont <jean@valmont.fr> » → « jean@valmont.fr ». Les clients
   de messagerie transmettent l'un ou l'autre selon les cas. */
function adresse(brut) {
  const t = String(brut || "").trim();
  const m = t.match(/<([^>]+)>/);
  return (m ? m[1] : t).trim().toLowerCase();
}

/* Nature de la pièce, devinée du nom de fichier puis du texte du
   message. Sert à choisir le modèle de lecture : une pièce non
   reconnue est simplement DÉPOSÉE, jamais analysée au hasard. */
const INDICES_PIECE = [
  [/arr[eê]t|prolongation|cerfa|avis[_ -]?travail|maladie/i, "arret"],
  [/\brib\b|iban|bancaire|coordonn[ée]es[_ -]?bancaires/i, "rib"],
  [/vitale|carte[_ -]?vitale|attestation[_ -]?(?:de[_ -]?)?s[ée]curit/i, "vitale"],
  [/cni|carte[_ -]?identit|passeport|titre[_ -]?s[ée]jour|r[ée]c[ée]piss/i, "identite"],
];
function typePiece(nomFichier, contexte) {
  for (const [motif, type] of INDICES_PIECE) if (motif.test(nomFichier)) return type;
  // Le nom de fichier d'un scan ne dit rien (« IMG_4821.jpg », « scan.pdf ») :
  // on se rabat sur ce que le client a écrit dans son message.
  for (const [motif, type] of INDICES_PIECE) if (motif.test(contexte)) return type;
  return null;
}

/* Effectif du client, pour rapprocher le nom cité dans le message d'un
   salarié réel. Sans rapprochement certain, aucune démarche n'est
   créée : le message part au gestionnaire, qui tranche. */
async function effectifClient(codeClient) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids["Salariés"]) return [];
  const tous = await items(tok, ids["Salariés"], SELECT_SALARIES);
  return tous.filter((s) => s.CodeClient === codeClient && s.Statut !== "Sorti");
}

const sansAccent = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* Un salarié est « cité » si son NOM apparaît dans le texte. Le nom seul
   suffit s'il est unique dans l'effectif ; sinon il faut aussi le
   prénom. Deux salariés possibles = aucun choix automatique. */
function salarieCite(effectif, texte) {
  const t = sansAccent(texte);
  const candidats = effectif.filter((s) => {
    const nom = sansAccent(s.Nom);
    return nom.length >= 3 && new RegExp(`\\b${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t);
  });
  if (candidats.length === 1) return candidats[0];
  if (candidats.length > 1) {
    const avecPrenom = candidats.filter((s) => {
      const p = sansAccent(s.Prenom);
      return p.length >= 3 && t.includes(p);
    });
    if (avecPrenom.length === 1) return avecPrenom[0];
  }
  return null;
}

/* Référence déterministe : le même message rejoué par le flux (reprise
   après incident, double livraison) ne doit pas créer deux absences.
   L'identifiant du message fait foi quand le flux le fournit ; sinon on
   scelle l'expéditeur, l'objet et le corps. */
function reference(d) {
  const graine = String(d.messageId || `${adresse(d.de)}|${d.objet || ""}|${d.corps || ""}`);
  return `MAIL-${crypto.createHash("sha256").update(graine).digest("hex").slice(0, 10).toUpperCase()}`;
}

/* Ce message a-t-il déjà été traité ? On interroge les listes où cette
   brique écrit — une référence retrouvée signifie « rien à refaire ». */
async function dejaTraite(ref) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  for (const liste of ["Absences", "Messages gestionnaire"]) {
    if (!ids[liste]) continue;
    const lignes = await items(tok, ids[liste], "Reference");
    if (lignes.some((l) => l.Reference === ref)) return true;
  }
  return false;
}

/* ── Écritures ───────────────────────────────────────────────────────
   Volontairement dupliquées depuis demande.js plutôt qu'importées : ce
   module n'a pas de requête HTTP utilisateur, pas de jeton, pas de
   validation de formulaire. Mêler les deux chemins rendrait l'un ou
   l'autre fragile. */
async function ecrire(liste, fields) {
  const tok = await tokenGraph();
  const ids = await idsListes(tok);
  if (!ids[liste]) throw { status: 502, erreur: `Liste « ${liste} » introuvable.` };
  const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids[liste]}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const corps = (await r.text().catch(() => "")).slice(0, 300);
    throw { status: 502, erreur: `Écriture dans « ${liste} » impossible.`, detail: corps };
  }
  viderCacheItems();
}

/* Motif d'absence lu dans un message écrit à la main. La lecture des
   pièces (ocr.motifArret) ne connaît que les motifs d'ARRÊT : elle est
   consultée d'abord, car « arrêt maladie, il prendra ses congés après »
   parle d'abord d'un arrêt. Le reste de la nomenclature — celle du
   formulaire du portail, ni plus ni moins — se reconnaît ici. */
const MOTIFS_ECRITS = [
  [/cong[ée]s?\s+pay[ée]s|\bcp\b|vacances/i, "Congés payés"],
  [/sans\s+solde/i, "Congé sans solde"],
  [/enfant\s+malade/i, "Enfant malade"],
  [/cong[ée]\s+parental/i, "Congé parental d'éducation"],
  [/mariage|naissance|d[ée]c[èe]s|obs[èe]ques|[ée]v[ée]nement\s+familial/i, "Événement familial (mariage, naissance, décès…)"],
  [/injustifi|abandon\s+de\s+poste/i, "Absence injustifiée"],
];
function motifAbsence(texte) {
  const arret = require("./ocr").motifArret(texte);
  if (arret) return arret;
  for (const [motif, libelle] of MOTIFS_ECRITS) if (motif.test(texte)) return libelle;
  return "";
}

const MOTIFS_JUSTIFIES = new Set([
  "Maladie (arrêt de travail)", "Maladie professionnelle", "Accident du travail",
  "Accident de trajet", "Congé maternité", "Congé paternité / accueil de l'enfant",
  "Congé d'adoption", "Temps partiel thérapeutique",
]);

/* ── Traitement d'un message ─────────────────────────────────────────
   Ne lève jamais : quoi qu'il arrive, le client doit recevoir une
   réponse. Une pièce non déposée, une liste absente, un service en
   panne — tout cela se raconte dans la réponse, jamais par un silence. */
async function traiter(d, context) {
  const de = adresse(d.de);
  const objet = String(d.objet || "").slice(0, 300);
  const corps = String(d.corps || "").slice(0, 20000);
  const contexte = `${objet}\n${corps}`;

  if (!de || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(de))
    return { reconnu: false, reponse: null };   // pas d'adresse exploitable : le flux n'a personne à qui répondre

  let client;
  try {
    client = await resoudreClient(de);
  } catch {
    return {
      reconnu: false,
      reponse: {
        objet: `Re: ${objet || "votre message"}`,
        corps: "Bonjour,\n\nNous avons bien reçu votre message, mais cette adresse n'est pas reconnue comme un contact du portail. Votre demande n'a donc pas pu être enregistrée automatiquement.\n\nContactez votre gestionnaire Osmose RH pour faire ouvrir l'accès, ou répondez directement à son adresse habituelle.\n\nOsmose RH",
      },
    };
  }

  const ref = reference(d);
  if (await dejaTraite(ref).catch(() => false)) {
    return { reconnu: true, client: client.codeClient, doublon: true, reference: ref, reponse: null };
  }

  // 1. Les pièces jointes : déposer d'abord, analyser ensuite. Le dépôt
  //    prime toujours — un document rangé vaut mieux qu'un document lu.
  const pieces = Array.isArray(d.pieces) ? d.pieces.slice(0, MAX_PIECES) : [];
  const deposees = [], refusees = [];
  let champs = {};
  for (const p of pieces) {
    const nom = String(p.nom || "piece.pdf");
    let contenu;
    try { contenu = Buffer.from(String(p.contenu || ""), "base64"); }
    catch { refusees.push(`${nom} (illisible)`); continue; }
    if (!contenu.length) { refusees.push(`${nom} (vide)`); continue; }
    if (contenu.length > TAILLE_MAX_PIECE) { refusees.push(`${nom} (trop volumineux)`); continue; }
    try {
      const nomFinal = await deposerFichier(client.codeClient, nom, p.type, contenu);
      deposees.push(nomFinal || nom);
      const type = typePiece(nom, contexte);
      if (type) {
        const lu = await require("./ocr").analyser(type, contenu, p.type, context);
        if (lu.champs) champs = { ...lu.champs, ...champs };   // la première pièce lue prime
      }
    } catch (e) {
      refusees.push(`${nom}${e && e.erreur ? ` (${e.erreur})` : ""}`);
    }
  }

  // 2. Le message lui-même est un document : « Sophie est arrêtée du 24
  //    au 30 » se lit exactement comme un certificat rédigé librement.
  //    Il ne fait que COMPLÉTER ce que les pièces ont donné.
  const duTexte = require("./ocr").extraire("arret", { content: contexte });
  champs = { ...duTexte, ...champs };
  // Un mail parle d'autre chose que d'arrêts : congés, événement
  // familial, enfant malade. Le motif ne se complète que s'il manque.
  if (!champs.motif) {
    const m = motifAbsence(contexte);
    if (m) champs.motif = m;
  }

  // 3. Qui ? Le rapprochement doit être certain, sinon le gestionnaire tranche.
  const effectif = await effectifClient(client.codeClient).catch(() => []);
  const salarie = salarieCite(effectif, contexte);

  const socle = {
    Reference: ref,
    CodeClient: client.codeClient,
    RaisonSociale: client.raisonSociale || "",
    EmailDemandeur: de,
    EmailGestionnaire: client.emailGestionnaire || "",
  };

  // 4. Créer l'absence seulement si tout est réuni : le salarié, la date
  //    de début, un motif, et le justificatif quand le motif l'exige.
  const complet = salarie && champs.dateDebut && champs.motif
    && (!MOTIFS_JUSTIFIES.has(champs.motif) || deposees.length > 0);

  if (complet) {
    try {
      await ecrire("Absences", {
        ...socle,
        Title: `${salarie.Nom} ${salarie.Prenom || ""}`.trim().slice(0, 255),
        SalarieNom: String(salarie.Nom || "").toUpperCase(),
        SalariePrenom: salarie.Prenom || "",
        DateDebut: champs.dateDebut,
        ...(champs.dateFin ? { DateFin: champs.dateFin } : {}),
        Motif: champs.motif,
        JustificatifUrl: deposees[0] || "",
        Statut: "Nouvelle",
        // Aucune colonne d'origine à créer : une référence en « MAIL- »
        // dit à elle seule que la ligne vient d'un courriel, et
        // EmailDemandeur dit de qui.
      });
      return {
        reconnu: true, client: client.codeClient, reference: ref, cree: "absence",
        champs, salarie: `${salarie.Nom} ${salarie.Prenom || ""}`.trim(), deposees,
        reponse: {
          objet: `Absence enregistrée — ${salarie.Nom} ${salarie.Prenom || ""}`.trim(),
          corps: [
            "Bonjour,",
            "",
            "Votre message a été traité automatiquement. Voici ce qui a été enregistré :",
            "",
            `  Salarié : ${salarie.Nom} ${salarie.Prenom || ""}`.trimEnd(),
            `  Motif : ${champs.motif}`,
            `  Du ${frDate(champs.dateDebut)}${champs.dateFin ? ` au ${frDate(champs.dateFin)}` : " (fin non précisée)"}`,
            deposees.length ? `  Pièce classée : ${deposees.join(", ")}` : "",
            "",
            "Si l'un de ces éléments est inexact, répondez à ce message : votre gestionnaire corrigera.",
            "",
            `Référence ${ref}`,
            "Osmose RH",
          ].filter((l) => l !== "").join("\n"),
        },
      };
    } catch (e) {
      context?.error?.("courriel/absence :", e);
      // On retombe volontairement sur le message au gestionnaire ci-dessous :
      // le client ne doit pas payer une écriture ratée par un silence.
    }
  }

  // 5. Sinon : le gestionnaire reçoit le message avec ce qui a été compris.
  const manque = [];
  if (!salarie) manque.push(effectif.length ? "salarié non identifié" : "effectif inconnu");
  if (!champs.dateDebut) manque.push("date de début");
  if (!champs.motif) manque.push("motif");
  if (champs.motif && MOTIFS_JUSTIFIES.has(champs.motif) && !deposees.length) manque.push("justificatif");

  const resume = [
    `Message reçu de ${de}.`,
    salarie ? `Salarié identifié : ${salarie.Nom} ${salarie.Prenom || ""}`.trimEnd() : "Salarié non identifié.",
    champs.dateDebut ? `Début lu : ${champs.dateDebut}` : "",
    champs.dateFin ? `Fin lue : ${champs.dateFin}` : "",
    champs.motif ? `Motif lu : ${champs.motif}` : "",
    deposees.length ? `Pièces classées : ${deposees.join(", ")}` : "Aucune pièce jointe.",
    refusees.length ? `Pièces refusées : ${refusees.join(", ")}` : "",
    manque.length ? `À compléter : ${manque.join(", ")}.` : "",
    "",
    "--- message d'origine ---",
    corps.slice(0, 3000),
  ].filter(Boolean).join("\n");

  try {
    await ecrire("Messages gestionnaire", {
      ...socle,
      Title: (objet || "Message reçu par courriel").slice(0, 255),
      Message: resume.slice(0, 4000),
      Statut: "Nouveau",
    });
  } catch (e) {
    context?.error?.("courriel/message :", e);
    return {
      reconnu: true, client: client.codeClient, reference: ref, cree: null, deposees,
      reponse: {
        objet: `Re: ${objet || "votre message"}`,
        corps: `Bonjour,\n\n${deposees.length ? `Vos documents ont bien été classés dans votre espace (${deposees.join(", ")}).` : "Votre message nous est bien parvenu."}\n\nUn incident nous empêche de l'enregistrer automatiquement : votre gestionnaire en est informé et reprendra la main.\n\nOsmose RH`,
      },
    };
  }

  return {
    reconnu: true, client: client.codeClient, reference: ref, cree: "message",
    champs, deposees, refusees, manque,
    reponse: {
      objet: `Bien reçu — ${objet || "votre message"}`.slice(0, 200),
      corps: [
        "Bonjour,",
        "",
        deposees.length
          ? `Vos documents ont été classés dans votre espace : ${deposees.join(", ")}.`
          : "Votre message a bien été transmis à votre gestionnaire.",
        refusees.length ? `\nNon traité : ${refusees.join(", ")}.` : "",
        "",
        manque.length
          ? "Il manque quelques éléments pour enregistrer la démarche automatiquement — votre gestionnaire s'en charge et reviendra vers vous si besoin."
          : "Votre gestionnaire prend le relais.",
        "",
        `Référence ${ref}`,
        "Osmose RH",
      ].filter((l) => l !== "").join("\n"),
    },
  };
}

const frDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? iso.split("-").reverse().join("/") : String(iso || ""));

/* Point d'entrée appelé par POST /api/demande { action: "courriel" }.
   Secret d'en-tête obligatoire : cette porte est ouverte sans jeton
   utilisateur, elle ne s'ouvre donc que pour le flux du cabinet. */
async function recevoir(request, d, context) {
  if (!configure()) return { status: 503, jsonBody: { erreur: "Réception de courriels non configurée." } };
  if (request.headers.get("x-courriel-secret") !== process.env.COURRIEL_SECRET)
    return { status: 401, jsonBody: { erreur: "Non autorisé." } };
  try {
    const r = await traiter(d, context);
    context?.log?.(`courriel de ${adresse(d.de)} : ${r.reconnu ? r.cree || (r.doublon ? "doublon" : "aucune écriture") : "expéditeur inconnu"}`);
    return { status: 200, jsonBody: r };
  } catch (e) {
    context?.error?.("courriel :", e);
    // Même ici, le flux doit pouvoir répondre quelque chose d'humain.
    return {
      status: 200,
      jsonBody: {
        reconnu: false,
        reponse: {
          objet: "Re: votre message",
          corps: "Bonjour,\n\nVotre message nous est bien parvenu mais n'a pas pu être traité automatiquement. Votre gestionnaire Osmose RH le reprendra manuellement.\n\nOsmose RH",
        },
      },
    };
  }
}

module.exports = { recevoir, configure, adresse, typePiece, salarieCite, reference, traiter };
