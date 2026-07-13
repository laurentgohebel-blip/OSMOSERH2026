// src/components/AppShell.jsx — v2.2
// Tableau de bord / Production (tuiles → formulaires) / Documents
// ATT-01 câblé : la tuile « Attestation » poste vers /api/demande
// ACP-01 câblé : la tuile « Acompte » poste vers /api/demande,
// champs alignés sur la liste SharePoint « Acompte » du site RH
// (Matricule, Nom, Prénom, Montant demandé — Date de demande et
// Statut sont posés par le flux). Le flux Power Automate fait
// tout le reste. Les autres tuiles restent en démo locale.

import React, { useState, useEffect, useMemo } from "react";
import {
  ChartBar, FileText, Folder, Send, Download, Eye, Upload,
  Users, Clock, ShieldCheck, ArrowLeft, LogOut, Award, Banknote,
  GraduationCap, AlertCircle, Check
} from "lucide-react";
import { apiFetch } from "../apiClient";

/* ================================================================
   CONFIGURATION
   Le client est RÉSOLU CÔTÉ SERVEUR (/api/me : jeton vérifié →
   listes « Utilisateurs portail » / « Paramètres clients » du site RH).
   CODE_CLIENT ne sert plus que de repli d'affichage en dev local
   sans API — le payload envoyé est de toute façon écrasé par l'API.
   ================================================================ */
const CODE_CLIENT = "TEST";

/* ================================================================
   DONNÉES DE DÉMONSTRATION (tuiles non câblées + tableau de bord)
   ================================================================ */
const seed = {
  effectif: 42,
  repartition: { CDI: 31, CDD: 6, Alternance: 4, Stage: 1 },
  embauchesParMois: [
    { m: "Fév", n: 1 }, { m: "Mar", n: 2 }, { m: "Avr", n: 1 },
    { m: "Mai", n: 3 }, { m: "Juin", n: 2 }, { m: "Juil", n: 4 },
  ],
  contrats: [
    { id: 1, nom: "Dupont", prenom: "Marie", type: "CDI", poste: "Comptable", debut: "2026-09-01", statut: "Signé", ts: "2026-07-10T09:12:00" },
    { id: 2, nom: "Martin", prenom: "Paul", type: "CDD", poste: "Assistant RH", debut: "2026-08-15", statut: "Brouillon", ts: "2026-07-09T15:40:00" },
    { id: 3, nom: "Leroy", prenom: "Anne", type: "Alternance", poste: "Chargée de com", debut: "2026-10-01", statut: "En relecture", ts: "2026-07-08T11:05:00" },
  ],
  dpae: [
    { id: 1, nom: "Martin", prenom: "Paul", naissance: "1998-03-22", debut: "2026-08-15", statut: "À traiter", ts: "2026-07-09T15:45:00" },
    { id: 2, nom: "Bernard", prenom: "Luc", naissance: "1990-11-02", debut: "2026-07-20", statut: "À traiter", ts: "2026-07-07T10:20:00" },
  ],
  documents: [
    { id: 1, nom: "Contrat_Dupont_CDI.docx", dossier: "Contrats", modif: "2026-07-10", par: "Osmose RH" },
    { id: 2, nom: "Attestation_Leroy.pdf", dossier: "Attestations", modif: "2026-07-08", par: "Osmose RH" },
    { id: 3, nom: "Bulletins_juin_2026.zip", dossier: "Paie", modif: "2026-07-02", par: "Cabinet paie" },
    { id: 4, nom: "DUERP_2026.pdf", dossier: "Sécurité", modif: "2026-06-18", par: "Osmose RH" },
    { id: 5, nom: "Plan_formation_2026.xlsx", dossier: "Formations", modif: "2026-06-05", par: "Osmose RH" },
  ],
};

const DOSSIERS = ["Contrats", "Paie", "Attestations", "DPAE", "Sécurité", "Formations"];

const latence = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/* ================================================================
   THÈME — identité Osmose RH
   ================================================================ */
const T = {
  navy: "#0D1F33",
  accent: "#1668D9",
  accentSoft: "#7FB0E8",
  bg: "#F4F6F9",
  card: "#FFFFFF",
  border: "#E3E8EF",
  ink: "#1A2433",
  mut: "#5C6B80",
  err: "#A8564A",
  ok: "#0F6E56",
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};

const STATUTS = {
  "Signé":        { bg: "#E1F5EE", fg: "#085041" },
  "Brouillon":    { bg: "#F1EFE8", fg: "#444441" },
  "En relecture": { bg: "#EEEDFE", fg: "#3C3489" },
  "À traiter":    { bg: "#FAEEDA", fg: "#854F0B" },
  "Envoyée":      { bg: "#E6F1FB", fg: "#0C447C" },
  "Reçue":        { bg: "#E6F1FB", fg: "#0C447C" },
};

const BARRES = { CDI: "#378ADD", CDD: "#5DCAA5", Alternance: "#AFA9EC", Stage: "#F0997B" };

/* ================================================================
   TUILES — id "attestation" est câblée (ATT-01), les autres en démo
   ================================================================ */
/* Option contractuelle requise par tuile (opt-in) — les tuiles sans entrée
   (démos formation/sécurité) restent librement accessibles. */
const OPTION_TUILE = { attestation: "attestation", acompte: "acompte", embauche: "embauche" };

const TUILES = [
  { id: "embauche", titre: "Embauche", sous: "Contrat + DPAE", icone: FileText, cablee: true },
  { id: "attestation", titre: "Attestation", sous: "Attestation employeur", icone: Award, cablee: true },
  { id: "acompte", titre: "Acompte", sous: "Demande d'acompte", icone: Banknote, cablee: true },
  { id: "formation", titre: "Formation", sous: "Demande de formation", icone: GraduationCap,
    cible: "Hors catalogue v1 — démo",
    champs: [
      { k: "salarie", l: "Salarié", large: true },
      { k: "intitule", l: "Intitulé", large: true },
      { k: "organisme", l: "Organisme" },
      { k: "date", l: "Date souhaitée", type: "date" },
    ] },
  { id: "securite", titre: "Sécurité", sous: "DUERP, registres", icone: ShieldCheck,
    cible: "Hors catalogue v1 — démo",
    champs: [
      { k: "type", l: "Document", type: "select", opts: ["DUERP", "Registre du personnel", "Registre sécurité", "Affichage obligatoire"], large: true },
      { k: "commentaire", l: "Commentaire", large: true },
    ] },
];

/* ================================================================
   PETITS COMPOSANTS
   ================================================================ */
