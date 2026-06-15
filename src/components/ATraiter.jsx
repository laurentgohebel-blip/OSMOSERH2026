import React, { useEffect, useState, useMemo } from "react";
import { getTasks, updateTask, runScan, SYNAPSE_API } from "../services/synapseApi.js";

/**
 * ATraiter — surface "à traiter" du poste de travail RH.
 * Consomme les TÂCHES générées par le moteur de cascades (GET /tasks),
 * avec actions Fait / Reporter. Le scan d'échéances peut être lancé d'ici.
 */

const styles = `
.at-wrap { display:flex; flex-direction:column; gap:16px; }
.at-head { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.at-title { font-size:17px; font-weight:800; color:#1a202c; }
.at-sub { font-size:13px; color:#64748b; }
.at-tools { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.at-toggle { display:flex; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
.at-toggle button { padding:7px 12px; border:none; background:#fff; font-size:13px; font-weight:700; color:#64748b; cursor:pointer; }
.at-toggle button.on { background:#edf2f7; color:#2d3748; }
.at-btn { padding:8px 12px; border:1px solid #e2e8f0; background:#fff; border-radius:8px; font-size:13px; font-weight:700; color:#475569; cursor:pointer; }
.at-btn:hover { background:#f3f5fa; }
.at-btn.primary { background:linear-gradient(135deg,#6d28d9,#7c3aed); color:#fff; border:none; }

.at-stats { display:flex; gap:10px; flex-wrap:wrap; }
.at-stat { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; }
.at-stat-v { font-size:22px; font-weight:900; line-height:1; }
.at-stat-l { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; font-weight:700; margin-top:4px; }

.at-list { display:flex; flex-direction:column; gap:8px; }
.at-task { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px;
  display:flex; align-items:center; gap:12px; border-left-width:4px; }
.at-task.done { opacity:.55; }
.at-task.done .at-task-title { text-decoration:line-through; }
.at-av { width:34px; height:34px; border-radius:50%; flex-shrink:0;
  background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center; }
.at-task-body { flex:1; min-width:0; }
.at-task-title { font-size:14px; font-weight:700; color:#1a202c; }
.at-task-meta { font-size:12px; color:#94a3b8; margin-top:2px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.at-chip { font-size:11px; font-weight:700; padding:2px 7px; border-radius:999px; background:#f1f5f9; color:#475569; }
.at-due { font-size:12px; font-weight:800; white-space:nowrap; }
.at-actions { display:flex; gap:6px; flex-shrink:0; }
.at-act { padding:7px 10px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid transparent; white-space:nowrap; }
.at-act.done { background:linear-gradient(135deg,#059669,#10b981); color:#fff; }
.at-act.post { background:#fff; color:#475569; border-color:#e2e8f0; }
.at-act:disabled { opacity:.5; cursor:not-allowed; }

.at-state { text-align:center; padding:36px 20px; color:#64748b; }
.at-err { background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:16px 18px; color:#9a3412; font-size:13px; }
.at-err code { background:#fff; padding:2px 6px; border-radius:5px; border:1px solid #fed7aa; }

@media(max-width:700px){ .at-task { flex-wrap:wrap; } .at-actions { width:100%; } }
`;

const CASCADE_LABEL = {
  employee_onboarding: "Onboarding",
  trial_period_ending: "Période d'essai",
  cdd_ending: "Fin de CDD",
};
const ROLE_LABEL = { hr: "RH", manager: "Manager", it: "IT", office: "Office" };

