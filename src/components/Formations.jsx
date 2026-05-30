import React, { useState, useMemo } from "react";

/**
 * Page Formations — Synapse RH
 * Même thème que Conges.jsx / Home.jsx
 *
 * Props:
 *  - user:          { displayName, givenName, tenantLabel, email }
 *  - catalogue:     Array<Formation>   (données serveur / mock)
 *  - inscriptions:  Array<Inscription> (formations où l'utilisateur est inscrit)
 *  - onNavigate:    (route: string) => void
 *  - onLogout:      () => void
 *  - onInscrire:    (formationId: string) => Promise|void
 *  - onDesinscrire: (inscriptionId: string) => Promise|void
 *
 * Types :
 *   Formation     { id, titre, description, theme, format, dureeH, date, lieu, places, placesDispos, niveau, obligatoire }
 *   Inscription   { id, formationId, titre, date, statut:'inscrit'|'valide'|'annule'|'en_attente', heures, format }
 */

// ─── Données de démo ──────────────────────────────────────────────────────────
const DEMO_CATALOGUE = [
  { id:"f1", titre:"Sécurité & Microsoft 365", description:"Bonnes pratiques de cybersécurité dans l'environnement M365 (Teams, SharePoint, OneDrive).", theme:"Sécurité", format:"Présentiel", dureeH:7, date:"2026-03-12", lieu:"Salle A — Paris", places:15, placesDispos:6, niveau:"Tous niveaux", obligatoire:true },
  { id:"f2", titre:"Excel Avancé — Tableaux croisés", description:"Maîtrisez les TCD, Power Query et les formules avancées pour piloter vos données.", theme:"Bureautique", format:"Distanciel", dureeH:14, date:"2026-03-20", lieu:"Teams", places:20, placesDispos:12, niveau:"Intermédiaire", obligatoire:false },
  { id:"f3", titre:"Management & Leadership", description:"Développez votre posture managériale et apprenez à animer votre équipe efficacement.", theme:"Management", format:"Présentiel", dureeH:14, date:"2026-04-03", lieu:"Salle B — Lyon", places:12, placesDispos:3, niveau:"Confirmé", obligatoire:false },
  { id:"f4", titre:"Communication & Prise de parole", description:"Techniques de communication assertive, gestion du stress en public, storytelling professionnel.", theme:"Soft skills", format:"Distanciel", dureeH:7, date:"2026-04-10", lieu:"Teams", places:25, placesDispos:18, niveau:"Tous niveaux", obligatoire:false },
  { id:"f5", titre:"RGPD — Mise en conformité", description:"Comprendre le cadre légal RGPD, identifier les données sensibles et sécuriser les traitements.", theme:"Réglementation", format:"E-learning", dureeH:3, date:"2026-04-14", lieu:"En ligne", places:999, placesDispos:999, niveau:"Tous niveaux", obligatoire:true },
  { id:"f6", titre:"Power BI — Tableaux de bord RH", description:"Créez des dashboards interactifs connectés à vos données RH SharePoint et Excel.", theme:"Data", format:"Distanciel", dureeH:14, date:"2026-05-06", lieu:"Teams", places:16, placesDispos:9, niveau:"Intermédiaire", obligatoire:false },
];

const DEMO_INSCRIPTIONS = [
  { id:"i1", formationId:"f1", titre:"Sécurité & Microsoft 365", date:"2026-03-12", statut:"inscrit",   heures:7,  format:"Présentiel" },
  { id:"i2", formationId:"f5", titre:"RGPD — Mise en conformité",  date:"2026-04-14", statut:"en_attente", heures:3, format:"E-learning" },
  { id:"i3", formationId:"f9", titre:"Onboarding Synapse RH",       date:"2026-01-15", statut:"valide",    heures:4,  format:"Distanciel" },
];

