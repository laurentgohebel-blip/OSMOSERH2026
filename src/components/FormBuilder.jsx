import React, { useState, useRef, useEffect, useCallback } from "react";

/**
 * FormBuilder — Constructeur de formulaires RH → PDF
 * Intégré dans AdminRH via l'onglet "Formulaires"
 *
 * Props:
 *  - user:         { displayName, givenName, ... }
 *  - templates:    Array<FormTemplate>  (stockés via graphService writeJsonData)
 *  - onSave:       (template) => void
 *  - onDelete:     (id) => void
 *  - graphUser:    objet Graph /me (pour pré-remplissage)
 */

// ─── Types de champs disponibles ─────────────────────────────────────────────
const FIELD_TYPES = [
  { type:"text",      icon:"✏️",  label:"Texte court",       desc:"Nom, prénom, adresse…" },
  { type:"textarea",  icon:"📝",  label:"Texte long",        desc:"Description, observations…" },
  { type:"date",      icon:"📅",  label:"Date",              desc:"Date de naissance, contrat…" },
  { type:"select",    icon:"🔽",  label:"Liste déroulante",  desc:"Choix parmi des options" },
  { type:"checkbox",  icon:"☑️",  label:"Case à cocher",     desc:"Oui/Non, acceptation…" },
  { type:"signature", icon:"✍️",  label:"Signature",         desc:"Signature électronique" },
  { type:"graph",     icon:"🔗",  label:"Pré-rempli Graph",  desc:"Données depuis Microsoft 365" },
];

// Champs disponibles depuis Microsoft Graph
const GRAPH_KEYS = [
  { key:"displayName",    label:"Nom complet" },
  { key:"givenName",      label:"Prénom" },
  { key:"surname",        label:"Nom de famille" },
  { key:"jobTitle",       label:"Poste / Titre" },
  { key:"department",     label:"Service / Département" },
  { key:"mail",           label:"Adresse email" },
  { key:"mobilePhone",    label:"Téléphone mobile" },
  { key:"officeLocation", label:"Bureau / Localisation" },
];