function initials(f = "", l = "") {
  return ((f[0] || "") + (l[0] || "")).toUpperCase() || "?";
}
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }); }
  catch { return String(d); }
}
function toYMD(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysUntil(due) {
  if (!due) return null;
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function urgency(due) {
  const n = daysUntil(due);
  if (n === null) return { color: "#94a3b8", text: "sans échéance" };
  if (n < 0) return { color: "#dc2626", text: `en retard de ${Math.abs(n)}j` };
  if (n === 0) return { color: "#dc2626", text: "aujourd'hui" };
  if (n <= 7) return { color: "#d97706", text: `dans ${n}j` };
  return { color: "#2563eb", text: `dans ${n}j` };
}

export default function ATraiter() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todo");
  const [busy, setBusy] = useState({});
  const [scanning, setScanning] = useState(false);

  function load() {
    setLoading(true); setError("");
    getTasks()
      .then((res) => setTasks(res.tasks || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const t = tasks || [];
    const todo = t.filter((x) => x.status === "todo");
    return {
      todo: todo.length,
      overdue: todo.filter((x) => daysUntil(x.due_date) !== null && daysUntil(x.due_date) < 0).length,
      done: t.filter((x) => x.status === "done").length,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    const t = tasks || [];
    const list = filter === "todo" ? t.filter((x) => x.status === "todo") : t;
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "todo" ? -1 : 1;
      return new Date(a.due_date || "2999") - new Date(b.due_date || "2999");
    });
  }, [tasks, filter]);

  async function patch(id, body, optimistic) {
    setBusy((b) => ({ ...b, [id]: true }));
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimistic } : t)));
    try {
      await updateTask(id, body);
    } catch (e) {
      setError(e.message);
      load(); // resync en cas d'échec
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  function markDone(t) { patch(t.id, { status: "done" }, { status: "done" }); }
  function postpone(t) {
    const base = t.due_date ? new Date(t.due_date) : new Date();
    base.setDate(base.getDate() + 7);
    const ymd = toYMD(base);
    patch(t.id, { due_date: ymd }, { due_date: ymd });
  }

  async function handleScan() {
    setScanning(true);
    try { await runScan(); load(); }
    catch (e) { setError(e.message); }
    finally { setScanning(false); }
  }

  return (
    <div className="at-wrap">
      <style>{styles}</style>

      <div className="at-head">
        <div>
          <div className="at-title">📥 À traiter</div>
          <div className="at-sub">Les tâches générées par le moteur de cascades — agissez en un clic.</div>
        </div>
        <div className="at-tools">
          <div className="at-toggle">
            <button className={filter === "todo" ? "on" : ""} onClick={() => setFilter("todo")}>À faire</button>
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>Tout</button>
          </div>
          <button className="at-btn" onClick={load}>↻</button>
          <button className="at-btn primary" onClick={handleScan} disabled={scanning}>
            {scanning ? "Scan…" : "⚡ Scanner les échéances"}
          </button>
        </div>
      </div>

      {tasks && !error && (
        <div className="at-stats">
          <div className="at-stat"><div className="at-stat-v">{stats.todo}</div><div className="at-stat-l">À faire</div></div>
          <div className="at-stat"><div className="at-stat-v" style={{ color: stats.overdue ? "#dc2626" : "#1a202c" }}>{stats.overdue}</div><div className="at-stat-l">En retard</div></div>
          <div className="at-stat"><div className="at-stat-v" style={{ color: "#059669" }}>{stats.done}</div><div className="at-stat-l">Faites</div></div>
        </div>
      )}

      {loading && <div className="at-state">Chargement…</div>}

      {error && (
        <div className="at-err">
          <strong>Backend injoignable.</strong> Lancez <code>npm run dev</code> dans <code>synapse-core</code> (API sur <code>{SYNAPSE_API}</code>).
          <div style={{ marginTop: 6, opacity: .8 }}>Détail : {error}</div>
        </div>
      )}

      {tasks && !error && visible.length === 0 && (
        <div className="at-state">
          <p>Aucune tâche {filter === "todo" ? "à faire" : ""}.</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>Cliquez sur « Scanner les échéances » pour que le moteur génère les tâches dues.</p>
        </div>
      )}

      {tasks && !error && visible.length > 0 && (
        <div className="at-list">
          {visible.map((t) => {
            const u = urgency(t.due_date);
            const done = t.status === "done";
            return (
              <div key={t.id} className={`at-task ${done ? "done" : ""}`} style={{ borderLeftColor: done ? "#cbd5e1" : u.color }}>
                <div className="at-av">{initials(t.first_name, t.last_name)}</div>
                <div className="at-task-body">
                  <div className="at-task-title">{t.title}</div>
                  <div className="at-task-meta">
                    <span>{t.first_name} {t.last_name}</span>
                    <span className="at-chip">{CASCADE_LABEL[t.source_cascade] || t.source_cascade}</span>
                    <span className="at-chip">{ROLE_LABEL[t.assignee_role] || t.assignee_role}</span>
                  </div>
                </div>
                <div className="at-due" style={{ color: done ? "#94a3b8" : u.color }}>
                  {fmtDate(t.due_date)}<div style={{ fontSize: 11, fontWeight: 600 }}>{done ? "fait" : u.text}</div>
                </div>
                {!done && (
                  <div className="at-actions">
                    <button className="at-act done" disabled={busy[t.id]} onClick={() => markDone(t)}>✓ Fait</button>
                    <button className="at-act post" disabled={busy[t.id]} onClick={() => postpone(t)}>+7j</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
