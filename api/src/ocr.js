// api/src/ocr.js — lecture automatique des pièces déposées.
// Le client (ou le salarié en onboarding) photographie un document ;
// le portail en extrait les champs et PRÉ-REMPLIT le formulaire — la
// saisie reste modifiable, rien n'est écrit sans validation humaine.
//
// Moteur : Azure AI Document Intelligence (prebuilt-read pour le texte,
// prebuilt-idDocument pour les pièces d'identité). Configuration par
// variables d'environnement, exactement comme la DPAE :
//   OCR_ENDPOINT  https://<ressource>.cognitiveservices.azure.com
//   OCR_CLE       clé de la ressource
//   OCR_MODELE    (facultatif) modèle de lecture, défaut « prebuilt-read »
// NON CONFIGURÉ = fonctionnalité absente, pas en panne : `configuree()`
// est faux, /api/depot n'analyse rien et le dépôt se comporte comme
// avant. Aucun appel réseau, aucun coût.
//
// Rien n'est stocké par ce module : il lit le contenu déjà téléversé et
// rend des champs. Le fichier reste dans la GED du client, l'extraction
// vit le temps de la réponse HTTP.

const API_VERSION = "2024-11-30";
const TAILLE_MAX = 4 * 1024 * 1024;   // au-delà, on n'analyse pas (coût, latence)
const ATTENTE_MAX_MS = 25000;         // le dépôt ne doit jamais rester bloqué

const configuree = () => !!(process.env.OCR_ENDPOINT && process.env.OCR_CLE);

/* Types de pièces reconnus et modèle associé. */
const MODELES = {
  identite: "prebuilt-idDocument",
  rib: "prebuilt-read",
  vitale: "prebuilt-read",
  arret: "prebuilt-read",
};
const typeValide = (t) => Object.prototype.hasOwnProperty.call(MODELES, String(t || ""));

/* ── Appel Document Intelligence : POST puis attente du résultat ────── */
async function analyserDocument(contenu, contentType, modele) {
  const base = String(process.env.OCR_ENDPOINT).replace(/\/$/, "");
  const url = `${base}/documentintelligence/documentModels/${modele}:analyze?api-version=${API_VERSION}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.OCR_CLE,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: contenu,
  });
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(`analyse refusée (HTTP ${r.status}) ${detail}`);
  }
  const suivi = r.headers.get("operation-location");
  if (!suivi) throw new Error("réponse d'analyse sans URL de suivi");

  const debut = Date.now();
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    await new Promise((r2) => setTimeout(r2, 900));
    const rs = await fetch(suivi, { headers: { "Ocp-Apim-Subscription-Key": process.env.OCR_CLE } });
    if (!rs.ok) throw new Error(`suivi d'analyse en échec (HTTP ${rs.status})`);
    const j = await rs.json();
    if (j.status === "succeeded") return j.analyzeResult || {};
    if (j.status === "failed") throw new Error("analyse en échec côté service");
  }
  throw new Error("analyse trop longue");
}

/* ── Extracteurs par type de pièce ───────────────────────────────────
   Volontairement prudents : un champ douteux n'est PAS proposé. Mieux
   vaut un formulaire à compléter qu'un formulaire mal pré-rempli. */

const MOIS = { janvier: "01", février: "02", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06", juillet: "07", août: "08", aout: "08", septembre: "09", octobre: "10", novembre: "11", décembre: "12", decembre: "12" };

/* Toutes les dates d'un texte, en AAAA-MM-JJ, dans l'ordre d'apparition. */
function datesDuTexte(texte) {
  const out = [];
  const pousser = (a, m, j) => {
    const an = Number(a) < 100 ? 2000 + Number(a) : Number(a);
    const mm = String(m).padStart(2, "0"), jj = String(j).padStart(2, "0");
    if (an < 1900 || an > 2100 || Number(mm) < 1 || Number(mm) > 12 || Number(jj) < 1 || Number(jj) > 31) return;
    out.push(`${an}-${mm}-${jj}`);
  };
  // 12/03/2026, 12-03-2026, 12.03.26
  for (const m of texte.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g)) pousser(m[3], m[2], m[1]);
  // 12 mars 2026
  for (const m of texte.matchAll(/\b(\d{1,2})\s+([a-zéûôA-ZÉÛÔ]+)\s+(\d{4})\b/g)) {
    const mm = MOIS[m[2].toLowerCase()];
    if (mm) pousser(m[3], mm, m[1]);
  }
  // 2026-03-12
  for (const m of texte.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) pousser(m[1], m[2], m[3]);
  return out;
}

/* NIR : 15 chiffres souvent imprimés par groupes (2 94 05 12 345 678 46).
   On ne recolle QUE les chiffres séparés par un espace — recoller tout le
   texte ferait disparaître les frontières de mots et attraperait
   n'importe quelle suite de chiffres. */
const nir = (texte) => {
  const compact = texte.replace(/(\d)[\s.]+(?=\d)/g, "$1");
  const m = compact.match(/\b([12]\d{2}(?:0[1-9]|1[0-2]|[2-9]\d)\d{8,10})\b/);
  return m ? m[1].slice(0, 15) : "";
};

