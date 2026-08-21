// api/src/functions/dashboard.js — KPI réels du tableau de bord client.
// Jeton vérifié → client résolu → lecture des listes du site RH (cache 60 s
// de annuaire.items) → indicateurs FILTRÉS sur le CodeClient du compte.
// Le filtrage est côté serveur : un client ne peut pas voir les chiffres
// d'un autre, même en bricolant les appels.

const { app } = require("@azure/functions");
const { verifierJeton, resoudreClient, tokenGraph, idsListes, items, dateParis } = require("../annuaire");

/* Route admin-activer déclarée EN TÊTE de fichier : l'indexation de la
   plateforme SWA ne lit que le début de chaque fichier (constat du
   21/08 : toute déclaration au-delà de ~la ligne 100 est ignorée —
   voir me.js). Handler littéral obligatoire, jamais après un gros bloc. */
app.http("admin-activer", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      return await require("../admin").activer(request, context);
    } catch (e) {
      context.error("admin-activer :", e);
      return { status: 500, jsonBody: { erreur: `Module admin inchargeable : ${e.message}` } };
    }
  },
});

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

app.http("dashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { email } = await verifierJeton(request);
      const c = await resoudreClient(email);
      const tok = await tokenGraph();
      const ids = await idsListes(tok);

      // Acompte : les éléments écrits par l'ancien flux HTTP portent les
      // colonnes accentuées historiques (Pr_x00e9_nom, Montantdemand_x00e9_),
      // ceux écrits par l'API standard les canoniques (Prenom,
      // Montantdemande) — on lit les deux générations et on fusionne.
      // Attestations : « Demandes attestations » (circuit standard) s'ajoute
      // à « Attestations test » (historique) si elle existe.
      const [embauches, acomptes, attestations, attestationsStd] = await Promise.all([
        items(tok, ids["Production contrat"],
          "CodeClient,Nom,Pr_x00e9_nom,Type_x0020_contrat,Dateded_x00e9_but,Approuv_x00e9_,Sign_x00e9_,Created"),
        items(tok, ids["Acompte"], "CodeClient,Nom,Pr_x00e9_nom,Prenom,Montantdemand_x00e9_,Montantdemande,Statut,Created"),
        ids["Attestations test"] ? items(tok, ids["Attestations test"], "CodeClient,Title,Statut,Created") : [],
        ids["Demandes attestations"] ? items(tok, ids["Demandes attestations"], "CodeClient,Title,Statut,Created") : [],
      ]);
      const duClient = (liste) => liste.filter((x) => x.CodeClient === c.codeClient);
      const emb = duClient(embauches), att = duClient([...attestations, ...attestationsStd]);
      const aco = duClient(acomptes).map((x) => ({
        ...x,
        Pr_x00e9_nom: x.Pr_x00e9_nom || x.Prenom || "",
        Montantdemand_x00e9_: x.Montantdemand_x00e9_ ?? x.Montantdemande ?? 0,
      }));

      const maintenant = new Date();
      const debutMoisCourant = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);

      // Embauches par mois (6 derniers mois, par date de début)
      const parMois = [];
      for (let i = 5; i >= 0; i--) {
        const m = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
        const fin = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        parMois.push({
          m: MOIS_COURTS[m.getMonth()],
          n: emb.filter((x) => x.Dateded_x00e9_but && new Date(x.Dateded_x00e9_but) >= m && new Date(x.Dateded_x00e9_but) < fin).length,
        });
      }
      const repartition = {};
      for (const x of emb) {
        const t = x.Type_x0020_contrat || "Autre";
        repartition[t] = (repartition[t] || 0) + 1;
      }
      const prochaines = emb
        .filter((x) => x.Dateded_x00e9_but && new Date(x.Dateded_x00e9_but) >= maintenant)
        .sort((a, b) => new Date(a.Dateded_x00e9_but) - new Date(b.Dateded_x00e9_but))
        .slice(0, 3)
        .map((x) => ({ nom: x.Nom || "", prenom: x.Pr_x00e9_nom || "", type: x.Type_x0020_contrat || "", debut: dateParis(x.Dateded_x00e9_but) }));

      const acoEnAttente = aco.filter((x) => x.Statut === "Nouveau");
      const embEnAttente = emb.filter((x) => x.Approuv_x00e9_ !== true);

      // Bloc « À traiter » : ce qui attend une action côté gestionnaire
      const aTraiter = [
        ...embEnAttente.slice(0, 5).map((x) => ({
          t: `Embauche ${x.Type_x0020_contrat || ""} ${x.Nom || ""} ${x.Pr_x00e9_nom || ""} — en attente d'approbation`, s: "À traiter",
        })),
        ...acoEnAttente.slice(0, 5).map((x) => ({
          t: `Acompte ${x.Nom || ""} ${x.Pr_x00e9_nom || ""} — ${x.Montantdemand_x00e9_ || 0} € à traiter`, s: "À traiter",
        })),
      ];

      // Chaque bloc n'est renvoyé que si l'option est souscrite : le front
      // n'affiche que ce qui existe, et les compteurs d'options non incluses
      // ne fuient pas.
      return { status: 200, jsonBody: {
        client: c.codeClient,
        raisonSociale: c.raisonSociale,
        options: c.options,
        embauches: !c.options.includes("embauche") ? null : {
          total: emb.length,
          enAttente: embEnAttente.length,
          moisCourant: emb.filter((x) => new Date(x.Created) >= debutMoisCourant).length,
          parMois, repartition, prochaines,
        },
        acomptes: !c.options.includes("acompte") ? null : {
          enAttente: acoEnAttente.length,
          montantEnAttente: Math.round(acoEnAttente.reduce((s, x) => s + (Number(x.Montantdemand_x00e9_) || 0), 0) * 100) / 100,
          traites: aco.filter((x) => x.Statut === "Traité").length,
        },
        attestations: !c.options.includes("attestation") ? null : {
          total: att.length,
          moisCourant: att.filter((x) => new Date(x.Created) >= debutMoisCourant).length,
        },
        aTraiter: [
          ...(c.options.includes("embauche") ? aTraiter.filter((x) => x.t.startsWith("Embauche")) : []),
          ...(c.options.includes("acompte") ? aTraiter.filter((x) => x.t.startsWith("Acompte")) : []),
        ],
      } };
    } catch (e) {
      if (e && e.status) return { status: e.status, jsonBody: { erreur: e.erreur } };
      context.error("dashboard :", e);
      return { status: 502, jsonBody: { erreur: "Indicateurs momentanément indisponibles." } };
    }
  }
});

