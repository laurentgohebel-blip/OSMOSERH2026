// api/src/functions/lead.js — leads du site vitrine (formulaires publics).
// POST /api/lead : SANS jeton (les visiteurs du site n'ont pas de compte) —
// pot de miel + validation, puis écriture dans la liste « Leads site » du
// site RH. La notification (gestionnaire + accusé au prospect) est assurée
// par un flux Power Automate déclenché à la création de l'élément :
// connecteurs standard uniquement, aucune URL secrète dans la page publique.
// CORS : le site vitrine (osmoserh.fr) appelle l'API cross-origin — on
// répond au préflight OPTIONS et on renvoie l'origine si elle est connue.

const { app } = require("@azure/functions");
const { tokenGraph, idsListes } = require("./annuaire");

const ORIGINES_AUTORISEES = new Set([
  "https://osmoserh.fr",
  "https://www.osmoserh.fr",
  "https://synapserh.fr",
  "https://www.synapserh.fr",
]);

function enTetesCors(request) {
  const origine = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINES_AUTORISEES.has(origine) ? origine : "https://osmoserh.fr",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

app.http("lead", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const headers = enTetesCors(request);
    if (request.method === "OPTIONS") return { status: 204, headers };

    let d;
    try { d = await request.json(); }
    catch { return { status: 400, headers, jsonBody: { erreur: "JSON attendu" } }; }

    // Pot de miel : un humain ne remplit jamais ce champ caché — on répond
    // OK sans rien écrire pour ne pas renseigner le robot.
    if (d.website || d.xq_note) return { status: 202, headers, jsonBody: { ok: true } };

    const prenom = String(d.prenom || "").trim().slice(0, 80);
    const nom = String(d.nom || "").trim().slice(0, 80);
    const email = String(d.email || "").trim().slice(0, 200);
    if (prenom.length < 2 || nom.length < 2)
      return { status: 400, headers, jsonBody: { erreur: "Nom et prénom requis." } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return { status: 400, headers, jsonBody: { erreur: "Adresse e-mail invalide." } };

    try {
      const tok = await tokenGraph();
      const ids = await idsListes(tok);
      if (!ids["Leads site"]) throw { status: 502, erreur: "Liste « Leads site » introuvable." };
      const r = await fetch(`https://graph.microsoft.com/v1.0/sites/${process.env.RH_SITE_ID}/lists/${ids["Leads site"]}/items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          Title: `${nom.toUpperCase()} ${prenom}`,
          Prenom: prenom,
          Nom: nom.toUpperCase(),
          Email: email,
          Entreprise: String(d.entreprise || "").trim().slice(0, 200),
          Effectif: String(d.effectif || "").trim().slice(0, 60),
          Sujet: String(d.sujet || "").trim().slice(0, 200),
          Message: String(d.message || "").trim().slice(0, 4000),
          Formulaire: String(d.formulaire || "").trim().slice(0, 60) || "inconnu",
          PageOrigine: String(d.page || "").trim().slice(0, 200),
          Statut: "Nouveau",
        } }),
      });
      if (!r.ok) {
        const corps = (await r.text().catch(() => "")).slice(0, 300);
        context.error("lead : écriture refusée —", r.status, corps);
        throw { status: 502, erreur: "Enregistrement impossible — réessayez dans un instant." };
      }
      return { status: 202, headers, jsonBody: { ok: true } };
    } catch (e) {
      if (e && e.status) return { status: e.status, headers, jsonBody: { erreur: e.erreur } };
      context.error("lead :", e);
      return { status: 502, headers, jsonBody: { erreur: "Service momentanément indisponible." } };
    }
  }
});
