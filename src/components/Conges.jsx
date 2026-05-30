import React, { useMemo, useState } from "react";

/**
 * Page Congés — React (Vite/React)
 * - Marque blanche premium, cohérente avec Home.jsx
 * - Soldes, demande de congés, liste + filtres, uploads justificatifs
 *
 * Props:
 *  - user: { displayName, givenName, familyName, tenantLabel, email }
 *  - balances: { cp, rtt, recup, sansSolde }
 *  - requests: Array<{
 *      id: string,
 *      type: 'CP'|'RTT'|'Récup'|'Sans solde',
 *      startDate: 'YYYY-MM-DD',
 *      endDate: 'YYYY-MM-DD',
 *      startHalf?: 'AM'|'PM'|null,
 *      endHalf?: 'AM'|'PM'|null,
 *      days: number,
 *      status: 'pending'|'approved'|'rejected'|'canceled',
 *      comment?: string,
 *      createdAt?: 'YYYY-MM-DD',
 *      approver?: string,
 *      attachmentsCount?: number
 *    }>
 *  - holidays: string[] (ex: ['2026-01-01','2026-05-01']) — utilisé pour le calcul jours ouvrés
 *  - onNavigate: (route: string) => void
 *  - onLogout: () => void
 *  - onSubmitLeave: (leavePayload) => Promise|void
 *  - onCancelRequest: (id: string) => Promise|void
 *  - onUploadJustif: (id: string, file: File) => Promise|void
 */

const styles = `
:root{
  --bg:#f7fafc;
  --panel:#ffffff;
  --text:#1a202c;
  --muted:#4a5568;
  --line:#e2e8f0;
  --brand1:#667eea;
  --brand2:#764ba2;
  --success:#10b981;
  --warning:#f59e0b;
  --danger:#e53e3e;
  --info:#2b6cb0;
  --chip:#edf2f7;
  --shadow:0 20px 60px rgba(0,0,0,.08);
  --radius:12px;
}

*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
.page{
  min-height:100vh;
  background:var(--bg);
  color:var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI','Roboto','Oxygen',
  'Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue', sans-serif;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}

/* Header (aligné avec Home.jsx) */
.header{
  background: linear-gradient(135deg,var(--brand1) 0%, var(--brand2) 100%);
  color:#fff;border-bottom:1px solid rgba(255,255,255,.12);
}
.header-inner{
  max-width:1400px;margin:0 auto;height:76px;
  display:flex;align-items:center;justify-content:space-between;padding:0 24px;
}
.app-brand{display:flex;align-items:center;gap:14px;cursor:pointer}
.logo-dot{
  width:40px;height:40px;border-radius:10px;
  background:linear-gradient(135deg,#8ea0ff 0%,#7b61ff 100%);
  box-shadow:0 8px 20px rgba(0,0,0,.15);
}
.app-title{font-size:20px;font-weight:800;letter-spacing:.2px}
.user-section{display:flex;align-items:center;gap:12px}
.user-photo{
  width:40px;height:40px;border-radius:50%;
  background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:800;border:2px solid rgba(255,255,255,.35);
}
.user-meta{display:flex;flex-direction:column;line-height:1.1}
.user-name{font-size:14px;font-weight:700}
.user-tenant{font-size:12px;opacity:.9}
.logout-btn{
  margin-left:12px;padding:8px 12px;font-size:13px;
  background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);
  border-radius:8px;cursor:pointer;transition:.2s;
}
.logout-btn:hover{background:rgba(255,255,255,.12)}

/* Layout */
.main{max-width:1400px;margin:0 auto;display:flex;gap:24px;padding:24px}
.sidebar{
  width:260px;background:#fff;border-radius:12px;border:1px solid var(--line);
  padding:16px;height:fit-content;box-shadow:var(--shadow);
}
.nav-section-title{
  font-size:12px;text-transform:uppercase;letter-spacing:.6px;
  color:var(--muted);margin:6px 8px 10px;
}
.nav-link{
  display:flex;align-items:center;gap:10px;
  padding:12px 12px;font-size:14px;color:var(--muted);
  text-decoration:none;border-radius:10px;margin-bottom:6px;
  transition:background-color .15s,color .15s;
}
.nav-link:hover{background:#f3f5fa;color:var(--text)}
.nav-link.active{background:#edf2f7;color:#2d3748;font-weight:700}

/* Content area */
.content{flex:1;display:flex;flex-direction:column;gap:24px}

/* Solde + Form */
.top-grid{display:grid;grid-template-columns: .9fr 1.1fr; gap:24px}
.panel{
  background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:var(--shadow);
}
.section-title{font-size:16px;font-weight:800;margin-bottom:12px;color:#1a202c}

/* Balances */
.balances{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.balance-card{
  grid-column: span 4;
  background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;
  box-shadow: var(--shadow);
}
.balance-title{font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;font-weight:800}
.balance-value{font-size:28px;font-weight:900}

/* Form */
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px}
.label{font-size:13px;font-weight:700;margin-bottom:6px;color:#2d3748}
.input, .select, .textarea, .date{
  width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;color:#1a202c;
}
.textarea{min-height:84px;resize:vertical}
.hint{font-size:12px;color:#718096;margin-top:6px}
.badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800
}
.badge.info{background:#f7fbff;border:1px solid #cfe3fb;color:#2b6cb0}
.badge.warn{background:#fffaf0;border:1px solid #fde68a;color:#92400e}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:12px 14px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;border:1px solid transparent;
}
.btn.primary{background:linear-gradient(135deg,#2b6cb0,#3182ce);color:#fff;box-shadow:0 6px 16px rgba(49,130,206,.25)}
.btn.ghost{background:#fff;color:#2b6cb0;border-color:#cfe3fb}
.btn.danger{background:#fff;color:#e53e3e;border-color:#fecaca}
.btn:active{transform:translateY(1px)}
.actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}

/* Filters + list */
.filters{display:grid;grid-template-columns: repeat(4,1fr); gap:12px}
.table{
  width:100%;border-collapse:collapse;margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid var(--line);
  background:#fff;box-shadow:var(--shadow);
}
.table th, .table td{padding:12px 14px;border-bottom:1px solid var(--line);font-size:14px;text-align:left}
.table th{background:#f8fafc;font-weight:800;color:#374151}
.status{
  padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;display:inline-block
}
.status.pending{background:#fffaf0;color:#92400e;border:1px solid #fde68a}
.status.approved{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.status.rejected{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
.status.canceled{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb}

/* Responsive */
@media (max-width:1100px){
  .top-grid{grid-template-columns:1fr}
  .balances .balance-card{grid-column: span 6}
}
@media (max-width:800px){
  .main{flex-direction:column}
  .sidebar{width:100%}
  .balances .balance-card{grid-column: span 12}
  .form-row, .form-row-3{grid-template-columns:1fr}
  .filters{grid-template-columns:1fr 1fr}
  .table th:nth-child(6), .table td:nth-child(6){display:none} /* masque colonne commentaire en mobile */
}
`;