// ─── Nav items (même ordre que Home.jsx) ─────────────────────────────────────
const NAV_ITEMS = [
  { route:"dashboard",  icon:"📊", label:"Tableau de bord" },
  { route:"conges",     icon:"🏖️", label:"Congés" },
  { route:"documents",  icon:"📄", label:"Documents" },
  { route:"formations", icon:"🎓", label:"Formations" },
  { route:"equipe",     icon:"👥", label:"Équipe" },
  { route:"paie",       icon:"💰", label:"Fiches de paie" },
  { route:"support",    icon:"🛟", label:"Support" },
  { route:"parametres", icon:"⚙️", label:"Paramètres" },
];

const THEMES    = ["Tous", "Sécurité", "Bureautique", "Management", "Soft skills", "Réglementation", "Data"];
const FORMATS   = ["Tous", "Présentiel", "Distanciel", "E-learning"];
const NIVEAUX   = ["Tous", "Tous niveaux", "Intermédiaire", "Confirmé"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name = "") {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "--";
}
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return d; }
}
function themeColor(theme) {
  const map = {
    "Sécurité":"#dc2626","Bureautique":"#2563eb","Management":"#7c3aed",
    "Soft skills":"#059669","Réglementation":"#d97706","Data":"#0891b2",
  };
  return map[theme] || "#4b5563";
}
function formatIcon(fmt) {
  if (fmt === "Présentiel") return "🏢";
  if (fmt === "Distanciel")  return "💻";
  if (fmt === "E-learning")  return "📱";
  return "📚";
}

