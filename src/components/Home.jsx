// src/components/Home.jsx
import React, { useMemo } from "react";

const css = `
:root{--bg:#f7fafc;--line:#e2e8f0;--brand1:#667eea;--brand2:#764ba2;--success:#10b981;--danger:#e53e3e;--shadow:0 4px 24px rgba(0,0,0,.08)}
*{box-sizing:border-box;margin:0;padding:0}html,body,#root{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:#1a202c;-webkit-font-smoothing:antialiased}
.hd{background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff}
.hd-in{max-width:1400px;margin:0 auto;height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
.brand{display:flex;align-items:center;gap:12px;cursor:pointer}
.dot{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#8ea0ff,#7b61ff)}
.brand-name{font-size:20px;font-weight:800}
.usr{display:flex;align-items:center;gap:10px}
.av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid rgba(255,255,255,.4)}
.uname{font-size:14px;font-weight:700}.utenant{font-size:12px;opacity:.8}
.lbtn{padding:7px 12px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:7px;font-size:13px;cursor:pointer}
.lbtn:hover{background:rgba(255,255,255,.15)}
.wrap{max-width:1400px;margin:0 auto;display:flex;gap:24px;padding:24px}
.sb{width:250px;flex-shrink:0;background:#fff;border-radius:12px;border:1px solid var(--line);padding:14px;box-shadow:var(--shadow);height:fit-content}
.sb-title{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#718096;margin:4px 8px 10px}
.nb{display:flex;align-items:center;gap:9px;padding:11px 12px;border:none;background:transparent;width:100%;text-align:left;border-radius:9px;font-size:14px;color:#4a5568;cursor:pointer;margin-bottom:3px;transition:.12s}
.nb:hover{background:#f3f5fa;color:#1a202c}
.nb.on{background:#edf2f7;color:#2d3748;font-weight:700}
.main{flex:1;display:flex;flex-direction:column;gap:20px;min-width:0}
.hero{background:#fff;border:1px solid var(--line);border-radius:12px;padding:24px;box-shadow:var(--shadow);display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.hero h2{font-size:22px;font-weight:800;margin-bottom:4px}
.hero p{color:#718096;font-size:14px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.chip{background:#edf2f7;color:#2d3748;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:600;border:1px solid var(--line)}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.ab{display:flex;align-items:center;gap:7px;padding:11px 14px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;color:#fff;background:linear-gradient(135deg,#2b6cb0,#3182ce);transition:.12s}
.ab:hover{filter:brightness(1.08)}
.ab.s{background:linear-gradient(135deg,#5a67d8,#6b46c1)}
.ab.g{background:#fff;color:#2b6cb0;border:1px solid #cfe3fb}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;box-shadow:var(--shadow);cursor:pointer;transition:.12s}
.kpi:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.1)}
.kpi-t{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#718096;margin-bottom:8px;font-weight:800}
.kpi-v{font-size:32px;font-weight:900;color:#1a202c;margin-bottom:2px}
.kpi-l{font-size:12px;color:#a0aec0}
.kpi-tr{font-size:11px;font-weight:800;margin-top:6px}
.up{color:var(--success)}.dn{color:var(--danger)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pnl{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;box-shadow:var(--shadow)}
.pnl-t{font-size:15px;font-weight:800;margin-bottom:12px}
.rw{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);gap:10px}
.rw:last-child{border-bottom:none}
.rt{font-weight:700;font-size:14px}.rs{font-size:12px;color:#718096;margin-top:2px}
.ract{padding:7px 11px;border:1px solid #dbe7fd;background:#f7fbff;color:#2b6cb0;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.ract:hover{background:#dbeafe}
.fn{font-size:12px;color:#a0aec0;text-align:center;padding:8px 0 4px}
@media(max-width:1100px){.hero{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}}
@media(max-width:800px){.wrap{flex-direction:column}.sb{width:100%}.kpis{grid-template-columns:repeat(2,1fr)}.cols{grid-template-columns:1fr}}
@media(max-width:480px){.kpis{grid-template-columns:1fr}}
`;

const NAV = [
  {r:"dashboard", i:"📊", l:"Tableau de bord"},
  {r:"conges",    i:"🏖️",  l:"Congés"},
  {r:"production",i:"⚡",  l:"Production"},
  {r:"documents", i:"📄", l:"Documents"},
  {r:"formations",i:"🎓", l:"Formations"},
  {r:"equipe",    i:"👥", l:"Équipe"},
  {r:"paie",      i:"💰", l:"Fiches de paie"},
  {r:"support",   i:"🛟", l:"Support"},
  {r:"parametres",i:"⚙️", l:"Paramètres"},
  {r:"admin",     i:"🛠️", l:"Admin RH"},
];

