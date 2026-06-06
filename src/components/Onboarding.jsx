import React, { useState, useMemo, useEffect } from "react";
import {
  DEFAULT_TASKS,
  getAllOnboardings,
  createOnboarding,
  updateOnboardingTasks,
  updateOnboardingStatus,
  isSharePointConfigured,
} from "../services/onboardingService.js";

/**
 * Onboarding — Module de gestion des parcours d'arrivée nouveaux salariés
 *
 * Props:
 *  - instance: MSAL instance (pour SharePoint + email)
 */

const DEMO_ONBOARDINGS = [
  {
    id: "ONB-2026-001",
    employeeName: "Camille Rousseau",
    employeeEmail: "camille.rousseau@entreprise.com",
    position: "Chargée de communication",
    department: "Marketing",
    manager: "Sophie Martin",
    startDate: "2026-06-15",
    status: "in_progress",
    tasks: DEFAULT_TASKS.map((t, i) => ({ ...t, done: i < 5 })),
    createdAt: "2026-06-01",
  },
  {
    id: "ONB-2026-002",
    employeeName: "Antoine Leclerc",
    employeeEmail: "antoine.leclerc@entreprise.com",
    position: "Développeur Full-Stack",
    department: "IT",
    manager: "Marc Dupuis",
    startDate: "2026-07-01",
    status: "in_progress",
    tasks: DEFAULT_TASKS.map((t, i) => ({ ...t, done: i < 2 })),
    createdAt: "2026-06-04",
  },
  {
    id: "ONB-2026-003",
    employeeName: "Julie Moreau",
    employeeEmail: "julie.moreau@entreprise.com",
    position: "Comptable",
    department: "Finance",
    manager: "Thomas Leroy",
    startDate: "2026-05-15",
    status: "completed",
    tasks: DEFAULT_TASKS.map(t => ({ ...t, done: true })),
    createdAt: "2026-05-01",
  },
];