// ─── Styles (même base que Conges.jsx) ───────────────────────────────────────
const styles = `
:root{
  --bg:#f7fafc; --panel:#ffffff; --text:#1a202c; --muted:#4a5568;
  --line:#e2e8f0; --brand1:#667eea; --brand2:#764ba2;
  --success:#10b981; --warning:#f59e0b; --danger:#e53e3e;
  --chip:#edf2f7; --shadow:0 20px 60px rgba(0,0,0,.08); --radius:12px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
.page{min-height:100vh;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;
  -webkit-font-smoothing:antialiased;}
.header{background:linear-gradient(135deg,var(--brand1) 0%,var(--brand2) 100%);
  color:#fff;border-bottom:1px solid rgba(255,255,255,.12);}
.header-inner{max-width:1400px;margin:0 auto;height:76px;
  display:flex;align-items:center;justify-content:space-between;padding:0 24px;}
.app-brand{display:flex;align-items:center;gap:14px;cursor:pointer}
.logo-dot{width:40px;height:40px;border-radius:10px;
  background:linear-gradient(135deg,#8ea0ff 0%,#7b61ff 100%);
  box-shadow:0 8px 20px rgba(0,0,0,.15);}
.app-title{font-size:20px;font-weight:800;letter-spacing:.2px}
.user-section{display:flex;align-items:center;gap:12px}
.user-photo{width:40px;height:40px;border-radius:50%;
  background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:800;font-size:14px;border:2px solid rgba(255,255,255,.35);}
.user-meta{display:flex;flex-direction:column;line-height:1.1}
.user-name{font-size:14px;font-weight:700}
.user-tenant{font-size:12px;opacity:.9}
.logout-btn{margin-left:12px;padding:8px 12px;font-size:13px;
  background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);
  border-radius:8px;cursor:pointer;transition:.2s;}
.logout-btn:hover{background:rgba(255,255,255,.12)}
.main{max-width:1400px;margin:0 auto;display:flex;gap:24px;padding:24px}
.sidebar{width:260px;background:#fff;border-radius:12px;border:1px solid var(--line);
  padding:16px;height:fit-content;box-shadow:var(--shadow);flex-shrink:0;}
.nav-section-title{font-size:12px;text-transform:uppercase;letter-spacing:.6px;
  color:var(--muted);margin:6px 8px 10px;}
.nav-link{display:flex;align-items:center;gap:10px;padding:12px 12px;
  font-size:14px;color:var(--muted);text-decoration:none;border-radius:10px;
  margin-bottom:4px;transition:background-color .15s,color .15s;
  cursor:pointer;border:none;background:transparent;width:100%;text-align:left;}
.nav-link:hover{background:#f3f5fa;color:var(--text)}
.nav-link.active{background:#edf2f7;color:#2d3748;font-weight:700}
.content{flex:1;display:flex;flex-direction:column;gap:24px;min-width:0}
.panel{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:20px;box-shadow:var(--shadow);}
.section-title{font-size:16px;font-weight:800;margin-bottom:16px;color:#1a202c}
.label{font-size:13px;font-weight:700;margin-bottom:6px;color:#2d3748;display:block}
.select,.input,.date{width:100%;padding:10px 12px;border:1px solid var(--line);
  border-radius:10px;font-size:14px;background:#fff;color:#1a202c;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:10px 16px;border-radius:10px;font-weight:700;font-size:14px;
  cursor:pointer;border:1px solid transparent;transition:transform .06s,filter .15s;}
.btn.primary{background:linear-gradient(135deg,#2b6cb0,#3182ce);color:#fff;
  box-shadow:0 4px 12px rgba(49,130,206,.3);}
.btn.success{background:linear-gradient(135deg,#059669,#10b981);color:#fff;
  box-shadow:0 4px 12px rgba(16,185,129,.3);}
.btn.ghost{background:#fff;color:#2b6cb0;border-color:#cfe3fb;}
.btn.danger{background:#fff;color:#e53e3e;border-color:#fecaca;}
.btn.sm{padding:7px 12px;font-size:13px;}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.hint{font-size:12px;color:#718096;margin-top:6px}
.badge{display:inline-flex;align-items:center;gap:4px;
  padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;}
.badge.oblig{background:#fff0f0;border:1px solid #fca5a5;color:#dc2626;}
.badge.info{background:#f0f7ff;border:1px solid #bfdbfe;color:#1d4ed8;}

/* KPIs */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.kpi-card{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:20px;box-shadow:var(--shadow);}
.kpi-label{font-size:12px;text-transform:uppercase;letter-spacing:.5px;
  color:#718096;margin-bottom:8px;font-weight:800;}
.kpi-value{font-size:32px;font-weight:900;color:#1a202c;margin-bottom:4px;}
.kpi-sub{font-size:13px;color:#a0aec0;}
.kpi-trend{font-size:12px;font-weight:700;margin-top:6px;}
.kpi-trend.up{color:var(--success)} .kpi-trend.down{color:var(--danger)}

/* Filtres */
.filters{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px;}

/* Catalogue cards */
.catalogue-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.f-card{background:#fff;border:1px solid var(--line);border-radius:14px;
  overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.07);
  display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;}
.f-card:hover{transform:translateY(-3px);box-shadow:0 10px 36px rgba(0,0,0,.12);}
.f-card-banner{height:6px;}
.f-card-body{padding:18px;flex:1;display:flex;flex-direction:column;gap:10px;}
.f-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
.f-card-title{font-size:15px;font-weight:800;color:#1a202c;line-height:1.3;}
.f-card-desc{font-size:13px;color:#4a5568;line-height:1.5;flex:1;}
.f-meta{display:flex;flex-wrap:wrap;gap:8px;}
.f-meta-item{display:flex;align-items:center;gap:5px;font-size:12px;color:#6b7280;}
.f-card-footer{padding:14px 18px;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;align-items:center;background:#fafafa;}
.places-bar-wrap{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280;}
.places-bar{height:5px;width:80px;background:#e5e7eb;border-radius:99px;overflow:hidden;}
.places-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#10b981,#059669);}
.places-fill.warn{background:linear-gradient(90deg,#f59e0b,#d97706);}
.places-fill.full{background:#e5e7eb;}

/* Statuts inscriptions */
.status{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;display:inline-block;}
.status.inscrit{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;}
.status.valide{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;}
.status.en_attente{background:#fffbeb;color:#92400e;border:1px solid #fde68a;}
.status.annule{background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;}

/* Table */
.table{width:100%;border-collapse:collapse;margin-top:4px;border-radius:12px;
  overflow:hidden;border:1px solid var(--line);background:#fff;box-shadow:var(--shadow);}
.table th,.table td{padding:12px 14px;border-bottom:1px solid var(--line);font-size:14px;text-align:left;}
.table th{background:#f8fafc;font-weight:800;color:#374151;}
.table tr:last-child td{border-bottom:none;}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);
  display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
.modal{background:#fff;border-radius:16px;width:100%;max-width:520px;
  box-shadow:0 24px 80px rgba(0,0,0,.25);overflow:hidden;}
.modal-header{padding:20px 24px;border-bottom:1px solid var(--line);
  display:flex;justify-content:space-between;align-items:flex-start;}
.modal-title{font-size:18px;font-weight:800;color:#1a202c;}
.modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:#9ca3af;line-height:1;}
.modal-body{padding:24px;}
.modal-footer{padding:16px 24px;border-top:1px solid var(--line);
  display:flex;justify-content:flex-end;gap:10px;background:#fafafa;}
.modal-row{display:flex;align-items:center;gap:10px;
  padding:10px 0;border-bottom:1px solid var(--line);font-size:14px;}
.modal-row:last-child{border-bottom:none;}
.modal-icon{font-size:18px;width:24px;text-align:center;flex-shrink:0;}
.modal-key{color:#6b7280;min-width:110px;font-size:13px;}
.modal-val{font-weight:600;color:#1a202c;}

/* Empty state */
.empty{text-align:center;padding:40px 20px;color:#94a3b8;}
.empty-icon{font-size:40px;margin-bottom:12px;}
.empty p{font-size:14px;}

/* Toast */
.toast{
  position:fixed;bottom:24px;right:24px;z-index:2000;
  background:#1e293b;color:#fff;padding:14px 20px;
  border-radius:12px;font-size:14px;font-weight:600;
  box-shadow:0 8px 32px rgba(0,0,0,.25);
  animation:slideUp .3s ease;
}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}

@media(max-width:1100px){.catalogue-grid{grid-template-columns:1fr 1fr;}.kpi-grid{grid-template-columns:1fr 1fr;}}
@media(max-width:800px){
  .main{flex-direction:column;}.sidebar{width:100%;}
  .catalogue-grid{grid-template-columns:1fr;}.kpi-grid{grid-template-columns:1fr 1fr;}
  .filters{grid-template-columns:1fr 1fr;}
}
@media(max-width:480px){.kpi-grid{grid-template-columns:1fr;}.filters{grid-template-columns:1fr;}}
`;

