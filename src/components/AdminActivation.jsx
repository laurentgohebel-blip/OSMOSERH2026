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

import React, { useEffect, useState, useRef } from "react";
import { LogOut, RefreshCw, UserCheck, UserPlus, Users, Building2, Check, Send, ArrowLeft, Archive } from "lucide-react";
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

/* ── Messagerie : boîte de réception des fils clients ─────────────────
   GET /api/me?vue=admin&onglet=messages (tous les fils, tous clients) ;
   réponse et clôture via POST /api/demande { action: "messageRepondre" |
   "messageStatut" } — le rôle gestionnaire est déduit du jeton côté API. */
const frCourt = (iso) => { const d = new Date(iso || ""); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };
const frLong = (iso) => { const d = new Date(iso || ""); return isNaN(d) ? "" : `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`; };

/* La balle est au cabinet tant que le dernier mot est au client — signal
   plus fiable que Statut, qui peut porter des valeurs historiques posées
   par d'anciens flux (« Traitée », « En cours »). */
const aRepondreFil = (f) => !f.clos && f.dernierAuteur !== "gestionnaire";

function PastilleFil({ fil }) {
  const [bg, fg, lib] = fil.clos ? ["#F1EFE8", "#444441", "Clos"]
    : aRepondreFil(fil) ? ["#FAEEDA", "#854F0B", "À répondre"]
    : ["#E1F5EE", "#085041", "Répondu"];
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

function BoiteMessages({ boite, recharger, notifier, filInitial, majLocale }) {
  const [ouvert, setOuvert] = useState(null);
  const [rep, setRep] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Lien profond ?msg= : le fil s'ouvre à la PREMIÈRE boîte qui le
  // contient, puis la cible est consommée. Dépendre de l'identité de
  // `boite` (et non d'un booléen « est-elle nulle ») : sinon un premier
  // chargement en erreur brûlait le lien pour de bon, et chaque retour
  // sur l'onglet rouvrait le fil de force.
  const initRef = useRef(filInitial || null);
  useEffect(() => {
    if (!initRef.current || !Array.isArray(boite?.fils)) return;
    const f = boite.fils.find((x) => String(x.id) === String(initRef.current));
    if (f) { initRef.current = null; ouvrir(f); }
  }, [boite]); // eslint-disable-line react-hooks/exhaustive-deps

  /* `ajout` : réponse à porter LOCALEMENT dans le fil. La lecture est mise
     en cache 60 s côté API et peut être servie par une autre instance —
     recharger juste après l'écriture risquait de ne pas montrer la réponse,
     donnant à croire à un échec (et menant à un doublon). */
  const poster = async (corps, okMsg, ajout) => {
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
      if (ajout) {
        const quand = j.quand || new Date().toISOString();
        majLocale(ajout.id, (f) => ({
          ...f, statut: "Répondu", dernierAuteur: "gestionnaire", nonLuGestionnaire: false,
          derniereMaj: quand, echanges: [...(f.echanges || []), { qui: "gestionnaire", quand, texte: ajout.texte }],
        }));
      } else recharger();
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
  // Trois formes d'échec, dont une silencieuse : un 200 dont le corps
  // n'est pas le JSON attendu (SWA qui sert index.html sur /api/*) donne
  // {} — sans ce garde, `boite.fils.find` faisait planter tout l'écran.
  if (boite.erreur || !Array.isArray(boite.fils)) return (
    <p style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      {boite.erreur || "Réponse inattendue de l'API — rechargez la page."}
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
              <button onClick={async () => { if (rep.trim() && await poster({ action: "messageRepondre", id: fil.id, texte: rep.trim() }, "✓ Réponse ajoutée au fil.", { id: fil.id, texte: rep.trim() })) setRep(""); }}
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

  // Met à jour UN fil de la boîte sans relire (voir `poster`).
  const majFilBoite = (id, transformer) =>
    setBoite((b) => (Array.isArray(b?.fils)
      ? { ...b, fils: b.fils.map((f) => (f.id === id ? transformer(f) : f)) }
      : b));

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
  const aRepondre = Array.isArray(boite?.fils) ? boite.fils.filter(aRepondreFil).length : 0;

  const retirer = (id) =>
    setDonnees((d) => ({ ...d, demandes: d.demandes.filter((x) => x.id !== id) }));

  // Un client créé (avec ou sans demande) devient immédiatement proposable
  // en « client existant » dans les autres fiches, sans rechargement.
  const ajouterClient = (codeClient, raisonSociale) =>
    setDonnees((d) => d?.clients && !d.clients.some((c) => c.codeClient === codeClient)
      ? { ...d, clients: [...d.clients, { codeClient, raisonSociale }].sort((a, b) => a.codeClient.localeCompare(b.codeClient)) }
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
        {/* Masqué, pas démonté : changer d'onglet en pleine rédaction ne
            doit pas effacer la réponse en cours ni refermer le fil. */}
        <div style={{ display: onglet === "messages" ? "block" : "none" }}>
          <BoiteMessages boite={boite} recharger={chargerBoite} notifier={notifier}
            filInitial={msgInitial} majLocale={majFilBoite} />
        </div>

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
