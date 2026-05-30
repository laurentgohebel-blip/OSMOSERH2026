import React, { useState, useMemo } from "react";
import FormBuilder from "./FormBuilder.jsx";

/**
 * AdminRH — Interface service RH (route /admin)
 * Même thème que Home / Conges / Formations
 *
 * Props:
 *  - user:          { displayName, givenName, tenantLabel, email }
 *  - tasks:         Array<Task>   (données serveur / mock)
 *  - groups:        string[]      (liste des services/groupes)
 *  - onNavigate:    (route) => void
 *  - onLogout:      () => void
 *  - onCreateTask:  (task) => Promise|void
 *  - onUpdateTask:  (id, patch) => Promise|void
 *  - onDeleteTask:  (id) => Promise|void
 *
 * Task {
 *   id, type: 'document'|'formation'|'profil'|'conge',
 *   titre, description, groupe, priorite: 'haute'|'normale'|'basse',
 *   echeance: 'YYYY-MM-DD', statut: 'active'|'completee'|'archivee',
 *   createdAt, completedCount, totalCount
 * }
 */

// ─── Données démo ─────────────────────────────────────────────────────────────
const DEMO_GROUPS = ["RH", "IT", "Commercial", "Direction", "Logistique", "Finance", "Marketing"];

const DEMO_TASKS = [
  { id:"t1", type:"document",  titre:"Fournir justificatif domicile", description:"Merci de déposer un justificatif de domicile de moins de 3 mois dans l'espace Documents.", groupe:"RH", priorite:"haute",   echeance:"2026-02-28", statut:"active",    createdAt:"2026-02-01", completedCount:14, totalCount:23 },
  { id:"t2", type:"formation", titre:"RGPD — Mise en conformité obligatoire", description:"Compléter le module e-learning RGPD disponible dans l'espace Formations avant l'échéance.", groupe:"IT", priorite:"haute",   echeance:"2026-03-15", statut:"active",    createdAt:"2026-02-05", completedCount:6,  totalCount:12 },
  { id:"t3", type:"profil",    titre:"Mettre à jour coordonnées personnelles", description:"Vérifier et compléter votre adresse postale, téléphone mobile et contact d'urgence.", groupe:"Commercial", priorite:"normale", echeance:"2026-03-01", statut:"active",    createdAt:"2026-02-10", completedCount:20, totalCount:31 },
  { id:"t4", type:"conge",     titre:"Valider soldes de congés N-1", description:"Les soldes de congés de l'année 2025 doivent être validés avant fin février.", groupe:"Direction", priorite:"haute",   echeance:"2026-02-28", statut:"active",    createdAt:"2026-02-12", completedCount:3,  totalCount:8  },
  { id:"t5", type:"formation", titre:"Sécurité & Microsoft 365", description:"Participer à la session présentielle de formation cybersécurité M365.", groupe:"Logistique", priorite:"normale", echeance:"2026-03-12", statut:"active",    createdAt:"2026-02-08", completedCount:9,  totalCount:15 },
  { id:"t6", type:"document",  titre:"Contrats signés — campagne 2025", description:"Renvoyer les avenants signés par voie numérique.", groupe:"Finance",  priorite:"basse",   echeance:"2026-04-01", statut:"archivee",  createdAt:"2026-01-15", completedCount:18, totalCount:18 },
  { id:"t7", type:"profil",    titre:"Compléter fiche de poste", description:"Mettre à jour votre intitulé de poste et votre manager direct dans le SIRH.", groupe:"Marketing", priorite:"basse",   echeance:"2026-03-20", statut:"completee", createdAt:"2026-01-20", completedCount:10, totalCount:10 },
];