// ─── Composant ────────────────────────────────────────────────────────────────
export default function Formations({ user, catalogue, inscriptions, onNavigate, onLogout, onInscrire, onDesinscrire }) {
  const cat  = catalogue   || DEMO_CATALOGUE;
  const insc = inscriptions || DEMO_INSCRIPTIONS;

  const u = {
    displayName:"Jean Dupont", givenName:"Jean",
    tenantLabel:"Client Démo", email:"jean.dupont@entreprise.com",
    ...(user || {}),
  };

  // ── Filtres catalogue ─────────────────────────────────────────────────────
  const [search,    setSearch]   = useState("");
  const [fTheme,    setFTheme]   = useState("Tous");
  const [fFormat,   setFFormat]  = useState("Tous");
  const [fNiveau,   setFNiveau]  = useState("Tous");

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modal,     setModal]    = useState(null); // formation object
  const [loading,   setLoading]  = useState(false);
  const [toast,     setToast]    = useState(null);

  // ── Onglet bas de page ────────────────────────────────────────────────────
  const [tab, setTab] = useState("catalogue"); // 'catalogue' | 'inscriptions'

  // ── Navigation ───────────────────────────────────────────────────────────
  const nav = (route) => (e) => {
    e?.preventDefault?.();
    if (typeof onNavigate === "function") onNavigate(route);
    else window.location.hash = route;
  };
  const logout = () => (typeof onLogout === "function" ? onLogout() : null);

  // ── IDs inscrits ─────────────────────────────────────────────────────────
  const inscritIds = useMemo(
    () => new Set(insc.filter(i => i.statut !== "annule").map(i => i.formationId)),
    [insc]
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpiInscrits  = insc.filter(i => i.statut === "inscrit" || i.statut === "en_attente").length;
  const kpiValidees  = insc.filter(i => i.statut === "valide").length;
  const kpiHeures    = insc.filter(i => i.statut === "valide").reduce((s, i) => s + (i.heures || 0), 0);
  const kpiDispo     = cat.filter(f => f.placesDispos > 0).length;

  // ── Filtrage catalogue ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return cat.filter(f => {
      const q = search.toLowerCase();
      if (q && !f.titre.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false;
      if (fTheme  !== "Tous" && f.theme  !== fTheme)  return false;
      if (fFormat !== "Tous" && f.format !== fFormat) return false;
      if (fNiveau !== "Tous" && f.niveau !== fNiveau) return false;
      return true;
    });
  }, [cat, search, fTheme, fFormat, fNiveau]);

  // ── Inscription ───────────────────────────────────────────────────────────
  async function handleInscrire(formation) {
    setLoading(true);
    try {
      if (typeof onInscrire === "function") await onInscrire(formation.id);
      showToast(`✅ Inscrit à « ${formation.titre} »`);
      setModal(null);
    } catch (e) {
      showToast(`❌ Erreur : ${e.message}`);
    } finally { setLoading(false); }
  }

  async function handleDesinscrire(inscription) {
    if (!window.confirm(`Se désinscrire de « ${inscription.titre} » ?`)) return;
    try {
      if (typeof onDesinscrire === "function") await onDesinscrire(inscription.id);
      showToast(`🗑️ Désinscription enregistrée`);
    } catch (e) { showToast(`❌ ${e.message}`); }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Barre de places ───────────────────────────────────────────────────────
  function PlacesBar({ total, dispos }) {
    if (total >= 999) return <span style={{fontSize:12, color:"#6b7280"}}>♾ Illimité</span>;
    const pct   = Math.round(((total - dispos) / total) * 100);
    const cls   = dispos === 0 ? "full" : pct >= 80 ? "warn" : "";
    return (
      <div className="places-bar-wrap">
        <div className="places-bar">
          <div className="places-fill" style={{ width:`${pct}%` }} />
        </div>
        <span>{dispos === 0 ? "Complet" : `${dispos} place${dispos > 1 ? "s" : ""}`}</span>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{styles}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <div className="app-brand" onClick={nav("dashboard")}>
            <div className="logo-dot" />
            <div className="app-title">Synapse — Espace Client</div>
          </div>
          <div className="user-section">
            <div className="user-photo" title={u.email}>{initials(u.displayName)}</div>
            <div className="user-meta">
              <span className="user-name">{u.displayName}</span>
              <span className="user-tenant">{u.tenantLabel}</span>
            </div>
            <button className="logout-btn" onClick={logout}>Déconnexion</button>
          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <div className="main">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="nav-section-title">Navigation</div>
          <nav>
            {NAV_ITEMS.map(({ route, icon, label }) => (
              <button key={route}
                className={`nav-link${route === "formations" ? " active" : ""}`}
                onClick={nav(route)}
              >
                {icon} {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="content">

          {/* ── KPIs ─────────────────────────────────────────────── */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Inscriptions actives</div>
              <div className="kpi-value">{kpiInscrits}</div>
              <div className="kpi-sub">En cours ou en attente</div>
              <div className="kpi-trend up">+0 vs. mois dernier</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Formations validées</div>
              <div className="kpi-value">{kpiValidees}</div>
              <div className="kpi-sub">Depuis janvier 2026</div>
              <div className="kpi-trend up">✓ Certificats disponibles</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Heures de formation</div>
              <div className="kpi-value">{kpiHeures} h</div>
              <div className="kpi-sub">Validées cette année</div>
              <div className="kpi-trend" style={{color:"#6b7280"}}>Objectif : 14 h/an</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Formations dispo</div>
              <div className="kpi-value">{kpiDispo}</div>
              <div className="kpi-sub">Places disponibles</div>
              <div className="kpi-trend up">Catalogue mis à jour</div>
            </div>
          </div>

          {/* ── ONGLETS ──────────────────────────────────────────── */}
          <div style={{ display:"flex", gap:8, borderBottom:`2px solid var(--line)`, paddingBottom:0 }}>
            {[
              { key:"catalogue", label:"🎓 Catalogue de formations" },
              { key:"inscriptions", label:`📋 Mes inscriptions (${insc.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding:"10px 18px", border:"none", background:"none",
                cursor:"pointer", fontWeight:700, fontSize:14,
                color: tab === t.key ? "#7c3aed" : "#6b7280",
                borderBottom: tab === t.key ? "2px solid #7c3aed" : "2px solid transparent",
                marginBottom:-2, transition:"color .15s",
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── CATALOGUE ────────────────────────────────────────── */}
          {tab === "catalogue" && (
            <div className="panel">
              {/* Filtres */}
              <div className="filters">
                <div>
                  <label className="label">Recherche</label>
                  <input className="input" placeholder="Titre, mot-clé…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div>
                  <label className="label">Thème</label>
                  <select className="select" value={fTheme} onChange={e => setFTheme(e.target.value)}>
                    {THEMES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Format</label>
                  <select className="select" value={fFormat} onChange={e => setFFormat(e.target.value)}>
                    {FORMATS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Niveau</label>
                  <select className="select" value={fNiveau} onChange={e => setFNiveau(e.target.value)}>
                    {NIVEAUX.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Grille */}
              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🔍</div>
                  <p>Aucune formation ne correspond à vos critères.</p>
                </div>
              ) : (
                <div className="catalogue-grid">
                  {filtered.map(f => {
                    const color   = themeColor(f.theme);
                    const isInsc  = inscritIds.has(f.id);
                    const isFull  = f.placesDispos === 0;
                    return (
                      <div className="f-card" key={f.id}>
                        <div className="f-card-banner" style={{ background:color }} />
                        <div className="f-card-body">
                          <div className="f-card-header">
                            <div className="f-card-title">{f.titre}</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                              {f.obligatoire && <span className="badge oblig">Obligatoire</span>}
                              <span className="badge info" style={{ borderColor:color+"33", color, background:color+"0f" }}>
                                {f.theme}
                              </span>
                            </div>
                          </div>
                          <p className="f-card-desc">{f.description}</p>
                          <div className="f-meta">
                            <span className="f-meta-item">{formatIcon(f.format)} {f.format}</span>
                            <span className="f-meta-item">⏱ {f.dureeH} h</span>
                            <span className="f-meta-item">📅 {fmtDate(f.date)}</span>
                            <span className="f-meta-item">📍 {f.lieu}</span>
                            <span className="f-meta-item">🎯 {f.niveau}</span>
                          </div>
                        </div>
                        <div className="f-card-footer">
                          <PlacesBar total={f.places} dispos={f.placesDispos} />
                          {isInsc ? (
                            <span className="btn sm ghost" style={{ cursor:"default" }}>✓ Inscrit</span>
                          ) : (
                            <button
                              className={`btn sm ${isFull ? "ghost" : "success"}`}
                              disabled={isFull}
                              onClick={() => setModal(f)}
                            >
                              {isFull ? "Complet" : "S'inscrire"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MES INSCRIPTIONS ─────────────────────────────────── */}
          {tab === "inscriptions" && (
            <div className="panel">
              <div className="section-title">Mes inscriptions</div>
              {insc.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📭</div>
                  <p>Vous n'êtes inscrit à aucune formation.</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Formation</th>
                      <th>Date</th>
                      <th>Format</th>
                      <th>Durée</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insc.map(i => (
                      <tr key={i.id}>
                        <td><strong>{i.titre}</strong></td>
                        <td>{fmtDate(i.date)}</td>
                        <td>{formatIcon(i.format)} {i.format}</td>
                        <td>{i.heures ? `${i.heures} h` : "—"}</td>
                        <td>
                          <span className={`status ${i.statut}`}>
                            {i.statut === "inscrit"    && "✅ Inscrit"}
                            {i.statut === "valide"     && "🏅 Validée"}
                            {i.statut === "en_attente" && "⏳ En attente"}
                            {i.statut === "annule"     && "❌ Annulé"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:8 }}>
                            {(i.statut === "inscrit" || i.statut === "en_attente") && (
                              <button className="btn sm danger" onClick={() => handleDesinscrire(i)}>
                                Se désinscrire
                              </button>
                            )}
                            {i.statut === "valide" && (
                              <button className="btn sm ghost" onClick={() => showToast("📄 Attestation téléchargée")}>
                                Attestation
                              </button>
                            )}
                            <button className="btn sm ghost" onClick={() => {
                              const f = cat.find(c => c.id === i.formationId);
                              if (f) setModal(f);
                            }}>
                              Détails
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <p className="hint" style={{ textAlign:"center" }}>
            Données servies par le backend (Microsoft Graph / SharePoint Lists). Aucune clé exposée côté front.
          </p>

        </main>
      </div>

      {/* ── MODAL DÉTAIL / INSCRIPTION ─────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" role="dialog" aria-labelledby="modal-title">
            <div className="modal-header">
              <div>
                <div id="modal-title" className="modal-title">{modal.titre}</div>
                <div style={{ marginTop:6, display:"flex", gap:8, flexWrap:"wrap" }}>
                  {modal.obligatoire && <span className="badge oblig">Obligatoire</span>}
                  <span className="badge info" style={{ color:themeColor(modal.theme) }}>{modal.theme}</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Fermer">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:14, color:"#4a5568", marginBottom:16, lineHeight:1.6 }}>{modal.description}</p>
              {[
                { icon:"📅", key:"Date",     val: fmtDate(modal.date) },
                { icon:"⏱",  key:"Durée",    val: `${modal.dureeH} heure${modal.dureeH > 1 ? "s" : ""}` },
                { icon:formatIcon(modal.format), key:"Format", val: modal.format },
                { icon:"📍", key:"Lieu",     val: modal.lieu },
                { icon:"🎯", key:"Niveau",   val: modal.niveau },
                { icon:"🪑", key:"Places",   val: modal.places >= 999 ? "Illimité" : `${modal.placesDispos} / ${modal.places} disponibles` },
              ].map(r => (
                <div key={r.key} className="modal-row">
                  <span className="modal-icon">{r.icon}</span>
                  <span className="modal-key">{r.key}</span>
                  <span className="modal-val">{r.val}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setModal(null)}>Annuler</button>
              {inscritIds.has(modal.id) ? (
                <button className="btn ghost" style={{ cursor:"default" }} disabled>✓ Déjà inscrit</button>
              ) : (
                <button
                  className="btn success"
                  disabled={modal.placesDispos === 0 || loading}
                  onClick={() => handleInscrire(modal)}
                >
                  {loading ? "Inscription…" : modal.placesDispos === 0 ? "Complet" : "Confirmer l'inscription"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && <div className="toast">{toast}</div>}

    </div>
  );
}