function initials(name) {
  const parts = (name || "").trim().split(/\s+/);
  const i1 = parts[0]?.[0] || "";
  const i2 = parts[1]?.[0] || "";
  const res = (i1 + i2).toUpperCase();
  return res || "--";
}

function toDate(str) {
  const [y,m,d] = (str || "").split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function isWeekend(d) {
  const n = d.getDay(); // 0 Sun, 6 Sat
  return n === 0 || n === 6;
}
function isHoliday(d, holidaysSet) {
  return holidaysSet.has(fmt(d));
}

/** Calcule le nombre de jours ouvrés inclusifs entre deux dates, avec ajustements demi-journées */
function businessDaysBetween(startStr, endStr, startHalf, endHalf, holidaysSet) {
  if (!startStr || !endStr) return 0;
  const start = toDate(startStr);
  const end = toDate(endStr);
  if (isNaN(start) || isNaN(end)) return 0;
  if (start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur) && !isHoliday(cur, holidaysSet)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }

  // Ajustements demi-journées
  const sameDay = startStr === endStr;
  // Si premier jour l'après-midi => -0.5
  if (!isWeekend(start) && !isHoliday(start, holidaysSet) && startHalf === "PM") {
    count -= 0.5;
  }
  // Si dernier jour le matin => -0.5 (sauf si même jour déjà géré ci-dessus, on ajuste intelligemment)
  if (!isWeekend(end) && !isHoliday(end, holidaysSet)) {
    if (sameDay) {
      if (startHalf === "AM" && endHalf === "AM") count = Math.min(count, 0.5);
      else if (startHalf === "PM" && endHalf === "PM") count = Math.min(count, 0.5);
      else if (startHalf === "PM" && endHalf === "AM") count = Math.min(count, 0.5); // cas incohérent -> 0.5
      else count = Math.min(count, 1); // AM->PM sur même jour => 1 jour ouvré
    } else {
      if (endHalf === "AM") count -= 0.5;
    }
  }

  return Math.max(0, count);
}