const styles = `
.onb-wrap { display:flex; flex-direction:column; gap:20px; }

.onb-toolbar {
  display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;
}
.onb-title { font-size:17px; font-weight:800; color:#1a202c; }
.onb-sub   { font-size:13px; color:#64748b; }
.onb-btn-new {
  padding:10px 18px; border-radius:10px; font-weight:700; font-size:14px;
  background:linear-gradient(135deg,#6d28d9,#7c3aed); color:#fff; border:none;
  cursor:pointer; box-shadow:0 4px 14px rgba(109,40,217,.3);
}

.onb-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.onb-kpi {
  background:#fff; border:1px solid #e2e8f0; border-radius:12px;
  padding:14px 16px; box-shadow:0 2px 8px rgba(0,0,0,.05);
}
.onb-kpi-label { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; font-weight:700; }
.onb-kpi-value { font-size:26px; font-weight:900; color:#1a202c; margin-top:4px; }

.onb-list { display:flex; flex-direction:column; gap:14px; }

.onb-card {
  background:#fff; border:1px solid #e2e8f0; border-radius:14px;
  padding:18px; transition:box-shadow .15s;
}
.onb-card:hover { box-shadow:0 6px 20px rgba(0,0,0,.08); }
.onb-card.completed { opacity:.7; }
.onb-card.urgent  { border-left:3px solid #d97706; }

.onb-card-head {
  display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:14px;
}
.onb-employee { display:flex; align-items:center; gap:12px; }
.onb-avatar {
  width:44px; height:44px; border-radius:50%;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:800; font-size:15px; flex-shrink:0;
}
.onb-emp-name { font-size:15px; font-weight:800; color:#1a202c; }
.onb-emp-pos  { font-size:13px; color:#64748b; }
.onb-emp-meta { font-size:12px; color:#94a3b8; margin-top:2px; }

.onb-progress-zone { display:flex; flex-direction:column; align-items:flex-end; gap:6px; min-width:200px; }
.onb-progress-bar { width:200px; height:8px; background:#e2e8f0; border-radius:99px; overflow:hidden; }
.onb-progress-fill { height:100%; background:linear-gradient(90deg,#7c3aed,#a78bfa); transition:width .4s; }
.onb-progress-fill.done { background:linear-gradient(90deg,#059669,#10b981); }
.onb-progress-text { font-size:12px; color:#64748b; font-weight:600; }

.onb-status-badge {
  display:inline-flex; align-items:center; gap:4px;
  padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700;
}
.onb-status-badge.in_progress { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
.onb-status-badge.completed   { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
.onb-status-badge.urgent      { background:#fffbeb; color:#92400e; border:1px solid #fde68a; }

.onb-tasks-zone {
  margin-top:12px; padding-top:14px; border-top:1px solid #e2e8f0;
}
.onb-tasks-header {
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:10px; cursor:pointer; user-select:none;
}
.onb-tasks-title { font-size:13px; font-weight:700; color:#475569; }
.onb-chevron { font-size:11px; color:#94a3b8; transition:transform .2s; }
.onb-chevron.open { transform:rotate(90deg); }

.onb-categories { display:flex; flex-direction:column; gap:10px; }
.onb-category { padding:8px 0; }
.onb-cat-name {
  font-size:11px; text-transform:uppercase; letter-spacing:.5px;
  color:#94a3b8; font-weight:800; margin-bottom:6px;
}
.onb-task {
  display:flex; align-items:center; gap:10px;
  padding:7px 10px; border-radius:8px; transition:background .12s;
}
.onb-task:hover { background:#f8fafc; }
.onb-task.done .onb-task-title { text-decoration:line-through; color:#94a3b8; }
.onb-task-checkbox {
  width:18px; height:18px; border-radius:5px; border:2px solid #cbd5e1;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; flex-shrink:0; transition:.12s;
}
.onb-task-checkbox.checked {
  background:#10b981; border-color:#10b981; color:#fff; font-size:12px;
}
.onb-task-icon { font-size:16px; }
.onb-task-title { flex:1; font-size:13px; color:#1a202c; }
.onb-task-meta { font-size:11px; color:#94a3b8; }

/* Modal nouveau parcours */
.onb-modal-overlay {
  position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:1000;
  display:flex; align-items:center; justify-content:center; padding:20px;
}
.onb-modal {
  background:#fff; border-radius:16px; width:100%; max-width:600px;
  max-height:90vh; display:flex; flex-direction:column;
  box-shadow:0 24px 80px rgba(0,0,0,.25); overflow:hidden;
}
.onb-modal-head {
  padding:18px 22px; border-bottom:1px solid #e2e8f0;
  display:flex; justify-content:space-between; align-items:center;
}
.onb-modal-title { font-size:16px; font-weight:800; }
.onb-modal-close { background:none; border:none; font-size:22px; color:#94a3b8; cursor:pointer; }
.onb-modal-body { padding:22px; overflow-y:auto; }
.onb-modal-foot {
  padding:14px 22px; border-top:1px solid #e2e8f0; background:#fafafa;
  display:flex; justify-content:flex-end; gap:10px;
}
.onb-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.onb-form-full { margin-bottom:12px; }
.onb-label { font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:5px; }
.onb-input, .onb-select {
  width:100%; padding:9px 12px; border:1px solid #e2e8f0;
  border-radius:8px; font-size:14px;
}
.onb-input:focus, .onb-select:focus {
  outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.1);
}

.onb-btn {
  padding:9px 16px; border-radius:8px; font-weight:700; font-size:13px;
  cursor:pointer; border:1px solid transparent;
}
.onb-btn.primary { background:linear-gradient(135deg,#6d28d9,#7c3aed); color:#fff; }
.onb-btn.ghost   { background:#fff; color:#64748b; border-color:#e2e8f0; }
.onb-btn:disabled { opacity:.5; cursor:not-allowed; }

.onb-empty { text-align:center; padding:48px 20px; color:#94a3b8; }
.onb-empty-icon { font-size:44px; margin-bottom:12px; }

.onb-toast {
  position:fixed; bottom:24px; right:24px; z-index:2000;
  background:#1e293b; color:#fff; padding:14px 20px; border-radius:12px;
  font-size:14px; font-weight:600; box-shadow:0 8px 32px rgba(0,0,0,.25);
}

@media(max-width:900px) {
  .onb-kpis { grid-template-columns:1fr 1fr; }
  .onb-card-head { flex-direction:column; }
  .onb-progress-zone { width:100%; align-items:flex-start; }
  .onb-progress-bar { width:100%; }
  .onb-form-row { grid-template-columns:1fr; }
}
`;

