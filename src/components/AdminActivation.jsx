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
import { LogOut, RefreshCw, UserCheck, UserPlus, Users, Building2, Check, ShieldCheck, Send, AlertTriangle, ArrowLeft, Archive } from "lucide-react";
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
  etrangers: "Salariés étrangers (titres de séjour)",
  securite: "Sécurité (habilitations, CACES, recyclages)",
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
  // Dossier salarié complet (fin du chantier « fiches » — 22/08)
  { k: "adressePostale", l: "Adresse postale" }, { k: "numeroSS", l: "N° sécurité sociale" },
  { k: "dateNaissance", l: "Date de naissance" }, { k: "sexe", l: "Sexe" },
  { k: "nomNaissance", l: "Nom de naissance" }, { k: "nomMarital", l: "Nom marital" },
  { k: "situationFamiliale", l: "Situation familiale" },
  { k: "departementNaissance", l: "Département de naissance" },
  { k: "codeDepartementNaissance", l: "Code département" },
  { k: "paysNaissance", l: "Pays de naissance" }, { k: "codePaysNaissance", l: "Code pays" },
  { k: "iban", l: "IBAN" }, { k: "bic", l: "BIC" },
  { k: "bulletinDematerialise", l: "Bulletin dématérialisé (Oui/Non)" },
];
// Ordre de détection pensé pour les collisions de sous-chaînes :
// « prénom » avant « nom », « nom de naissance » avant « naissance » et
// « nom », les libellés composés (code/département/pays) avant les courts.
const DETECTION = [
  ["matricule", ["matricule", "n° sal", "numero sal"]],
  ["prenom", ["prenom"]],
  ["numeroSS", ["secu", "securite sociale", "nir", "n° ss", "numero ss", "insee"]],
  ["nomNaissance", ["nom de naissance", "nom naissance", "patronyme"]],
  ["nomMarital", ["marital", "usage", "epoux"]],
  ["situationFamiliale", ["situation"]],
  ["codeDepartementNaissance", ["code dep", "code du dep"]],
  ["departementNaissance", ["departement"]],
  ["codePaysNaissance", ["code pays"]],
  ["paysNaissance", ["pays"]],
  ["dateNaissance", ["naissance", "ne le", "nee le"]],
  ["adressePostale", ["adresse", "domicile"]],
  ["iban", ["iban", "rib"]],
  ["bic", ["bic", "swift"]],
  ["sexe", ["sexe", "genre", "civilite"]],
  ["bulletinDematerialise", ["demat", "bulletin"]],
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
      if (s.dateNaissance) s.dateNaissance = normDate(s.dateNaissance);
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

/* ── Messagerie : boîte de réception des fils clients ─────────────────
   GET /api/me?vue=admin&onglet=messages (tous les fils, tous clients) ;
   réponse et clôture via POST /api/demande { action: "messageRepondre" |
   "messageStatut" } — le rôle gestionnaire est déduit du jeton côté API. */
const frCourt = (iso) => { const d = new Date(iso || ""); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };
const frLong = (iso) => { const d = new Date(iso || ""); return isNaN(d) ? "" : `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`; };

function PastilleFil({ fil }) {
  const [bg, fg, lib] = fil.clos ? ["#F1EFE8", "#444441", "Clos"]
    : fil.statut === "Répondu" ? ["#E1F5EE", "#085041", "Répondu"]
    : ["#FAEEDA", "#854F0B", "À répondre"];
  return <span style={{ background: bg, color: fg, fontSize: 11, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>{lib}</span>;
}

/* Réplique côté gestionnaire : le client à gauche (carte), vous à droite
   (bleu) — miroir exact de l'écran client. */
function BulleAdmin({ fil, qui, quand, texte }) {
  const moi = qui === "gestionnaire";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: moi ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.55, color: T.ink,
        whiteSpace: "pre-wrap", overflowWrap: "anywhere",
        background: moi ? "#E6F1FB" : T.card,
        border: `1px solid ${moi ? "#CBDFF5" : T.border}`,
        borderRadius: moi ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
      }}>{texte}</div>
      <span style={{ fontSize: 11, color: T.mut, margin: "4px 2px 0" }}>
        {moi ? "Vous" : `${fil.raisonSociale || fil.codeClient}${fil.emailDemandeur ? ` (${fil.emailDemandeur})` : ""}`} — {frLong(quand)}
      </span>
    </div>
  );
}

