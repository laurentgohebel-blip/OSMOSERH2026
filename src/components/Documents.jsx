import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Page Documents — React (Vite/React)
 * - Marque blanche premium, cohérente avec Home.jsx / Conges.jsx
 * - Drive-like: dossiers, liste/grille, drag&drop, sélection, actions
 *
 * Props (branche tes handlers backend ici) :
 *  - user: { displayName, givenName, tenantLabel, email }
 *  - initialPath: string (ex: "/") — chemin logique dans ta librairie
 *  - onFetch:    (path: string) => Promise<DriveItem[]> | DriveItem[]
 *  - onUpload:   (path: string, files: File[]) => Promise|void
 *  - onDownload: (item: DriveItem | DriveItem[]) => Promise|void
 *  - onPreview:  (item: DriveItem) => Promise|void
 *  - onShare:    (item: DriveItem) => Promise<{url:string}>|void
 *  - onCreateFolder: (path: string, name: string) => Promise|void
 *  - onRename:   (itemId: string, newName: string) => Promise|void
 *  - onMove:     (itemId: string, targetPath: string) => Promise|void
 *  - onDelete:   (ids: string[]) => Promise|void  // suppression (souvent corbeille/soft delete)
 *  - onNavigate: (route: string) => void
 *  - onLogout:   () => void
 *
 * DriveItem:
 *  {
 *    id: string,
 *    name: string,
 *    ext?: string,              // ex: 'pdf', 'docx' (vide si folder)
 *    type: 'file'|'folder',
 *    size?: number,             // en octets
 *    modified?: string,         // 'YYYY-MM-DD HH:mm' ou ISO
 *    modifiedBy?: string,
 *    path: string,              // ex: '/RH/Contrats'
 *    tags?: string[],
 *    protected?: boolean,
 *    locked?: boolean,
 *    version?: string
 *  }
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
  --info:#2b6cb0;
  --danger:#e53e3e;
  --success:#10b981;
  --chip:#edf2f7;
  --shadow:0 20px 60px rgba(0,0,0,.08);
}