const Badge = ({ s }) => {
  const c = STATUTS[s] || { bg: "#F1EFE8", fg: "#444441" };
  return <span style={{ background: c.bg, color: c.fg, fontSize: 11, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{s}</span>;
};

const Kpi = ({ label, val, warn, icon: Icon }) => (
  <div className="osrh-kpi" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.mut, marginBottom: 8 }}>
      {Icon && (
        <span style={{ width: 26, height: 26, borderRadius: 8, background: warn ? "#FAEEDA" : "#E6F1FB", color: warn ? "#854F0B" : T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} />
        </span>
      )}
      {label}
    </div>
    <div className="osrh-kpi-val" style={{ fontSize: 26, fontWeight: 600, color: warn ? "#B45309" : T.ink, fontFamily: T.serif }}>{val}</div>
  </div>
);

const Btn = ({ children, primary, onClick, small, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: primary ? T.accent : T.card,
      color: primary ? "#fff" : T.ink,
      border: `1px solid ${primary ? T.accent : T.border}`,
      borderRadius: 8, padding: small ? "5px 10px" : "8px 14px",
      fontSize: small ? 12 : 13, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.5 : 1, fontFamily: T.sans,
    }}
  >
    {children}
  </button>
);

const inputStyle = {
  border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 13, outline: "none", background: "#fff", color: T.ink,
  fontFamily: T.sans, width: "100%", boxSizing: "border-box",
};
const inputInvalid = { ...inputStyle, border: `1px solid ${T.err}` };

/* ================================================================
   APPLICATION
   ================================================================ */
