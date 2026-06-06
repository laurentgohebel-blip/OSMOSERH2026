import React, { useState, useMemo, useEffect } from "react";
import { getAllConges, updateCongeStatus, isSharePointConfigured } from "../services/congesService.js";

/**
 * ValidationConges — Vue manager : approuver / refuser les demandes en attente
 *
 * Props:
 *  - requests: Array<{
 *      id, employeeName, employeeEmail, type, startDate, endDate,
 *      startHalf, endHalf, days, comment, createdAt
 *    }>
 *  - onApprove: (id, managerComment) => Promise|void
 *  - onReject:  (id, managerComment) => Promise|void
 *  - instance:  MSAL instance (pour envoyer l'email via Graph)
 */

const DEMO_REQUESTS = [
  {
    id: "REQ-2026-010",
    employeeName: "Sophie Martin",
    employeeEmail: "sophie.martin@entreprise.com",
    type: "CP",
    startDate: "2026-06-16",
    endDate: "2026-06-20",
    startHalf: "AM",
    endHalf: "PM",
    days: 5,
    comment: "Vacances été",
    createdAt: "2026-06-01",
  },
  {
    id: "REQ-2026-011",
    employeeName: "Thomas Leroy",
    employeeEmail: "thomas.leroy@entreprise.com",
    type: "RTT",
    startDate: "2026-06-11",
    endDate: "2026-06-11",
    startHalf: "PM",
    endHalf: "PM",
    days: 0.5,
    comment: "RDV médical",
    createdAt: "2026-06-03",
  },
  {
    id: "REQ-2026-012",
    employeeName: "Lucie Bernard",
    employeeEmail: "lucie.bernard@entreprise.com",
    type: "Sans solde",
    startDate: "2026-06-22",
    endDate: "2026-06-26",
    startHalf: "AM",
    endHalf: "PM",
    days: 5,
    comment: "",
    createdAt: "2026-06-04",
  },
  {
    id: "REQ-2026-013",
    employeeName: "Marc Dupuis",
    employeeEmail: "marc.dupuis@entreprise.com",
    type: "CP",
    startDate: "2026-07-07",
    endDate: "2026-07-18",
    startHalf: "AM",
    endHalf: "PM",
    days: 10,
    comment: "Vacances juillet",
    createdAt: "2026-05-28",
  },
];