/* IBAN : lu AVEC ses espaces (FR76 3000 6000 …), compacté ensuite. */
const iban = (texte) => {
  const t = texte.toUpperCase();
  const m = t.match(/FR\s?\d{2}(?:\s?[A-Z0-9]){23}/)
    || t.match(/\b[A-Z]{2}\s?\d{2}(?:\s?[A-Z0-9]){11,28}\b/);
  return m ? m[0].replace(/\s/g, "") : "";
};

/* BIC : exigé À CÔTÉ du mot BIC ou SWIFT. Sans ce garde-fou, n'importe
   quel mot de huit lettres passe pour un BIC (« IDENTITE » d'un relevé
   d'identité bancaire, par exemple) — mieux vaut ne rien proposer. */
const bic = (texte) => {
  const m = texte.toUpperCase().match(/\b(?:BIC|SWIFT)\b[^A-Z0-9]{0,12}([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/);
  return m ? m[1] : "";
};

/* Motif d'arrêt déduit du vocabulaire — miroir des motifs du portail. */
function motifArret(texte) {
  const t = texte.toLowerCase();
  if (/maladie professionnelle/.test(t)) return "Maladie professionnelle";
  if (/accident de trajet/.test(t)) return "Accident de trajet";
  if (/accident du travail|accident de travail/.test(t)) return "Accident du travail";
  if (/maternit/.test(t)) return "Congé maternité";
  if (/paternit|accueil de l'enfant/.test(t)) return "Congé paternité / accueil de l'enfant";
  if (/temps partiel thérapeutique|mi-temps thérapeutique/.test(t)) return "Temps partiel thérapeutique";
  if (/arrêt de travail|arret de travail|avis d'arrêt|prolongation/.test(t)) return "Maladie (arrêt de travail)";
  return "";
}

function extraire(type, resultat) {
  const texte = String(resultat.content || "");
  if (type === "rib") {
    const champs = {};
    const i = iban(texte); if (i) champs.iban = i;
    const b = bic(texte); if (b) champs.bic = b;
    return champs;
  }
  if (type === "vitale") {
    const n = nir(texte);
    return n ? { numeroSS: n } : {};
  }
  if (type === "arret") {
    const champs = {};
    const dates = datesDuTexte(texte);
    // Un avis d'arrêt porte au moins la date de début et la date de fin :
    // on retient les deux plus éloignées dans l'ordre chronologique, en
    // écartant celles antérieures à un an (dates de naissance, etc.).
    const borne = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const utiles = [...new Set(dates.filter((d) => d >= borne))].sort();
    if (utiles.length >= 1) champs.dateDebut = utiles[0];
    if (utiles.length >= 2) champs.dateFin = utiles[utiles.length - 1];
    const n = nir(texte); if (n) champs.numeroSS = n;
    const m = motifArret(texte); if (m) champs.motif = m;
    return champs;
  }
  if (type === "identite") {
    // prebuilt-idDocument rend des champs structurés — bien plus fiable
    // qu'une expression régulière sur le texte brut.
    const doc = (resultat.documents || [])[0] || {};
    const f = doc.fields || {};
    const val = (nom) => {
      const c = f[nom];
      if (!c) return "";
      return String(c.valueString || c.content || "").trim();
    };
    const champs = {};
    const nom = val("LastName"); if (nom) champs.nomNaissance = nom.toUpperCase();
    const prenom = val("FirstName"); if (prenom) champs.prenom = prenom;
    const naissance = f.DateOfBirth?.valueDate || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(naissance)) champs.dateNaissance = naissance;
    const sexe = val("Sex").toUpperCase();
    if (sexe === "M") champs.sexe = "Masculin";
    if (sexe === "F") champs.sexe = "Féminin";
    const lieu = val("PlaceOfBirth"); if (lieu) champs.communeNaissance = lieu;
    return champs;
  }
  return {};
}

/* ── Point d'entrée : analyse un contenu déjà téléversé ───────────────
   Ne LÈVE JAMAIS : le dépôt du fichier a déjà réussi, une extraction en
   échec ne doit pas transformer un succès en erreur pour l'utilisateur.
   Rend { champs } en cas de succès, { erreur } sinon. */
async function analyser(type, contenu, contentType, context) {
  if (!configuree()) return { erreur: "non configuré" };
  if (!typeValide(type)) return { erreur: "type de pièce inconnu" };
  if (!contenu || contenu.byteLength === 0) return { erreur: "fichier vide" };
  if (contenu.byteLength > TAILLE_MAX) return { erreur: "fichier trop volumineux pour l'analyse" };
  try {
    const resultat = await analyserDocument(contenu, contentType, process.env.OCR_MODELE && type !== "identite"
      ? process.env.OCR_MODELE : MODELES[type]);
    const champs = extraire(type, resultat);
    return Object.keys(champs).length ? { champs } : { erreur: "aucun champ reconnu" };
  } catch (e) {
    context?.error?.("ocr :", e);
    return { erreur: "analyse indisponible" };
  }
}

module.exports = { configuree, analyser, typeValide, datesDuTexte, extraire, TAILLE_MAX };
