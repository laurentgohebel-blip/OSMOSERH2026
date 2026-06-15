import React, { useEffect, useState } from "react";
import { getAttention, SYNAPSE_API } from "../services/synapseApi.js";

/**
 * ATraiter — surface "à traiter" du poste de travail RH.
 * Consomme GET /attention du backend synapse-core (100% déterministe).
 */

const styles = `
.at-wrap { display:flex; flex-direction:column; gap:16px; }
.at-head { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.at-title { font-size:17px; font-weight:800; color:#1a202c; }
.at-sub { font-size:13px; color:#64748b; }

.at-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.at-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px 18px;
  box-shadow:0 2px 12px rgba(0,0,0,.05); border-left-width:4px; }
.at-card-head { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
.at-icon { font-size:20px; }
.at-label { font-size:14px; font-weight:800; color:#1a202c; }
.at-summary { font-size:13px; color:#64748b; margin-bottom:12px; }

.at-row { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:8px 0; border-bottom:1px solid #f1f5f9; }
.at-row:last-child { border-bottom:none; }
.at-who { display:flex; align-items:center; gap:9px; min-width:0; }
.at-av { width:30px; height:30px; border-radius:50%; flex-shrink:0;
  background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font-size:11px; font-weight:800;
  display:flex; align-items:center; justify-content:center; }
.at-name { font-size:13px; font-weight:700; color:#1a202c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.at-meta { font-size:11px; color:#94a3b8; }
.at-detail { font-size:12px; font-weight:600; color:#475569; white-space:nowrap; }
.at-empty { font-size:13px; color:#94a3b8; font-style:italic; padding:4px 0; }

.at-state { text-align:center; padding:40px 20px; color:#64748b; }
.at-err { background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:16px 18px;
  color:#9a3412; font-size:13px; }
.at-err code { background:#fff; padding:2px 6px; border-radius:5px; border:1px solid #fed7aa; }

@media(max-width:900px){ .at-grid { grid-template-columns:1fr; } }
`;

const TYPES = {
  trial_periods_ending: {
    icon: "⏳", label: "Périodes d'essai à échéance",
    detail: (r) => `fin le ${fmtDate(r.trial_period_end)}`,
    meta: (r) => r.position || r.department || "",
  },
  contracts_expiring: {
    icon: "📄", label: "Contrats qui expirent",
    detail: (r) => `${r.contract_type || "CDD"} · fin ${fmtDate(r.contract_end_date)}`,
    meta: (r) => r.position || r.department || "",
  },
  training_not_completed: {
    icon: "🎓", label: "Formations en retard",
    detail: (r) => `${r.training} · ${r.status}`,
    meta: (r) => r.department || "",
  },
  leave_not_taken: {
    icon: "🌴", label: "Sans congé depuis longtemps",
    detail: (r) => (r.last_leave_taken ? `dernier : ${fmtDate(r.last_leave_taken)}` : "aucun congé"),
    meta: (r) => r.department || "",
  },
};

const SEV = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#2563eb",
};

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(d); }
}
function initials(f = "", l = "") {
  return ((f[0] || "") + (l[0] || "")).toUpperCase() || "?";
}

export default function ATraiter() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getAttention()
      .then((res) => { if (alive) setItems(res.items || []); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const totalCount = (items || []).reduce((s, it) => s + (it.data?.length || 0), 0);

  return (
    <div className="at-wrap">
      <style>{styles}</style>

      <div className="at-head">
        <div>
          <div className="at-title">📥 À traiter</div>
          <div className="at-sub">Ce qui demande votre attention aujourd'hui — données en temps réel.</div>
        </div>
        {items && <div className="at-sub">{totalCount} élément{totalCount !== 1 ? "s" : ""}</div>}
      </div>

      {loading && <div className="at-state">Chargement depuis le backend…</div>}

      {error && (
        <div className="at-err">
          <strong>Backend injoignable.</strong> Vérifiez que <code>synapse-core</code> tourne :
          lancez <code>npm run dev</code> dans le dossier du backend (API attendue sur <code>{SYNAPSE_API}</code>).
          <div style={{ marginTop: 6, opacity: .8 }}>Détail : {error}</div>
        </div>
      )}

      {items && !error && (
        <div className="at-grid">
          {items.map((it) => {
            const meta = TYPES[it.type] || { icon: "•", label: it.type, detail: () => "", meta: () => "" };
            const color = SEV[it.severity] || "#94a3b8";
            const rows = it.data || [];
            return (
              <div className="at-card" key={it.type} style={{ borderLeftColor: color }}>
                <div className="at-card-head">
                  <span className="at-icon">{meta.icon}</span>
                  <span className="at-label">{meta.label}</span>
                </div>
                <div className="at-summary">{it.summary}</div>
                {rows.length === 0 ? (
                  <div className="at-empty">Rien à signaler 🎉</div>
                ) : (
                  rows.map((r) => (
                    <div className="at-row" key={r.id}>
                      <div className="at-who">
                        <div className="at-av">{initials(r.first_name, r.last_name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="at-name">{r.first_name} {r.last_name}</div>
                          <div className="at-meta">{meta.meta(r)}</div>
                        </div>
                      </div>
                      <div className="at-detail" style={{ color }}>{meta.detail(r)}</div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