export default function AppShell({ user, onLogout }) {
  const [vue, setVue] = useState("dash");
  const [tuile, setTuile] = useState(null);
  const [dossierActif, setDossierActif] = useState("Contrats");
  const [db, setDb] = useState(null);
  const [toast, setToast] = useState(null);
  // moi : { client, raisonSociale } résolu par l'API, { bloque } si compte
  // non rattaché, { client: CODE_CLIENT } en repli dev local (API absente).
  const [moi, setMoi] = useState(null);
  // stats : KPI réels par client (/api/dashboard) ; null = repli démo (dev local).
  const [stats, setStats] = useState(null);
  // docs : documents réels (/api/documents) ; { demo } = maquette dev local.
  const [docs, setDocs] = useState(null);

  const prenom = user?.givenName || (user?.displayName || "").split(" ")[0] || "";
  const initiales = (user?.displayName || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    latence(500).then(() => setDb(JSON.parse(JSON.stringify(seed))));
    apiFetch("/api/me")
      .then(async (r) => {
        if (r.ok) return setMoi(await r.json());
        if (r.status === 401 || r.status === 403) {
          const e = await r.json().catch(() => ({}));
          return setMoi({ bloque: e.erreur || `Accès refusé (HTTP ${r.status}).`, code: r.status });
        }
        // Panne API : on N'ENTRE PAS avec un client de repli (affichage
        // trompeur). Le verrou serveur bloquerait de toute façon les envois.
        setMoi({ bloque: `Service momentanément indisponible (HTTP ${r.status}) — réessayez dans quelques minutes.`, code: r.status });
      })
      .catch(() => {
        // Échec réseau : API absente en dev local (mode démo assumé) ;
        // en production, indisponibilité réelle → écran d'attente.
        if (import.meta.env.DEV) return setMoi({ client: CODE_CLIENT, demo: true });
        setMoi({ bloque: "Service momentanément indisponible — vérifiez votre connexion et réessayez.", code: 0 });
      });
    // KPI réels — en cas d'échec on reste sur la maquette de démonstration
    apiFetch("/api/dashboard")
      .then(async (r) => { if (r.ok) setStats(await r.json()); })
      .catch(() => {});
    // Documents réels — maquette uniquement en dev local, message en prod
    apiFetch("/api/documents")
      .then(async (r) => {
        if (r.ok) return setDocs(await r.json());
        const e = await r.json().catch(() => ({}));
        setDocs(import.meta.env.DEV ? { demo: true } : { erreur: e.erreur || `Documents indisponibles (HTTP ${r.status}).` });
      })
      .catch(() => setDocs(import.meta.env.DEV ? { demo: true } : { erreur: "Documents momentanément indisponibles — réessayez." }));
  }, []);

  /* Téléchargement via l'API (jeton + contrôle d'appartenance côté serveur),
     puis déclenchement du « Enregistrer sous » du navigateur. */
  const telechargerDoc = async (d) => {
    try {
      const r = await apiFetch(`/api/document?id=${encodeURIComponent(d.id)}`);
      if (!r.ok) { notifier("Téléchargement refusé — rechargez la page et réessayez."); return; }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = d.nom;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { notifier("Téléchargement impossible — vérifiez votre connexion."); }
  };

  const notifier = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  /* Écriture DÉMO pour les tuiles non câblées */
  const enregistrerDemo = async (tuileId, f) => {
    await latence(400);
    const ts = new Date().toISOString();
    setDb((d) => {
      const n = { ...d };
      if (tuileId === "contrat") {
        n.contrats = [{ id: Date.now(), ...f, statut: "Brouillon", ts }, ...d.contrats];
        n.repartition = { ...d.repartition, [f.type]: (d.repartition[f.type] || 0) + 1 };
        n.embauchesParMois = d.embauchesParMois.map((x, i) =>
          i === d.embauchesParMois.length - 1 ? { ...x, n: x.n + 1 } : x
        );
      } else if (tuileId === "dpae") {
        n.dpae = [{ id: Date.now(), ...f, statut: "À traiter", ts }, ...d.dpae];
      }
      return n;
    });
    setTuile(null);
    notifier("Enregistré (démo locale — démarche pas encore câblée)");
  };

  const deposerFichierDemo = async () => {
    await latence();
    setDb((d) => ({
      ...d,
      documents: [{ id: Date.now(), nom: `Document_${Date.now().toString().slice(-4)}.pdf`, dossier: dossierActif, modif: new Date().toISOString().slice(0, 10), par: user?.displayName || "Utilisateur" }, ...d.documents],
    }));
    notifier(`Fichier déposé dans ${dossierActif} (démo)`);
  };

  const aTraiter = useMemo(() => {
    if (!db) return [];
    return [
      ...db.dpae.filter((x) => x.statut === "À traiter").map((x) => ({
        t: `DPAE ${x.nom} ${x.prenom} — embauche le ${x.debut?.split("-").reverse().join("/")}`, s: "À traiter",
      })),
      ...db.contrats.filter((c) => c.statut === "En relecture").map((c) => ({
        t: `Contrat ${c.nom} ${c.prenom} — en relecture`, s: "En relecture",
      })),
      ...db.contrats.filter((c) => c.statut === "Brouillon").map((c) => ({
        t: `Contrat ${c.nom} ${c.prenom} — brouillon à finaliser`, s: "Brouillon",
      })),
    ];
  }, [db]);

  /* 401 : la session côté API n'est pas exploitable — on propose de se
     reconnecter. 403 : compte valide mais non rattaché — c'est le début
     du parcours d'onboarding, on affiche le formulaire de demande d'accès. */
  if (moi?.bloque && moi.code !== 403) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 30px", maxWidth: 460, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#FAEEDA", color: "#854F0B", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <AlertCircle size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>
            {moi.code === 401 ? "Reconnexion nécessaire" : "Service momentanément indisponible"}
          </h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5, color: T.ink }}>
            Compte : <strong>{user?.email}</strong>
          </p>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: T.mut }}>{moi.bloque}</p>
          {moi.code === 401 ? (
            <Btn primary onClick={onLogout}><LogOut size={14} /> Se reconnecter</Btn>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
              <Btn onClick={onLogout}><LogOut size={14} /> Se déconnecter</Btn>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (moi?.bloque && moi.code === 403) {
    return <DemandeAcces user={user} onLogout={onLogout} />;
  }

  if (!db) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans, color: T.mut, fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  const codeClient = moi?.client || CODE_CLIENT;

  const totalContrats = Object.values(db.repartition).reduce((a, b) => a + b, 0);
  const maxMois = Math.max(...db.embauchesParMois.map((x) => x.n), 1);
  const embauches2026 = db.embauchesParMois.reduce((a, x) => a + x.n, 0);
  const dpaeATraiter = db.dpae.filter((x) => x.statut === "À traiter").length;

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button
      className="osrh-navbtn"
      onClick={() => { setVue(id); setTuile(null); }}
      style={{
        all: "unset", cursor: "pointer", padding: "11px 20px", fontSize: 13.5,
        display: "flex", alignItems: "center", gap: 10, fontFamily: T.sans,
        background: vue === id ? "rgba(127,176,232,0.16)" : "transparent",
        borderLeft: vue === id ? `3px solid ${T.accentSoft}` : "3px solid transparent",
        color: vue === id ? "#E8EDF5" : "#9FB2C9",
      }}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="osrh-racine" style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      {/* Adaptation mobile : les media queries ci-dessous priment (via
          !important) sur les styles inline pensés pour l'écran large.
          ≤ 760 px : la barre latérale devient une barre de navigation
          horizontale collante, grilles et formulaires passent en 1 colonne. */}
      <style>{`
        /* Tableau de bord : grille à zones nommées.
           < 1500 px : 2 rangées (graphiques / listes) — ≥ 1500 px : 3 cartes
           en rangée du milieu, « À traiter » pleine largeur. */
        .osrh-dashgrid { display: grid; gap: 14px; grid-template-columns: repeat(6, 1fr); align-items: stretch;
          grid-template-areas: "rep rep rep mois mois mois" "tra tra tra tra pro pro"; }
        .osrh-b-rep { grid-area: rep; } .osrh-b-mois { grid-area: mois; }
        .osrh-b-pro { grid-area: pro; } .osrh-b-tra { grid-area: tra; }
        @media (min-width: 1500px) {
          .osrh-dashgrid { grid-template-areas: "rep rep mois mois pro pro" "tra tra tra tra tra tra"; }
          .osrh-main { padding: 34px 44px !important; }
          .osrh-kpi { padding: 18px 20px !important; }
          .osrh-kpi-val { font-size: 30px !important; }
          .osrh-carte h2 { font-size: 15px; }
          .osrh-barres { height: 170px !important; }
          .osrh-tuilegrid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important; grid-auto-rows: minmax(260px, 330px) !important; }
          .osrh-tuile { padding: 32px 20px !important; }
        }
        @media (max-width: 760px) {
          .osrh-dashgrid { grid-template-columns: 1fr; grid-template-areas: "rep" "mois" "pro" "tra"; }
          .osrh-tuilegrid { min-height: 0 !important; grid-auto-rows: auto !important; }
          .osrh-tuile { padding: 20px 16px !important; }
        }
        .osrh-kpi { transition: transform .15s, box-shadow .15s; }
        .osrh-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(6,24,64,0.07); }
        .osrh-tuile { transition: transform .15s, box-shadow .15s, border-color .15s !important; }
        .osrh-tuile:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(6,24,64,0.08); }
        /* Focus clavier visible partout — !important requis : les boutons
           utilisent all:unset en inline, qui neutralise l'outline. */
        .osrh-racine :focus-visible { outline: 2px solid #1668D9 !important; outline-offset: 2px; }
        @media (max-width: 760px) {
          .osrh-racine { flex-direction: column !important; }
          .osrh-aside { width: 100% !important; flex-direction: row !important; align-items: center !important; padding: 10px 14px !important; position: sticky; top: 0; z-index: 40; gap: 2px; overflow-x: auto; }
          .osrh-logo { padding: 0 12px 0 0 !important; font-size: 17px !important; white-space: nowrap; }
          .osrh-navbtn { padding: 9px 10px !important; border-left: none !important; border-radius: 8px !important; white-space: nowrap !important; flex-shrink: 0 !important; }
          .osrh-user { margin: 0 0 0 auto !important; padding: 0 0 0 10px !important; border-top: none !important; }
          .osrh-user-info { display: none !important; }
          .osrh-user-label { display: none !important; }
          .osrh-main { padding: 18px 14px !important; }
          .osrh-grille2 { grid-template-columns: 1fr !important; }
          .osrh-form { grid-template-columns: 1fr !important; }
          .osrh-table { overflow-x: auto !important; }
          .osrh-table > div { min-width: 540px; }
        }
      `}</style>

      {/* ---------- BARRE LATÉRALE (barre du haut sur mobile) ---------- */}
      <aside className="osrh-aside" style={{ width: 224, flexShrink: 0, background: T.navy, display: "flex", flexDirection: "column", paddingTop: 24 }}>
        <div className="osrh-logo" style={{ padding: "0 20px 26px", fontFamily: T.serif, fontSize: 19, color: "#fff" }}>
          Osmose <span style={{ fontStyle: "italic", color: T.accentSoft }}>RH</span>
        </div>
        <NavBtn id="dash" icon={ChartBar} label="Tableau de bord" />
        <NavBtn id="prod" icon={FileText} label="Production" />
        <NavBtn id="docs" icon={Folder} label="Documents" />
        <div className="osrh-user" style={{ marginTop: "auto", padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="osrh-user-info" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentSoft, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{initiales}</div>
            <div style={{ fontSize: 11.5, color: "#9FB2C9", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.displayName}<br />{moi?.raisonSociale || codeClient}
            </div>
          </div>
          <button onClick={onLogout} title="Se déconnecter" style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9FB2C9", fontFamily: T.sans, padding: 4 }}>
            <LogOut size={15} /> <span className="osrh-user-label">Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* ---------- CONTENU ---------- */}
      {/* Colonne de contenu centrée : plafond 1360 px, marges auto — sur
          grand écran le contenu occupe le cœur de la page au lieu de
          rester collé à la barre latérale. */}
      {/* Pleine largeur avec gouttières : les grilles habitent l'écran.
          Garde-fou 2240 px : rempli sur un 2560, borné sur les ultra-larges. */}
      <main className="osrh-main" style={{ flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", padding: "26px 32px", maxWidth: 2240, margin: "0 auto" }}>

        {/* ===== TABLEAU DE BORD ===== */}
        {vue === "dash" && (() => {
          /* KPI réels (/api/dashboard) quand disponibles, maquette sinon (dev
             local). Un bloc null = option non souscrite : ni carte ni graphique. */
          const emb = stats ? stats.embauches : null;
          const rep = stats ? (emb?.repartition || {}) : db.repartition;
          const totalRep = Object.values(rep).reduce((a, b) => a + b, 0) || 1;
          const mois = stats ? (emb?.parMois || []) : db.embauchesParMois;
          const maxM = Math.max(...mois.map((x) => x.n), 1);
          const enAttente = stats ? stats.aTraiter : aTraiter;
          /* Prochaines embauches : calculées par l'API (dates de début à
             venir) ; en démo locale, dérivées des contrats de la maquette. */
          const prochaines = stats
            ? (emb?.prochaines || [])
            : db.contrats.slice(0, 3).map((x) => ({ nom: x.nom, prenom: x.prenom, type: x.type, debut: x.debut }));
          const avecGraphiques = !stats || !!emb;
          const kpis = stats ? [
            ...(emb ? [{ label: "Embauches en attente", val: emb.enAttente, warn: emb.enAttente > 0, icon: Users }] : []),
            ...(stats.acomptes ? [
              { label: "Acomptes à traiter", val: stats.acomptes.enAttente, warn: stats.acomptes.enAttente > 0, icon: Banknote },
              { label: "Montant acomptes (€)", val: stats.acomptes.montantEnAttente, icon: Clock },
            ] : []),
            ...(stats.attestations ? [{ label: "Attestations ce mois-ci", val: stats.attestations.moisCourant, icon: FileText }] : []),
          ] : [
            { label: "Effectif", val: db.effectif, icon: Users },
            { label: "Embauches 2026", val: embauches2026, icon: FileText },
            { label: "DPAE à traiter", val: dpaeATraiter, warn: dpaeATraiter > 0, icon: Clock },
            { label: "Documents", val: db.documents.length, icon: Folder },
          ];
          return (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Bonjour {prenom}</h1>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Tableau de bord — {moi?.raisonSociale || codeClient}</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {kpis.map((k) => <Kpi key={k.label} label={k.label} val={k.val} warn={k.warn} icon={k.icon} />)}
              {kpis.length === 0 && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: T.mut }}>
                  Aucune option active sur votre contrat — contactez votre gestionnaire Osmose RH pour ouvrir vos démarches.
                </div>
              )}
            </div>

            {/* Grille unique aux zones nommées : la disposition change par
                media query (voir <style>) — 2 rangées classiques sous 1500 px,
                3 colonnes + « À traiter » pleine largeur au-delà. */}
            {avecGraphiques ? (
            <div className="osrh-dashgrid">
              <div className="osrh-b-rep osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 14, fontFamily: T.serif }}>Répartition des contrats</h2>
                {Object.keys(rep).length === 0 && (
                  <p style={{ fontSize: 12.5, color: T.mut, margin: 0 }}>Aucune embauche déclarée pour l'instant.</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(rep).map(([type, n]) => (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span>{type}</span><span style={{ color: T.mut }}>{n}</span>
                      </div>
                      <div style={{ height: 8, background: T.bg, borderRadius: 4 }}>
                        <div style={{ width: `${Math.round((n / totalRep) * 100)}%`, height: 8, background: BARRES[type] || T.accentSoft, borderRadius: 4, transition: "width .4s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="osrh-b-mois osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 14, fontFamily: T.serif }}>Embauches par mois</h2>
                <div className="osrh-barres" style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
                  {mois.map((x, i) => (
                    <div key={x.m + i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: T.mut }}>{x.n}</span>
                      <div style={{ width: "100%", height: `${Math.max(5, (x.n / maxM) * 72)}%`, background: i >= mois.length - 2 ? "#378ADD" : "#B5D4F4", borderRadius: "3px 3px 0 0", transition: "height .4s" }} />
                      <span style={{ fontSize: 11, color: T.mut }}>{x.m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="osrh-b-pro osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, alignSelf: "start" }}>
                <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>Prochaines embauches</div>
                {prochaines.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Aucune embauche planifiée.</div>
                )}
                {prochaines.map((x, i) => (
                  <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: i < prochaines.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>{(x.nom || "").toUpperCase()} {x.prenom}</strong>
                      <span style={{ color: T.mut }}> — {x.type}</span>
                    </span>
                    <span style={{ fontSize: 12, color: T.mut, flexShrink: 0 }}>
                      {String(x.debut).slice(0, 10).split("-").reverse().join("/")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="osrh-b-tra osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, alignSelf: "start" }}>
                <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>À traiter</div>
                {enAttente.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Rien en attente — tout est à jour.</div>
                )}
                {enAttente.map((a, i) => (
                  <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: i < enAttente.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertCircle size={15} color="#BA7517" style={{ flexShrink: 0 }} /> {a.t}
                    </span>
                    <Badge s={a.s} />
                  </div>
                ))}
              </div>
            </div>
            ) : (
            <div className="osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
              <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>À traiter</div>
              {enAttente.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Rien en attente — tout est à jour.</div>
              )}
              {enAttente.map((a, i) => (
                <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: i < enAttente.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={15} color="#BA7517" style={{ flexShrink: 0 }} /> {a.t}
                  </span>
                  <Badge s={a.s} />
                </div>
              ))}
            </div>
            )}

            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut }}>
              <ShieldCheck size={13} />
              {stats
                ? "Indicateurs calculés en direct depuis vos démarches — données hébergées en Europe, conformes RGPD"
                : "Données de démonstration — connectez-vous en production pour vos indicateurs réels"}
            </div>
          </>
          );
        })()}

        {/* ===== PRODUCTION ===== */}
        {vue === "prod" && !tuile && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Production</h1>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Choisissez une démarche</p>

            {/* Grands panneaux à hauteur BORNÉE : auto-fit étire en largeur,
                les rangées vont de 230 à 300 px (une rangée unique sur très
                grand écran ne doit pas s'étirer sur toute la page).
                Compact sur mobile (voir media query). */}
            <div className="osrh-tuilegrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, gridAutoRows: "auto" }}>
              {TUILES.map((t) => {
                const Icone = t.icone;
                /* Opt-in contractuel : tuile grisée si l'option n'est pas
                   souscrite (le refus réel est côté API — ceci n'est que
                   l'affichage). moi absent (dev local) = tout ouvert. */
                const opt = OPTION_TUILE[t.id];
                const inclus = !opt || !moi?.options || moi.options.includes(opt);
                return (
                  <button
                    key={t.id}
                    className="osrh-tuile"
                    onClick={() => inclus ? setTuile(t) : notifier("Option non incluse dans votre contrat — parlez-en à votre gestionnaire Osmose RH.")}
                    style={{
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
                      padding: "26px 18px", cursor: "pointer", textAlign: "center",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                      fontFamily: T.sans, transition: "border-color .15s", position: "relative",
                      opacity: inclus ? 1 : 0.45,
                    }}
                    onMouseEnter={(e) => { if (inclus) e.currentTarget.style.borderColor = T.accent; }}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
                  >
                    {t.cablee && inclus && (
                      <span style={{ position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: "50%", background: T.ok }} title="Démarche active" />
                    )}
                    <span style={{ width: 62, height: 62, borderRadius: 16, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icone size={30} color={T.accent} strokeWidth={1.6} />
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>{t.titre}</span>
                    <span style={{ fontSize: 12.5, color: T.mut }}>{t.sous}</span>
                    {!inclus && (
                      <span style={{ fontSize: 10.5, color: T.mut, fontStyle: "italic" }}>Option non incluse</span>
                    )}
                  </button>
                );
              })}
            </div>

          </>
        )}

        {/* Formulaires : largeur volontairement contenue (~560 px, un champ
            trop large se lit mal) mais CENTRÉE dans la zone de contenu. */}
        {vue === "prod" && tuile && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {tuile.id === "attestation" && (
              <AttestationEmployeur user={user} client={codeClient} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "acompte" && (
              <DemandeAcompte user={user} client={codeClient} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "embauche" && (
              <DemandeEmbauche user={user} client={codeClient} onRetour={() => setTuile(null)} />
            )}
            {!tuile.cablee && (
              <FormulaireTuile tuile={tuile} onRetour={() => setTuile(null)} onSave={(f) => enregistrerDemo(tuile.id, f)} />
            )}
          </div>
        )}

        {/* ===== DOCUMENTS ===== */}
        {vue === "docs" && (() => {
          /* Documents RÉELS (bibliothèque « Documents clients », dossier du
             client résolu) — la maquette ne subsiste qu'en dev local. */
          if (docs === null || docs.demo) {
            return (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
                <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>
                  {docs === null ? "Chargement de vos documents…" : "Maquette de démonstration (dev local)"}
                </p>
                {docs?.demo && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {DOSSIERS.map((f) => (
                      <button key={f} onClick={() => setDossierActif(f)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          border: `1px solid ${dossierActif === f ? T.accent : T.border}`,
                          background: dossierActif === f ? "#E6F1FB" : T.card,
                          color: dossierActif === f ? "#0C447C" : T.ink,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: T.sans,
                        }}>
                        <Folder size={15} color={dossierActif === f ? T.accent : T.mut} /> {f}
                        <span style={{ fontSize: 11, color: T.mut }}>
                          {db.documents.filter((d) => d.dossier === f).length}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {docs?.demo && (
                  <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                    {db.documents.filter((d) => d.dossier === dossierActif).map((d) => (
                      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 90px", gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={15} color={T.mut} /> {d.nom}</span>
                        <span style={{ color: T.mut }}>{d.modif.split("-").reverse().join("/")}</span>
                        <span style={{ color: T.mut }}><Download size={16} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          }
          if (docs.erreur) {
            return (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
                <p style={{ margin: "12px 0", fontSize: 13, color: T.mut }}>{docs.erreur}</p>
                <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
              </>
            );
          }
          const reels = docs.documents || [];
          const ordre = ["Attestations", "Contrats", "Paie", "Général"];
          const cats = [...new Set(reels.map((d) => d.categorie))]
            .sort((a, b) => (ordre.indexOf(a) + 99 * (ordre.indexOf(a) < 0)) - (ordre.indexOf(b) + 99 * (ordre.indexOf(b) < 0)));
          const catActive = cats.includes(dossierActif) ? dossierActif : cats[0];
          const visibles = reels.filter((d) => d.categorie === catActive);
          const taille = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
          return (
            <>
              <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
              <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>
                Vos documents — déposés par votre gestionnaire ou générés par vos démarches.
              </p>

              {reels.length === 0 && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
                  Aucun document pour l'instant.<br />
                  Vos attestations et contrats générés apparaîtront ici automatiquement.
                </div>
              )}

              {reels.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {cats.map((f) => (
                      <button key={f} onClick={() => setDossierActif(f)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          border: `1px solid ${catActive === f ? T.accent : T.border}`,
                          background: catActive === f ? "#E6F1FB" : T.card,
                          color: catActive === f ? "#0C447C" : T.ink,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: T.sans,
                        }}>
                        <Folder size={15} color={catActive === f ? T.accent : T.mut} /> {f}
                        <span style={{ fontSize: 11, color: T.mut }}>{reels.filter((d) => d.categorie === f).length}</span>
                      </button>
                    ))}
                  </div>

                  <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 110px", gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                      <span>Nom</span><span>Modifié</span><span>Taille</span><span>Action</span>
                    </div>
                    {visibles.map((d) => (
                      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 110px", gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <FileText size={15} color={T.mut} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nom}</span>
                        </span>
                        <span style={{ color: T.mut }}>{String(d.modifie).slice(0, 10).split("-").reverse().join("/")}</span>
                        <span style={{ color: T.mut }}>{taille(d.taille)}</span>
                        <Btn small onClick={() => telechargerDoc(d)}>
                          <Download size={13} /> Télécharger
                        </Btn>
                      </div>
                    ))}
                    {visibles.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.mut }}>Dossier vide.</div>
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </main>

      {/* ---------- TOAST ---------- */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.navy, color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 13, zIndex: 60, fontFamily: T.sans }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   ATT-01 — ATTESTATION EMPLOYEUR (câblée sur /api/demande)
   Reprend à l'identique le formulaire du portail public :
   mêmes champs, mêmes validations, même payload, même écran
   de confirmation, même mode démo si l'API est injoignable.
   Différences app authentifiée : email pré-rempli (compte
   Microsoft), client = CODE_CLIENT (pas de paramètre d'URL).
   ================================================================ */
function AttestationEmployeur({ user, client, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    civilite: "", nom: "", naissance: "", entree: "", poste: "", contrat: "",
    format: "PDF",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref, demo }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const e = {
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()),
      civilite: !f.civilite,
      nom: f.nom.trim().length < 3,
      naissance: !f.naissance,
      entree: !f.entree || new Date(f.entree) > new Date(),
      poste: f.poste.trim().length < 2,
      contrat: !f.contrat,
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");

    const payload = {
      demarche: "attestation-employeur",
      client, // indicatif : l'API impose le client résolu côté serveur
      email: f.email.trim(),
      civilite: f.civilite,
      nomSalarie: f.nom.trim(),
      dateNaissance: f.naissance,
      dateEntree: f.entree,
      poste: f.poste.trim(),
      typeContrat: f.contrat,
      formatSouhaite: f.format, // "PDF" | "Word" — format du document généré par le flux
      xq_note: "", // honeypot : doit rester vide
    };

    let ref = null, demo = false;
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        // L'API a répondu mais refuse : on AFFICHE l'erreur, jamais un faux succès
        let msg = "HTTP " + r.status;
        try { const e = await r.json(); if (e.erreur) msg = `${e.erreur} (HTTP ${r.status})`; } catch (_) {}
        if (r.status === 404) msg = "API /api/demande introuvable (404) — vérifier api_location dans le workflow GitHub.";
        setErrbar(msg);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      ref = j.reference || null;
    } catch (_) {
      // Aucune réponse (dev local sans API) : parcours sans envoi réel
      demo = true;
    }

    setFini({ ref, demo });
  };

  /* Les champs utilisent ChampReq (défini au niveau module) : un composant
     défini ICI serait recréé à chaque frappe et ferait perdre le focus. */

  /* ---------- Écran de confirmation ---------- */
  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Demande transmise</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            Votre demande d'attestation pour <strong>{f.civilite} {f.nom.trim()}</strong> est prise en charge.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Vous recevrez le document en PDF à <strong>{f.email.trim()}</strong> après validation par votre gestionnaire.
          </p>
          {fini.ref && (
            <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>
          )}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  /* ---------- Formulaire ---------- */
  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Award size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Attestation employeur</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — traitée après validation par votre gestionnaire.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Votre email (accusé et réception du document) <span style={{ color: T.err }}>*</span></label>
            <input style={err.email ? inputInvalid : inputStyle} value={f.email} onChange={(e) => maj("email", e.target.value)} />
            {err.email && <span style={{ fontSize: 11, color: T.err }}>Email invalide.</span>}
          </div>

          <ChampReq label="Civilité" erreur={err.civilite && "Champ requis."}>
            <select style={err.civilite ? inputInvalid : inputStyle} value={f.civilite} onChange={(e) => maj("civilite", e.target.value)}>
              <option value="">—</option>
              <option>Madame</option>
              <option>Monsieur</option>
            </select>
          </ChampReq>

          <ChampReq label="Nom et prénom du salarié" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. Sofia Marques" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Date de naissance" erreur={err.naissance && "Date requise."}>
            <input type="date" max="2010-12-31" style={err.naissance ? inputInvalid : inputStyle} value={f.naissance} onChange={(e) => maj("naissance", e.target.value)} />
          </ChampReq>

          <ChampReq label="Date d'entrée" erreur={err.entree && "La date d'entrée ne peut pas être future."}>
            <input type="date" style={err.entree ? inputInvalid : inputStyle} value={f.entree} onChange={(e) => maj("entree", e.target.value)} />
          </ChampReq>

          <ChampReq label="Intitulé du poste" erreur={err.poste && "Champ requis."}>
            <input style={err.poste ? inputInvalid : inputStyle} placeholder="Ex. Agent de service" value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
          </ChampReq>

          <ChampReq label="Type de contrat" erreur={err.contrat && "Champ requis."}>
            <select style={err.contrat ? inputInvalid : inputStyle} value={f.contrat} onChange={(e) => maj("contrat", e.target.value)}>
              <option value="">—</option>
              <option>contrat à durée indéterminée (CDI)</option>
              <option>contrat à durée déterminée (CDD)</option>
            </select>
          </ChampReq>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Format du document</label>
            <select style={inputStyle} value={f.format} onChange={(e) => maj("format", e.target.value)}>
              <option value="PDF">PDF (recommandé — non modifiable)</option>
              <option value="Word">Word (.docx)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Envoyer la demande"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Un accusé de traitement vous sera adressé. Données traitées par Osmose RH dans le cadre de la mission confiée par votre entreprise.
        </p>
      </div>
    </>
  );
}

/* ================================================================
   ACP-01 — DEMANDE D'ACOMPTE (câblée sur /api/demande)
   Champs alignés colonne à colonne sur la liste SharePoint
   « Acompte » (site RH) : Matricule (nombre), Nom, Prénom,
   Montant demandé (nombre). « Date de demande » et
   « Statut » (Nouveau → Traité) sont posés par le flux ;
   « Title » reçoit la référence ACOMPTE-… générée par l'API.
   Même contrat que ATT-01 : /api/demande, honeypot, erreurs
   affichées, mode démo si l'API est injoignable en dev local.
   Variable à configurer sur la Static Web App : FLOW_URL_ACOMPTE.
   ================================================================ */

/* Champ requis avec message d'erreur — défini au niveau module
   (un composant défini DANS le rendu serait remonté à chaque frappe
   et ferait perdre le focus de l'input). */
const ChampReq = ({ label, erreur, large, children }) => (
  <div style={{ gridColumn: large ? "1 / -1" : "auto", display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 12, color: T.mut }}>{label} <span style={{ color: T.err }}>*</span></label>
    {children}
    {erreur && <span style={{ fontSize: 11, color: T.err }}>{erreur}</span>}
  </div>
);

function DemandeAcompte({ user, client, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    nom: "", prenom: "", matricule: "", montant: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref, demo }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const e = {
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()),
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      matricule: !/^\d{1,10}$/.test(f.matricule.trim()),
      montant: !/^\d{1,5}([.,]\d{1,2})?$/.test(f.montant.trim()) || parseFloat(f.montant.trim().replace(",", ".")) <= 0,
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");

    const payload = {
      demarche: "acompte",
      client, // indicatif : l'API impose le client résolu côté serveur
      email: f.email.trim(),
      nom: f.nom.trim().toUpperCase(),
      prenom: f.prenom.trim(),
      matricule: f.matricule.trim(),          // colonne Matricule (nombre) : int(...) côté flux
      montant: f.montant.trim().replace(",", "."), // colonne Montant demandé (nombre) : float(...) côté flux
      xq_note: "", // honeypot : doit rester vide
    };

    let ref = null, demo = false;
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        let msg = "HTTP " + r.status;
        try { const e = await r.json(); if (e.erreur) msg = `${e.erreur} (HTTP ${r.status})`; } catch (_) {}
        if (r.status === 404) msg = "API /api/demande introuvable (404) — vérifier api_location dans le workflow GitHub.";
        setErrbar(msg);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      ref = j.reference || null;
    } catch (_) {
      demo = true;
    }

    setFini({ ref, demo });
  };

  /* ---------- Écran de confirmation ---------- */
  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Demande transmise</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            Demande d'acompte de <strong>{f.montant.trim().replace(".", ",")} €</strong> pour <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim()}</strong> (matricule {f.matricule.trim()}).
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Elle sera traitée par votre gestionnaire ; un accusé sera adressé à <strong>{f.email.trim()}</strong>.
          </p>
          {fini.ref && (
            <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>
          )}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  /* ---------- Formulaire ---------- */
  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Banknote size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Demande d'acompte</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — versée après validation par votre gestionnaire.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq large label="Votre email (accusé de traitement)" erreur={err.email && "Email invalide."}>
            <input style={err.email ? inputInvalid : inputStyle} value={f.email} onChange={(e) => maj("email", e.target.value)} />
          </ChampReq>

          <ChampReq label="Nom du salarié" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. MARQUES" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Prénom du salarié" erreur={err.prenom && "Champ requis."}>
            <input style={err.prenom ? inputInvalid : inputStyle} placeholder="Ex. Sofia" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Matricule" erreur={err.matricule && "Matricule numérique attendu."}>
            <input inputMode="numeric" style={err.matricule ? inputInvalid : inputStyle} placeholder="Ex. 600138" value={f.matricule} onChange={(e) => maj("matricule", e.target.value)} />
          </ChampReq>

          <ChampReq label="Montant demandé (€)" erreur={err.montant && "Montant invalide (ex. 150 ou 113,35)."}>
            <input inputMode="decimal" style={err.montant ? inputInvalid : inputStyle} placeholder="Ex. 150" value={f.montant} onChange={(e) => maj("montant", e.target.value)} />
          </ChampReq>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Envoyer la demande"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Un accusé de traitement vous sera adressé. Données traitées par Osmose RH dans le cadre de la mission confiée par votre entreprise.
        </p>
      </div>
    </>
  );
}

/* ================================================================
   EMB-01 — EMBAUCHE (contrat + DPAE), câblée sur /api/demande
   Une seule déclaration du client alimente la production du contrat
   ET la DPAE : l'API écrit dans la liste « Production contrat » du
   site RH, dont le flux existant « Production contrat + AR » assure
   l'accusé, l'approbation (gestionnaire du client) et la génération.
   L'accusé part sur l'email du compte connecté — pas de champ email.
   ================================================================ */
function DemandeEmbauche({ user, client, onRetour }) {
  const [f, setF] = useState({
    type: "CDI", nom: "", prenom: "", naissance: "", lieuNaissance: "",
    nationalite: "", numeroSS: "", adresse: "", emailSalarie: "",
    telephone: "", debut: "", fin: "", poste: "", duree: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const ss = f.numeroSS.replace(/\s/g, "");
    const e = {
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      naissance: !f.naissance,
      lieuNaissance: f.lieuNaissance.trim().length < 2,
      nationalite: f.nationalite.trim().length < 2,
      numeroSS: !/^[12]\d{12}(\d{2})?$/.test(ss),
      adresse: f.adresse.trim().length < 8,
      debut: !f.debut,
      fin: f.type === "CDD" && (!f.fin || f.fin <= f.debut),
      poste: f.poste.trim().length < 2,
      duree: !/^\d{1,3}([.,]\d{1,2})?$/.test(f.duree.trim()) || parseFloat(f.duree.replace(",", ".")) <= 0,
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");
    const payload = {
      demarche: "embauche",
      client, // indicatif : l'API impose le client résolu côté serveur
      typeContrat: f.type,
      nom: f.nom.trim(),
      prenom: f.prenom.trim(),
      dateNaissance: f.naissance,
      lieuNaissance: f.lieuNaissance.trim(),
      nationalite: f.nationalite.trim(),
      numeroSS: f.numeroSS.replace(/\s/g, ""),
      adressePostale: f.adresse.trim(),
      emailSalarie: f.emailSalarie.trim(),
      telephoneSalarie: f.telephone.trim(),
      dateDebut: f.debut,
      ...(f.type === "CDD" ? { dateFin: f.fin } : {}),
      poste: f.poste.trim(),
      dureeMensuelle: f.duree.trim().replace(",", "."),
      xq_note: "", // honeypot : doit rester vide
    };
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrbar(j.erreur ? `${j.erreur} (HTTP ${r.status})` : `HTTP ${r.status}`);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setFini({ ref: j.reference || null });
    } catch (_) {
      setFini({ demo: true });
    }
  };

  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Embauche déclarée</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            {f.type} pour <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim()}</strong>, début le <strong>{f.debut.split("-").reverse().join("/")}</strong>.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Votre gestionnaire prépare le contrat et la DPAE. Un accusé vous est adressé à <strong>{user?.email}</strong>.
          </p>
          {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <FileText size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Déclarer une embauche</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — votre gestionnaire produit le contrat et effectue la DPAE. Accusé envoyé à {user?.email}.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq label="Type de contrat">
            <select style={inputStyle} value={f.type} onChange={(e) => maj("type", e.target.value)}>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
            </select>
          </ChampReq>

          {f.type === "CDD" ? (
            <ChampReq label="Date de fin (CDD)" erreur={err.fin && "Requise et postérieure au début."}>
              <input type="date" style={err.fin ? inputInvalid : inputStyle} value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
            </ChampReq>
          ) : <div />}

          <ChampReq label="Nom de naissance" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. MARQUES" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Prénom" erreur={err.prenom && "Champ requis."}>
            <input style={err.prenom ? inputInvalid : inputStyle} placeholder="Ex. Sofia" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Date de naissance" erreur={err.naissance && "Date requise."}>
            <input type="date" style={err.naissance ? inputInvalid : inputStyle} value={f.naissance} onChange={(e) => maj("naissance", e.target.value)} />
          </ChampReq>

          <ChampReq label="Lieu de naissance" erreur={err.lieuNaissance && "Champ requis."}>
            <input style={err.lieuNaissance ? inputInvalid : inputStyle} placeholder="Ex. Montpellier" value={f.lieuNaissance} onChange={(e) => maj("lieuNaissance", e.target.value)} />
          </ChampReq>

          <ChampReq label="Nationalité" erreur={err.nationalite && "Champ requis."}>
            <input style={err.nationalite ? inputInvalid : inputStyle} placeholder="Ex. Française" value={f.nationalite} onChange={(e) => maj("nationalite", e.target.value)} />
          </ChampReq>

          <ChampReq label="N° de sécurité sociale" erreur={err.numeroSS && "13 ou 15 chiffres, commençant par 1 ou 2."}>
            <input inputMode="numeric" style={err.numeroSS ? inputInvalid : inputStyle} placeholder="Ex. 2 90 05 34 172 118 90" value={f.numeroSS} onChange={(e) => maj("numeroSS", e.target.value)} />
          </ChampReq>

          <ChampReq large label="Adresse postale du salarié" erreur={err.adresse && "Adresse complète requise."}>
            <input style={err.adresse ? inputInvalid : inputStyle} placeholder="Ex. 12 rue des Lilas, 34000 Montpellier" value={f.adresse} onChange={(e) => maj("adresse", e.target.value)} />
          </ChampReq>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Email du salarié (facultatif)</label>
            <input style={inputStyle} value={f.emailSalarie} onChange={(e) => maj("emailSalarie", e.target.value)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Téléphone du salarié (facultatif)</label>
            <input inputMode="tel" style={inputStyle} value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          </div>

          <ChampReq label="Date de début" erreur={err.debut && "Date requise."}>
            <input type="date" style={err.debut ? inputInvalid : inputStyle} value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
          </ChampReq>

          <ChampReq label="Poste de travail" erreur={err.poste && "Champ requis."}>
            <input style={err.poste ? inputInvalid : inputStyle} placeholder="Ex. Agent de service" value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
          </ChampReq>

          <ChampReq label="Durée du travail (heures/mois)" erreur={err.duree && "Nombre d'heures invalide (ex. 151,67)."}>
            <input inputMode="decimal" style={err.duree ? inputInvalid : inputStyle} placeholder="Ex. 151,67" value={f.duree} onChange={(e) => maj("duree", e.target.value)} />
          </ChampReq>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Déclarer l'embauche"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Données transmises à votre gestionnaire Osmose RH pour l'établissement du contrat de travail et de la déclaration préalable à l'embauche (DPAE).
        </p>
      </div>
    </>
  );
}

/* ================================================================
   ONBOARDING — DEMANDE D'ACCÈS
   Affiché à la place du portail quand le compte connecté n'est
   rattaché à aucun client (403 sur /api/me). L'email vient du compte
   (vérifié) ; le gestionnaire traite la demande en ajoutant la ligne
   Email → CodeClient dans « Utilisateurs portail ».
   ================================================================ */
function DemandeAcces({ user, onLogout }) {
  const [f, setF] = useState({ nom: user?.displayName || "", entreprise: "", telephone: "", message: "" });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref } | { dejaEnCours: msg }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const envoyer = async () => {
    const e = { nom: f.nom.trim().length < 2, entreprise: f.entreprise.trim().length < 2 };
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    setEnvoi(true);
    setErrbar("");
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demarche: "acces",
          nom: f.nom.trim(),
          entreprise: f.entreprise.trim(),
          telephone: f.telephone.trim(),
          message: f.message.trim(),
          xq_note: "", // honeypot : doit rester vide
        }),
      });
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        setFini({ dejaEnCours: j.erreur || "Votre demande est déjà en cours de traitement." });
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrbar(j.erreur ? `${j.erreur} (HTTP ${r.status})` : `HTTP ${r.status}`);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setFini({ ref: j.reference || null });
    } catch (_) {
      setErrbar("API injoignable — réessayez dans un instant.");
      setEnvoi(false);
    }
  };

  const cadre = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans, padding: 20 };

  if (fini) {
    return (
      <div style={cadre}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "32px 28px", maxWidth: 480, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: fini.dejaEnCours ? "#E6F1FB" : "#E1F5EE", color: fini.dejaEnCours ? "#0C447C" : T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            {fini.dejaEnCours ? <Clock size={24} /> : <Check size={24} />}
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>
            {fini.dejaEnCours ? "Demande en cours" : "Demande transmise"}
          </h1>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            {fini.dejaEnCours || <>Votre gestionnaire Osmose RH va activer votre accès. Vous serez prévenu à <strong>{user?.email}</strong>, puis il suffira de vous reconnecter.</>}
          </p>
          {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
          <Btn onClick={onLogout}><LogOut size={14} /> Se déconnecter</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={cadre}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 26px", maxWidth: 480, width: "100%" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 21, fontFamily: T.serif, fontWeight: 600 }}>Bienvenue sur Osmose RH</h1>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.mut }}>
          Votre compte <strong>{user?.email}</strong> est créé. Dernière étape : demandez l'activation de votre accès — votre gestionnaire s'en charge rapidement.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq label="Votre nom complet" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Votre entreprise" erreur={err.entreprise && "Champ requis."}>
            <input style={err.entreprise ? inputInvalid : inputStyle} placeholder="Ex. ACME Propreté" value={f.entreprise} onChange={(e) => maj("entreprise", e.target.value)} />
          </ChampReq>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Téléphone (facultatif)</label>
            <input inputMode="tel" style={inputStyle} placeholder="Ex. 06 12 34 56 78" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Message (facultatif)</label>
            <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Ex. Contact RH de l'agence de Montpellier" value={f.message} onChange={(e) => maj("message", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button onClick={onLogout} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: T.mut, display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={13} /> Se déconnecter
          </button>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Demander l'accès"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   FORMULAIRE GÉNÉRIQUE (tuiles non câblées — démo locale)
   ================================================================ */
function FormulaireTuile({ tuile, onRetour, onSave }) {
  const [f, setF] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const Icone = tuile.icone;
  const ok = tuile.champs.every((c) => c.type === "select" ? true : (f[c.k] || "").trim() !== "");

  useEffect(() => {
    const init = {};
    tuile.champs.forEach((c) => { if (c.type === "select") init[c.k] = c.opts[0]; });
    setF(init);
  }, [tuile]);

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Icone size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>{tuile.titre}</h1>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: T.mut }}>{tuile.cible}</p>

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tuile.champs.map((c) => (
            <div key={c.k} style={{ gridColumn: c.large ? "1 / -1" : "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: T.mut }}>{c.l}</label>
              {c.type === "select" ? (
                <select style={inputStyle} value={f[c.k] || c.opts[0]} onChange={(e) => setF({ ...f, [c.k]: e.target.value })}>
                  {c.opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={c.type || "text"} style={inputStyle} value={f[c.k] || ""} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={!ok || envoi} onClick={async () => { setEnvoi(true); await onSave(f); }}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Btn>
        </div>
      </div>
    </>
  );
}