*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
.page{
  min-height:100vh;background:var(--bg);color:var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue', sans-serif;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}

/* Header (identique) */
.header{background: linear-gradient(135deg,var(--brand1) 0%, var(--brand2) 100%); color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
.header-inner{max-width:1400px;margin:0 auto;height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
.app-brand{display:flex;align-items:center;gap:14px;cursor:pointer}
.logo-dot{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#8ea0ff 0%,#7b61ff 100%);box-shadow:0 8px 20px rgba(0,0,0,.15)}
.app-title{font-size:20px;font-weight:800;letter-spacing:.2px}
.user-section{display:flex;align-items:center;gap:12px}
.user-photo{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;border:2px solid rgba(255,255,255,.35)}
.user-meta{display:flex;flex-direction:column;line-height:1.1}
.user-name{font-size:14px;font-weight:700}
.user-tenant{font-size:12px;opacity:.9}
.logout-btn{margin-left:12px;padding:8px 12px;font-size:13px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;cursor:pointer;transition:.2s}
.logout-btn:hover{background:rgba(255,255,255,.12)}

/* Layout */
.main{max-width:1400px;margin:0 auto;display:flex;gap:24px;padding:24px}
.sidebar{width:260px;background:#fff;border-radius:12px;border:1px solid var(--line);padding:16px;height:fit-content;box-shadow:var(--shadow)}
.nav-section-title{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:6px 8px 10px}
.nav-link{display:flex;align-items:center;gap:10px;padding:12px 12px;font-size:14px;color:var(--muted);text-decoration:none;border-radius:10px;margin-bottom:6px;transition:background-color .15s,color .15s}
.nav-link:hover{background:#f3f5fa;color:var(--text)}
.nav-link.active{background:#edf2f7;color:#2d3748;font-weight:700}

/* Content wrapper */
.content{flex:1;display:flex;flex-direction:column;gap:16px}

/* Toolbar */
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;box-shadow:var(--shadow)}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;border:1px solid #dbe7fd;background:#f7fbff;color:#2b6cb0}
.btn.primary{background:linear-gradient(135deg,#2b6cb0,#3182ce);color:#fff;border-color:transparent;box-shadow:0 6px 16px rgba(49,130,206,.25)}
.btn.danger{background:#fff;color:#e53e3e;border-color:#fecaca}
.btn:active{transform:translateY(1px)}

.filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.input, .select{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:14px}
.view-toggle{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.view-toggle button{padding:8px 10px;border:none;background:#fff;cursor:pointer}
.view-toggle button.active{background:#edf2f7;font-weight:800}

/* Breadcrumb */
.breadcrumb{display:flex;align-items:center;gap:8px;font-size:14px;color:#4a5568}
.bc-link{color:#2b6cb0;cursor:pointer}
.bc-sep{color:#a0aec0}

/* Dropzone */
.dropzone{border:2px dashed #cfe3fb;border-radius:12px;padding:16px;text-align:center;color:#2b6cb0;background:#f7fbff}
.dropzone.dragover{background:#eef6ff;border-color:#2b6cb0}

/* Selection bar */
.selection-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:var(--shadow)}

/* List / Grid */
.table{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff;box-shadow:var(--shadow)}
.table th,.table td{padding:12px 14px;border-bottom:1px solid var(--line);font-size:14px;text-align:left}
.table th{background:#f8fafc;font-weight:800;color:#374151}
.row-name{display:flex;align-items:center;gap:10px}
.file-ico{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12px}
.ico-folder{background:linear-gradient(135deg,#836ef0,#6b46c1)}
.ico-doc{background:#2b6cb0}
.ico-pdf{background:#e11d48}
.ico-xls{background:#059669}
.ico-ppt{background:#d97706}
.ico-img{background:#7c3aed}
.ico-txt{background:#4b5563}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{background:#edf2f7;color:#1f2937;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700}

/* Grid view */
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.card{grid-column: span 3;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:var(--shadow);cursor:pointer}
.card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.card-name{font-weight:800}
.card-meta{font-size:12px;color:#6b7280}
.card-actions{display:flex;gap:8px;margin-top:8px}
.card .btn{padding:6px 8px;font-size:12px}

/* Responsive */
@media (max-width:1100px){
  .card{grid-column: span 4}
}
@media (max-width:800px){
  .main{flex-direction:column}
  .sidebar{width:100%}
  .card{grid-column: span 6}
  .table th:nth-child(5), .table td:nth-child(5){display:none} /* masque Tags en mobile */
}
`;

function initials(name) {
  const parts = (name || "").trim().split(/\s+/);
  const i1 = parts[0]?.[0] || "";
  const i2 = parts[1]?.[0] || "";
  const res = (i1 + i2).toUpperCase();
  return res || "--";
}

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const k = 1024;
  const sizes = ["octets", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
  return `${v} ${sizes[i]}`;
}
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString();
}

function iconClass(ext, type) {
  if (type === "folder") return "ico-folder";
  const e = (ext || "").toLowerCase();
  if (["pdf"].includes(e)) return "ico-pdf";
  if (["doc", "docx"].includes(e)) return "ico-doc";
  if (["xls", "xlsx", "csv"].includes(e)) return "ico-xls";
  if (["ppt", "pptx"].includes(e)) return "ico-ppt";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(e)) return "ico-img";
  if (["txt", "md"].includes(e)) return "ico-txt";
  return "ico-doc";
}

const defaultMock = {
  "/": [
    { id: "f1", name: "Mes documents", type: "folder", path: "/", modified: "2026-02-10 10:04", modifiedBy: "Moi" },
    { id: "f2", name: "RH", type: "folder", path: "/", modified: "2026-02-02 16:20", modifiedBy: "Service RH" },
    { id: "f3", name: "Fiches de paie", type: "folder", path: "/", modified: "2026-01-31 09:10", modifiedBy: "Paie" },
    { id: "a1", name: "Bienvenue.pdf", ext: "pdf", type: "file", size: 128_450, path: "/", modified: "2026-02-12 14:02", modifiedBy: "Synapse" },
  ],
  "/Mes documents": [
    { id: "m1", name: "CV_Laurent.pdf", ext: "pdf", type: "file", size: 356_000, path: "/Mes documents", modified: "2026-02-13 11:28", modifiedBy: "Laurent" },
    { id: "m2", name: "Notes.txt", ext: "txt", type: "file", size: 2_100, path: "/Mes documents", modified: "2026-02-01 09:50", modifiedBy: "Laurent" },
  ],
  "/RH": [
    { id: "r1", name: "Contrat_2025_LG.docx", ext: "docx", type: "file", size: 89_000, path: "/RH", modified: "2026-02-02 10:00", modifiedBy: "RH", tags: ["Contrat"] },
    { id: "r2", name: "Règlement_intérieur.pdf", ext: "pdf", type: "file", size: 512_000, path: "/RH", modified: "2026-01-15 08:44", modifiedBy: "RH", tags: ["Règlement"] },
  ],
  "/Fiches de paie": [
    { id: "p1", name: "Bulletin_2026-01.pdf", ext: "pdf", type: "file", size: 210_000, path: "/Fiches de paie", modified: "2026-01-31 08:00", modifiedBy: "Paie", tags: ["Paie"] },
  ],
};

export default function Documents({
  user,
  initialPath = "/",
  onFetch,
  onUpload,
  onDownload,
  onPreview,
  onShare,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
  onNavigate,
  onLogout,
}) {
  const u = {
    displayName: "Jean Dupont",
    givenName: "Jean",
    tenantLabel: "Client Démo",
    email: "jean.dupont@entreprise.com",
    ...(user || {}),
  };

  // État principal
  const [path, setPath] = useState(initialPath);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtres & tri
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // 'file'|'folder'|'pdf'|'docx'|'img'...
  const [tagFilter, setTagFilter] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name|modified|size
  const [sortDir, setSortDir] = useState("asc");

  // Sélection
  const [selected, setSelected] = useState({}); // id: boolean
  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const allSelected = useMemo(() => items.length > 0 && selectedIds.length === items.length, [items, selectedIds]);

  // Affichage
  const [view, setView] = useState("list"); // 'list' | 'grid'

  // Dropzone
  const dzRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // Fetch initial
  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      try {
        let result;
        if (typeof onFetch === "function") {
          result = await onFetch(path);
        } else {
          // Mock local
          result = defaultMock[path] || [];
        }
        if (!canceled) {
          setItems(result);
          setSelected({});
        }
      } catch (e) {
        console.error("fetch error", e);
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    load();
    return () => (canceled = true);
  }, [path, onFetch]);

  // Breadcrumb (ex: "/RH/Contrats")
  const crumbs = useMemo(() => {
    if (!path || path === "/") return [{ name: "Racine", p: "/" }];
    const parts = path.replace(/^\/+/, "").split("/");
    const acc = [];
    const arr = [{ name: "Racine", p: "/" }];
    parts.forEach((part) => {
      acc.push(part);
      arr.push({ name: part, p: "/" + acc.join("/") });
    });
    return arr;
  }, [path]);

  // Filtres + tri
  const filteredSorted = useMemo(() => {
    const qs = q.trim().toLowerCase();
    const list = (items || []).filter((it) => {
      if (qs) {
        const hay = `${it.name} ${it.modifiedBy || ""} ${it.tags?.join(" ") || ""}`.toLowerCase();
        if (!hay.includes(qs)) return false;
      }
      if (typeFilter) {
        if (typeFilter === "folder" && it.type !== "folder") return false;
        else if (typeFilter === "file" && it.type !== "file") return false;
        else if (["pdf","docx","doc","xlsx","xls","pptx","ppt","img","txt","csv"].includes(typeFilter)) {
          if (typeFilter === "img") {
            if (!["jpg","jpeg","png","gif","webp"].includes((it.ext || "").toLowerCase())) return false;
          } else if ((it.ext || "").toLowerCase() !== typeFilter) return false;
        }
      }
      if (tagFilter && !(it.tags || []).includes(tagFilter)) return false;
      return true;
    });

    const cmp = (a, b) => {
      let va, vb;
      if (sortBy === "name") {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      } else if (sortBy === "modified") {
        va = new Date(a.modified || 0).getTime(); vb = new Date(b.modified || 0).getTime();
      } else if (sortBy === "size") {
        va = a.size || 0; vb = b.size || 0;
      } else {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    };

    // Dossiers en haut, fichiers ensuite (puis tri interne)
    const folders = list.filter((x) => x.type === "folder").sort(cmp);
    const files = list.filter((x) => x.type !== "folder").sort(cmp);
    return [...folders, ...files];
  }, [items, q, typeFilter, tagFilter, sortBy, sortDir]);

  // Navigation
  const nav = (route) => {
    if (typeof onNavigate === "function") return onNavigate(route);
    window.location.hash = route;
  };
  const logout = () => {
    if (typeof onLogout === "function") return onLogout();
    alert("Déconnexion… (branche onLogout() à MSAL)");
  };

  const openFolder = (folder) => {
    setPath(folder.path === "/" ? `/${folder.name}` : `${folder.path}/${folder.name}`);
  };

  // Sélection
  const toggleItem = (id, checked) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };
  const toggleAll = (checked) => {
    const next = {};
    if (checked) items.forEach((it) => (next[it.id] = true));
    setSelected(next);
  };

  // Actions unitaires
  const doPreview = (it) => (typeof onPreview === "function" ? onPreview(it) : alert(`Aperçu ${it.name}`));
  const doDownload = (it) => (typeof onDownload === "function" ? onDownload(it) : alert(`Télécharger ${it.name}`));
  const doShare = async (it) => {
    try {
      if (typeof onShare === "function") {
        const r = await onShare(it);
        if (r?.url) {
          await navigator.clipboard?.writeText?.(r.url);
          alert("Lien copié dans le presse-papiers.");
        } else {
          alert("Lien créé.");
        }
      } else {
        alert("Partage prêt (branche onShare)");
      }
    } catch (e) {
      console.error(e);
      alert("Partage impossible pour le moment.");
    }
  };
  const doRename = async (it) => {
    const newName = prompt("Nouveau nom :", it.name);
    if (!newName || newName === it.name) return;
    try {
      if (typeof onRename === "function") await onRename(it.id, newName);
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, name: newName } : x)));
    } catch (e) {
      console.error(e);
      alert("Renommage impossible.");
    }
  };
  const doMove = async (it) => {
    const target = prompt("Déplacer vers le chemin :", "/Mes documents");
    if (!target) return;
    try {
      if (typeof onMove === "function") await onMove(it.id, target);
      // En mock: on supprime de la vue actuelle si on change de répertoire
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e) {
      console.error(e);
      alert("Déplacement impossible.");
    }
  };
  const doDelete = async (id) => {
    const ok = confirm("Supprimer cet élément ? (peut aller en Corbeille)");
    if (!ok) return;
    try {
      if (typeof onDelete === "function") await onDelete([id]);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setSelected((prev) => {
        const p = { ...prev };
        delete p[id];
        return p;
      });
    } catch (e) {
      console.error(e);
      alert("Suppression impossible.");
    }
  };

  // Actions groupées
  const doBulkDownload = () => {
    const list = items.filter((x) => selected[x.id]);
    if (list.length === 0) return;
    if (typeof onDownload === "function") return onDownload(list);
    alert(`Télécharger ${list.length} élément(s)`);
  };
  const doBulkDelete = async () => {
    const ids = items.filter((x) => selected[x.id]).map((x) => x.id);
    if (ids.length === 0) return;
    const ok = confirm(`Supprimer ${ids.length} élément(s) ?`);
    if (!ok) return;
    try {
      if (typeof onDelete === "function") await onDelete(ids);
      setItems((prev) => prev.filter((x) => !ids.includes(x.id)));
      setSelected({});
    } catch (e) {
      console.error(e);
      alert("Suppression groupée impossible.");
    }
  };
  const doBulkMove = async () => {
    const ids = items.filter((x) => selected[x.id]).map((x) => x.id);
    if (ids.length === 0) return;
    const target = prompt("Déplacer la sélection vers :", "/Mes documents");
    if (!target) return;
    try {
      if (typeof onMove === "function") {
        for (const id of ids) await onMove(id, target);
      }
      setItems((prev) => prev.filter((x) => !ids.includes(x.id)));
      setSelected({});
    } catch (e) {
      console.error(e);
      alert("Déplacement groupé impossible.");
    }
  };

  // New folder
  const createFolder = async () => {
    const name = prompt("Nom du dossier :");
    if (!name) return;
    try {
      if (typeof onCreateFolder === "function") await onCreateFolder(path, name);
      setItems((prev) => [
        { id: `nf-${Date.now()}`, name, type: "folder", path, modified: new Date().toISOString(), modifiedBy: u.displayName },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
      alert("Création impossible.");
    }
  };

  // Upload
  const inputRef = useRef(null);
  const openFileDialog = () => inputRef.current?.click();
  const handleFiles = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    try {
      if (typeof onUpload === "function") await onUpload(path, arr);
      // Mock: ajoute dans la vue
      const newItems = arr.map((f, idx) => ({
        id: `u-${Date.now()}-${idx}`,
        name: f.name,
        ext: f.name.split(".").pop(),
        type: "file",
        size: f.size,
        path,
        modified: new Date().toISOString(),
        modifiedBy: u.displayName,
      }));
      setItems((prev) => [...newItems, ...prev]);
    } catch (e) {
      console.error(e);
      alert("Upload impossible.");
    }
  };

  // Drag & Drop
  useEffect(() => {
    const dz = dzRef.current;
    if (!dz) return;
    const over = (e) => { e.preventDefault(); setDragOver(true); };
    const leave = (e) => { e.preventDefault(); setDragOver(false); };
    const drop = (e) => {
      e.preventDefault(); setDragOver(false);
      const files = e.dataTransfer?.files;
      handleFiles(files);
    };
    dz.addEventListener("dragover", over);
    dz.addEventListener("dragleave", leave);
    dz.addEventListener("drop", drop);
    return () => {
      dz.removeEventListener("dragover", over);
      dz.removeEventListener("dragleave", leave);
      dz.removeEventListener("drop", drop);
    };
  }, [dzRef.current]);

  // Tags disponibles (simples) pour filtre
  const allTags = useMemo(() => {
    const s = new Set();
    (items || []).forEach((it) => (it.tags || []).forEach((t) => s.add(t)));
    return Array.from(s);
  }, [items]);

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
            <div className="user-photo" title={u.email}>{initials(u.displayName)}</div>
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
            <a className="nav-link" onClick={() => nav("conges")} href="#conges">🏖️ Congés</a>
            <a className="nav-link active" onClick={() => nav("documents")} href="#documents">📄 Documents</a>
            <a className="nav-link" onClick={() => nav("formations")} href="#formations">🎓 Formations</a>
            <a className="nav-link" onClick={() => nav("equipe")} href="#equipe">👥 Équipe</a>
            <a className="nav-link" onClick={() => nav("paie")} href="#paie">💰 Fiches de paie</a>
            <a className="nav-link" onClick={() => nav("support")} href="#support">🛟 Support</a>
            <a className="nav-link" onClick={() => nav("parametres")} href="#parametres">⚙️ Paramètres</a>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="content">
          {/* BREADCRUMB */}
          <div className="breadcrumb">
            {crumbs.map((c, idx) => (
              <React.Fragment key={c.p}>
                {idx > 0 && <span className="bc-sep">/</span>}
                {idx === crumbs.length - 1 ? (
                  <span>{c.name}</span>
                ) : (
                  <span className="bc-link" onClick={() => setPath(c.p)}>{c.name}</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* TOOLBAR */}
          <div className="toolbar" ref={dzRef}>
            <div className="actions">
              <button className="btn primary" onClick={openFileDialog}>⬆️ Upload</button>
              <input ref={inputRef} type="file" multiple style={{display:"none"}} onChange={(e)=>handleFiles(e.target.files)} />
              <button className="btn" onClick={createFolder}>📁 Nouveau dossier</button>
              <button className="btn" onClick={() => alert("Demande envoyée au RH (branche ton flow)")}>📝 Demander un document</button>
              <div className={`dropzone ${dragOver ? "dragover":""}`} style={{minWidth:220}}>
                Glissez-déposez ici pour téléverser
              </div>
            </div>

            <div className="filters">
              <input className="input" placeholder="Rechercher…" value={q} onChange={(e)=>setQ(e.target.value)} />
              <select className="select" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}>
                <option value="">Type : Tous</option>
                <option value="folder">Dossiers</option>
                <option value="file">Fichiers</option>
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="xlsx">XLSX</option>
                <option value="pptx">PPTX</option>
                <option value="img">Images</option>
                <option value="txt">TXT</option>
                <option value="csv">CSV</option>
              </select>
              <select className="select" value={tagFilter} onChange={(e)=>setTagFilter(e.target.value)}>
                <option value="">Tag : Tous</option>
                {allTags.map((t)=> <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="select" value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
                <option value="name">Tri : Nom</option>
                <option value="modified">Tri : Modifié le</option>
                <option value="size">Tri : Taille</option>
              </select>
              <select className="select" value={sortDir} onChange={(e)=>setSortDir(e.target.value)}>
                <option value="asc">↗︎ Asc</option>
                <option value="desc">↘︎ Desc</option>
              </select>
              <div className="view-toggle">
                <button className={view==="list"?"active":""} onClick={()=>setView("list")}>Liste</button>
                <button className={view==="grid"?"active":""} onClick={()=>setView("grid")}>Grille</button>
              </div>
            </div>
          </div>

          {/* SELECTION BAR */}
          {selectedIds.length > 0 && (
            <div className="selection-bar">
              <div><strong>{selectedIds.length}</strong> sélectionné(s)</div>
              <div className="actions">
                <button className="btn" onClick={doBulkDownload}>⬇️ Télécharger</button>
                <button className="btn" onClick={doBulkMove}>📦 Déplacer</button>
                <button className="btn danger" onClick={doBulkDelete}>🗑️ Supprimer</button>
              </div>
            </div>
          )}

          {/* LISTE / GRILLE */}
          {view === "list" ? (
            <div className="table-wrapper">
              <table className="table" aria-label="Documents">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={allSelected} onChange={(e)=>toggleAll(e.target.checked)} /></th>
                    <th>Nom</th>
                    <th>Modifié le</th>
                    <th>Par</th>
                    <th>Tags</th>
                    <th>Taille</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan="7" style={{textAlign:"center", color:"#718096"}}>Chargement…</td></tr>
                  )}
                  {!loading && filteredSorted.length === 0 && (
                    <tr><td colSpan="7" style={{textAlign:"center", color:"#718096"}}>Aucun élément</td></tr>
                  )}
                  {!loading && filteredSorted.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[it.id]}
                          onChange={(e)=>toggleItem(it.id, e.target.checked)}
                        />
                      </td>
                      <td>
                        <div className="row-name">
                          <div className={`file-ico ${iconClass(it.ext, it.type)}`}>{it.type === "folder" ? "DIR" : (it.ext || "").toUpperCase()}</div>
                          <span
                            style={{cursor: it.type === "folder" ? "pointer" : "default", fontWeight:600}}
                            onClick={() => (it.type === "folder" ? openFolder(it) : null)}
                            title={it.path}
                          >
                            {it.name}
                          </span>
                          {it.protected && <span className="tag">🔒 Protégé</span>}
                          {it.locked && <span className="tag">🔏 Verrouillé</span>}
                        </div>
                      </td>
                      <td>{fmtDate(it.modified)}</td>
                      <td>{it.modifiedBy || "—"}</td>
                      <td>
                        <div className="tags">
                          {(it.tags || []).map((t) => <span className="tag" key={t}>{t}</span>)}
                        </div>
                      </td>
                      <td>{it.type === "file" ? fmtBytes(it.size) : "—"}</td>
                      <td>
                        <div className="actions">
                          {it.type === "file" && <button className="btn" onClick={()=>doPreview(it)}>👁️ Aperçu</button>}
                          <button className="btn" onClick={()=>doDownload(it)}>⬇️</button>
                          <button className="btn" onClick={()=>doShare(it)}>🔗</button>
                          <button className="btn" onClick={()=>doRename(it)}>✏️</button>
                          <button className="btn" onClick={()=>doMove(it)}>📦</button>
                          <button className="btn danger" onClick={()=>doDelete(it.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid">
              {loading && (
                <div className="card" style={{gridColumn:"span 12", textAlign:"center", color:"#718096"}}>Chargement…</div>
              )}
              {!loading && filteredSorted.length === 0 && (
                <div className="card" style={{gridColumn:"span 12", textAlign:"center", color:"#718096"}}>Aucun élément</div>
              )}
              {!loading && filteredSorted.map((it) => (
                <div key={it.id} className="card" onDoubleClick={() => (it.type === "folder" ? openFolder(it) : doPreview(it))}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center", marginBottom:8}}>
                    <input type="checkbox" checked={!!selected[it.id]} onChange={(e)=>toggleItem(it.id, e.target.checked)} onClick={(e)=>e.stopPropagation()} />
                    <div className={`file-ico ${iconClass(it.ext, it.type)}`}>{it.type === "folder" ? "DIR" : (it.ext || "").toUpperCase()}</div>
                  </div>
                  <div className="card-head">
                    <div className="card-name" title={it.path} style={{cursor: it.type==="folder"?"pointer":"default"}} onClick={() => (it.type === "folder" ? openFolder(it) : null)}>{it.name}</div>
                  </div>
                  <div className="card-meta">
                    {fmtDate(it.modified)} • {it.modifiedBy || "—"} {it.type === "file" ? `• ${fmtBytes(it.size)}` : ""}
                  </div>
                  {(it.tags?.length ? (
                    <div className="tags" style={{marginTop:6}}>
                      {it.tags.map((t)=> <span className="tag" key={t}>{t}</span>)}
                    </div>
                  ) : null)}
                  <div className="card-actions">
                    {it.type === "file" && <button className="btn" onClick={(e)=>{e.stopPropagation(); doPreview(it);}}>👁️</button>}
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); doDownload(it);}}>⬇️</button>
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); doShare(it);}}>🔗</button>
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); doRename(it);}}>✏️</button>
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); doMove(it);}}>📦</button>
                    <button className="btn danger" onClick={(e)=>{e.stopPropagation(); doDelete(it.id);}}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="tag" style={{alignSelf:"center"}}>
            Données servies par le backend (Microsoft Graph / SharePoint — App-Only). Aucune clé exposée côté front.
          </p>
        </main>
      </div>
    </div>
  );
}