/* ── Titre de séjour (salariés étrangers) : suivi de l'authentification
   préfectorale. La demande part par courriel à la préfecture du lieu
   d'embauche (mail type pré-rempli) au moins 2 jours ouvrables avant la
   prise de poste ; la réponse est consignée ici (Authentifié / Refusé). */
const BADGE_TITRE = (e) => {
  if (!e.titreType) return <span style={{ color: T.mut, fontSize: 12 }}>—</span>;
  const s = e.titreStatut || "À authentifier";
  const teinte = s === "Authentifié" ? { bg: "#E4F3EE", fg: T.ok }
    : s === "Refusé" ? { bg: "#FCEBEB", fg: T.err }
    : { bg: "#FAEEDA", fg: "#854F0B" };
  return (
    <span style={{ background: teinte.bg, color: teinte.fg, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s}
    </span>
  );
};

function PanneauTitre({ embauche: e, raisonSociale, onTitre, onFermer, notifier }) {
  const [envoi, setEnvoi] = useState(false);
  const decider = async (decision) => {
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminTitreSejour", idContrat: e.id, decision }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) notifier(j.erreur || `Enregistrement refusé (HTTP ${r.status}).`);
      else { onTitre(e.id, j.statut); notifier(`✓ Titre de séjour : ${j.statut}.`); onFermer(); }
    } catch { notifier("API injoignable — réessayez."); }
    setEnvoi(false);
  };

  const sujet = encodeURIComponent("Demande d'authentification d'un titre de séjour avant embauche (art. R.5221-41 du code du travail)");
  const corps = encodeURIComponent(
    `Madame, Monsieur,\n\nEn application des articles L.5221-8 et R.5221-41 et suivants du code du travail, je vous prie de bien vouloir authentifier le titre de séjour du salarié que l'entreprise ci-dessous envisage d'embaucher :\n\n` +
    `Employeur : ${raisonSociale}\nSalarié : ${e.nom} ${e.prenom} (nationalité : ${e.nationalite || "—"})\n` +
    `Titre présenté : ${e.titreType}\nNuméro du titre : ${e.titreNumero || "—"}\nDate d'expiration : ${e.titreExpiration || "—"}\n` +
    `Date d'embauche prévue : ${e.debut || "—"}\n\n` +
    `Copie du titre disponible sur demande.\n\nCordialement,\nOsmose RH, pour le compte de l'employeur`);

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12.5 }}>
        <strong>{e.titreType}</strong> n° {e.titreNumero || "—"} — expire le {e.titreExpiration || "—"} ·
        nationalité : {e.nationalite || "—"} · la copie du titre est dans les Documents du client
        (Dépôts, fichier « PJ-Embauche_…_titre-sejour_… »).
      </p>
      <p style={{ margin: 0, fontSize: 12, color: T.mut }}>
        1. Adressez la demande d'authentification à la préfecture du département du lieu
        d'embauche (au moins 2 jours ouvrables avant la prise de poste). Sans réponse sous
        2 jours ouvrables, l'obligation est réputée accomplie. 2. Consignez la réponse ici.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
        <a href={`mailto:?subject=${sujet}&body=${corps}`}
          style={{ fontSize: 12.5, color: T.accent, fontWeight: 600, marginRight: "auto" }}>
          ✉ Préparer le mail à la préfecture
        </a>
        <button onClick={onFermer} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: T.mut, padding: "8px 6px" }}>Fermer</button>
        <button onClick={() => decider("refuse")} disabled={envoi}
          style={{ all: "unset", cursor: "pointer", color: T.err, fontSize: 12.5, fontWeight: 600, padding: "8px 6px" }}>
          Titre non valide
        </button>
        <button onClick={() => decider("authentifie")} disabled={envoi} style={{
          all: "unset", cursor: envoi ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
          background: T.ok, color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600,
        }}>
          <ShieldCheck size={14} /> Authentifié par la préfecture
        </button>
      </div>
    </div>
  );
}