const TYPE_COLORS = {
  CP:          { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  RTT:         { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  "Récup":     { bg: "#f0fdf4", color: "#059669", border: "#a7f3d0" },
  "Sans solde":{ bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
};

const styles = `
.vc-wrap { display:flex; flex-direction:column; gap:20px; }
.vc-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.vc-title { font-size:17px; font-weight:800; color:#1a202c; }
.vc-count { font-size:13px; color:#64748b; }

.vc-filters { display:flex; gap:10px; flex-wrap:wrap; }
.vc-filter-select {
  padding:8px 12px; border:1px solid #e2e8f0; border-radius:8px;
  font-size:13px; background:#fff; color:#1a202c; cursor:pointer;
}

.vc-list { display:flex; flex-direction:column; gap:12px; }

.vc-card {
  background:#fff; border:1px solid #e2e8f0; border-radius:14px;
  padding:20px; display:grid; grid-template-columns:1fr auto;
  gap:16px; align-items:start; transition:box-shadow .15s;
}
.vc-card:hover { box-shadow:0 4px 20px rgba(0,0,0,.08); }
.vc-card.decided { opacity:.55; }

.vc-card-left { display:flex; flex-direction:column; gap:10px; }
.vc-employee { display:flex; align-items:center; gap:10px; }
.vc-avatar {
  width:38px; height:38px; border-radius:50%;
  background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:800; font-size:13px; flex-shrink:0;
}
.vc-name { font-size:15px; font-weight:800; color:#1a202c; }
.vc-email { font-size:12px; color:#94a3b8; }

.vc-details { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.vc-badge {
  display:inline-flex; align-items:center; gap:4px;
  padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;
}
.vc-period { font-size:13px; color:#475569; }
.vc-comment { font-size:13px; color:#64748b; font-style:italic; }
.vc-created { font-size:12px; color:#94a3b8; }

.vc-actions { display:flex; flex-direction:column; gap:8px; align-items:flex-end; min-width:200px; }
.vc-input-comment {
  width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px;
  font-size:13px; resize:none; min-height:60px;
}
.vc-input-comment:focus { outline:none; border-color:#667eea; box-shadow:0 0 0 3px rgba(102,126,234,.1); }
.vc-btn-row { display:flex; gap:8px; width:100%; }
.vc-btn {
  flex:1; padding:9px 14px; border-radius:9px; font-weight:700; font-size:13px;
  cursor:pointer; border:1px solid transparent; transition:filter .12s, transform .06s;
}
.vc-btn:active { transform:translateY(1px); }
.vc-btn:disabled { opacity:.5; cursor:not-allowed; }
.vc-btn.approve {
  background:linear-gradient(135deg,#059669,#10b981); color:#fff;
  box-shadow:0 4px 12px rgba(5,150,105,.25);
}
.vc-btn.reject {
  background:#fff; color:#dc2626; border-color:#fca5a5;
}
.vc-btn.approve:hover:not(:disabled) { filter:brightness(1.06); }
.vc-btn.reject:hover:not(:disabled) { background:#fff0f0; }

.vc-decided-label {
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 14px; border-radius:999px; font-size:13px; font-weight:700;
}
.vc-decided-label.approved { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
.vc-decided-label.rejected { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; }

.vc-empty { text-align:center; padding:48px 20px; color:#94a3b8; }
.vc-empty-icon { font-size:44px; margin-bottom:12px; }

.vc-toast {
  position:fixed; bottom:24px; right:24px; z-index:2000;
  background:#1e293b; color:#fff; padding:14px 20px; border-radius:12px;
  font-size:14px; font-weight:600; box-shadow:0 8px 32px rgba(0,0,0,.25);
  animation:vcSlide .3s ease;
}
@keyframes vcSlide { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }

@media(max-width:700px) {
  .vc-card { grid-template-columns:1fr; }
  .vc-actions { min-width:0; width:100%; }
  .vc-filters { flex-direction:column; }
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

function fmtHalf(h) {
  if (h === "AM") return "matin";
  if (h === "PM") return "après-midi";
  return "";
}

export default function ValidationConges({ requests: requestsProp, onApprove, onReject, instance }) {
  const [items, setItems] = useState(() =>
    (requestsProp || DEMO_REQUESTS).map(r => ({ ...r, _status: r.status || "pending", _loading: false }))
  );
  const [spLoaded, setSpLoaded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [comments, setComments] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [toast, setToast] = useState(null);

  // Chargement depuis SharePoint si configuré
  useEffect(() => {
    if (!instance || !isSharePointConfigured() || spLoaded) return;
    setSpLoaded(true);
    setLoading(true);
    getAllConges(instance)
      .then(spItems => {
        if (spItems) {
          setItems(spItems.map(r => ({ ...r, _status: r.status || "pending", _loading: false })));
        }
      })
      .catch(err => console.warn("[ValidationConges] Chargement SharePoint échoué :", err.message))
      .finally(() => setLoading(false));
  }, [instance, spLoaded]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const pending = useMemo(() => items.filter(i => i._status === "pending"), [items]);
  const decided = useMemo(() => items.filter(i => i._status !== "pending"), [items]);

  const filtered = useMemo(() => {
    const list = filterType === "decided" ? decided : filterType === "pending" ? pending : items;
    return list;
  }, [items, filterType, pending, decided]);

  async function handle(id, action) {
    const comment = (comments[id] || "").trim();
    setItems(prev => prev.map(i => i.id === id ? { ...i, _loading: true } : i));

    try {
      const req = items.find(i => i.id === id);
      const newStatus = action === "approve" ? "approved" : "rejected";

      // Mise à jour SharePoint si configuré
      if (instance && isSharePointConfigured() && req?.spItemId) {
        try {
          await updateCongeStatus(instance, req.spItemId, newStatus, comment);
        } catch (spErr) {
          console.warn("[ValidationConges] MAJ SharePoint échouée :", spErr.message);
        }
      }

      if (action === "approve" && typeof onApprove === "function") {
        await onApprove(id, comment);
      } else if (action === "reject" && typeof onReject === "function") {
        await onReject(id, comment);
      }
      if (req && instance) {
        // Envoyer notification email via Graph si instance MSAL disponible
        try {
          const { sendEmail } = await import("../services/graphService.js");
          const label = action === "approve" ? "approuvée ✅" : "refusée ❌";
          const periode = `${fmtDate(req.startDate)} (${fmtHalf(req.startHalf)}) → ${fmtDate(req.endDate)} (${fmtHalf(req.endHalf)})`;
          await sendEmail(instance, {
            to: req.employeeEmail,
            subject: `Votre demande de congé ${req.type} a été ${label}`,
            bodyHTML: `
              <p>Bonjour ${req.employeeName.split(" ")[0]},</p>
              <p>Votre demande de congé <strong>${req.type}</strong> pour la période <strong>${periode}</strong> (${req.days} jour${req.days > 1 ? "s" : ""}) a été <strong>${label}</strong>.</p>
              ${comment ? `<p><em>Commentaire du manager : ${comment}</em></p>` : ""}
              <p>Cordialement,<br/>Votre service RH via Synapse</p>
            `,
          });
        } catch (emailErr) {
          console.warn("[ValidationConges] Email non envoyé :", emailErr.message);
        }
      }

      setItems(prev => prev.map(i =>
        i.id === id ? { ...i, _status: action === "approve" ? "approved" : "rejected", _loading: false } : i
      ));
      showToast(action === "approve" ? `✅ Demande de ${items.find(i=>i.id===id)?.employeeName} approuvée` : `❌ Demande refusée`);
    } catch (err) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, _loading: false } : i));
      showToast("❌ Erreur : " + err.message);
    }
  }

  return (
    <div className="vc-wrap">
      <style>{styles}</style>

      <div className="vc-toolbar">
        <div>
          <div className="vc-title">Validation des congés</div>
          <div className="vc-count">
            {pending.length} demande{pending.length !== 1 ? "s" : ""} en attente · {decided.length} traitée{decided.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="vc-filters">
          <select className="vc-filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">Toutes ({items.length})</option>
            <option value="pending">En attente ({pending.length})</option>
            <option value="decided">Traitées ({decided.length})</option>
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign:"center", padding:"24px", color:"#94a3b8", fontSize:14 }}>
          Chargement des demandes depuis SharePoint…
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <div className="vc-empty">
          <div className="vc-empty-icon">🎉</div>
          <p>Aucune demande à afficher.</p>
        </div>
      ) : (
        <div className="vc-list">
          {filtered.map(req => {
            const tc = TYPE_COLORS[req.type] || TYPE_COLORS["CP"];
            const isDecided = req._status !== "pending";
            const periode = `${fmtDate(req.startDate)} ${req.startHalf ? `(${fmtHalf(req.startHalf)})` : ""} → ${fmtDate(req.endDate)} ${req.endHalf ? `(${fmtHalf(req.endHalf)})` : ""}`;

            return (
              <div key={req.id} className={`vc-card${isDecided ? " decided" : ""}`}>
                <div className="vc-card-left">
                  <div className="vc-employee">
                    <div className="vc-avatar">{initials(req.employeeName)}</div>
                    <div>
                      <div className="vc-name">{req.employeeName}</div>
                      <div className="vc-email">{req.employeeEmail}</div>
                    </div>
                  </div>
                  <div className="vc-details">
                    <span className="vc-badge" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                      {req.type}
                    </span>
                    <span className="vc-badge" style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                      📅 {req.days} jour{req.days > 1 ? "s" : ""}
                    </span>
                    <span className="vc-period">{periode}</span>
                  </div>
                  {req.comment && (
                    <div className="vc-comment">« {req.comment} »</div>
                  )}
                  <div className="vc-created">Demande créée le {fmtDate(req.createdAt)} · Ref. {req.id}</div>
                </div>

                <div className="vc-actions">
                  {isDecided ? (
                    <div className={`vc-decided-label ${req._status}`}>
                      {req._status === "approved" ? "✅ Approuvée" : "❌ Refusée"}
                    </div>
                  ) : (
                    <>
                      <textarea
                        className="vc-input-comment"
                        placeholder="Commentaire (optionnel)…"
                        value={comments[req.id] || ""}
                        onChange={e => setComments(prev => ({ ...prev, [req.id]: e.target.value }))}
                      />
                      <div className="vc-btn-row">
                        <button
                          className="vc-btn reject"
                          disabled={req._loading}
                          onClick={() => handle(req.id, "reject")}
                        >
                          {req._loading ? "…" : "✕ Refuser"}
                        </button>
                        <button
                          className="vc-btn approve"
                          disabled={req._loading}
                          onClick={() => handle(req.id, "approve")}
                        >
                          {req._loading ? "…" : "✓ Approuver"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className="vc-toast">{toast}</div>}
    </div>
  );
}
