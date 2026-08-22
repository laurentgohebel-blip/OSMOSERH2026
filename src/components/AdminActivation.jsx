// src/components/AdminActivation.jsx — écran gestionnaire : activation des
// demandes d'accès en un clic. Affiché par AppShell quand /api/me renvoie
// { admin: true } (adresse dans ADMIN_EMAILS côté API).
// Chaque demande propose : rattacher à un client existant, OU créer le
// client (code, raison sociale, options, identité employeur) — l'API fait
// les deux écritures SharePoint et passe la demande en « Traitée ».
// Routage : la table de routage de la SWA actuelle n'accepte plus de
// nouvelle route (voir api/src/functions/me.js) — l'écran passe donc par
// les routes historiques : GET /api/me?vue=admin et POST /api/demande
// { action: "adminActiver" }. Fonctionne aussi sur la future SWA.

import React, { useEffect, useState } from "react";
import { LogOut, RefreshCw, UserCheck, UserPlus, Users, Building2, Check, ShieldCheck, Send, AlertTriangle } from "lucide-react";
import { apiFetch } from "../apiClient";

const T = {
  navy: "#0D1F33", accent: "#1668D9", bg: "#F4F6F9", card: "#FFFFFF",
  border: "#E3E8EF", ink: "#1A2433", mut: "#5C6B80", err: "#A8564A", ok: "#0F6E56",
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};
const champ = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", fontSize: 13,
  border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.sans, background: "#fff",
};
const LIBELLES_OPTIONS = {
  embauche: "Embauche (contrats, personnel, fins)", acompte: "Acomptes",
  attestation: "Attestations", paie: "Variables de paie",
};

const N_VIDE = {
  codeClient: "", raisonSociale: "", options: ["embauche"],
  adresseEntreprise: "", siret: "", representant: "",
  fonctionRepresentant: "", lieuEdition: "", emailGestionnaire: "",
};

/* Formulaire d'activation, deux usages :
   - avec `demande` : traitement d'une demande d'accès en attente ;
   - sans `demande` : création directe (pré-provisionnement d'un client
     signé — le gestionnaire saisit l'adresse, le client entrera
     directement dans son espace à sa première connexion). */