function SectionDpae({ embauches, clients, dpaeMode, onStatut, onTitre, notifier }) {
  const [ouvert, setOuvert] = useState(null); // id du panneau DPAE ouvert
  const [ouvertTitre, setOuvertTitre] = useState(null); // id du panneau titre ouvert
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
                {["Reçue le", "Client", "Salarié", "Contrat", "Début", "Titre séjour", "DPAE", ""].map((h) => (
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
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>
                      {e.titreType ? (
                        <button onClick={() => { setOuvertTitre(ouvertTitre === e.id ? null : e.id); setOuvert(null); }}
                          style={{ all: "unset", cursor: "pointer" }} title="Suivre l'authentification du titre">
                          {BADGE_TITRE(e)}
                        </button>
                      ) : BADGE_TITRE(e)}
                    </td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>{BADGE_DPAE(e.dpaeStatut)}</td>
                    <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap", textAlign: "right" }}>
                      {dpaeMode && (e.dpaeStatut || "").startsWith("Déposée") && (
                        <button onClick={() => verifier(e)} disabled={verif === e.id}
                          style={{ all: "unset", cursor: verif === e.id ? "wait" : "pointer", color: T.accent, fontSize: 12, fontWeight: 600 }}>
                          {verif === e.id ? "Vérification…" : "Vérifier"}
                        </button>
                      )}
                      {dpaeMode && !(e.dpaeStatut || "").startsWith("Déposée") && !(e.dpaeStatut || "").startsWith("Conforme") && (
                        <button onClick={() => { setOuvert(ouvert === e.id ? null : e.id); setOuvertTitre(null); }}
                          style={{ all: "unset", cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 600 }}>
                          {ouvert === e.id ? "Fermer" : (e.dpaeStatut || "").startsWith("Refusée") ? "Corriger" : "Déclarer"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {ouvertTitre === e.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: "0 8px 10px", borderBottom: `1px solid ${T.border}` }}>
                        <PanneauTitre embauche={e} raisonSociale={nomClient(e.codeClient)} notifier={notifier}
                          onTitre={onTitre} onFermer={() => setOuvertTitre(null)} />
                      </td>
                    </tr>
                  )}
                  {ouvert === e.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: "0 8px 10px", borderBottom: `1px solid ${T.border}` }}>
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

function BoiteMessages({ boite, recharger, notifier, filInitial }) {
  const [ouvert, setOuvert] = useState(null);
  const [rep, setRep] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Lien profond ?msg= : le fil s'ouvre dès que la boîte est chargée.
  useEffect(() => {
    if (filInitial && Array.isArray(boite?.fils)) {
      const f = boite.fils.find((x) => String(x.id) === String(filInitial));
      if (f) ouvrir(f);
    }
  }, [boite === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const poster = async (corps, okMsg) => {
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const j = await r.json().catch(() => ({}));
      setEnvoi(false);
      if (!r.ok) { notifier(j.erreur || `Refusé (HTTP ${r.status}).`); return false; }
      if (okMsg) notifier(okMsg);
      recharger();
      return true;
    } catch {
      setEnvoi(false);
      notifier("API injoignable — réessayez.");
      return false;
    }
  };

  const ouvrir = (f) => {
    setOuvert(f.id); setRep("");
    if (f.nonLuGestionnaire) {
      // marquage lu silencieux — l'échec n'empêche pas la lecture
      apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "messageStatut", id: f.id, lu: true }),
      }).catch(() => {});
    }
  };

  if (boite === null) return <p style={{ color: T.mut, fontSize: 13.5 }}>Chargement des messages…</p>;
  if (boite.erreur) return (
    <p style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      {boite.erreur}
    </p>
  );

  const fil = boite.fils.find((f) => f.id === ouvert);

  // ── Conversation ──
  if (fil) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <button onClick={() => setOuvert(null)} aria-label="Retour à la boîte" style={{ all: "unset", cursor: "pointer", color: T.mut, padding: 4, display: "flex" }}><ArrowLeft size={17} /></button>
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: T.serif, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fil.objet}</h2>
          <PastilleFil fil={fil} />
          <button onClick={() => poster({ action: "messageStatut", id: fil.id, clos: !fil.clos }, fil.clos ? "✓ Fil rouvert." : "✓ Fil clos.")}
            disabled={envoi} title={fil.clos ? "Rouvrir le fil" : "Clore le fil (résolu)"}
            style={{ all: "unset", cursor: "pointer", marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
            <Archive size={13} /> {fil.clos ? "Rouvrir" : "Clore"}
          </button>
        </div>
        <p style={{ margin: "0 0 16px 31px", fontSize: 11.5, color: T.mut }}>
          {fil.raisonSociale || fil.codeClient} ({fil.codeClient}) — réf. {fil.reference || "—"} — ouvert le {frCourt(fil.creeLe)}
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          <BulleAdmin fil={fil} qui="client" quand={fil.creeLe} texte={fil.message} />
          {(fil.echanges || []).map((e, i) => <BulleAdmin key={i} fil={fil} qui={e.qui} quand={e.quand} texte={e.texte} />)}
        </div>
        {fil.clos ? (
          <p style={{ marginTop: 16, fontSize: 12.5, color: T.mut }}>Fil clos — rouvrez-le pour répondre.</p>
        ) : (
          <div style={{ marginTop: 16 }}>
            <textarea rows={3} value={rep} onChange={(e) => setRep(e.target.value)}
              placeholder={`Répondre à ${fil.raisonSociale || fil.codeClient}…`}
              style={{ ...champ, resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 10 }}>
              <span style={{ fontSize: 11.5, color: T.mut }}>
                La réponse s'ajoute au fil du portail client et passe le statut en « Répondu ».
              </span>
              <button onClick={async () => { if (rep.trim() && await poster({ action: "messageRepondre", id: fil.id, texte: rep.trim() }, "✓ Réponse ajoutée au fil.")) setRep(""); }}
                disabled={envoi || !rep.trim()} style={{
                  all: "unset", cursor: envoi || !rep.trim() ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8,
                  background: T.accent, color: "#fff", borderRadius: 8, padding: "9px 18px",
                  fontSize: 13, fontWeight: 600, fontFamily: T.sans, opacity: envoi || !rep.trim() ? 0.6 : 1, flexShrink: 0,
                }}>
                <Send size={14} /> {envoi ? "Envoi…" : "Répondre"}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Liste ──
  if (!boite.fils.length) return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
      Aucun message client. ✨
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {boite.total > boite.fils.length && (
        <p style={{ margin: 0, fontSize: 12, color: T.mut }}>
          Les {boite.fils.length} fils les plus récents (sur {boite.total}) — le reste est dans la liste SharePoint.
        </p>
      )}
      {boite.fils.map((f) => (
        <button key={f.id} onClick={() => ouvrir(f)} style={{
          all: "unset", boxSizing: "border-box", display: "block", width: "100%", minWidth: 0, overflow: "hidden",
          cursor: "pointer", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontFamily: T.sans,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong>{f.raisonSociale || f.codeClient}</strong>
              <span style={{ color: T.mut }}> — {f.objet}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: T.mut }}>{frCourt(f.derniereMaj)}</span>
              <PastilleFil fil={f} />
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: T.mut, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.dernierAuteur === "gestionnaire" ? "Vous : " : ""}{((f.echanges && f.echanges.length ? f.echanges[f.echanges.length - 1].texte : f.message) || "").trim()}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Brique « Salariés étrangers » — suivi tous clients & dossier
   inspection. Chargée à l'ouverture (GET /api/me?vue=admin&onglet=etrangers) ;
   qualification du droit au travail et suivi d'autorisation par ligne
   (POST /api/demande { action:"adminEtrangers" }). ─────────────────────── */
const BADGE_ETAT_ETR = (s) => {
  const rendu = (bg, fg, txt) => <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{txt}</span>;
  switch (s.etat) {
    case "expire": return rendu("#FCEBEB", "#791F1F", "EXPIRÉ");
    case "en-renouvellement": return rendu("#EAF1FB", T.accent, "En renouvellement");
    case "a-renouveler": return rendu("#FAEEDA", "#854F0B", `À renouveler (${s.joursRestants} j)`);
    case "valide": return rendu("#E4F3EE", T.ok, "Valide");
    default: return rendu(T.bg, T.mut, "À renseigner");
  }
};

function SectionEtrangers({ notifier }) {
  const [donnees, setDonnees] = useState(null); // null=fermé | "chargement" | {salaries…} | {erreur}
  const [envoi, setEnvoi] = useState(null);

  const charger = () => {
    setDonnees("chargement");
    apiFetch("/api/me?vue=admin&onglet=etrangers")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setDonnees(r.ok ? j : { erreur: j.erreur || `HTTP ${r.status}` });
      })
      .catch(() => setDonnees({ erreur: "API injoignable — réessayez." }));
  };

  const enregistrer = async (s, champ, valeur) => {
    setEnvoi(s.id);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminEtrangers", id: s.id, [champ]: valeur }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) notifier(j.erreur || `Enregistrement refusé (HTTP ${r.status}).`);
      else setDonnees((d) => ({ ...d, salaries: d.salaries.map((x) => (x.id === s.id ? { ...x, [champ === "droitTravail" ? "droitTravail" : "autorisationTravail"]: valeur, ...(champ === "droitTravail" ? { droitSuggere: false } : {}) } : x)) }));
    } catch { notifier("API injoignable — réessayez."); }
    setEnvoi(null);
  };

  if (donnees === null) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
        <button onClick={charger} style={{ all: "unset", cursor: "pointer", color: T.accent, fontSize: 13, fontWeight: 600 }}>
          Ouvrir le suivi des salariés étrangers (tous clients) →
        </button>
      </div>
    );
  }
  if (donnees === "chargement") return <p style={{ fontSize: 13, color: T.mut }}>Chargement du suivi…</p>;
  if (donnees.erreur) return <p style={{ fontSize: 13, color: T.err }}>{donnees.erreur}</p>;

  const cpt = donnees.compteurs || {};
  const salaries = donnees.salaries || [];
  const fr = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 12.5 }}>
        <strong style={{ color: cpt.expires ? T.err : T.ink }}>{cpt.expires || 0} expiré{cpt.expires > 1 ? "s" : ""}</strong>
        {" · "}{cpt.enRenouvellement || 0} en renouvellement · {cpt.aRenouveler || 0} à renouveler · {cpt.valides || 0} valide{cpt.valides > 1 ? "s" : ""}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.mut }}>
        Dossier inspection : les copies (colonnes « Pièces ») sont dans les Documents du client concerné.
        Rappel : la première admission au travail d'un étranger déclenche la taxe employeur (OFII/DGFiP).
        « Droit au travail » en italique = suggestion d'après le type de titre — qualifiez d'après la mention exacte.
      </p>
      {salaries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: T.mut }}>Aucun salarié étranger suivi.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["Client", "Salarié", "Nationalité", "Titre", "Fin des droits", "État", "Droit au travail", "Autorisation", "Pièces"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 11.5, color: T.mut }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salaries.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{s.raisonSociale}</td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}><strong>{s.nom}</strong> {s.prenom}</td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>{s.nationalite || "—"}</td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }} title={s.titre?.numero ? `N° ${s.titre.numero}` : undefined}>
                    {s.titre?.type || "—"}{s.recepisse?.fin ? ` + récépissé → ${fr(s.recepisse.fin)}` : ""}
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{fr(s.finDroits)}</td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>{BADGE_ETAT_ETR(s)}</td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>
                    <select value={s.droitTravail || ""} disabled={envoi === s.id}
                      onChange={(e) => enregistrer(s, "droitTravail", e.target.value)}
                      style={{ ...champ, padding: "5px 7px", fontSize: 11.5, fontStyle: s.droitSuggere ? "italic" : "normal", minWidth: 150 }}>
                      {(donnees.droits || []).map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}` }}>
                    <select value={s.autorisationTravail || ""} disabled={envoi === s.id}
                      onChange={(e) => enregistrer(s, "autorisationTravail", e.target.value)}
                      style={{ ...champ, padding: "5px 7px", fontSize: 11.5, minWidth: 110 }}>
                      {(donnees.autorisations || []).map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.mut, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={[s.titre?.pj, s.recepisse?.pj].filter(Boolean).join(" · ") || undefined}>
                    {[s.titre?.pj, s.recepisse?.pj].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminActivation({ user, onLogout, msgInitial: msgProp }) {
  const [donnees, setDonnees] = useState(null); // null | { demandes, clients, options } | { erreur }
  const [boite, setBoite] = useState(null);     // null | { fils, total } | { erreur }
  // Lien profond des e-mails : ?msg=<id> ouvre l'onglet Messages sur ce
  // fil. Lecture PURE (StrictMode double-invoque les initialisateurs) —
  // l'URL est nettoyée dans l'effet ci-dessous, une seule fois.
  const [msgInitial] = useState(() => msgProp || new URLSearchParams(window.location.search).get("msg"));
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("msg")) { // seul msg est retiré — les autres paramètres restent
      params.delete("msg");
      const reste = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (reste ? `?${reste}` : ""));
    }
  }, []);
  const [onglet, setOnglet] = useState(msgInitial ? "messages" : "acces");
  const [toast, setToast] = useState(null);
  const notifier = (m) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  const chargerBoite = () => {
    apiFetch("/api/me?vue=admin&onglet=messages")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setBoite(r.ok ? j : { erreur: j.erreur || `HTTP ${r.status}` });
      })
      .catch(() => setBoite({ erreur: "API injoignable — rechargez la page." }));
  };
  const charger = () => {
    setDonnees(null);
    apiFetch("/api/me?vue=admin")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setDonnees(r.ok ? j : { erreur: j.erreur || `HTTP ${r.status}` });
      })
      .catch(() => setDonnees({ erreur: "API injoignable — rechargez la page." }));
    chargerBoite();
  };
  useEffect(charger, []);

  // Fils où la balle est côté cabinet : compteur de l'onglet Messages.
  const aRepondre = Array.isArray(boite?.fils)
    ? boite.fils.filter((f) => !f.clos && f.statut !== "Répondu").length : 0;

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
  // Idem pour l'authentification du titre de séjour.
  const majStatutTitre = (id, statut) =>
    setDonnees((d) => d?.embauches
      ? { ...d, embauches: d.embauches.map((e) => (e.id === id ? { ...e, titreStatut: statut } : e)) }
      : d);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <header style={{ background: T.navy, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: T.serif, fontSize: 18 }}>Osmose <em style={{ color: "#7FB0E8" }}>RH</em></span>
        <span style={{ fontSize: 12.5, color: "#9FB2C9" }}>Administration</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9FB2C9" }}>{user?.email}</span>
        <button onClick={charger} title="Actualiser" style={{ all: "unset", cursor: "pointer", color: "#9FB2C9", display: "flex" }}><RefreshCw size={15} /></button>
        <button onClick={onLogout} style={{ all: "unset", cursor: "pointer", color: "#9FB2C9", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </header>

      <nav style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 4, padding: "0 24px" }}>
        {[
          ["acces", `Demandes d'accès${donnees?.demandes?.length ? ` (${donnees.demandes.length})` : ""}`],
          ["messages", `Messages clients${aRepondre ? ` (${aRepondre})` : ""}`],
        ].map(([id, lib]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{
            all: "unset", cursor: "pointer", padding: "12px 14px", fontSize: 13.5,
            fontWeight: onglet === id ? 600 : 400,
            color: onglet === id ? T.accent : T.mut,
            borderBottom: `2px solid ${onglet === id ? T.accent : "transparent"}`,
          }}>{lib}</button>
        ))}
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "26px 18px 60px" }}>
        {onglet === "messages" && (
          <BoiteMessages boite={boite} recharger={chargerBoite} notifier={notifier} filInitial={msgInitial} />
        )}

        {onglet === "acces" && (<>
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
              Embauches — DPAE & titres de séjour
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.mut }}>
              Chaque embauche reçue est à déclarer à l'URSSAF avant la prise de poste
              (au plus tôt 8 jours avant) — brouillon pré-rempli, dépôt, certificat.
              Pour un salarié étranger, faites d'abord authentifier le titre de séjour
              par la préfecture (2 jours ouvrables) : cliquez sur son badge.
            </p>
            <SectionDpae embauches={donnees.embauches} clients={donnees.clients}
              dpaeMode={donnees.dpaeMode} onStatut={majStatutDpae} onTitre={majStatutTitre} notifier={notifier} />
          </section>
        )}

        {donnees?.embauches && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, fontFamily: T.serif, fontWeight: 600 }}>
              <ShieldCheck size={15} style={{ verticalAlign: "-2px", marginRight: 7 }} />
              Salariés étrangers — suivi & dossier inspection
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.mut }}>
              Tous clients : validité des titres, renouvellements en cours, qualification du
              droit au travail et suivi des autorisations. Vendue en option « Salariés
              étrangers » — activable client par client à l'activation de l'accès.
            </p>
            <SectionEtrangers notifier={notifier} />
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
        </>)}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.navy, color: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 13, maxWidth: "84%", boxShadow: "0 8px 30px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