// ─── Templates de documents prédéfinis ───────────────────────────────────────
const DOC_TYPES = [
  { type:"attestation",  icon:"🏛️",  label:"Attestation employeur",  color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe", desc:"Attestation de travail, de salaire ou d'emploi." },
  { type:"contrat",      icon:"📋",  label:"Contrat de travail",      color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe", desc:"CDI, CDD, alternance, stage." },
  { type:"avenant",      icon:"📎",  label:"Avenant au contrat",      color:"#0891b2", bg:"#f0f9ff", border:"#bae6fd", desc:"Modification du contrat existant." },
  { type:"onboarding",   icon:"🚀",  label:"Fiche d'onboarding",      color:"#059669", bg:"#f0fdf4", border:"#a7f3d0", desc:"Accueil et intégration d'un nouveau collaborateur." },
  { type:"poste",        icon:"👤",  label:"Fiche de poste",          color:"#d97706", bg:"#fffbeb", border:"#fde68a", desc:"Missions, responsabilités, compétences requises." },
  { type:"frais",        icon:"💸",  label:"Note de frais",           color:"#dc2626", bg:"#fff0f0", border:"#fca5a5", desc:"Remboursement de frais professionnels." },
  { type:"materiel",     icon:"🖥️",  label:"Demande de matériel",     color:"#4b5563", bg:"#f9fafb", border:"#e5e7eb", desc:"Équipements, fournitures, logiciels." },
  { type:"custom",       icon:"✨",  label:"Modèle personnalisé",     color:"#7c3aed", bg:"#faf5ff", border:"#e9d5ff", desc:"Créez un formulaire sur-mesure." },
];

// ─── Modèles de démo pré-chargés ─────────────────────────────────────────────
const DEMO_TEMPLATES = [
  {
    id:"tpl1", type:"attestation", titre:"Attestation employeur standard",
    description:"Certifie qu'un collaborateur est bien employé dans l'entreprise.",
    usageCount:42, createdAt:"2026-01-10",
    fields:[
      { id:"f1", type:"graph",  label:"Nom complet",        graphKey:"displayName", required:true },
      { id:"f2", type:"graph",  label:"Poste occupé",       graphKey:"jobTitle",    required:true },
      { id:"f3", type:"graph",  label:"Service",            graphKey:"department",  required:true },
      { id:"f4", type:"date",   label:"Date d'entrée",      required:true, placeholder:"" },
      { id:"f5", type:"select", label:"Type de contrat",    required:true, options:["CDI","CDD","Alternance","Stage","Intérim"] },
      { id:"f6", type:"text",   label:"Salaire brut mensuel", required:false, placeholder:"Ex : 3 200 €" },
      { id:"f7", type:"date",   label:"Date de l'attestation", required:true },
      { id:"f8", type:"signature", label:"Signature du RH", required:true },
    ]
  },
  {
    id:"tpl2", type:"onboarding", titre:"Fiche d'onboarding",
    description:"Recueil des informations nécessaires à l'intégration d'un nouveau collaborateur.",
    usageCount:18, createdAt:"2026-01-20",
    fields:[
      { id:"f1", type:"graph",    label:"Prénom",             graphKey:"givenName",    required:true },
      { id:"f2", type:"graph",    label:"Nom",                graphKey:"surname",      required:true },
      { id:"f3", type:"graph",    label:"Email professionnel",graphKey:"mail",         required:true },
      { id:"f4", type:"date",     label:"Date de début",      required:true },
      { id:"f5", type:"text",     label:"Manager direct",     required:true, placeholder:"Nom du responsable" },
      { id:"f6", type:"select",   label:"Site de travail",    required:true, options:["Paris","Lyon","Bordeaux","Télétravail","Autre"] },
      { id:"f7", type:"checkbox", label:"Ordinateur fourni",  required:false },
      { id:"f8", type:"checkbox", label:"Badge d'accès créé", required:false },
      { id:"f9", type:"checkbox", label:"Email configuré",    required:false },
      { id:"f10",type:"textarea", label:"Notes d'intégration",required:false, placeholder:"Informations complémentaires…" },
      { id:"f11",type:"signature",label:"Signature collaborateur", required:true },
    ]
  },
  {
    id:"tpl3", type:"frais", titre:"Note de frais",
    description:"Demande de remboursement de frais professionnels.",
    usageCount:67, createdAt:"2026-01-05",
    fields:[
      { id:"f1", type:"graph",    label:"Nom complet",      graphKey:"displayName", required:true },
      { id:"f2", type:"graph",    label:"Service",          graphKey:"department",  required:true },
      { id:"f3", type:"date",     label:"Date de la dépense", required:true },
      { id:"f4", type:"select",   label:"Nature de la dépense", required:true, options:["Transport","Hébergement","Repas","Fournitures","Téléphone","Autre"] },
      { id:"f5", type:"text",     label:"Montant TTC (€)",  required:true, placeholder:"Ex : 47.50" },
      { id:"f6", type:"text",     label:"Justificatif n°",  required:false, placeholder:"Réf. facture" },
      { id:"f7", type:"textarea", label:"Description",      required:true, placeholder:"Détail de la dépense…" },
      { id:"f8", type:"signature",label:"Signature",        required:true },
    ]
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return "f" + Date.now() + Math.random().toString(36).slice(2,6); }
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" }); }
  catch { return d; }
}
function getDocType(type) { return DOC_TYPES.find(d => d.type === type) || DOC_TYPES[7]; }

// ─── Génération PDF (HTML → print) ───────────────────────────────────────────
function generatePDF(template, formData, sigDataURL) {
  const dt    = getDocType(template.type);
  const today = new Date().toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" });

  const rows = template.fields.map(f => {
    let val = formData[f.id] ?? "";
    if (f.type === "checkbox")  val = val ? "☑ Oui" : "☐ Non";
    if (f.type === "signature") val = sigDataURL?.[f.id]
      ? `<img src="${sigDataURL[f.id]}" style="height:60px;border-bottom:1px solid #ccc;" />`
      : "<em style='color:#aaa'>Non signé</em>";
    if (f.type === "date" && val) val = fmtDate(val);
    return `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#6b7280;font-weight:600;
          border-bottom:1px solid #f0f0f0;width:40%;vertical-align:top;">${f.label}${f.required ? " *" : ""}</td>
        <td style="padding:10px 14px;font-size:13px;color:#1a202c;
          border-bottom:1px solid #f0f0f0;vertical-align:top;">${val || "<em style='color:#ccc'>—</em>"}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${template.titre}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background:#fff; color:#1a202c; }
    @media print {
      body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    .doc-wrapper { max-width:780px; margin:0 auto; padding:40px 48px; }
    .header-bar { height:6px; background:linear-gradient(90deg,${dt.color},${dt.color}99); border-radius:3px; margin-bottom:32px; }
    .doc-title { font-size:22px; font-weight:900; color:#1a202c; margin-bottom:6px; }
    .doc-meta  { font-size:13px; color:#94a3b8; margin-bottom:28px; display:flex; gap:16px; }
    .doc-meta span { display:flex; align-items:center; gap:5px; }
    table { width:100%; border-collapse:collapse; margin-bottom:28px; }
    .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb;
      font-size:12px; color:#94a3b8; display:flex; justify-content:space-between; }
    .print-btn { 
      position:fixed; top:20px; right:20px; z-index:999;
      background:#7c3aed; color:#fff; border:none; padding:12px 24px;
      border-radius:10px; font-size:14px; font-weight:700; cursor:pointer;
      box-shadow:0 4px 16px rgba(124,58,237,.4);
    }
  </style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
  <div class="doc-wrapper">
    <div class="header-bar"></div>
    <div class="doc-title">${dt.icon} ${template.titre}</div>
    <div class="doc-meta">
      <span>📄 ${dt.label}</span>
      <span>📅 Généré le ${today}</span>
    </div>
    <table>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <span>Document généré par Synapse RH</span>
      <span>${today}</span>
    </div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Autorisez les popups pour générer le PDF."); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Canvas Signature ─────────────────────────────────────────────────────────
function SignatureCanvas({ onChange }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function start(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const pos    = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    drawing.current = true;
  }
  function draw(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const pos    = getPos(e, canvas);
    ctx.lineWidth = 2; ctx.strokeStyle = "#1a202c"; ctx.lineCap = "round";
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
  }
  function end() {
    drawing.current = false;
    if (onChange) onChange(canvasRef.current.toDataURL());
  }
  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (onChange) onChange(null);
  }

  return (
    <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", background:"#fafafa" }}>
      <canvas ref={canvasRef} width={400} height={120} style={{ display:"block", cursor:"crosshair", width:"100%" }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
      />
      <div style={{ padding:"6px 10px", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#94a3b8" }}>Signez dans la zone ci-dessus</span>
        <button onClick={clear} style={{ fontSize:12, color:"#dc2626", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Effacer</button>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
.fb-mosaic { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
.fb-card {
  background:#fff; border:1px solid #e2e8f0; border-radius:14px;
  padding:20px; cursor:pointer; transition:box-shadow .15s,transform .12s;
  display:flex; flex-direction:column; gap:10px; position:relative; overflow:hidden;
}
.fb-card::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; }
.fb-card:hover { box-shadow:0 8px 28px rgba(0,0,0,.1); transform:translateY(-2px); }
.fb-card.new-card { border:2px dashed #d1d5db; background:#fafafa; align-items:center; justify-content:center; }
.fb-card.new-card:hover { border-color:#7c3aed; background:#f5f3ff; }
.fb-card-icon { font-size:28px; }
.fb-card-title { font-size:14px; font-weight:800; color:#1a202c; }
.fb-card-desc { font-size:12px; color:#94a3b8; line-height:1.5; flex:1; }
.fb-card-footer { display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; margin-top:4px; }

/* Builder layout */
.fb-builder { display:grid; grid-template-columns:240px 1fr 280px; gap:0; min-height:600px;
  border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; background:#fff; }
.fb-palette { background:#f8fafc; border-right:1px solid #e2e8f0; padding:16px; }
.fb-palette-title { font-size:12px; text-transform:uppercase; letter-spacing:.5px;
  color:#6b7280; font-weight:800; margin-bottom:12px; }
.fb-type-btn { display:flex; align-items:center; gap:10px; width:100%;
  background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px;
  cursor:pointer; margin-bottom:6px; font-size:13px; color:#374151; font-weight:600;
  transition:border-color .15s,background .15s; }
.fb-type-btn:hover { border-color:#7c3aed; background:#f5f3ff; color:#7c3aed; }
.fb-canvas { padding:20px; overflow-y:auto; }
.fb-canvas-title { font-size:12px; text-transform:uppercase; letter-spacing:.5px;
  color:#6b7280; font-weight:800; margin-bottom:16px; }
.fb-field-item {
  background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:14px;
  margin-bottom:10px; display:flex; align-items:flex-start; gap:10px;
  cursor:default; transition:box-shadow .1s;
}
.fb-field-item:hover { box-shadow:0 2px 12px rgba(0,0,0,.08); }
.fb-field-item.selected { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.08); }
.fb-field-drag { color:#d1d5db; cursor:grab; font-size:18px; padding-top:2px; }
.fb-field-body { flex:1; min-width:0; }
.fb-field-label { font-size:14px; font-weight:700; color:#1a202c; }
.fb-field-type { font-size:11px; color:#94a3b8; margin-top:2px; }
.fb-field-actions { display:flex; gap:4px; }
.fb-field-btn { background:none; border:none; cursor:pointer; font-size:16px;
  color:#d1d5db; padding:2px 4px; transition:color .15s; }
.fb-field-btn:hover { color:#374151; }

/* Config panel */
.fb-config { border-left:1px solid #e2e8f0; padding:16px; overflow-y:auto; }
.fb-config-title { font-size:12px; text-transform:uppercase; letter-spacing:.5px;
  color:#6b7280; font-weight:800; margin-bottom:16px; }
.fb-empty-config { text-align:center; padding:40px 12px; color:#cbd5e1; }
.cfg-field { margin-bottom:14px; }
.cfg-label { font-size:12px; font-weight:700; color:#374151; margin-bottom:5px; display:block; }
.cfg-input,.cfg-select,.cfg-textarea { width:100%; padding:8px 10px;
  border:1px solid #e2e8f0; border-radius:8px; font-size:13px; color:#1a202c; }
.cfg-input:focus,.cfg-select:focus { outline:none; border-color:#7c3aed; }
.cfg-toggle { display:flex; align-items:center; gap:8px; cursor:pointer; }
.cfg-toggle input { accent-color:#7c3aed; width:16px; height:16px; }

/* Toolbar */
.fb-toolbar { display:flex; align-items:center; justify-content:space-between;
  padding:14px 20px; background:#fff; border-bottom:1px solid #e2e8f0;
  border-radius:14px 14px 0 0; gap:12px; }
.fb-toolbar-left { display:flex; align-items:center; gap:12px; }
.fb-toolbar-title { font-size:16px; font-weight:800; color:#1a202c; }

/* Preview form */
.pv-field { margin-bottom:18px; }
.pv-label { font-size:13px; font-weight:700; color:#374151; margin-bottom:6px; display:block; }
.pv-input,.pv-select,.pv-textarea { width:100%; padding:10px 12px;
  border:1px solid #e2e8f0; border-radius:8px; font-size:14px; color:#1a202c; background:#fff; }
.pv-graph-val { padding:10px 12px; background:#f0f9ff; border:1px solid #bae6fd;
  border-radius:8px; font-size:14px; color:#0c4a6e; font-weight:600; }

@media(max-width:1200px){ .fb-mosaic{grid-template-columns:repeat(3,1fr);} }
@media(max-width:900px){ .fb-mosaic{grid-template-columns:repeat(2,1fr);} .fb-builder{grid-template-columns:1fr;} }
@media(max-width:600px){ .fb-mosaic{grid-template-columns:1fr;} }
`;

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function FormBuilder({ user, templates: tplProp, onSave, onDelete, graphUser }) {

  const [templates, setTemplates] = useState(tplProp || DEMO_TEMPLATES);
  const [view,      setView]      = useState("mosaic"); // mosaic | builder | preview
  const [current,   setCurrent]   = useState(null);     // template en cours d'édition
  const [selected,  setSelected]  = useState(null);     // champ sélectionné (id)
  const [formData,  setFormData]  = useState({});       // données remplies en preview
  const [sigData,   setSigData]   = useState({});       // signatures canvas
  const [toast,     setToast]     = useState(null);

  // ── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ── Ouvrir un template existant ──────────────────────────────────────────
  function openTemplate(tpl) {
    setCurrent(JSON.parse(JSON.stringify(tpl))); // deep copy
    setSelected(null);
    setView("builder");
  }

  // ── Nouveau template ─────────────────────────────────────────────────────
  function newTemplate(docType) {
    const dt = getDocType(docType);
    setCurrent({
      id: "tpl" + Date.now(),
      type: docType,
      titre: dt.label + " — Nouveau modèle",
      description: dt.desc,
      usageCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      fields: [],
    });
    setSelected(null);
    setView("builder");
  }

  // ── Sauvegarder le template ───────────────────────────────────────────────
  function saveTemplate() {
    setTemplates(prev => {
      const exists = prev.find(t => t.id === current.id);
      return exists ? prev.map(t => t.id === current.id ? current : t) : [current, ...prev];
    });
    if (typeof onSave === "function") onSave(current);
    showToast("✅ Modèle sauvegardé");
    setView("mosaic");
  }

  // ── Supprimer template ────────────────────────────────────────────────────
  function deleteTemplate(id) {
    if (!window.confirm("Supprimer ce modèle ?")) return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (typeof onDelete === "function") onDelete(id);
    showToast("🗑️ Modèle supprimé");
  }

  // ── Ajouter un champ ─────────────────────────────────────────────────────
  function addField(type) {
    const ft   = FIELD_TYPES.find(f => f.type === type);
    const newF = {
      id:       uid(),
      type,
      label:    ft.label,
      required: false,
      placeholder: "",
      ...(type === "select"    ? { options:["Option 1","Option 2"] } : {}),
      ...(type === "graph"     ? { graphKey:"displayName" } : {}),
    };
    setCurrent(c => ({ ...c, fields:[...c.fields, newF] }));
    setSelected(newF.id);
  }

  // ── Mettre à jour un champ ────────────────────────────────────────────────
  function updateField(id, patch) {
    setCurrent(c => ({ ...c, fields: c.fields.map(f => f.id === id ? {...f,...patch} : f) }));
  }

  // ── Déplacer un champ ─────────────────────────────────────────────────────
  function moveField(id, dir) {
    setCurrent(c => {
      const arr = [...c.fields];
      const idx = arr.findIndex(f => f.id === id);
      if (dir === "up"   && idx > 0)              [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
      if (dir === "down" && idx < arr.length - 1) [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
      return { ...c, fields: arr };
    });
  }

  // ── Supprimer un champ ────────────────────────────────────────────────────
  function removeField(id) {
    setCurrent(c => ({ ...c, fields: c.fields.filter(f => f.id !== id) }));
    if (selected === id) setSelected(null);
  }

  // ── Preview mode : pré-remplir depuis Graph ───────────────────────────────
  function initPreviewData() {
    const data = {};
    (current?.fields || []).forEach(f => {
      if (f.type === "graph" && graphUser?.[f.graphKey]) {
        data[f.id] = graphUser[f.graphKey];
      }
    });
    setFormData(data);
    setSigData({});
  }

  // ── Champ sélectionné ─────────────────────────────────────────────────────
  const selField = current?.fields?.find(f => f.id === selected);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>

      {/* ══ VUE MOSAÏQUE ══════════════════════════════════════════════════ */}
      {view === "mosaic" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"#1a202c" }}>Constructeur de formulaires</div>
              <div style={{ fontSize:13, color:"#94a3b8", marginTop:3 }}>
                Créez des modèles de formulaires qui génèrent automatiquement des documents PDF.
              </div>
            </div>
          </div>

          {/* Modèles existants */}
          {templates.length > 0 && (
            <>
              <div style={{ fontSize:13, fontWeight:700, color:"#6b7280", textTransform:"uppercase",
                letterSpacing:".5px", marginBottom:12 }}>Mes modèles ({templates.length})</div>
              <div className="fb-mosaic" style={{ marginBottom:28 }}>
                {templates.map(tpl => {
                  const dt = getDocType(tpl.type);
                  return (
                    <div key={tpl.id} className="fb-card" onClick={() => openTemplate(tpl)}
                      style={{ borderColor: dt.border }}>
                      <div style={{ position:"absolute", top:0, left:0, right:0, height:4,
                        background:dt.color, borderRadius:"14px 14px 0 0" }} />
                      <div className="fb-card-icon">{dt.icon}</div>
                      <div>
                        <div className="fb-card-title">{tpl.titre}</div>
                        <div style={{ display:"inline-block", padding:"2px 8px", borderRadius:999,
                          fontSize:11, fontWeight:700, marginTop:4,
                          background:dt.bg, color:dt.color, border:`1px solid ${dt.border}` }}>
                          {dt.label}
                        </div>
                      </div>
                      <div className="fb-card-desc">{tpl.description}</div>
                      <div className="fb-card-footer">
                        <span>🧩 {tpl.fields?.length || 0} champs</span>
                        <span>📊 {tpl.usageCount} utilisations</span>
                      </div>
                      {/* Bouton supprimer */}
                      <button onClick={e => { e.stopPropagation(); deleteTemplate(tpl.id); }}
                        style={{ position:"absolute", top:10, right:10, background:"none", border:"none",
                          cursor:"pointer", fontSize:14, color:"#d1d5db", fontWeight:700, lineHeight:1 }}
                        title="Supprimer">✕</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Créer un nouveau modèle */}
          <div style={{ fontSize:13, fontWeight:700, color:"#6b7280", textTransform:"uppercase",
            letterSpacing:".5px", marginBottom:12 }}>Créer un nouveau modèle</div>
          <div className="fb-mosaic">
            {DOC_TYPES.map(dt => (
              <div key={dt.type} className="fb-card" onClick={() => newTemplate(dt.type)}
                style={{ borderColor: dt.border }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:4,
                  background:dt.color, borderRadius:"14px 14px 0 0" }} />
                <div className="fb-card-icon">{dt.icon}</div>
                <div className="fb-card-title">{dt.label}</div>
                <div className="fb-card-desc">{dt.desc}</div>
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:dt.color }}>→ Créer</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ VUE BUILDER ═══════════════════════════════════════════════════ */}
      {view === "builder" && current && (
        <div>
          {/* Toolbar */}
          <div className="fb-toolbar" style={{ borderRadius:14, marginBottom:0,
            border:"1px solid #e2e8f0", borderBottom:"none" }}>
            <div className="fb-toolbar-left">
              <button onClick={() => setView("mosaic")}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:13,
                  color:"#7c3aed", fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
                ← Retour
              </button>
              <div style={{ width:1, height:20, background:"#e2e8f0" }} />
              <span style={{ fontSize:16 }}>{getDocType(current.type).icon}</span>
              <input value={current.titre}
                onChange={e => setCurrent(c => ({...c, titre: e.target.value}))}
                style={{ fontSize:16, fontWeight:800, border:"none", outline:"none",
                  color:"#1a202c", background:"transparent", minWidth:240 }}
              />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { initPreviewData(); setView("preview"); }}
                style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #e2e8f0",
                  background:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, color:"#374151" }}>
                👁 Prévisualiser
              </button>
              <button onClick={saveTemplate}
                style={{ padding:"8px 16px", borderRadius:8, border:"none",
                  background:"linear-gradient(135deg,#6d28d9,#7c3aed)", color:"#fff",
                  cursor:"pointer", fontSize:13, fontWeight:700,
                  boxShadow:"0 4px 12px rgba(109,40,217,.3)" }}>
                💾 Sauvegarder
              </button>
            </div>
          </div>

          {/* Corps du builder */}
          <div className="fb-builder">
            {/* ── Palette ── */}
            <div className="fb-palette">
              <div className="fb-palette-title">Ajouter un champ</div>
              {FIELD_TYPES.map(ft => (
                <button key={ft.type} className="fb-type-btn" onClick={() => addField(ft.type)}>
                  <span style={{ fontSize:16 }}>{ft.icon}</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>{ft.label}</div>
                    <div style={{ fontSize:11, color:"#94a3b8", fontWeight:400 }}>{ft.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* ── Canvas ── */}
            <div className="fb-canvas">
              <div className="fb-canvas-title">
                Formulaire — {current.fields.length} champ{current.fields.length !== 1 ? "s" : ""}
              </div>
              {current.fields.length === 0 && (
                <div style={{ textAlign:"center", padding:"40px 20px", color:"#cbd5e1",
                  border:"2px dashed #e2e8f0", borderRadius:12 }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🧩</div>
                  <p style={{ fontSize:14 }}>Cliquez sur un type de champ à gauche pour commencer.</p>
                </div>
              )}
              {current.fields.map((f, idx) => {
                const ft = FIELD_TYPES.find(x => x.type === f.type) || FIELD_TYPES[0];
                return (
                  <div key={f.id}
                    className={`fb-field-item${selected === f.id ? " selected" : ""}`}
                    onClick={() => setSelected(f.id)}>
                    <span className="fb-field-drag">⠿</span>
                    <div className="fb-field-body">
                      <div className="fb-field-label">
                        {ft.icon} {f.label}
                        {f.required && <span style={{ color:"#dc2626", marginLeft:4 }}>*</span>}
                      </div>
                      <div className="fb-field-type">
                        {ft.label}
                        {f.type === "graph" && f.graphKey && (
                          <span style={{ marginLeft:6, color:"#0891b2" }}>
                            → {GRAPH_KEYS.find(g => g.key === f.graphKey)?.label}
                          </span>
                        )}
                        {f.type === "select" && f.options?.length > 0 && (
                          <span style={{ marginLeft:6, color:"#94a3b8" }}>
                            ({f.options.length} options)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="fb-field-actions">
                      <button className="fb-field-btn" onClick={e => { e.stopPropagation(); moveField(f.id,"up"); }}
                        title="Monter" disabled={idx === 0}>↑</button>
                      <button className="fb-field-btn" onClick={e => { e.stopPropagation(); moveField(f.id,"down"); }}
                        title="Descendre" disabled={idx === current.fields.length - 1}>↓</button>
                      <button className="fb-field-btn" onClick={e => { e.stopPropagation(); removeField(f.id); }}
                        title="Supprimer" style={{ color:"#fca5a5" }}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Config ── */}
            <div className="fb-config">
              <div className="fb-config-title">Configuration</div>
              {!selField ? (
                <div className="fb-empty-config">
                  <div style={{ fontSize:32, marginBottom:10 }}>⚙️</div>
                  <p style={{ fontSize:13 }}>Sélectionnez un champ pour le configurer.</p>
                </div>
              ) : (
                <>
                  <div className="cfg-field">
                    <label className="cfg-label">Libellé du champ</label>
                    <input className="cfg-input" value={selField.label}
                      onChange={e => updateField(selField.id, { label: e.target.value })} />
                  </div>

                  {selField.type !== "graph" && selField.type !== "checkbox" && selField.type !== "signature" && (
                    <div className="cfg-field">
                      <label className="cfg-label">Placeholder</label>
                      <input className="cfg-input" value={selField.placeholder || ""}
                        placeholder="Texte d'aide…"
                        onChange={e => updateField(selField.id, { placeholder: e.target.value })} />
                    </div>
                  )}

                  {selField.type === "graph" && (
                    <div className="cfg-field">
                      <label className="cfg-label">Donnée Microsoft Graph</label>
                      <select className="cfg-select" value={selField.graphKey || "displayName"}
                        onChange={e => updateField(selField.id, { graphKey: e.target.value })}>
                        {GRAPH_KEYS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                      </select>
                      <div style={{ fontSize:11, color:"#94a3b8", marginTop:5 }}>
                        Pré-rempli automatiquement depuis le profil Microsoft 365.
                      </div>
                    </div>
                  )}

                  {selField.type === "select" && (
                    <div className="cfg-field">
                      <label className="cfg-label">Options (une par ligne)</label>
                      <textarea className="cfg-textarea"
                        style={{ minHeight:100, resize:"vertical" }}
                        value={(selField.options || []).join("\n")}
                        onChange={e => updateField(selField.id, {
                          options: e.target.value.split("\n").filter(Boolean)
                        })} />
                    </div>
                  )}

                  <div className="cfg-field">
                    <label className="cfg-toggle">
                      <input type="checkbox" checked={!!selField.required}
                        onChange={e => updateField(selField.id, { required: e.target.checked })} />
                      <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>Champ obligatoire</span>
                    </label>
                  </div>

                  {/* Aperçu du champ */}
                  <div style={{ marginTop:16, padding:12, background:"#f8fafc",
                    border:"1px solid #e2e8f0", borderRadius:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                      textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>
                      Aperçu
                    </div>
                    <FieldPreview field={selField} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ VUE PREVIEW / REMPLISSAGE ════════════════════════════════════ */}
      {view === "preview" && current && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:20, flexWrap:"wrap", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={() => setView("builder")}
                style={{ background:"none", border:"none", cursor:"pointer",
                  fontSize:13, color:"#7c3aed", fontWeight:700 }}>
                ← Retour au builder
              </button>
              <div style={{ width:1, height:18, background:"#e2e8f0" }} />
              <span style={{ fontSize:16, fontWeight:800, color:"#1a202c" }}>
                {getDocType(current.type).icon} {current.titre}
              </span>
            </div>
            <button
              onClick={() => generatePDF(current, formData, sigData)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px",
                background:"linear-gradient(135deg,#6d28d9,#7c3aed)", color:"#fff",
                border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:14,
                boxShadow:"0 4px 14px rgba(109,40,217,.3)" }}>
              🖨️ Générer le PDF
            </button>
          </div>

          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14,
            padding:32, maxWidth:640, margin:"0 auto" }}>
            {/* En-tête doc */}
            <div style={{ height:4, background:getDocType(current.type).color,
              borderRadius:3, marginBottom:24 }} />
            <div style={{ fontSize:20, fontWeight:900, color:"#1a202c", marginBottom:20 }}>
              {current.titre}
            </div>

            {/* Champs */}
            {current.fields.map(f => (
              <div key={f.id} className="pv-field">
                <label className="pv-label">
                  {f.label}{f.required && <span style={{ color:"#dc2626" }}> *</span>}
                </label>
                {f.type === "graph" && (
                  <div className="pv-graph-val">
                    {formData[f.id] || <em style={{ color:"#94a3b8" }}>Non disponible (connectez Graph)</em>}
                  </div>
                )}
                {f.type === "text" && (
                  <input className="pv-input" value={formData[f.id] || ""}
                    placeholder={f.placeholder}
                    onChange={e => setFormData(d => ({...d, [f.id]: e.target.value}))} />
                )}
                {f.type === "textarea" && (
                  <textarea className="pv-textarea" rows={3} value={formData[f.id] || ""}
                    placeholder={f.placeholder}
                    style={{ width:"100%", padding:"10px 12px", border:"1px solid #e2e8f0",
                      borderRadius:8, fontSize:14, resize:"vertical" }}
                    onChange={e => setFormData(d => ({...d, [f.id]: e.target.value}))} />
                )}
                {f.type === "date" && (
                  <input className="pv-input" type="date" value={formData[f.id] || ""}
                    onChange={e => setFormData(d => ({...d, [f.id]: e.target.value}))} />
                )}
                {f.type === "select" && (
                  <select className="pv-select" value={formData[f.id] || ""}
                    onChange={e => setFormData(d => ({...d, [f.id]: e.target.value}))}>
                    <option value="">— Sélectionner —</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {f.type === "checkbox" && (
                  <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                    <input type="checkbox" checked={!!formData[f.id]}
                      style={{ width:18, height:18, accentColor:"#7c3aed" }}
                      onChange={e => setFormData(d => ({...d, [f.id]: e.target.checked}))} />
                    <span style={{ fontSize:14, color:"#374151" }}>Oui</span>
                  </label>
                )}
                {f.type === "signature" && (
                  <SignatureCanvas onChange={dataURL => setSigData(s => ({...s, [f.id]: dataURL}))} />
                )}
              </div>
            ))}

            <div style={{ marginTop:24, paddingTop:16, borderTop:"1px solid #f0f0f0",
              fontSize:12, color:"#94a3b8", display:"flex", justifyContent:"space-between" }}>
              <span>Document généré par Synapse RH</span>
              <span>{new Date().toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, zIndex:2000,
          background:"#1e293b", color:"#fff", padding:"14px 20px", borderRadius:12,
          fontSize:14, fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,.25)",
          animation:"slideUp .3s ease" }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  );
}

// ─── Aperçu minimal d'un champ ────────────────────────────────────────────────
function FieldPreview({ field }) {
  const s = { width:"100%", padding:"8px 10px", border:"1px solid #e2e8f0",
    borderRadius:8, fontSize:13, color:"#94a3b8", background:"#fff" };
  if (field.type === "text")      return <input style={s} placeholder={field.placeholder || "Texte court…"} disabled />;
  if (field.type === "textarea")  return <textarea style={{...s,resize:"none",minHeight:60}} placeholder={field.placeholder || "Texte long…"} disabled />;
  if (field.type === "date")      return <input type="date" style={s} disabled />;
  if (field.type === "checkbox")  return <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" disabled /><span style={{fontSize:12,color:"#94a3b8"}}>Case à cocher</span></label>;
  if (field.type === "signature") return <div style={{...s,height:60,textAlign:"center",lineHeight:"44px",color:"#d1d5db",fontSize:12}}>Zone de signature</div>;
  if (field.type === "graph")     return <div style={{...s,background:"#f0f9ff",color:"#0891b2",fontWeight:600}}>🔗 Auto-rempli depuis Microsoft Graph</div>;
  if (field.type === "select")    return (
    <select style={s} disabled>
      {(field.options || ["Option…"]).map(o => <option key={o}>{o}</option>)}
    </select>
  );
  return null;
}