// ─── Config types ─────────────────────────────────────────────────────────────
const TASK_TYPES = {
  document:  { label:"Document",  icon:"📄", color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
  formation: { label:"Formation", icon:"🎓", color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
  profil:    { label:"Profil RH", icon:"👤", color:"#059669", bg:"#f0fdf4", border:"#a7f3d0" },
  conge:     { label:"Congé",     icon:"🏖️", color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
};

const PRIORITES = {
  haute:   { label:"Haute",   color:"#dc2626", bg:"#fff0f0", border:"#fca5a5" },
  normale: { label:"Normale", color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
  basse:   { label:"Basse",   color:"#059669", bg:"#f0fdf4", border:"#a7f3d0" },
};

const STATUTS = {
  active:    { label:"Active",    color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
  completee: { label:"Complétée", color:"#059669", bg:"#f0fdf4", border:"#a7f3d0" },
  archivee:  { label:"Archivée",  color:"#6b7280", bg:"#f3f4f6", border:"#e5e7eb" },
};

// ─── Nav items ────────────────────────────────────────────────────────────────
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
function isOverdue(echeance) {
  if (!echeance) return false;
  return new Date(echeance) < new Date();
}
function progressPct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
:root{
  --bg:#f7fafc; --panel:#ffffff; --text:#1a202c; --muted:#4a5568;
  --line:#e2e8f0; --brand1:#667eea; --brand2:#764ba2;
  --success:#10b981; --warning:#f59e0b; --danger:#e53e3e;
  --chip:#edf2f7; --shadow:0 20px 60px rgba(0,0,0,.08);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
.page{min-height:100vh;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;
  -webkit-font-smoothing:antialiased;}

/* Header */
.header{background:linear-gradient(135deg,var(--brand1) 0%,var(--brand2) 100%);
  color:#fff;border-bottom:1px solid rgba(255,255,255,.12);}
.header-inner{max-width:1400px;margin:0 auto;height:76px;
  display:flex;align-items:center;justify-content:space-between;padding:0 24px;}
.app-brand{display:flex;align-items:center;gap:14px;cursor:pointer}
.logo-dot{width:40px;height:40px;border-radius:10px;
  background:linear-gradient(135deg,#8ea0ff,#7b61ff);
  box-shadow:0 8px 20px rgba(0,0,0,.15);}
.app-title{font-size:20px;font-weight:800;letter-spacing:.2px}
.header-right{display:flex;align-items:center;gap:16px;}
.admin-badge{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);
  color:#fff;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;
  letter-spacing:.3px;}
.user-section{display:flex;align-items:center;gap:12px}
.user-photo{width:40px;height:40px;border-radius:50%;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:800;font-size:14px;border:2px solid rgba(255,255,255,.35);}
.user-meta{display:flex;flex-direction:column;line-height:1.1}
.user-name{font-size:14px;font-weight:700}
.user-tenant{font-size:12px;opacity:.9}
.logout-btn{margin-left:12px;padding:8px 12px;font-size:13px;
  background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);
  border-radius:8px;cursor:pointer;transition:.2s;}
.logout-btn:hover{background:rgba(255,255,255,.12)}

/* Layout */
.main{max-width:1400px;margin:0 auto;display:flex;gap:24px;padding:24px}
.sidebar{width:260px;background:#fff;border-radius:12px;border:1px solid var(--line);
  padding:16px;height:fit-content;box-shadow:var(--shadow);flex-shrink:0;}
.nav-section-title{font-size:12px;text-transform:uppercase;letter-spacing:.6px;
  color:var(--muted);margin:6px 8px 10px;}
.nav-link{display:flex;align-items:center;gap:10px;padding:12px;
  font-size:14px;color:var(--muted);border-radius:10px;margin-bottom:4px;
  cursor:pointer;border:none;background:transparent;width:100%;text-align:left;
  transition:background .15s,color .15s;}
.nav-link:hover{background:#f3f5fa;color:var(--text)}
.nav-link.active{background:#edf2f7;color:#2d3748;font-weight:700}
.nav-link.admin-link{
  margin-top:8px;border-top:1px solid var(--line);padding-top:12px;
  color:#7c3aed;font-weight:700;
}
.nav-link.admin-link.active{background:#f5f3ff;color:#6d28d9;}
.content{flex:1;display:flex;flex-direction:column;gap:24px;min-width:0}

/* Page title bar */
.page-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
.page-title{font-size:22px;font-weight:900;color:#1a202c;}
.page-sub{font-size:14px;color:#64748b;margin-top:3px;}

/* KPIs */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
.kpi-card{background:#fff;border:1px solid var(--line);border-radius:14px;
  padding:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;}
.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.kpi-card.blue::before{background:linear-gradient(90deg,#2563eb,#60a5fa);}
.kpi-card.purple::before{background:linear-gradient(90deg,#7c3aed,#a78bfa);}
.kpi-card.green::before{background:linear-gradient(90deg,#059669,#34d399);}
.kpi-card.orange::before{background:linear-gradient(90deg,#d97706,#fbbf24);}
.kpi-label{font-size:12px;text-transform:uppercase;letter-spacing:.5px;
  color:#718096;margin-bottom:8px;font-weight:800;}
.kpi-value{font-size:34px;font-weight:900;color:#1a202c;margin-bottom:4px;}
.kpi-sub{font-size:13px;color:#94a3b8;}

/* Onglets */
.tabs{display:flex;gap:4px;border-bottom:2px solid var(--line);padding-bottom:0;}
.tab-btn{padding:10px 18px;border:none;background:none;cursor:pointer;
  font-weight:700;font-size:14px;transition:color .15s;
  border-bottom:2px solid transparent;margin-bottom:-2px;}
.tab-btn.active{color:#7c3aed;border-bottom-color:#7c3aed;}
.tab-btn:not(.active){color:#64748b;}

/* Panel */
.panel{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:24px;box-shadow:var(--shadow);}
.section-title{font-size:16px;font-weight:800;margin-bottom:16px;color:#1a202c;}
.label{font-size:13px;font-weight:700;margin-bottom:6px;color:#2d3748;display:block;}
.input,.select,.textarea,.date{
  width:100%;padding:10px 12px;border:1px solid var(--line);
  border-radius:10px;font-size:14px;background:#fff;color:#1a202c;
  transition:border-color .15s;}
.input:focus,.select:focus,.textarea:focus{outline:none;border-color:#7c3aed;
  box-shadow:0 0 0 3px rgba(124,58,237,.08);}
.textarea{min-height:90px;resize:vertical;}
.hint{font-size:12px;color:#94a3b8;margin-top:5px;}

/* Form grid */
.form-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
.form-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px;}
.form-full{margin-bottom:16px;}

/* Boutons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;
  cursor:pointer;border:1px solid transparent;transition:transform .06s,filter .15s,opacity .15s;}
.btn.primary{background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff;
  box-shadow:0 4px 14px rgba(109,40,217,.3);}
.btn.secondary{background:linear-gradient(135deg,#2b6cb0,#3182ce);color:#fff;
  box-shadow:0 4px 14px rgba(49,130,206,.25);}
.btn.ghost{background:#fff;color:#4b5563;border-color:#e5e7eb;}
.btn.danger{background:#fff;color:#dc2626;border-color:#fca5a5;}
.btn.sm{padding:7px 12px;font-size:13px;}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn-row{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:8px;}

/* Filtres */
.filters{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px;}

/* Task cards */
.task-list{display:flex;flex-direction:column;gap:14px;}
.task-card{background:#fff;border:1px solid var(--line);border-radius:14px;
  padding:18px;box-shadow:0 2px 12px rgba(0,0,0,.05);
  display:flex;gap:16px;align-items:flex-start;
  transition:box-shadow .15s,transform .1s;}
.task-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.1);transform:translateY(-1px);}
.task-card.overdue{border-left:3px solid #dc2626;}
.task-type-pill{width:44px;height:44px;border-radius:12px;
  display:flex;align-items:center;justify-content:center;
  font-size:20px;flex-shrink:0;}
.task-body{flex:1;min-width:0;}
.task-title{font-size:15px;font-weight:800;color:#1a202c;margin-bottom:4px;}
.task-desc{font-size:13px;color:#64748b;margin-bottom:10px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.task-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.task-actions{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;}

/* Progress */
.progress-wrap{display:flex;align-items:center;gap:8px;min-width:160px;}
.progress-bar{flex:1;height:6px;background:#e5e7eb;border-radius:99px;overflow:hidden;}
.progress-fill{height:100%;border-radius:99px;
  background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width .4s ease;}
.progress-fill.done{background:linear-gradient(90deg,#059669,#34d399);}
.progress-fill.warn{background:linear-gradient(90deg,#d97706,#fbbf24);}
.progress-pct{font-size:12px;font-weight:700;color:#4b5563;min-width:34px;text-align:right;}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:4px;
  padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;}

/* Stats par groupe */
.group-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.group-card{background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.05);}
.group-name{font-size:14px;font-weight:800;color:#1a202c;margin-bottom:12px;}
.group-stat{display:flex;justify-content:space-between;align-items:center;
  font-size:13px;color:#6b7280;padding:4px 0;border-bottom:1px solid var(--line);}
.group-stat:last-child{border-bottom:none;}
.group-stat strong{color:#1a202c;}

/* Empty state */
.empty{text-align:center;padding:48px 20px;color:#94a3b8;}
.empty-icon{font-size:44px;margin-bottom:12px;}
.empty p{font-size:14px;}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);
  display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
.modal{background:#fff;border-radius:16px;width:100%;max-width:540px;
  box-shadow:0 24px 80px rgba(0,0,0,.25);overflow:hidden;max-height:90vh;display:flex;flex-direction:column;}
.modal-header{padding:20px 24px;border-bottom:1px solid var(--line);
  display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
.modal-title{font-size:17px;font-weight:800;color:#1a202c;}
.modal-close{background:none;border:none;font-size:22px;cursor:pointer;
  color:#9ca3af;line-height:1;padding:0 4px;}
.modal-body{padding:24px;overflow-y:auto;}
.modal-footer{padding:16px 24px;border-top:1px solid var(--line);
  display:flex;justify-content:flex-end;gap:10px;background:#fafafa;flex-shrink:0;}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;z-index:2000;
  background:#1e293b;color:#fff;padding:14px 20px;border-radius:12px;
  font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.25);
  animation:slideUp .3s ease;}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}

@media(max-width:1200px){.kpi-grid{grid-template-columns:1fr 1fr;}.filters{grid-template-columns:1fr 1fr;}.group-grid{grid-template-columns:1fr 1fr;}}
@media(max-width:900px){.main{flex-direction:column;}.sidebar{width:100%;}.form-3{grid-template-columns:1fr 1fr;}.group-grid{grid-template-columns:1fr;}}
@media(max-width:600px){.kpi-grid{grid-template-columns:1fr;}.form-2,.form-3{grid-template-columns:1fr;}.filters{grid-template-columns:1fr;}.task-card{flex-direction:column;}.task-actions{flex-direction:row;}}
`;

// ─── Composant ────────────────────────────────────────────────────────────────
export default function AdminRH({ user, tasks: tasksProp, groups: groupsProp, onNavigate, onLogout, onCreateTask, onUpdateTask, onDeleteTask }) {

  const [tasks, setTasks]   = useState(tasksProp || DEMO_TASKS);
  const groups              = groupsProp || DEMO_GROUPS;

  const u = {
    displayName:"Service RH", givenName:"Service",
    tenantLabel:"Admin", email:"rh@entreprise.com",
    ...(user || {}),
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  const nav = (route) => (e) => {
    e?.preventDefault?.();
    if (typeof onNavigate === "function") onNavigate(route);
    else window.location.hash = route;
  };
  const logout = () => (typeof onLogout === "function" ? onLogout() : null);

  // ── Onglets ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("taches"); // taches | creer | apercu

  // ── Filtres liste ─────────────────────────────────────────────────────────
  const [fType,    setFType]    = useState("tous");
  const [fStatut,  setFStatut]  = useState("tous");
  const [fGroupe,  setFGroupe]  = useState("tous");
  const [fPrio,    setFPrio]    = useState("tous");
  const [fSearch,  setFSearch]  = useState("");

  // ── Form création ─────────────────────────────────────────────────────────
  const EMPTY_FORM = { type:"document", titre:"", description:"", groupe:"RH", priorite:"normale", echeance:"", totalCount:10 };
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");

  // ── Modale détail / edit ──────────────────────────────────────────────────
  const [modal,    setModal]    = useState(null);
  const [toast,    setToast]    = useState(null);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total:     tasks.length,
    actives:   tasks.filter(t => t.statut === "active").length,
    completees:tasks.filter(t => t.statut === "completee").length,
    overdue:   tasks.filter(t => t.statut === "active" && isOverdue(t.echeance)).length,
  }), [tasks]);

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (fType   !== "tous" && t.type    !== fType)   return false;
      if (fStatut !== "tous" && t.statut  !== fStatut) return false;
      if (fGroupe !== "tous" && t.groupe  !== fGroupe) return false;
      if (fPrio   !== "tous" && t.priorite !== fPrio)  return false;
      if (fSearch) {
        const q = fSearch.toLowerCase();
        if (!t.titre.toLowerCase().includes(q) && !t.groupe.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, fType, fStatut, fGroupe, fPrio, fSearch]);

  // ── Stats par groupe ───────────────────────────────────────────────────────
  const groupStats = useMemo(() => {
    return groups.map(g => {
      const gt = tasks.filter(t => t.groupe === g);
      return {
        groupe:     g,
        total:      gt.length,
        actives:    gt.filter(t => t.statut === "active").length,
        completees: gt.filter(t => t.statut === "completee").length,
        overdue:    gt.filter(t => t.statut === "active" && isOverdue(t.echeance)).length,
      };
    }).filter(s => s.total > 0);
  }, [tasks, groups]);

  // ── Création tâche ────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    if (!form.titre.trim()) { setFormErr("Le titre est obligatoire."); return; }
    if (!form.echeance)     { setFormErr("L'échéance est obligatoire."); return; }
    setFormErr(""); setSaving(true);
    const newTask = {
      ...form,
      id:         `t${Date.now()}`,
      statut:     "active",
      createdAt:  new Date().toISOString().split("T")[0],
      completedCount: 0,
      totalCount: Number(form.totalCount) || 1,
    };
    try {
      if (typeof onCreateTask === "function") await onCreateTask(newTask);
      setTasks(prev => [newTask, ...prev]);
      setForm(EMPTY_FORM);
      setTab("taches");
      showToast("✅ Tâche créée et diffusée au groupe " + newTask.groupe);
    } catch(err) { setFormErr("Erreur : " + err.message); }
    finally { setSaving(false); }
  }

  // ── Archiver / supprimer ──────────────────────────────────────────────────
  async function handleArchive(id) {
    try {
      if (typeof onUpdateTask === "function") await onUpdateTask(id, { statut:"archivee" });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, statut:"archivee" } : t));
      showToast("📦 Tâche archivée");
      setModal(null);
    } catch(e) { showToast("❌ " + e.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer définitivement cette tâche ?")) return;
    try {
      if (typeof onDeleteTask === "function") await onDeleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      showToast("🗑️ Tâche supprimée");
      setModal(null);
    } catch(e) { showToast("❌ " + e.message); }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  // ── Rendu badge type ──────────────────────────────────────────────────────
  function TypeBadge({ type }) {
    const t = TASK_TYPES[type] || TASK_TYPES.document;
    return (
      <span className="badge" style={{ background:t.bg, color:t.color, border:`1px solid ${t.border}` }}>
        {t.icon} {t.label}
      </span>
    );
  }
  function PrioBadge({ p }) {
    const x = PRIORITES[p] || PRIORITES.normale;
    return (
      <span className="badge" style={{ background:x.bg, color:x.color, border:`1px solid ${x.border}` }}>
        {p === "haute" ? "🔴" : p === "normale" ? "🟡" : "🟢"} {x.label}
      </span>
    );
  }
  function StatutBadge({ s }) {
    const x = STATUTS[s] || STATUTS.active;
    return (
      <span className="badge" style={{ background:x.bg, color:x.color, border:`1px solid ${x.border}` }}>
        {s === "active" ? "⚡" : s === "completee" ? "✅" : "📦"} {x.label}
      </span>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <style>{styles}</style>

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-inner">
          <div className="app-brand" onClick={nav("dashboard")}>
            <div className="logo-dot" />
            <div className="app-title">Synapse — Espace Client</div>
          </div>
          <div className="header-right">
            <span className="admin-badge">⚙️ Interface RH</span>
            <div className="user-section">
              <div className="user-photo" title={u.email}>{initials(u.displayName)}</div>
              <div className="user-meta">
                <span className="user-name">{u.displayName}</span>
                <span className="user-tenant">{u.tenantLabel}</span>
              </div>
              <button className="logout-btn" onClick={logout}>Déconnexion</button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="main">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="nav-section-title">Navigation</div>
          <nav>
            {NAV_ITEMS.map(({ route, icon, label }) => (
              <button key={route} className="nav-link" onClick={nav(route)}>
                {icon} {label}
              </button>
            ))}
            <button className={`nav-link admin-link${true ? " active" : ""}`} onClick={nav("admin")}>
              🛠️ Admin RH
            </button>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="content">

          {/* Page header */}
          <div className="page-header">
            <div>
              <div className="page-title">🛠️ Administration RH</div>
              <div className="page-sub">Créez et suivez les tâches assignées à vos groupes collaborateurs.</div>
            </div>
            <button className="btn primary" onClick={() => setTab("creer")}>
              ➕ Nouvelle tâche
            </button>
          </div>

          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card blue">
              <div className="kpi-label">Total tâches</div>
              <div className="kpi-value">{kpis.total}</div>
              <div className="kpi-sub">Toutes catégories</div>
            </div>
            <div className="kpi-card purple">
              <div className="kpi-label">En cours</div>
              <div className="kpi-value">{kpis.actives}</div>
              <div className="kpi-sub">Actives sur les groupes</div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-label">Complétées</div>
              <div className="kpi-value">{kpis.completees}</div>
              <div className="kpi-sub">100 % de complétion</div>
            </div>
            <div className="kpi-card orange">
              <div className="kpi-label">En retard</div>
              <div className="kpi-value">{kpis.overdue}</div>
              <div className="kpi-sub">Échéance dépassée</div>
            </div>
          </div>

          {/* Onglets */}
          <div className="tabs">
            {[
              { key:"taches",    label:`📋 Tâches (${tasks.length})` },
              { key:"creer",     label:"➕ Créer une tâche" },
              { key:"apercu",    label:"📊 Aperçu par groupe" },
              { key:"formulaires", label:"🗂️ Formulaires & Documents" },
            ].map(t => (
              <button key={t.key}
                className={`tab-btn${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── ONGLET TÂCHES ── */}
          {tab === "taches" && (
            <div className="panel">
              {/* Filtres */}
              <div className="filters">
                <div>
                  <label className="label">Recherche</label>
                  <input className="input" placeholder="Titre, groupe…"
                    value={fSearch} onChange={e => setFSearch(e.target.value)} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="select" value={fType} onChange={e => setFType(e.target.value)}>
                    <option value="tous">Tous</option>
                    {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select className="select" value={fStatut} onChange={e => setFStatut(e.target.value)}>
                    <option value="tous">Tous</option>
                    {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Groupe</label>
                  <select className="select" value={fGroupe} onChange={e => setFGroupe(e.target.value)}>
                    <option value="tous">Tous</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priorité</label>
                  <select className="select" value={fPrio} onChange={e => setFPrio(e.target.value)}>
                    <option value="tous">Toutes</option>
                    {Object.entries(PRIORITES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🔍</div>
                  <p>Aucune tâche ne correspond à ces filtres.</p>
                </div>
              ) : (
                <div className="task-list">
                  {filtered.map(t => {
                    const tt  = TASK_TYPES[t.type] || TASK_TYPES.document;
                    const pct = progressPct(t.completedCount, t.totalCount);
                    const od  = t.statut === "active" && isOverdue(t.echeance);
                    return (
                      <div key={t.id} className={`task-card${od ? " overdue" : ""}`}>
                        <div className="task-type-pill" style={{ background:tt.bg }}>
                          {tt.icon}
                        </div>
                        <div className="task-body">
                          <div className="task-title">{t.titre}</div>
                          <div className="task-desc">{t.description}</div>
                          <div className="task-meta">
                            <TypeBadge type={t.type} />
                            <PrioBadge p={t.priorite} />
                            <StatutBadge s={t.statut} />
                            <span className="badge" style={{ background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0" }}>
                              👥 {t.groupe}
                            </span>
                            <span className="badge" style={{ background: od ? "#fff0f0" : "#f8fafc", color: od ? "#dc2626" : "#64748b", border:`1px solid ${od ? "#fca5a5" : "#e2e8f0"}` }}>
                              📅 {od ? "⚠ " : ""}{fmtDate(t.echeance)}
                            </span>
                          </div>
                        </div>
                        <div className="task-actions">
                          {/* Barre de progression */}
                          <div className="progress-wrap">
                            <div className="progress-bar">
                              <div className={`progress-fill${pct === 100 ? " done" : pct < 30 ? " warn" : ""}`}
                                style={{ width:`${pct}%` }} />
                            </div>
                            <span className="progress-pct">{pct}%</span>
                          </div>
                          <div style={{ fontSize:12, color:"#94a3b8", textAlign:"right" }}>
                            {t.completedCount} / {t.totalCount} complétés
                          </div>
                          {/* Actions */}
                          <div style={{ display:"flex", gap:6, marginTop:4 }}>
                            <button className="btn sm ghost" onClick={() => setModal(t)}>Détails</button>
                            {t.statut === "active" && (
                              <button className="btn sm ghost" onClick={() => handleArchive(t.id)}>Archiver</button>
                            )}
                            <button className="btn sm danger" onClick={() => handleDelete(t.id)}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ONGLET CRÉER ── */}
          {tab === "creer" && (
            <div className="panel">
              <div className="section-title">Nouvelle tâche RH</div>
              {formErr && (
                <div style={{ background:"#fff0f0", border:"1px solid #fca5a5", color:"#dc2626",
                  borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, fontWeight:600 }}>
                  ⚠️ {formErr}
                </div>
              )}
              <form onSubmit={handleCreate}>
                <div className="form-3">
                  <div>
                    <label className="label">Type de tâche</label>
                    <select className="select" value={form.type}
                      onChange={e => setForm(f => ({ ...f, type:e.target.value }))}>
                      {Object.entries(TASK_TYPES).map(([k,v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Groupe / Service cible</label>
                    <select className="select" value={form.groupe}
                      onChange={e => setForm(f => ({ ...f, groupe:e.target.value }))}>
                      {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priorité</label>
                    <select className="select" value={form.priorite}
                      onChange={e => setForm(f => ({ ...f, priorite:e.target.value }))}>
                      {Object.entries(PRIORITES).map(([k,v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-full">
                  <label className="label">Titre de la tâche *</label>
                  <input className="input" placeholder="Ex : Fournir justificatif domicile…"
                    value={form.titre}
                    onChange={e => setForm(f => ({ ...f, titre:e.target.value }))} />
                </div>
                <div className="form-full">
                  <label className="label">Description / Instructions</label>
                  <textarea className="textarea"
                    placeholder="Décrivez ce que les collaborateurs doivent faire, où et comment…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description:e.target.value }))} />
                </div>
                <div className="form-2">
                  <div>
                    <label className="label">Échéance *</label>
                    <input className="date" type="date" value={form.echeance}
                      onChange={e => setForm(f => ({ ...f, echeance:e.target.value }))} />
                    <p className="hint">Date limite pour les collaborateurs du groupe.</p>
                  </div>
                  <div>
                    <label className="label">Nombre de personnes ciblées</label>
                    <input className="input" type="number" min="1" value={form.totalCount}
                      onChange={e => setForm(f => ({ ...f, totalCount:e.target.value }))} />
                    <p className="hint">Servira au calcul du taux de complétion.</p>
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn ghost"
                    onClick={() => { setForm(EMPTY_FORM); setFormErr(""); }}>
                    Réinitialiser
                  </button>
                  <button type="submit" className="btn primary" disabled={saving}>
                    {saving ? "Création…" : "🚀 Créer et diffuser"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── ONGLET APERÇU PAR GROUPE ── */}
          {tab === "apercu" && (
            <div className="panel">
              <div className="section-title">Suivi par groupe</div>
              {groupStats.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📊</div>
                  <p>Aucune tâche assignée pour l'instant.</p>
                </div>
              ) : (
                <div className="group-grid">
                  {groupStats.map(s => (
                    <div className="group-card" key={s.groupe}>
                      <div className="group-name">👥 {s.groupe}</div>
                      <div className="group-stat">
                        <span>Total tâches</span><strong>{s.total}</strong>
                      </div>
                      <div className="group-stat">
                        <span>Actives</span>
                        <strong style={{ color:"#2563eb" }}>{s.actives}</strong>
                      </div>
                      <div className="group-stat">
                        <span>Complétées</span>
                        <strong style={{ color:"#059669" }}>{s.completees}</strong>
                      </div>
                      <div className="group-stat">
                        <span>En retard</span>
                        <strong style={{ color: s.overdue > 0 ? "#dc2626" : "#94a3b8" }}>
                          {s.overdue > 0 ? `⚠ ${s.overdue}` : "0"}
                        </strong>
                      </div>
                      {/* Mini barre globale */}
                      {s.total > 0 && (
                        <div style={{ marginTop:12 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:4 }}>
                            <span>Complétion globale</span>
                            <span>{Math.round((s.completees/s.total)*100)}%</span>
                          </div>
                          <div className="progress-bar" style={{ width:"100%", height:8 }}>
                            <div className={`progress-fill${s.completees === s.total ? " done" : ""}`}
                              style={{ width:`${Math.round((s.completees/s.total)*100)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ONGLET FORMULAIRES ── */}
          {tab === "formulaires" && (
            <div className="panel">
              <FormBuilder
                user={user}
                graphUser={null}
                onSave={(tpl) => console.log("[AdminRH] Formulaire sauvegardé", tpl)}
                onDelete={(id) => console.log("[AdminRH] Formulaire supprimé", id)}
              />
            </div>
          )}

          <p style={{ fontSize:12, color:"#94a3b8", textAlign:"center", padding:"4px 0 16px" }}>
            Données stockées côté serveur via Microsoft Graph / SharePoint Lists. Aucune clé exposée côté front.
          </p>

        </main>
      </div>

      {/* ── MODAL DÉTAIL TÂCHE ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">{modal.titre}</div>
                <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                  <TypeBadge type={modal.type} />
                  <PrioBadge p={modal.priorite} />
                  <StatutBadge s={modal.statut} />
                </div>
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:14, color:"#4a5568", lineHeight:1.6, marginBottom:16 }}>
                {modal.description || "Aucune description."}
              </p>
              {[
                { icon:"👥", label:"Groupe ciblé",   val: modal.groupe },
                { icon:"📅", label:"Échéance",        val: fmtDate(modal.echeance) },
                { icon:"📆", label:"Créée le",        val: fmtDate(modal.createdAt) },
                { icon:"👤", label:"Complétion",      val: `${modal.completedCount} / ${modal.totalCount} (${progressPct(modal.completedCount, modal.totalCount)}%)` },
              ].map(r => (
                <div key={r.label} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 0",
                  borderBottom:"1px solid var(--line)", fontSize:14
                }}>
                  <span style={{ fontSize:18, width:24, textAlign:"center" }}>{r.icon}</span>
                  <span style={{ color:"#6b7280", minWidth:110, fontSize:13 }}>{r.label}</span>
                  <strong style={{ color:"#1a202c" }}>{r.val}</strong>
                </div>
              ))}
              {/* Barre de progression */}
              <div style={{ marginTop:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6, color:"#4a5568" }}>
                  <span>Progression</span>
                  <strong>{progressPct(modal.completedCount, modal.totalCount)}%</strong>
                </div>
                <div className="progress-bar" style={{ width:"100%", height:10 }}>
                  <div className={`progress-fill${progressPct(modal.completedCount, modal.totalCount) === 100 ? " done" : ""}`}
                    style={{ width:`${progressPct(modal.completedCount, modal.totalCount)}%` }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn ghost sm" onClick={() => setModal(null)}>Fermer</button>
              {modal.statut === "active" && (
                <button className="btn ghost sm" onClick={() => handleArchive(modal.id)}>📦 Archiver</button>
              )}
              <button className="btn danger sm" onClick={() => handleDelete(modal.id)}>🗑️ Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && <div className="toast">{toast}</div>}

    </div>
  );
}