function initials(name = "") {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function progressPct(tasks = []) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
}

function groupByCategory(tasks) {
  return tasks.reduce((acc, t) => {
    const cat = t.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});
}

export default function Onboarding({ instance }) {
  const [items, setItems] = useState(DEMO_ONBOARDINGS);
  const [spLoaded, setSpLoaded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [openCards, setOpenCards] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  const EMPTY_FORM = {
    employeeName: "", employeeEmail: "", position: "",
    department: "", manager: "", startDate: "",
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Chargement SharePoint
  useEffect(() => {
    if (!instance || !isSharePointConfigured() || spLoaded) return;
    setSpLoaded(true);
    setLoading(true);
    getAllOnboardings(instance)
      .then(spItems => {
        if (spItems) setItems(spItems);
      })
      .catch(err => console.warn("[Onboarding] Chargement SharePoint échoué :", err.message))
      .finally(() => setLoading(false));
  }, [instance, spLoaded]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // KPIs
  const kpis = useMemo(() => {
    const inProgress = items.filter(i => i.status === "in_progress");
    const completed  = items.filter(i => i.status === "completed");
    const urgent     = inProgress.filter(i => {
      const d = daysUntil(i.startDate);
      return d !== null && d <= 7 && d >= 0;
    });
    const avgProgress = inProgress.length
      ? Math.round(inProgress.reduce((s, i) => s + progressPct(i.tasks), 0) / inProgress.length)
      : 0;
    return {
      total: items.length,
      inProgress: inProgress.length,
      completed: completed.length,
      urgent: urgent.length,
      avgProgress,
    };
  }, [items]);

  async function handleToggleTask(onbId, taskId) {
    const onb = items.find(i => i.id === onbId);
    if (!onb) return;
    const newTasks = onb.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);

    // Optimistic update
    setItems(prev => prev.map(i => i.id === onbId ? { ...i, tasks: newTasks } : i));

    // SharePoint sync
    if (instance && isSharePointConfigured() && onb.spItemId) {
      try {
        await updateOnboardingTasks(instance, onb.spItemId, newTasks);
      } catch (err) {
        console.warn("[Onboarding] MAJ tâches SharePoint échouée :", err.message);
      }
    }

    // Auto-complétion si toutes les tâches sont done
    if (newTasks.every(t => t.done) && onb.status === "in_progress") {
      setItems(prev => prev.map(i => i.id === onbId ? { ...i, status: "completed" } : i));
      if (instance && isSharePointConfigured() && onb.spItemId) {
        try { await updateOnboardingStatus(instance, onb.spItemId, "completed"); }
        catch (err) { console.warn("[Onboarding] Statut SP non MAJ :", err.message); }
      }
      showToast(`🎉 Onboarding de ${onb.employeeName.split(" ")[0]} terminé !`);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.employeeName.trim() || !form.startDate) {
      showToast("⚠️ Nom et date d'arrivée requis");
      return;
    }
    setSaving(true);

    const newOnb = {
      id: `ONB-${Date.now()}`,
      ...form,
      status: "in_progress",
      tasks: DEFAULT_TASKS.map(t => ({ ...t, done: false })),
      createdAt: new Date().toISOString().split("T")[0],
    };

    try {
      if (instance && isSharePointConfigured()) {
        const spItem = await createOnboarding(instance, newOnb);
        if (spItem) newOnb.spItemId = spItem.spItemId;
      }

      setItems(prev => [newOnb, ...prev]);
      setForm(EMPTY_FORM);
      setShowModal(false);
      showToast(`✅ Parcours d'onboarding créé pour ${newOnb.employeeName}`);
    } catch (err) {
      showToast("❌ " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleCard(id) {
    setOpenCards(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Tri : urgents d'abord, puis en cours par date proche, puis complétés
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "completed" ? 1 : -1;
      }
      return new Date(a.startDate) - new Date(b.startDate);
    });
  }, [items]);

  return (
    <div className="onb-wrap">
      <style>{styles}</style>

      {/* Toolbar */}
      <div className="onb-toolbar">
        <div>
          <div className="onb-title">Onboarding des nouveaux salariés</div>
          <div className="onb-sub">
            {kpis.inProgress} en cours · {kpis.completed} terminé{kpis.completed > 1 ? "s" : ""}
            {kpis.urgent > 0 && <> · <strong style={{ color: "#d97706" }}>{kpis.urgent} arrivée{kpis.urgent > 1 ? "s" : ""} cette semaine</strong></>}
          </div>
        </div>
        <button className="onb-btn-new" onClick={() => setShowModal(true)}>
          ➕ Nouveau parcours
        </button>
      </div>

      {/* KPIs */}
      <div className="onb-kpis">
        <div className="onb-kpi">
          <div className="onb-kpi-label">Total parcours</div>
          <div className="onb-kpi-value">{kpis.total}</div>
        </div>
        <div className="onb-kpi">
          <div className="onb-kpi-label">En cours</div>
          <div className="onb-kpi-value" style={{ color: "#2563eb" }}>{kpis.inProgress}</div>
        </div>
        <div className="onb-kpi">
          <div className="onb-kpi-label">Progression moyenne</div>
          <div className="onb-kpi-value" style={{ color: "#7c3aed" }}>{kpis.avgProgress}%</div>
        </div>
        <div className="onb-kpi">
          <div className="onb-kpi-label">Urgents (≤ 7j)</div>
          <div className="onb-kpi-value" style={{ color: kpis.urgent > 0 ? "#d97706" : "#94a3b8" }}>
            {kpis.urgent}
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign:"center", padding:"24px", color:"#94a3b8", fontSize:14 }}>
          Chargement depuis SharePoint…
        </div>
      )}

      {/* Liste des parcours */}
      {!loading && sortedItems.length === 0 ? (
        <div className="onb-empty">
          <div className="onb-empty-icon">👋</div>
          <p>Aucun parcours d'onboarding en cours.</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>Cliquez sur "Nouveau parcours" pour démarrer.</p>
        </div>
      ) : (
        <div className="onb-list">
          {sortedItems.map(onb => {
            const pct = progressPct(onb.tasks);
            const days = daysUntil(onb.startDate);
            const isUrgent = onb.status === "in_progress" && days !== null && days <= 7 && days >= 0;
            const grouped = groupByCategory(onb.tasks);
            const isOpen = openCards[onb.id] !== false; // ouvert par défaut

            return (
              <div key={onb.id} className={`onb-card ${onb.status} ${isUrgent ? "urgent" : ""}`}>
                <div className="onb-card-head">
                  <div className="onb-employee">
                    <div className="onb-avatar">{initials(onb.employeeName)}</div>
                    <div>
                      <div className="onb-emp-name">{onb.employeeName}</div>
                      <div className="onb-emp-pos">{onb.position} · {onb.department}</div>
                      <div className="onb-emp-meta">
                        📅 Arrivée {fmtDate(onb.startDate)}
                        {days !== null && onb.status === "in_progress" && (
                          <> · {days > 0 ? `dans ${days}j` : days === 0 ? "aujourd'hui" : `il y a ${Math.abs(days)}j`}</>
                        )}
                        {onb.manager && <> · Manager : {onb.manager}</>}
                      </div>
                    </div>
                  </div>

                  <div className="onb-progress-zone">
                    <span className={`onb-status-badge ${onb.status === "completed" ? "completed" : isUrgent ? "urgent" : "in_progress"}`}>
                      {onb.status === "completed" ? "✅ Terminé" : isUrgent ? "⚡ Urgent" : "⏳ En cours"}
                    </span>
                    <div className="onb-progress-bar">
                      <div className={`onb-progress-fill ${pct === 100 ? "done" : ""}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="onb-progress-text">
                      {onb.tasks.filter(t => t.done).length} / {onb.tasks.length} tâches · {pct}%
                    </div>
                  </div>
                </div>

                <div className="onb-tasks-zone">
                  <div className="onb-tasks-header" onClick={() => toggleCard(onb.id)}>
                    <span className="onb-tasks-title">📋 Checklist d'intégration</span>
                    <span className={`onb-chevron ${isOpen ? "open" : ""}`}>▶</span>
                  </div>

                  {isOpen && (
                    <div className="onb-categories">
                      {Object.entries(grouped).map(([cat, tasks]) => (
                        <div className="onb-category" key={cat}>
                          <div className="onb-cat-name">{cat}</div>
                          {tasks.map(t => (
                            <div key={t.id} className={`onb-task ${t.done ? "done" : ""}`}>
                              <div
                                className={`onb-task-checkbox ${t.done ? "checked" : ""}`}
                                onClick={() => handleToggleTask(onb.id, t.id)}
                              >
                                {t.done && "✓"}
                              </div>
                              <span className="onb-task-icon">{t.icon}</span>
                              <span className="onb-task-title">{t.title}</span>
                              <span className="onb-task-meta">{t.responsible}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nouveau parcours */}
      {showModal && (
        <div className="onb-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="onb-modal">
            <div className="onb-modal-head">
              <div className="onb-modal-title">Nouveau parcours d'onboarding</div>
              <button className="onb-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="onb-modal-body">
                <div className="onb-form-row">
                  <div>
                    <label className="onb-label">Nom complet *</label>
                    <input
                      className="onb-input" placeholder="Ex: Marie Dupont"
                      value={form.employeeName}
                      onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="onb-label">Email professionnel</label>
                    <input
                      className="onb-input" type="email" placeholder="marie.dupont@entreprise.com"
                      value={form.employeeEmail}
                      onChange={e => setForm(f => ({ ...f, employeeEmail: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="onb-form-row">
                  <div>
                    <label className="onb-label">Poste</label>
                    <input
                      className="onb-input" placeholder="Ex: Chargée de clientèle"
                      value={form.position}
                      onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="onb-label">Service / Département</label>
                    <input
                      className="onb-input" placeholder="Ex: Commercial"
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="onb-form-row">
                  <div>
                    <label className="onb-label">Manager</label>
                    <input
                      className="onb-input" placeholder="Ex: Sophie Martin"
                      value={form.manager}
                      onChange={e => setForm(f => ({ ...f, manager: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="onb-label">Date d'arrivée *</label>
                    <input
                      className="onb-input" type="date"
                      value={form.startDate}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ marginTop:14, padding:"12px 14px", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:8, fontSize:13, color:"#5b21b6" }}>
                  💡 <strong>{DEFAULT_TASKS.length} tâches</strong> seront créées automatiquement (administratif, IT, intégration, suivi).
                </div>
              </div>
              <div className="onb-modal-foot">
                <button type="button" className="onb-btn ghost" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="onb-btn primary" disabled={saving}>
                  {saving ? "Création…" : "🚀 Créer le parcours"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="onb-toast">{toast}</div>}
    </div>
  );
}
