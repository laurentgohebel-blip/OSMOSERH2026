import React, { useEffect, useMemo, useState } from "react";
import {
  getWorkflows, getWorkflowRuns, startWorkflow, getWorkflowRun,
  saveWorkflowFiche, completeWorkflowStep, revertWorkflowStep, getWorkflowDocument,
  getDpaeXml, teledeclarerDpae, scanFicheDocuments, SYNAPSE_API,
} from "../services/synapseApi.js";
/** Lit un fichier image et le réduit (≤2400px, JPEG qualité élevée pour l'OCR). */
function fileToScaledDataUrl(file, maxDim = 2400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.92));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Un fichier → data URI : PDF envoyé BRUT (l'OCR le lit nativement), image réduite. */
function fileToDataUri(file) {
  if (file.type !== "application/pdf") return fileToScaledDataUrl(file);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

/**
 * Workflows — situations guidées (ex. Embauche).
 * On part d'une situation, on remplit la fiche une fois, puis chaque étape
 * produit son document. Vue liste (démarrer / reprendre) + vue stepper guidé.
 */

const styles = `
.wf-wrap { display:flex; flex-direction:column; gap:18px; }
.wf-h { font-size:17px; font-weight:800; color:#1a202c; }
.wf-sub { font-size:13px; color:#64748b; }

.wf-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; }
.wf-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; cursor:pointer;
  display:flex; flex-direction:column; gap:8px; transition:.15s; }
.wf-card:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,0,0,.08); border-color:#c4b5fd; }
.wf-card-ic { font-size:28px; }
.wf-card-t { font-size:15px; font-weight:800; color:#1a202c; }
.wf-card-s { font-size:12px; color:#94a3b8; }

.wf-runs { display:flex; flex-direction:column; gap:8px; }
.wf-run { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px;
  display:flex; align-items:center; justify-content:space-between; gap:10px; }
.wf-run-t { font-size:14px; font-weight:700; }
.wf-run-meta { font-size:12px; color:#94a3b8; }
.wf-mini { width:120px; height:6px; background:#edf2f7; border-radius:99px; overflow:hidden; }
.wf-mini-f { height:100%; background:linear-gradient(90deg,#7c3aed,#a78bfa); }

.wf-back { background:none; border:none; color:#7c3aed; font-weight:700; font-size:13px; cursor:pointer; padding:0; }
.wf-run-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.wf-bar { height:6px; background:#edf2f7; border-radius:99px; overflow:hidden; }
.wf-bar-f { height:100%; background:linear-gradient(90deg,#7c3aed,#a78bfa); transition:width .4s; }

.wf-steps { display:flex; flex-direction:column; gap:10px; }
.wf-step { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; display:flex; gap:14px; }
.wf-step.current { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.08); }
.wf-step.future { opacity:.6; }
.wf-ic { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:16px; }
.wf-ic.done { background:#ecfdf5; color:#059669; }
.wf-ic.current { background:#f5f3ff; color:#7c3aed; }
.wf-ic.future { background:#f1f5f9; color:#94a3b8; }
.wf-step-body { flex:1; min-width:0; }
.wf-step-t { font-size:14px; font-weight:800; color:#1a202c; }
.wf-step-s { font-size:12px; color:#94a3b8; margin-top:1px; }
.wf-step-actions { margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; }

.wf-form { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
.wf-field { display:flex; flex-direction:column; gap:4px; }
.wf-field.full { grid-column:1 / -1; }
.wf-field label { font-size:12px; font-weight:700; color:#475569; }
.wf-field input, .wf-field select, .wf-field textarea {
  padding:9px 11px; border:1px solid #cbd5e0; border-radius:8px; font-size:14px; font-family:inherit; }
.wf-req { color:#e53e3e; }

.btn { padding:9px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; border:1px solid transparent; }
.btn.primary { background:linear-gradient(135deg,#6d28d9,#7c3aed); color:#fff; }
.btn.ghost { background:#fff; color:#475569; border-color:#e2e8f0; }
.btn:disabled { opacity:.5; cursor:not-allowed; }

.wf-err { background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:16px; color:#9a3412; font-size:13px; }
.wf-err code { background:#fff; padding:2px 6px; border-radius:5px; border:1px solid #fed7aa; }
.wf-done-banner { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:12px; padding:16px 18px; font-size:14px; font-weight:700; }

.wf-modal-ov { position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
.wf-modal { background:#fff; border-radius:14px; width:100%; max-width:820px; height:86vh; display:flex; flex-direction:column; overflow:hidden; }
.wf-modal-h { padding:14px 18px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
.wf-modal iframe { flex:1; border:none; width:100%; }

@media(max-width:700px){ .wf-form { grid-template-columns:1fr; } .wf-step { flex-wrap:wrap; } }
`;

function pct(steps) {
  if (!steps?.length) return 0;
  return Math.round((steps.filter(s => s.status === "done").length / steps.length) * 100);
}

const ACTION_LABEL = {
  onboarding: "⚡ Déclencher l'onboarding",
  visiteMedicale: "📅 Créer l'échéance",
  titreSejour: "✓ Marquer vérifié",
  conformite: "✓ Marquer vérifié",
  mutuelle: "✓ Marquer affilié",
  registre: "✓ Enregistrer l'entrée",
};

export default function Workflows() {
  const [catalog, setCatalog] = useState([]);
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);          // run sélectionné (null = vue liste)
  const [fiche, setFiche] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState(null);          // { key, html }
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  function loadList() {
    setLoading(true); setError("");
    Promise.all([getWorkflows(), getWorkflowRuns()])
      .then(([w, r]) => { setCatalog(w.workflows || []); setRuns(r.runs || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadList(); }, []);

  function openRun(r) {
    setRun(r);
    setFiche(r.fiche || {});
  }
  async function start(type) {
    setBusy(true); setError("");
    try { openRun(await startWorkflow(type)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function reload(id) {
    const r = await getWorkflowRun(id);
    setRun(r); setFiche(r.fiche || {});
  }
  async function handleSaveFiche() {
    setBusy(true); setError("");
    try { setRun(await saveWorkflowFiche(run.id, fiche)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function handleStep(key) {
    setBusy(true); setError("");
    try { setRun(await completeWorkflowStep(run.id, key)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function revertStep(key) {
    setBusy(true); setError("");
    try { setRun(await revertWorkflowStep(run.id, key)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function viewDoc(key) {
    try { setDoc({ key, html: await getWorkflowDocument(run.id, key) }); }
    catch (e) { setError(e.message); }
  }
  function printDoc() {
    const fr = document.getElementById("wf-doc-frame");
    if (fr && fr.contentWindow) { fr.contentWindow.focus(); fr.contentWindow.print(); }
  }
  async function viewXml() {
    try {
      const xml = await getDpaeXml(run.id);
      const esc = xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      setDoc({ key: "xml", html: `<pre style="padding:20px;white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;color:#1a202c;margin:0">${esc}</pre>` });
    } catch (e) { setError(e.message); }
  }
  async function teledeclarer() {
    setBusy(true); setError("");
    try { setRun(await teledeclarerDpae(run.id)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function handleScan(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setScanning(true); setError(""); setScanMsg("");
    try {
      const docs = [];
      for (const f of files) docs.push(await fileToDataUri(f));
      if (!docs.length) { setScanMsg("Aucun document exploitable."); return; }
      const { fields } = await scanFicheDocuments(docs);
      const keys = Object.keys(fields || {});
      if (!keys.length) {
        setScanMsg(`Aucune donnée détectée dans ${files.length} document(s).`);
      } else {
        setFiche(p => ({ ...p, ...fields }));
        const labels = Object.fromEntries(run.ficheFields.map(f => [f.key, f.label]));
        setScanMsg(`✨ ${keys.length} champ(s) pré-rempli(s) depuis ${files.length} document(s) : ${keys.map(k => labels[k] || k).join(", ")}. Vérifiez avant d'enregistrer.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  const currentKey = useMemo(() => run?.steps?.find(s => s.status !== "done")?.key, [run]);

  // ── Vue liste ──────────────────────────────────────────────────────────────
  if (!run) {
    return (
      <div className="wf-wrap">
        <style>{styles}</style>
        <div>
          <div className="wf-h">🚀 Démarrer une situation</div>
          <div className="wf-sub">Choisissez ce que vous avez à faire — l'outil vous guide étape par étape.</div>
        </div>

        {error && <div className="wf-err"><strong>Backend injoignable.</strong> Lancez <code>npm run dev</code> dans <code>synapse-core</code> ({SYNAPSE_API}). <div style={{marginTop:6,opacity:.8}}>{error}</div></div>}
        {loading && <div className="wf-sub">Chargement…</div>}

        <div className="wf-cards">
          {catalog.map(w => (
            <div className="wf-card" key={w.type} onClick={() => !busy && start(w.type)}>
              <div className="wf-card-ic">🚀</div>
              <div className="wf-card-t">{w.label}</div>
              <div className="wf-card-s">{w.steps} étapes guidées</div>
            </div>
          ))}
        </div>

        {runs.filter(r => r.status !== "done").length > 0 && (
          <div>
            <div className="wf-h" style={{ fontSize: 15, marginBottom: 8 }}>En cours</div>
            <div className="wf-runs">
              {runs.filter(r => r.status !== "done").map(r => (
                <div className="wf-run" key={r.id}>
                  <div>
                    <div className="wf-run-t">{r.title || r.label}</div>
                    <div className="wf-run-meta">{r.steps.filter(s => s.status === "done").length}/{r.steps.length} étapes</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="wf-mini"><div className="wf-mini-f" style={{ width: `${pct(r.steps)}%` }} /></div>
                    <button className="btn ghost" onClick={() => openRun(r)}>Reprendre</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vue stepper ────────────────────────────────────────────────────────────
  const progress = pct(run.steps);
  return (
    <div className="wf-wrap">
      <style>{styles}</style>

      <button className="wf-back" onClick={() => { setRun(null); loadList(); }}>← Toutes les situations</button>

      <div className="wf-run-head">
        <div>
          <div className="wf-h">{run.title || run.label}</div>
          <div className="wf-sub">{run.steps.filter(s => s.status === "done").length} / {run.steps.length} étapes · {progress}%</div>
        </div>
      </div>
      <div className="wf-bar"><div className="wf-bar-f" style={{ width: `${progress}%` }} /></div>

      {error && <div className="wf-err">{error}</div>}
      {run.status === "done" && <div className="wf-done-banner">✅ Situation terminée — tous les documents sont générés et l'onboarding est lancé.</div>}

      <div className="wf-steps">
        {run.steps.map(s => {
          const isDone = s.status === "done";
          const isCurrent = s.key === currentKey;
          const cls = isDone ? "done" : isCurrent ? "current" : "future";
          return (
            <div className={`wf-step ${isCurrent ? "current" : isDone ? "" : "future"}`} key={s.key}>
              <div className={`wf-ic ${cls}`}>{isDone ? "✓" : isCurrent ? "▶" : "•"}</div>
              <div className="wf-step-body">
                <div className="wf-step-t">{s.label}</div>
                <div className="wf-step-s">{s.sub}</div>

                {/* Étape fiche en cours → formulaire */}
                {isCurrent && s.kind === "form" && (
                  <>
                    <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f5f3ff", border: "1px dashed #c4b5fd", borderRadius: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#5b21b6" }}>📷 Scanner un document pour gagner du temps</div>
                      <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0 8px" }}>Pièce d'identité, carte vitale, RIB… images ou PDF, plusieurs à la fois. L'IA pré-remplit la fiche, vous validez ensuite.</div>
                      <label className="btn ghost" style={{ cursor: scanning ? "wait" : "pointer", display: "inline-flex" }}>
                        {scanning ? "Analyse en cours…" : "📎 Choisir un ou plusieurs documents"}
                        <input type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} onChange={handleScan} disabled={scanning} />
                      </label>
                      {scanMsg && <div style={{ fontSize: 12, color: scanMsg.startsWith("✨") ? "#065f46" : "#92400e", marginTop: 8 }}>{scanMsg}</div>}
                    </div>
                    <div className="wf-form">
                      {run.ficheFields
                        .filter(f => !f.when || (f.when.in || []).includes(fiche[f.when.field]))
                        .map(f => (
                        <div className={`wf-field${f.type === "textarea" ? " full" : ""}`} key={f.key}>
                          <label>{f.label}{f.required && <span className="wf-req"> *</span>}</label>
                          {f.type === "select" ? (
                            <select value={fiche[f.key] || ""} onChange={e => setFiche(p => ({ ...p, [f.key]: e.target.value }))}>
                              <option value="">—</option>
                              {f.options.map(o => <option key={o}>{o}</option>)}
                            </select>
                          ) : f.type === "textarea" ? (
                            <textarea rows={2} value={fiche[f.key] || ""} onChange={e => setFiche(p => ({ ...p, [f.key]: e.target.value }))} />
                          ) : (
                            <input type={f.type} value={fiche[f.key] || ""} onChange={e => setFiche(p => ({ ...p, [f.key]: e.target.value }))} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="wf-step-actions">
                      <button className="btn primary" disabled={busy} onClick={handleSaveFiche}>
                        {busy ? "Enregistrement…" : "Enregistrer la fiche & continuer"}
                      </button>
                    </div>
                  </>
                )}

                {/* Étape document en cours → générer */}
                {isCurrent && s.kind === "document" && (
                  <div className="wf-step-actions">
                    <button className="btn primary" disabled={busy} onClick={() => handleStep(s.key)}>
                      {busy ? "Génération…" : `📄 Générer ${s.label}`}
                    </button>
                  </div>
                )}

                {/* Étape action en cours → bouton contextuel selon l'étape */}
                {isCurrent && s.kind === "action" && (
                  <div className="wf-step-actions">
                    <button className="btn primary" disabled={busy} onClick={() => handleStep(s.key)}>
                      {busy ? "…" : (ACTION_LABEL[s.key] || "✓ Marquer fait")}
                    </button>
                  </div>
                )}

                {/* Étape document faite → voir + (DPAE) télédéclarer */}
                {isDone && s.kind === "document" && (
                  <div className="wf-step-actions" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn ghost" onClick={() => viewDoc(s.key)}>👁️ Voir le document</button>
                      {s.key === "dpae" && <button className="btn ghost" onClick={viewXml}>🧾 Voir le XML</button>}
                      {s.key === "dpae" && !s.teledeclaration && (
                        <button className="btn primary" disabled={busy} onClick={teledeclarer}>📨 Télédéclarer à l'URSSAF</button>
                      )}
                    </div>
                    {s.key === "dpae" && s.teledeclaration && (
                      <div style={{ fontSize: 12, color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                        ✅ Déposée à l'URSSAF — réf. <strong>{s.teledeclaration.depositId}</strong>
                        {s.teledeclaration.aee?.recu && " · accusé reçu (AEE)"}
                        {s.teledeclaration.mode === "simulation" && <span style={{ marginLeft: 6, color: "#92400e", fontWeight: 700 }}>· mode simulation</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Étape action faite ayant créé une échéance → note */}
                {isDone && s.kind === "action" && s.echeance && (
                  <div style={{ fontSize: 12, color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>
                    📅 Échéance créée — visible dans l'onglet « À traiter »
                  </div>
                )}

                {/* Toute étape faite → possibilité de revenir en arrière */}
                {isDone && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => revertStep(s.key)}>↩ Revenir / modifier</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {doc && (
        <div className="wf-modal-ov" onClick={e => e.target === e.currentTarget && setDoc(null)}>
          <div className="wf-modal">
            <div className="wf-modal-h">
              <strong>Document généré</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn primary" onClick={printDoc}>🖨️ Télécharger / Imprimer</button>
                <button className="btn ghost" onClick={() => setDoc(null)}>Fermer</button>
              </div>
            </div>
            <iframe id="wf-doc-frame" title="document" srcDoc={doc.html} />
          </div>
        </div>
      )}
    </div>
  );
}