function av(n){const p=(n||"").split(" ");return((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"?"}

export default function Home({user,kpis,onNavigate,onLogout,activeRoute="dashboard"}){
  const y=useMemo(()=>new Date().getFullYear(),[]);
  const u={displayName:"Jean Dupont",givenName:"Jean",tenantLabel:"Client",...(user||{})};
  const d={congesRestants:12,docsNouveaux:3,formationsProchaines:1,equipeCount:18,...(kpis||{})};
  const go=(r)=>{if(typeof onNavigate==="function")onNavigate(r);else window.location.hash=r;};

  return(
    <div>
      <style>{css}</style>
      <div className="hd">
        <div className="hd-in">
          <div className="brand" onClick={()=>go("dashboard")}>
            <div className="dot"/>
            <span className="brand-name">Synapse — Espace Client</span>
          </div>
          <div className="usr">
            <div className="av">{av(u.displayName)}</div>
            <div><div className="uname">{u.displayName}</div><div className="utenant">{u.tenantLabel}</div></div>
            <button className="lbtn" onClick={()=>typeof onLogout==="function"&&onLogout()}>Déconnexion</button>
          </div>
        </div>
      </div>
      <div className="wrap">
        <aside className="sb">
          <div className="sb-title">Navigation</div>
          {NAV.map(({r,i,l})=>(
            <button key={r} className={`nb${r===activeRoute?" on":""}`} onClick={()=>go(r)}>{i} {l}</button>
          ))}
        </aside>
        <div className="main">
          <div className="hero">
            <div>
              <h2>Bienvenue, {u.givenName} !</h2>
              <p>Connecté à l'espace {u.tenantLabel}.</p>
              <div className="chips">
                <span className="chip">Marque blanche</span>
                <span className="chip">Microsoft 365</span>
                <span className="chip">App-Only Graph</span>
              </div>
            </div>
            <div className="actions">
              <button className="ab" onClick={()=>go("conges")}>➕ Congé</button>
              <button className="ab s" onClick={()=>go("production")}>⚡ Production</button>
              <button className="ab g" onClick={()=>go("support")}>🛠️ Ticket</button>
            </div>
          </div>
          <div className="kpis">
            <div className="kpi" onClick={()=>go("conges")}>
              <div className="kpi-t">Congés</div><div className="kpi-v">{d.congesRestants}</div>
              <div className="kpi-l">Restants en {y}</div><div className="kpi-tr up">+0% vs N-1</div>
            </div>
            <div className="kpi" onClick={()=>go("documents")}>
              <div className="kpi-t">Documents</div><div className="kpi-v">{d.docsNouveaux}</div>
              <div className="kpi-l">Nouveaux</div><div className="kpi-tr" style={{color:"#2d3748"}}>Aujourd'hui</div>
            </div>
            <div className="kpi" onClick={()=>go("formations")}>
              <div className="kpi-t">Formations</div><div className="kpi-v">{d.formationsProchaines}</div>
              <div className="kpi-l">À venir ce mois</div><div className="kpi-tr up">+1 session</div>
            </div>
            <div className="kpi" onClick={()=>go("equipe")}>
              <div className="kpi-t">Équipe</div><div className="kpi-v">{d.equipeCount}</div>
              <div className="kpi-l">Collaborateurs</div><div className="kpi-tr dn">-0% turnover</div>
            </div>
          </div>
          <div className="cols">
            <div className="pnl">
              <div className="pnl-t">Derniers documents</div>
              {[["Bulletin de paie - Janvier","02/02/2026 • PDF"],["Attestation employeur","29/01/2026 • DOCX"],["Règlement intérieur","15/01/2026 • PDF"]].map(([t,s])=>(
                <div className="rw" key={t}>
                  <div><div className="rt">{t}</div><div className="rs">{s}</div></div>
                  <button className="ract" onClick={()=>go("documents")}>Ouvrir</button>
                </div>
              ))}
            </div>
            <div className="pnl">
              <div className="pnl-t">Notifications</div>
              <div className="rw"><div><div className="rt">Congés validés</div><div className="rs">22–24 fév. approuvée</div></div><button className="ract" onClick={()=>go("conges")}>Voir</button></div>
              <div className="rw"><div><div className="rt">Formation M365</div><div className="rs">12/03/2026 à 9h30</div></div><button className="ract" onClick={()=>go("formations")}>S'inscrire</button></div>
              <div className="rw"><div><div className="rt">Profil incomplet</div><div className="rs">Complétez votre adresse</div></div><button className="ract" onClick={()=>go("parametres")}>Compléter</button></div>
            </div>
          </div>
          <div className="fn">Propulsé par Synapse — Microsoft Graph (App-Only)</div>
        </div>
      </div>
    </div>
  );
}