function FormulaireActivation({ demande, clients, options, onActivee, onClientCree, notifier }) {
  const creation = !demande;
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState(creation || !clients.length ? "nouveau" : "existant");
  const [codeExistant, setCodeExistant] = useState("");
  const [n, setN] = useState({
    ...N_VIDE, raisonSociale: demande?.entreprise || "", representant: demande?.nom || "",
  });
  const [envoi, setEnvoi] = useState(false);
  const majN = (k, v) => setN((p) => ({ ...p, [k]: v }));
  const basculerOption = (o) =>
    majN("options", n.options.includes(o) ? n.options.filter((x) => x !== o) : [...n.options, o]);

  const activer = async () => {
    const adresse = (creation ? email : demande.email).trim().toLowerCase();
    if (creation && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse))
      return notifier("Adresse e-mail du client invalide.");
    if (mode === "existant" && !codeExistant) return notifier("Choisissez le client à rattacher.");
    if (mode === "nouveau" && (!n.codeClient.trim() || !n.raisonSociale.trim()))
      return notifier("Code client et raison sociale sont requis.");
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminActiver",
          email: adresse,
          ...(demande ? { demandeId: demande.id } : {}),
          ...(mode === "existant" ? { codeClient: codeExistant } : { nouveau: n }),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { notifier(j.erreur || `Activation refusée (HTTP ${r.status}).`); setEnvoi(false); return; }
      if (mode === "nouveau" && onClientCree) onClientCree(j.codeClient, n.raisonSociale.trim());
      if (creation) {
        setEmail(""); setCodeExistant(""); setN({ ...N_VIDE }); setEnvoi(false);
        notifier(`✓ ${adresse} rattaché à ${j.codeClient} — l'espace s'ouvrira dès sa première connexion.`);
      } else {
        notifier(`✓ ${adresse} rattaché à ${j.codeClient} — le client peut recharger sa page.`);
        onActivee(demande.id);
      }
    } catch {
      notifier("API injoignable — réessayez.");
      setEnvoi(false);
    }
  };

  const fr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
      {creation ? (
        <>
          <input style={champ} type="email" placeholder="Adresse e-mail du client *"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.mut }}>
            Le client devra créer son compte de connexion avec cette adresse exacte —
            c'est elle qui ouvre son espace.
          </p>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <div>
              <strong style={{ fontSize: 14.5 }}>{demande.nom || demande.email}</strong>
              <span style={{ color: T.mut, fontSize: 12.5 }}> — {demande.entreprise || "entreprise non précisée"}</span>
            </div>
            <span style={{ fontSize: 11.5, color: T.mut }}>{fr(demande.recueLe)}</span>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 12.5, color: T.mut }}>
            {demande.email}{demande.telephone ? ` · ${demande.telephone}` : ""}
          </p>
          {demande.message && (
            <p style={{ margin: "6px 0 0", fontSize: 12.5, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
              {demande.message}
            </p>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 14, margin: "14px 0 10px", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={mode === "existant"} onChange={() => setMode("existant")} disabled={!clients.length} />
          <UserCheck size={14} /> Client existant
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={mode === "nouveau"} onChange={() => setMode("nouveau")} />
          <Building2 size={14} /> Nouveau client
        </label>
      </div>

      {mode === "existant" ? (
        <select style={champ} value={codeExistant} onChange={(e) => setCodeExistant(e.target.value)}>
          <option value="">— Choisir le client —</option>
          {clients.map((c) => (
            <option key={c.codeClient} value={c.codeClient}>{c.codeClient} — {c.raisonSociale}</option>
          ))}
        </select>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <input style={champ} placeholder="Code client * (ex. DUPONT)" value={n.codeClient}
            onChange={(e) => majN("codeClient", e.target.value.toUpperCase())} />
          <input style={champ} placeholder="Raison sociale *" value={n.raisonSociale}
            onChange={(e) => majN("raisonSociale", e.target.value)} />
          <input style={{ ...champ, gridColumn: "1 / -1" }} placeholder="Adresse de l'entreprise (documents)"
            value={n.adresseEntreprise} onChange={(e) => majN("adresseEntreprise", e.target.value)} />
          <input style={champ} placeholder="SIRET" value={n.siret} onChange={(e) => majN("siret", e.target.value)} />
          <input style={champ} placeholder="Représentant (Prénom Nom)" value={n.representant}
            onChange={(e) => majN("representant", e.target.value)} />
          <input style={champ} placeholder="Fonction du représentant" value={n.fonctionRepresentant}
            onChange={(e) => majN("fonctionRepresentant", e.target.value)} />
          <input style={champ} placeholder="Lieu d'édition des documents" value={n.lieuEdition}
            onChange={(e) => majN("lieuEdition", e.target.value)} />
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, padding: "2px 0" }}>
            {options.map((o) => (
              <label key={o} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={n.options.includes(o)} onChange={() => basculerOption(o)} />
                {LIBELLES_OPTIONS[o] || o}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={activer} disabled={envoi} style={{
          all: "unset", cursor: envoi ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
          background: T.accent, color: "#fff", borderRadius: 8, padding: "9px 18px",
          fontSize: 13, fontWeight: 600, fontFamily: T.sans, opacity: envoi ? 0.7 : 1,
        }}>
          <Check size={15} /> {envoi ? "Activation…" : creation ? "Créer l'accès" : "Activer l'accès"}
        </button>
      </div>
    </div>
  );
}

/* ── Reprise de l'effectif ────────────────────────────────────────────── */
/* Le gestionnaire colle le tableau de l'export du client (Excel → Ctrl+C
   → coller ici : le presse-papier arrive en TSV, format universel), le
   portail détecte les colonnes usuelles, montre un aperçu, et l'API écrit
   le référentiel « Salariés » (CodeClient imposé côté serveur, doublons
   nom+prénom ignorés). */

const CHAMPS_IMPORT = [
  { k: "matricule", l: "Matricule" }, { k: "nom", l: "Nom" }, { k: "prenom", l: "Prénom" },
  { k: "poste", l: "Poste / emploi" }, { k: "typeContrat", l: "Type de contrat" },
  { k: "dateEntree", l: "Date d'entrée" }, { k: "dateSortie", l: "Date de sortie" },
  { k: "email", l: "E-mail" }, { k: "telephone", l: "Téléphone" }, { k: "statut", l: "Statut" },
];
// Ordre de détection pensé pour les collisions de sous-chaînes :
// « prénom » avant « nom », les dates avant « contrat » (« date fin contrat »).
const DETECTION = [
  ["matricule", ["matricule", "n° sal", "numero sal"]],
  ["prenom", ["prenom"]],
  ["dateEntree", ["entree", "embauche", "debut", "arrivee"]],
  ["dateSortie", ["sortie", "depart", "fin"]],
  ["email", ["mail", "courriel"]],
  ["telephone", ["tel", "portable", "mobile"]],
  ["statut", ["statut"]],
  ["typeContrat", ["contrat", "nature"]],
  ["poste", ["poste", "emploi", "fonction", "qualification"]],
  ["nom", ["nom"]],
];
const normaliser = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const detecterChamp = (entete) => {
  const e = normaliser(entete);
  if (!e) return "";
  for (const [champ, alias] of DETECTION) if (alias.some((a) => e.includes(a))) return champ;
  return "";
};
const normDate = (v) => {
  const t = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return "";
  const an = m[3].length === 2 ? (Number(m[3]) > 50 ? "19" + m[3] : "20" + m[3]) : m[3];
  return `${an}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

function analyserCollage(texte) {
  const lignesBrutes = texte.split(/\r?\n/).map((l) => l.replace(/ /g, " "))
    .filter((l) => l.trim() !== "");
  if (!lignesBrutes.length) return null;
  const sep = lignesBrutes[0].includes("\t") ? "\t" : lignesBrutes[0].includes(";") ? ";" : ",";
  const grille = lignesBrutes.map((l) => l.split(sep).map((c) => c.trim()));
  const nbCol = Math.max(...grille.map((l) => l.length));
  const detection = Array.from({ length: nbCol }, (_, i) => detecterChamp(grille[0][i]));
  // Première ligne = en-têtes si au moins deux colonnes reconnues distinctes
  const reconnues = detection.filter(Boolean);
  const enTete = new Set(reconnues).size >= 2;
  return {
    donnees: enTete ? grille.slice(1) : grille,
    mapping: enTete ? detection : Array.from({ length: nbCol }, () => ""),
    nbCol, enTete,
  };
}

function RepriseEffectif({ clients, notifier }) {
  const [codeClient, setCodeClient] = useState("");
  const [texte, setTexte] = useState("");
  const [mapping, setMapping] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);

  const analyse = texte.trim() ? analyserCollage(texte) : null;
  const majTexte = (v) => {
    setTexte(v); setResultat(null);
    const a = v.trim() ? analyserCollage(v) : null;
    setMapping(a ? a.mapping : []);
  };
  const colNom = mapping.indexOf("nom");
  const utilisables = analyse && colNom >= 0
    ? analyse.donnees.filter((l) => String(l[colNom] || "").trim().length >= 2).length : 0;

  const importer = async () => {
    if (!codeClient) return notifier("Choisissez le client destinataire de l'effectif.");
    if (!analyse) return notifier("Collez d'abord le tableau des salariés.");
    if (colNom < 0) return notifier("Indiquez quelle colonne contient le Nom.");
    if (!utilisables) return notifier("Aucune ligne avec un nom exploitable.");
    if (utilisables > 500) return notifier("500 salariés maximum par import — coupez le fichier en deux.");
    const salaries = analyse.donnees.map((l) => {
      const s = {};
      mapping.forEach((champ, i) => { if (champ) s[champ] = l[i] || ""; });
      if (s.dateEntree) s.dateEntree = normDate(s.dateEntree);
      if (s.dateSortie) s.dateSortie = normDate(s.dateSortie);
      return s;
    }).filter((s) => String(s.nom || "").trim().length >= 2);
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminImportSalaries", codeClient, salaries }),
      });
      const j = await r.json().catch(() => ({}));
      setEnvoi(false);
      if (!r.ok) return notifier(j.erreur || `Import refusé (HTTP ${r.status}).`);
      setResultat(j); setTexte(""); setMapping([]);
      notifier(`✓ Effectif ${codeClient} : ${j.crees} salarié${j.crees > 1 ? "s" : ""} importé${j.crees > 1 ? "s" : ""}.`);
    } catch {
      setEnvoi(false);
      notifier("API injoignable — réessayez.");
    }
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
        <select style={champ} value={codeClient} onChange={(e) => setCodeClient(e.target.value)}>
          <option value="">— Client destinataire —</option>
          {clients.map((c) => (
            <option key={c.codeClient} value={c.codeClient}>{c.codeClient} — {c.raisonSociale}</option>
          ))}
        </select>
        <a href="/modeles/Modele_reprise_effectif.xlsx" download
          style={{ fontSize: 12, color: T.accent, whiteSpace: "nowrap" }}>
          ⬇ Modèle Excel de reprise
        </a>
      </div>
      <textarea value={texte} onChange={(e) => majTexte(e.target.value)}
        placeholder={"Ouvrez l'export du client dans Excel, sélectionnez le tableau (en-têtes comprises), Ctrl+C… puis collez ici."}
        style={{ ...champ, marginTop: 10, minHeight: 90, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />

      {analyse && (
        <>
          <p style={{ margin: "10px 0 6px", fontSize: 12.5, color: T.mut }}>
            {analyse.donnees.length} ligne{analyse.donnees.length > 1 ? "s" : ""} détectée{analyse.donnees.length > 1 ? "s" : ""}
            {analyse.enTete ? " (en-têtes reconnues)" : " (pas d'en-têtes reconnues — indiquez les colonnes)"} —
            vérifiez le mappage puis l'aperçu :
          </p>
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
              <thead>
                <tr>
                  {mapping.map((m, i) => (
                    <th key={i} style={{ padding: 6, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      <select value={m} style={{ ...champ, padding: "5px 7px", fontSize: 11.5 }}
                        onChange={(e) => setMapping(mapping.map((x, j) => (j === i ? e.target.value : x)))}>
                        <option value="">— ignorer —</option>
                        {CHAMPS_IMPORT.map((c) => <option key={c.k} value={c.k}>{c.l}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analyse.donnees.slice(0, 6).map((l, i) => (
                  <tr key={i}>
                    {mapping.map((_, j) => (
                      <td key={j} style={{ padding: "5px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{l[j] || ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analyse.donnees.length > 6 && (
            <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.mut }}>… et {analyse.donnees.length - 6} autres lignes.</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={importer} disabled={envoi} style={{
              all: "unset", cursor: envoi ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
              background: T.accent, color: "#fff", borderRadius: 8, padding: "9px 18px",
              fontSize: 13, fontWeight: 600, fontFamily: T.sans, opacity: envoi ? 0.7 : 1,
            }}>
              <Users size={15} /> {envoi ? "Import…" : `Importer ${utilisables} salarié${utilisables > 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}

      {resultat && (
        <div style={{ marginTop: 12, fontSize: 12.5, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
          <strong>Import {resultat.codeClient}</strong> : {resultat.crees} créé{resultat.crees > 1 ? "s" : ""},{" "}
          {resultat.doublons} doublon{resultat.doublons > 1 ? "s" : ""} ignoré{resultat.doublons > 1 ? "s" : ""}
          {resultat.ignorees?.length ? <>
            , {resultat.ignorees.length} ligne{resultat.ignorees.length > 1 ? "s" : ""} en erreur :
            <ul style={{ margin: "4px 0 0 18px" }}>
              {resultat.ignorees.slice(0, 8).map((x, i) => <li key={i}>ligne {x.ligne} — {x.raison}</li>)}
              {resultat.ignorees.length > 8 && <li>… et {resultat.ignorees.length - 8} autres.</li>}
            </ul>
          </> : "."}
        </div>
      )}
    </div>
  );
}

/* ── DPAE — déclarations préalables à l'embauche ──────────────────────── */
/* Chaque embauche de « Production contrat » porte son état DPAE. Le
   gestionnaire ouvre le panneau (l'API renvoie un brouillon pré-rempli :
   fiche client + contrat + fiche salarié, sexe/département déduits du NIR),
   complète ce qui manque, dépose, puis vérifie le retour URSSAF (certificat
   de conformité ou motif de refus). Trois appels, même route :
   POST /api/demande { action:"adminDpae", phase:"preparer"|"deposer"|"retour" }. */

const CHAMPS_DPAE = {
  employeur: [
    ["siret", "SIRET *"], ["designation", "Dénomination *"], ["codeApe", "Code APE *"],
    ["codeUrssaf", "Code URSSAF (3 chiffres) *"], ["adresse", "Adresse (rue) *"],
    ["ville", "Ville *"], ["codePostal", "Code postal *"], ["telephone", "Téléphone"],
    ["santeTravail", "Service santé au travail"],
  ],
  salarie: [
    ["nom", "Nom *"], ["prenom", "Prénom *"], ["nir", "NIR (13 caractères) *"],
    ["cleNir", "Clé NIR *"], ["dateNaissance", "Date de naissance *", "date"],
    ["communeNaissance", "Commune de naissance *"], ["departementNaissance", "Département de naissance *"],
  ],
};

const BADGE_DPAE = (statut) => {
  const s = statut || "";
  const teinte = s.startsWith("Conforme") ? { bg: "#E4F3EE", fg: T.ok }
    : s.startsWith("Refusée") ? { bg: "#FCEBEB", fg: T.err }
    : s.startsWith("Déposée") ? { bg: "#EAF1FB", fg: T.accent }
    : { bg: T.bg, fg: T.mut };
  return (
    <span style={{ background: teinte.bg, color: teinte.fg, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s || "À déclarer"}
    </span>
  );
};

function PanneauDpae({ embauche, onStatut, onFermer, notifier }) {
  const [brouillon, setBrouillon] = useState(null); // null=chargement | {employeur,salarie,contrat}
  const [manques, setManques] = useState([]);
  const [mode, setMode] = useState("");
  const [etape, setEtape] = useState("saisie"); // saisie | envoi | attente | fini
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");

  const appel = (corps) => apiFetch("/api/demande", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "adminDpae", idContrat: embauche.id, ...corps }),
  });

  useEffect(() => {
    appel({ phase: "preparer" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErreur(j.erreur || `HTTP ${r.status}`); return; }
        setBrouillon(j.brouillon); setManques(j.manques || []); setMode(j.mode || "");
      })
      .catch(() => setErreur("API injoignable — réessayez."));
  }, [embauche.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (bloc, k, v) => setBrouillon((b) => ({ ...b, [bloc]: { ...b[bloc], [k]: v } }));

  const verifierRetour = async (restants) => {
    try {
      const r = await appel({ phase: "retour" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.pret) {
        setEtape("fini"); setResultat(j); onStatut(embauche.id, j.statut);
        return;
      }
    } catch { /* on retentera */ }
    if (restants > 0) setTimeout(() => verifierRetour(restants - 1), 5000);
    else setEtape("depose"); // bilan pas encore publié — bouton « Vérifier » du tableau
  };

  const deposer = async () => {
    setEtape("envoi"); setErreur("");
    try {
      const r = await appel({ phase: "deposer", dpae: brouillon });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.erreur || `Dépôt refusé (HTTP ${r.status}).`); setEtape("saisie"); return; }
      onStatut(embauche.id, j.statut);
      setEtape("attente");
      verifierRetour(5);
    } catch {
      setErreur("API injoignable — réessayez."); setEtape("saisie");
    }
  };

  const grille = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 };
  const bloc = (titre, cles, blocK) => (
    <fieldset style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", margin: 0 }}>
      <legend style={{ fontSize: 12, color: T.mut, padding: "0 6px" }}>{titre}</legend>
      <div style={grille}>
        {cles.map(([k, l, type]) => (
          <label key={k} style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
            {l}
            <input style={{ ...champ, padding: "6px 8px", fontSize: 12.5 }} type={type || "text"}
              value={brouillon[blocK][k] || ""} onChange={(e) => maj(blocK, k, e.target.value)} />
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
      {erreur && (
        <p style={{ margin: "0 0 10px", fontSize: 12.5, background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "8px 10px" }}>
          {erreur}
        </p>
      )}
      {!brouillon && !erreur && <p style={{ margin: 0, fontSize: 12.5, color: T.mut }}>Préparation du brouillon…</p>}

      {brouillon && etape === "saisie" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "test" && (
            <p style={{ margin: 0, fontSize: 12, color: T.accent }}>
              Mode TEST : l'URSSAF contrôle le message mais n'enregistre aucune déclaration.
            </p>
          )}
          {manques.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: T.err }}>
              <AlertTriangle size={12} style={{ verticalAlign: "-2px" }} /> À compléter : {manques.join(" · ")}
            </p>
          )}
          {bloc("Employeur (repris de la fiche client)", CHAMPS_DPAE.employeur, "employeur")}
          {bloc("Salarié", CHAMPS_DPAE.salarie, "salarie")}
          <fieldset style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", margin: 0 }}>
            <legend style={{ fontSize: 12, color: T.mut, padding: "0 6px" }}>Salarié — sexe · Contrat</legend>
            <div style={grille}>
              <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
                Sexe *
                <select style={{ ...champ, padding: "6px 8px", fontSize: 12.5 }} value={brouillon.salarie.sexe || ""}
                  onChange={(e) => maj("salarie", "sexe", e.target.value)}>
                  <option value="">—</option><option value="1">Homme</option><option value="2">Femme</option>
                </select>
              </label>
              <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
                Nature du contrat *
                <select style={{ ...champ, padding: "6px 8px", fontSize: 12.5 }} value={brouillon.contrat.nature}
                  onChange={(e) => maj("contrat", "nature", e.target.value)}>
                  <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="CTT">CTT (intérim)</option>
                </select>
              </label>
              <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
                Date d'embauche *
                <input style={{ ...champ, padding: "6px 8px", fontSize: 12.5 }} type="date"
                  value={brouillon.contrat.dateDebut || ""} onChange={(e) => maj("contrat", "dateDebut", e.target.value)} />
              </label>
              <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
                Heure d'embauche *
                <input style={{ ...champ, padding: "6px 8px", fontSize: 12.5 }} type="time"
                  value={(brouillon.contrat.heureDebut || "").slice(0, 5)} onChange={(e) => maj("contrat", "heureDebut", e.target.value)} />
              </label>
              {(brouillon.contrat.nature === "CDD" || brouillon.contrat.nature === "CTT") && (
                <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
                  Date de fin *
                  <input style={{ ...champ, padding: "6px 8px", fontSize: 12.5 }} type="date"
                    value={brouillon.contrat.dateFin || ""} onChange={(e) => maj("contrat", "dateFin", e.target.value)} />
                </label>
              )}
            </div>
          </fieldset>
          <p style={{ margin: 0, fontSize: 11.5, color: T.mut }}>
            Astuce : reportez SIRET, codes APE/URSSAF, ville, CP et service de santé dans la fiche
            « Paramètres clients » — les prochaines DPAE de ce client arriveront pré-remplies.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onFermer} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: T.mut, padding: "9px 6px" }}>Fermer</button>
            <button onClick={deposer} style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              background: T.accent, color: "#fff", borderRadius: 8, padding: "9px 18px",
              fontSize: 13, fontWeight: 600,
            }}>
              <Send size={14} /> Déposer la DPAE{mode === "test" ? " (test)" : ""}
            </button>
          </div>
        </div>
      )}

      {etape === "envoi" && <p style={{ margin: 0, fontSize: 12.5, color: T.mut }}>Dépôt auprès de l'URSSAF…</p>}
      {etape === "attente" && <p style={{ margin: 0, fontSize: 12.5, color: T.mut }}>Déposée ✓ — attente du bilan de conformité URSSAF…</p>}
      {etape === "depose" && (
        <p style={{ margin: 0, fontSize: 12.5, color: T.mut }}>
          Déposée ✓ — le bilan n'est pas encore publié. Revenez dans quelques minutes
          avec le bouton « Vérifier » du tableau.
        </p>
      )}
      {etape === "fini" && resultat && (
        resultat.conforme ? (
          <p style={{ margin: 0, fontSize: 12.5, color: T.ok }}>
            <ShieldCheck size={14} style={{ verticalAlign: "-2px" }} /> DPAE conforme — certificat URSSAF :{" "}
            <strong style={{ fontFamily: "monospace" }}>{resultat.certificat}</strong>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: T.err }}>
            <AlertTriangle size={14} style={{ verticalAlign: "-2px" }} /> DPAE refusée : {resultat.message}
          </p>
        )
      )}
      {(etape === "fini" || etape === "depose") && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onFermer} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: T.mut, padding: "4px 6px" }}>Fermer</button>
        </div>
      )}
    </div>
  );
}