export default function Conges({
  user,
  balances,
  requests,
  holidays,
  onNavigate,
  onLogout,
  onSubmitLeave,
  onCancelRequest,
  onUploadJustif,
}) {
  const u = {
    displayName: "Jean Dupont",
    givenName: "Jean",
    familyName: "Dupont",
    tenantLabel: "Client Démo",
    email: "jean.dupont@entreprise.com",
    ...(user || {}),
  };
  const bal = {
    cp: 15,
    rtt: 6,
    recup: 2,
    sansSolde: 999, // illimité en pratique
    ...(balances || {}),
  };
  const defaultRequests = [
    {
      id: "REQ-2026-001",
      type: "CP",
      startDate: "2026-02-22",
      endDate: "2026-02-24",
      startHalf: "AM",
      endHalf: "PM",
      days: 3,
      status: "approved",
      comment: "Séjour famille",
      createdAt: "2026-02-10",
      approver: "Manager A",
      attachmentsCount: 0,
    },
    {
      id: "REQ-2026-002",
      type: "RTT",
      startDate: "2026-03-12",
      endDate: "2026-03-12",
      startHalf: "PM",
      endHalf: "PM",
      days: 0.5,
      status: "pending",
      comment: "RDV",
      createdAt: "2026-02-14",
      approver: "Manager A",
      attachmentsCount: 1,
    },
    {
      id: "REQ-2026-003",
      type: "Sans solde",
      startDate: "2026-01-08",
      endDate: "2026-01-09",
      startHalf: "AM",
      endHalf: "PM",
      days: 2,
      status: "rejected",
      comment: "—",
      createdAt: "2026-01-05",
      approver: "Manager B",
      attachmentsCount: 0,
    },
  ];
  const [localRequests, setLocalRequests] = useState(requests || defaultRequests);

  const holidaysSet = useMemo(() => new Set(holidays || []), [holidays]);

  // Filtres
  const [fStatus, setFStatus] = useState("");
  const [fType, setFType] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  // Form state
  const [type, setType] = useState("CP");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startHalf, setStartHalf] = useState("AM");
  const [endHalf, setEndHalf] = useState("PM");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const computedDays = useMemo(() => {
    return businessDaysBetween(startDate, endDate, startHalf, endHalf, holidaysSet);
  }, [startDate, endDate, startHalf, endHalf, holidaysSet]);

  const canSubmit = useMemo(() => {
    if (!type || !startDate || !endDate) return false;
    if (computedDays <= 0) return false;
    return true;
  }, [type, startDate, endDate, computedDays]);

  const nav = (route) => {
    if (typeof onNavigate === "function") return onNavigate(route);
    window.location.hash = route; // fallback
  };

  const logout = () => {
    if (typeof onLogout === "function") return onLogout();
    alert("Déconnexion… (branche onLogout() à MSAL)");
  };

  function applyFilters(list) {
    return list.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (fType && r.type !== fType) return false;
      if (fFrom && r.startDate < fFrom) return false;
      if (fTo && r.endDate > fTo) return false;
      return true;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Veuillez compléter le formulaire. Les jours calculés doivent être > 0.");
      return;
    }

    // Règle simple: vérifier le solde si type CP/RTT/Récup
    const required = computedDays;
    if (type === "CP" && bal.cp < required) {
      setError(`Solde CP insuffisant (${bal.cp} restants).`);
      return;
    }
    if (type === "RTT" && bal.rtt < required) {
      setError(`Solde RTT insuffisant (${bal.rtt} restants).`);
      return;
    }
    if (type === "Récup" && bal.recup < required) {
      setError(`Solde Récup insuffisant (${bal.recup} restants).`);
      return;
    }

    const payload = {
      id: `REQ-${Date.now()}`,
      type,
      startDate,
      endDate,
      startHalf,
      endHalf,
      days: required,
      status: "pending",
      comment: reason?.trim() || "",
      createdAt: fmt(new Date()),
      approver: "", // à renseigner côté backend
      attachmentsCount: file ? 1 : 0,
      file, // facultatif, à uploader côté backend
    };

    try {
      setSubmitting(true);
      if (typeof onSubmitLeave === "function") {
        await onSubmitLeave(payload);
      }
      // Optimistic UI
      setLocalRequests((prev) => [payload, ...prev]);
      // Reset form
      setType("CP");
      setStartDate("");
      setEndDate("");
      setStartHalf("AM");
      setEndHalf("PM");
      setReason("");
      setFile(null);
    } catch (err) {
      console.error(err);
      setError("Échec de l’envoi. Réessayez ou contactez le support.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id) {
    const ok = confirm("Confirmer l’annulation de cette demande ?");
    if (!ok) return;
    try {
      if (typeof onCancelRequest === "function") {
        await onCancelRequest(id);
      }
      setLocalRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "canceled" } : r))
      );
    } catch (err) {
      console.error(err);
      alert("Annulation impossible pour le moment.");
    }
  }

  async function handleUpload(id, f) {
    if (!f) return;
    try {
      if (typeof onUploadJustif === "function") {
        await onUploadJustif(id, f);
      }
      setLocalRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, attachmentsCount: (r.attachmentsCount || 0) + 1 } : r))
      );
    } catch (err) {
      console.error(err);
      alert("Upload impossible pour le moment.");
    }
  }

  const filtered = applyFilters(localRequests);

  return (
    <div className="page">
      <style>{styles}</style>

      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div className="app-brand" onClick={() => nav("dashboard")}>
            <div className="logo-dot" aria-hidden="true" />
            <div className="app-title">Synapse — Espace Client</div>
          </div>
          <div className="user-section">
            <div className="user-photo" title={u.email}>
              {initials(u.displayName)}
            </div>
            <div className="user-meta">
              <span className="user-name">{u.displayName}</span>
              <span className="user-tenant">{u.tenantLabel}</span>
            </div>
            <button className="logout-btn" onClick={logout}>Déconnexion</button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="main">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="nav-section-title">Navigation</div>
          <nav>
            <a className="nav-link" onClick={() => nav("dashboard")} href="#dashboard">📊 Tableau de bord</a>
            <a className="nav-link active" onClick={() => nav("conges")} href="#conges">🏖️ Congés</a>
            <a className="nav-link" onClick={() => nav("documents")} href="#documents">📄 Documents</a>
            <a className="nav-link" onClick={() => nav("formations")} href="#formations">🎓 Formations</a>
            <a className="nav-link" onClick={() => nav("equipe")} href="#equipe">👥 Équipe</a>
            <a className="nav-link" onClick={() => nav("paie")} href="#paie">💰 Fiches de paie</a>
            <a className="nav-link" onClick={() => nav("support")} href="#support">🛟 Support</a>
            <a className="nav-link" onClick={() => nav("parametres")} href="#parametres">⚙️ Paramètres</a>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="content">
          {/* SOLDES + FORMULAIRE */}
          <section className="top-grid">
            {/* Soldes */}
            <div className="panel">
              <div className="section-title">Mes soldes</div>
              <div className="balances">
                <div className="balance-card">
                  <div className="balance-title">CP (Congés payés)</div>
                  <div className="balance-value">{bal.cp ?? "—"} jours</div>
                </div>
                <div className="balance-card">
                  <div className="balance-title">RTT</div>
                  <div className="balance-value">{bal.rtt ?? "—"} jours</div>
                </div>
                <div className="balance-card">
                  <div className="balance-title">Récupération</div>
                  <div className="balance-value">{bal.recup ?? "—"} jours</div>
                </div>
              </div>
              <p className="hint" style={{marginTop:10}}>
                <span className="badge info">i</span>&nbsp; Les soldes sont fournis par votre SIRH/SharePoint via le backend.
              </p>
            </div>

            {/* Formulaire demande */}
            <div className="panel">
              <div className="section-title">Demander un congé</div>
              {error && (
                <div className="hint" style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 10 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div>
                    <label className="label">Type</label>
                    <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="CP">CP (Congés payés)</option>
                      <option value="RTT">RTT</option>
                      <option value="Récup">Récupération</option>
                      <option value="Sans solde">Sans solde</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Motif (optionnel)</label>
                    <input
                      className="input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ex: Voyage, RDV médical..."
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div>
                    <label className="label">Date de début</label>
                    <input className="date" type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Demi-journée début</label>
                    <select className="select" value={startHalf} onChange={(e)=>setStartHalf(e.target.value)}>
                      <option value="AM">Matin</option>
                      <option value="PM">Après-midi</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date de fin</label>
                    <input className="date" type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="form-row">
                  <div>
                    <label className="label">Demi-journée fin</label>
                    <select className="select" value={endHalf} onChange={(e)=>setEndHalf(e.target.value)}>
                      <option value="AM">Matin</option>
                      <option value="PM">Après-midi</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Justificatif (optionnel)</label>
                    <input className="input" type="file" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
                  </div>
                </div>

                <div className="actions" style={{justifyContent:"space-between", marginTop:8}}>
                  <span className="badge info">
                    📅 Jours ouvrés calculés : <strong style={{marginLeft:6}}>{computedDays || "—"}</strong>
                  </span>
                  <div className="actions">
                    <button type="button" className="btn ghost" onClick={()=>{
                      setType("CP");setStartDate("");setEndDate("");setStartHalf("AM");setEndHalf("PM");setReason("");setFile(null);setError("");
                    }}>Réinitialiser</button>
                    <button type="submit" className="btn primary" disabled={!canSubmit || submitting}>
                      {submitting ? "Envoi…" : "Soumettre la demande"}
                    </button>
                  </div>
                </div>

                <p className="hint" style={{marginTop:10}}>
                  <span className="badge warn">!</span>&nbsp; Les week‑ends et jours fériés (prop <code>holidays</code>) ne sont pas comptés.
                </p>
              </form>
            </div>
          </section>

          {/* Filtres + liste des demandes */}
          <section className="panel">
            <div className="section-title">Mes demandes</div>
            <div className="filters">
              <div>
                <label className="label">Statut</label>
                <select className="select" value={fStatus} onChange={(e)=>setFStatus(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="pending">En attente</option>
                  <option value="approved">Approuvé</option>
                  <option value="rejected">Refusé</option>
                  <option value="canceled">Annulé</option>
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="select" value={fType} onChange={(e)=>setFType(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="CP">CP</option>
                  <option value="RTT">RTT</option>
                  <option value="Récup">Récup</option>
                  <option value="Sans solde">Sans solde</option>
                </select>
              </div>
              <div>
                <label className="label">Du</label>
                <input className="date" type="date" value={fFrom} onChange={(e)=>setFFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">Au</label>
                <input className="date" type="date" value={fTo} onChange={(e)=>setFTo(e.target.value)} />
              </div>
            </div>

            <table className="table" aria-label="Liste de mes demandes de congés">
              <thead>
                <tr>
                  <th>Demande</th>
                  <th>Période</th>
                  <th>Jours</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Commentaire</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{textAlign:"center", color:"#718096"}}>Aucune demande</td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{fontWeight:800}}>{r.id}</div>
                      <div style={{fontSize:12,color:"#718096"}}>Créée le {r.createdAt || "—"} • {r.approver ? `Approver: ${r.approver}` : "—"}</div>
                    </td>
                    <td>
                      {r.startDate} {r.startHalf ? `(${r.startHalf})` : ""} → {r.endDate} {r.endHalf ? `(${r.endHalf})` : ""}
                    </td>
                    <td><strong>{r.days}</strong></td>
                    <td>{r.type}</td>
                    <td>
                      <span className={`status ${r.status}`}>
                        {r.status === "pending" && "En attente"}
                        {r.status === "approved" && "Approuvé"}
                        {r.status === "rejected" && "Refusé"}
                        {r.status === "canceled" && "Annulé"}
                      </span>
                    </td>
                    <td style={{color:"#4a5568"}}>{r.comment || "—"}</td>
                    <td>
                      <div className="actions">
                        {r.status === "pending" && (
                          <button className="btn danger" onClick={() => handleCancel(r.id)}>Annuler</button>
                        )}
                        <label className="btn ghost" style={{cursor:"pointer"}}>
                          Joindre justificatif {r.attachmentsCount ? `(${r.attachmentsCount})` : ""}
                          <input type="file" style={{display:"none"}}
                            onChange={(e)=>handleUpload(r.id, e.target.files?.[0])}/>
                        </label>
                        <button className="btn ghost" onClick={() => nav("documents")}>Ouvrir dossier</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="hint" style={{textAlign:"center"}}>
            Données stockées côté serveur (Microsoft Graph / SharePoint). Cette page n’expose aucune clé ni accès direct.
          </p>
        </main>
      </div>
    </div>
  );
}