function SectionDpae({ embauches, clients, dpaeMode, onStatut, notifier }) {
  const [ouvert, setOuvert] = useState(null); // id du panneau ouvert
  const [verif, setVerif] = useState(null);   // id en cours de vérification
  const nomClient = (code) => clients.find((c) => c.codeClient === code)?.raisonSociale || code;
  const fr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");

  const verifier = async (e) => {
    setVerif(e.id);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminDpae", phase: "retour", idContrat: e.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) notifier(j.erreur || `Vérification refusée (HTTP ${r.status}).`);
      else if (!j.pret) notifier("Bilan URSSAF pas encore publié — réessayez dans quelques minutes.");
      else {
        onStatut(e.id, j.statut);
        notifier(j.conforme ? `✓ DPAE conforme — certificat ${j.certificat}` : `DPAE refusée : ${j.message}`);
      }
    } catch { notifier("API injoignable — réessayez."); }
    setVerif(null);
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
      {!dpaeMode && (
        <p style={{ margin: "0 0 10px", fontSize: 12.5, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.mut }}>
          API DPAE non configurée : renseignez les variables DPAE_* de la SWA (voir docs/DPAE-API.md).
          Le tableau reste consultatif.
        </p>
      )}
      {dpaeMode === "test" && (
        <p style={{ margin: "0 0 10px", fontSize: 12, color: T.accent }}>
          Mode TEST actif (DPAE_MODE=test) — les dépôts sont contrôlés par l'URSSAF mais rien n'est déclaré.
        </p>
      )}
      {embauches.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: T.mut }}>Aucune embauche déclarée par les clients pour l'instant.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["Reçue le", "Client", "Salarié", "Contrat", "Début", "DPAE", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 11.5, color: T.mut }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {embauches.map((e) => (
                <React.Fragment key={e.id}>
                  <tr>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{fr(e.recueLe)}</td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>{nomClient(e.codeClient)}</td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
                      <strong>{e.nom}</strong> {e.prenom}
                    </td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>{e.type}</td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{e.debut || ""}</td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>{BADGE_DPAE(e.dpaeStatut)}</td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap", textAlign: "right" }}>
                      {dpaeMode && (e.dpaeStatut || "").startsWith("Déposée") && (
                        <button onClick={() => verifier(e)} disabled={verif === e.id}
                          style={{ all: "unset", cursor: verif === e.id ? "wait" : "pointer", color: T.accent, fontSize: 12, fontWeight: 600 }}>
                          {verif === e.id ? "Vérification…" : "Vérifier"}
                        </button>
                      )}
                      {dpaeMode && !(e.dpaeStatut || "").startsWith("Déposée") && !(e.dpaeStatut || "").startsWith("Conforme") && (
                        <button onClick={() => setOuvert(ouvert === e.id ? null : e.id)}
                          style={{ all: "unset", cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 600 }}>
                          {ouvert === e.id ? "Fermer" : (e.dpaeStatut || "").startsWith("Refusée") ? "Corriger" : "Déclarer"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {ouvert === e.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 8px 10px", borderBottom: `1px solid ${T.border}` }}>
                        <PanneauDpae embauche={e} notifier={notifier}
                          onStatut={onStatut} onFermer={() => setOuvert(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminActivation({ user, onLogout }) {
  const [donnees, setDonnees] = useState(null); // null | { demandes, clients, options } | { erreur }
  const [toast, setToast] = useState(null);
  const notifier = (m) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  const charger = () => {
    setDonnees(null);
    apiFetch("/api/me?vue=admin")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setDonnees(r.ok ? j : { erreur: j.erreur || `HTTP ${r.status}` });
      })
      .catch(() => setDonnees({ erreur: "API injoignable — rechargez la page." }));
  };
  useEffect(charger, []);

  const retirer = (id) =>
    setDonnees((d) => ({ ...d, demandes: d.demandes.filter((x) => x.id !== id) }));

  // Un client créé (avec ou sans demande) devient immédiatement proposable
  // en « client existant » dans les autres fiches, sans rechargement.
  const ajouterClient = (codeClient, raisonSociale) =>
    setDonnees((d) => d?.clients && !d.clients.some((c) => c.codeClient === codeClient)
      ? { ...d, clients: [...d.clients, { codeClient, raisonSociale }].sort((a, b) => a.codeClient.localeCompare(b.codeClient)) }
      : d);

  // Statut DPAE mis à jour en place après un dépôt ou une vérification.
  const majStatutDpae = (id, statut) =>
    setDonnees((d) => d?.embauches
      ? { ...d, embauches: d.embauches.map((e) => (e.id === id ? { ...e, dpaeStatut: statut } : e)) }
      : d);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <header style={{ background: T.navy, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: T.serif, fontSize: 18 }}>Osmose <em style={{ color: "#7FB0E8" }}>RH</em></span>
        <span style={{ fontSize: 12.5, color: "#9FB2C9" }}>Administration — demandes d'accès</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9FB2C9" }}>{user?.email}</span>
        <button onClick={charger} title="Actualiser" style={{ all: "unset", cursor: "pointer", color: "#9FB2C9", display: "flex" }}><RefreshCw size={15} /></button>
        <button onClick={onLogout} style={{ all: "unset", cursor: "pointer", color: "#9FB2C9", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "26px 18px 60px" }}>
        {donnees === null && <p style={{ color: T.mut, fontSize: 13.5 }}>Chargement des demandes…</p>}
        {donnees?.erreur && (
          <p style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
            {donnees.erreur}
          </p>
        )}
        {donnees?.demandes && (
          donnees.demandes.length === 0 ? (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
              Aucune demande d'accès en attente. ✨
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: T.mut }}>
                {donnees.demandes.length} demande{donnees.demandes.length > 1 ? "s" : ""} en attente — l'activation crée la fiche client
                (si besoin), rattache le compte et passe la demande en « Traitée ».
              </p>
              {donnees.demandes.map((dem) => (
                <FormulaireActivation key={dem.id} demande={dem} clients={donnees.clients}
                  options={donnees.options} onActivee={retirer} onClientCree={ajouterClient} notifier={notifier} />
              ))}
            </div>
          )
        )}

        {donnees?.demandes && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, fontFamily: T.serif, fontWeight: 600 }}>
              <UserPlus size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />
              Nouveau client — accès sans demande
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.mut }}>
              Pour un client qui vient de signer : créez sa fiche et rattachez son adresse
              AVANT sa première connexion — il entrera directement dans son espace,
              sans demande d'accès ni attente.
            </p>
            <FormulaireActivation clients={donnees.clients} options={donnees.options}
              onClientCree={ajouterClient} notifier={notifier} />
          </section>
        )}

        {donnees?.embauches && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, fontFamily: T.serif, fontWeight: 600 }}>
              <ShieldCheck size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />
              DPAE — déclarations d'embauche
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.mut }}>
              Chaque embauche reçue est à déclarer à l'URSSAF avant la prise de poste
              (au plus tôt 8 jours avant). Le brouillon est pré-rempli depuis la fiche
              client, le contrat et le dossier du salarié — complétez, déposez,
              le certificat de conformité revient dans la foulée.
            </p>
            <SectionDpae embauches={donnees.embauches} clients={donnees.clients}
              dpaeMode={donnees.dpaeMode} onStatut={majStatutDpae} notifier={notifier} />
          </section>
        )}

        {donnees?.demandes && donnees.clients.length > 0 && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, fontFamily: T.serif, fontWeight: 600 }}>
              <Users size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />
              Reprise de l'effectif
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.mut }}>
              Collez le tableau des salariés du client (export Excel de son ancien outil,
              registre du personnel…) : son espace sera déjà peuplé à sa première connexion.
            </p>
            <RepriseEffectif clients={donnees.clients} notifier={notifier} />
          </section>
        )}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.navy, color: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 13, maxWidth: "84%", boxShadow: "0 8px 30px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
