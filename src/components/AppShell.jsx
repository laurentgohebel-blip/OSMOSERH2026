// src/components/AppShell.jsx — v2.2
// Tableau de bord / Production (tuiles → formulaires) / Documents
// ATT-01 câblé : la tuile « Attestation » poste vers /api/demande
// ACP-01 câblé : la tuile « Acompte » poste vers /api/demande,
// champs alignés sur la liste SharePoint « Acomptes » (MOIS, Agence,
// NOM, PRENOM, MATRICULE, MONTANT, PERMANENT/PONCTUEL — Statut et
// affectation restent côté gestionnaire). Le flux Power Automate
// fait tout le reste. Les autres tuiles restent en démo locale.

import React, { useState, useEffect, useMemo } from "react";
import {
  ChartBar, FileText, Folder, Send, Download, Eye, Upload,
  Users, Clock, ShieldCheck, ArrowLeft, LogOut, Award, Banknote,
  GraduationCap, AlertCircle, Check
} from "lucide-react";

/* ================================================================
   CONFIGURATION
   CODE_CLIENT : doit correspondre à une ligne de la liste
   « Paramètres clients » (colonne CodeClient) sur le site OsmoseRH.
   "TEST" = la ligne de recette du kit. À terme : dérivé du tenant.
   ================================================================ */
const CODE_CLIENT = "TEST";

/* ================================================================
   DONNÉES DE DÉMONSTRATION (tuiles non câblées + tableau de bord)
   ================================================================ */
const seed = {
  effectif: 42,
  repartition: { CDI: 31, CDD: 6, Alternance: 4, Stage: 1 },
  embauchesParMois: [
    { m: "Fév", n: 1 }, { m: "Mar", n: 2 }, { m: "Avr", n: 1 },
    { m: "Mai", n: 3 }, { m: "Juin", n: 2 }, { m: "Juil", n: 4 },
  ],
  contrats: [
    { id: 1, nom: "Dupont", prenom: "Marie", type: "CDI", poste: "Comptable", debut: "2026-09-01", statut: "Signé", ts: "2026-07-10T09:12:00" },
    { id: 2, nom: "Martin", prenom: "Paul", type: "CDD", poste: "Assistant RH", debut: "2026-08-15", statut: "Brouillon", ts: "2026-07-09T15:40:00" },
    { id: 3, nom: "Leroy", prenom: "Anne", type: "Alternance", poste: "Chargée de com", debut: "2026-10-01", statut: "En relecture", ts: "2026-07-08T11:05:00" },
  ],
  dpae: [
    { id: 1, nom: "Martin", prenom: "Paul", naissance: "1998-03-22", debut: "2026-08-15", statut: "À traiter", ts: "2026-07-09T15:45:00" },
    { id: 2, nom: "Bernard", prenom: "Luc", naissance: "1990-11-02", debut: "2026-07-20", statut: "À traiter", ts: "2026-07-07T10:20:00" },
  ],
  documents: [
    { id: 1, nom: "Contrat_Dupont_CDI.docx", dossier: "Contrats", modif: "2026-07-10", par: "Osmose RH" },
    { id: 2, nom: "Attestation_Leroy.pdf", dossier: "Attestations", modif: "2026-07-08", par: "Osmose RH" },
    { id: 3, nom: "Bulletins_juin_2026.zip", dossier: "Paie", modif: "2026-07-02", par: "Cabinet paie" },
    { id: 4, nom: "DUERP_2026.pdf", dossier: "Sécurité", modif: "2026-06-18", par: "Osmose RH" },
    { id: 5, nom: "Plan_formation_2026.xlsx", dossier: "Formations", modif: "2026-06-05", par: "Osmose RH" },
  ],
};

const DOSSIERS = ["Contrats", "Paie", "Attestations", "DPAE", "Sécurité", "Formations"];
const latence = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/* ================================================================
   THÈME — identité Osmose RH
   ================================================================ */
const T = {
  navy: "#0D1F33",
  accent: "#1668D9",
  accentSoft: "#7FB0E8",
  bg: "#F4F6F9",
  card: "#FFFFFF",
  border: "#E3E8EF",
  ink: "#1A2433",
  mut: "#5C6B80",
  err: "#A8564A",
  ok: "#0F6E56",
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};

const STATUTS = {
  "Signé":        { bg: "#E1F5EE", fg: "#085041" },
  "Brouillon":    { bg: "#F1EFE8", fg: "#444441" },
  "En relecture": { bg: "#EEEDFE", fg: "#3C3489" },
  "À traiter":    { bg: "#FAEEDA", fg: "#854F0B" },
  "Envoyée":      { bg: "#E6F1FB", fg: "#0C447C" },
  "Reçue":        { bg: "#E6F1FB", fg: "#0C447C" },
};

const BARRES = { CDI: "#378ADD", CDD: "#5DCAA5", Alternance: "#AFA9EC", Stage: "#F0997B" };

/* ================================================================
   TUILES — id "attestation" est câblée (ATT-01), les autres en démo
   ================================================================ */
const TUILES = [
  { id: "contrat", titre: "Contrat de travail", sous: "CDI, CDD, alternance", icone: FileText,
    cible: "Démarche EMB-01 — à câbler (vague 3)",
    champs: [
      { k: "nom", l: "Nom" }, { k: "prenom", l: "Prénom" },
      { k: "type", l: "Type de contrat", type: "select", opts: ["CDI", "CDD", "Alternance", "Stage"] },
      { k: "debut", l: "Date de début", type: "date" },
      { k: "poste", l: "Poste", large: true },
    ] },
  { id: "dpae", titre: "DPAE", sous: "Déclaration d'embauche", icone: Send,
    cible: "Démarche EMB-01 — à câbler (vague 3)",
    champs: [
      { k: "nom", l: "Nom" }, { k: "prenom", l: "Prénom" },
      { k: "naissance", l: "Date de naissance", type: "date" },
      { k: "debut", l: "Date d'embauche", type: "date" },
    ] },
  { id: "attestation", titre: "Attestation", sous: "Attestation employeur", icone: Award, cablee: true },
  { id: "acompte", titre: "Acompte", sous: "Demande d'acompte", icone: Banknote, cablee: true },
  { id: "formation", titre: "Formation", sous: "Demande de formation", icone: GraduationCap,
    cible: "Hors catalogue v1 — démo",
    champs: [
      { k: "salarie", l: "Salarié", large: true },
      { k: "intitule", l: "Intitulé", large: true },
      { k: "organisme", l: "Organisme" },
      { k: "date", l: "Date souhaitée", type: "date" },
    ] },
  { id: "securite", titre: "Sécurité", sous: "DUERP, registres", icone: ShieldCheck,
    cible: "Hors catalogue v1 — démo",
    champs: [
      { k: "type", l: "Document", type: "select", opts: ["DUERP", "Registre du personnel", "Registre sécurité", "Affichage obligatoire"], large: true },
      { k: "commentaire", l: "Commentaire", large: true },
    ] },
];

/* ================================================================
   PETITS COMPOSANTS
   ================================================================ */
const Badge = ({ s }) => {
  const c = STATUTS[s] || { bg: "#F1EFE8", fg: "#444441" };
  return <span style={{ background: c.bg, color: c.fg, fontSize: 11, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{s}</span>;
};

const Kpi = ({ label, val, warn, icon: Icon }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 130 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut, marginBottom: 4 }}>
      {Icon && <Icon size={14} />}{label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 600, color: warn ? "#B45309" : T.ink, fontFamily: T.serif }}>{val}</div>
  </div>
);

const Btn = ({ children, primary, onClick, small, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: primary ? T.accent : T.card,
      color: primary ? "#fff" : T.ink,
      border: `1px solid ${primary ? T.accent : T.border}`,
      borderRadius: 8, padding: small ? "5px 10px" : "8px 14px",
      fontSize: small ? 12 : 13, cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.5 : 1, fontFamily: T.sans,
    }}
  >
    {children}
  </button>
);

const inputStyle = {
  border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 13, outline: "none", background: "#fff", color: T.ink,
  fontFamily: T.sans, width: "100%", boxSizing: "border-box",
};
const inputInvalid = { ...inputStyle, border: `1px solid ${T.err}` };

/* ================================================================
   APPLICATION
   ================================================================ */
export default function AppShell({ user, onLogout }) {
  const [vue, setVue] = useState("dash");
  const [tuile, setTuile] = useState(null);
  const [dossierActif, setDossierActif] = useState("Contrats");
  const [db, setDb] = useState(null);
  const [toast, setToast] = useState(null);

  const prenom = user?.givenName || (user?.displayName || "").split(" ")[0] || "";
  const initiales = (user?.displayName || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    latence(500).then(() => setDb(JSON.parse(JSON.stringify(seed))));
  }, []);

  const notifier = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  /* Écriture DÉMO pour les tuiles non câblées */
  const enregistrerDemo = async (tuileId, f) => {
    await latence(400);
    const ts = new Date().toISOString();
    setDb((d) => {
      const n = { ...d };
      if (tuileId === "contrat") {
        n.contrats = [{ id: Date.now(), ...f, statut: "Brouillon", ts }, ...d.contrats];
        n.repartition = { ...d.repartition, [f.type]: (d.repartition[f.type] || 0) + 1 };
        n.embauchesParMois = d.embauchesParMois.map((x, i) =>
          i === d.embauchesParMois.length - 1 ? { ...x, n: x.n + 1 } : x
        );
      } else if (tuileId === "dpae") {
        n.dpae = [{ id: Date.now(), ...f, statut: "À traiter", ts }, ...d.dpae];
      }
      return n;
    });
    setTuile(null);
    notifier("Enregistré (démo locale — démarche pas encore câblée)");
  };

  const envoyerDpaeDemo = async (id) => {
    await latence(400);
    setDb((d) => ({ ...d, dpae: d.dpae.map((x) => (x.id === id ? { ...x, statut: "Envoyée" } : x)) }));
    notifier("DPAE marquée envoyée (démo)");
  };

  const deposerFichierDemo = async () => {
    await latence();
    setDb((d) => ({
      ...d,
      documents: [{ id: Date.now(), nom: `Document_${Date.now().toString().slice(-4)}.pdf`, dossier: dossierActif, modif: new Date().toISOString().slice(0, 10), par: user?.displayName || "Utilisateur" }, ...d.documents],
    }));
    notifier(`Fichier déposé dans ${dossierActif} (démo)`);
  };

  const aTraiter = useMemo(() => {
    if (!db) return [];
    return [
      ...db.dpae.filter((x) => x.statut === "À traiter").map((x) => ({
        t: `DPAE ${x.nom} ${x.prenom} — embauche le ${x.debut?.split("-").reverse().join("/")}`, s: "À traiter",
      })),
      ...db.contrats.filter((c) => c.statut === "En relecture").map((c) => ({
        t: `Contrat ${c.nom} ${c.prenom} — en relecture`, s: "En relecture",
      })),
      ...db.contrats.filter((c) => c.statut === "Brouillon").map((c) => ({
        t: `Contrat ${c.nom} ${c.prenom} — brouillon à finaliser`, s: "Brouillon",
      })),
    ];
  }, [db]);

  if (!db) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans, color: T.mut, fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  const totalContrats = Object.values(db.repartition).reduce((a, b) => a + b, 0);
  const maxMois = Math.max(...db.embauchesParMois.map((x) => x.n), 1);
  const embauches2026 = db.embauchesParMois.reduce((a, x) => a + x.n, 0);
  const dpaeATraiter = db.dpae.filter((x) => x.statut === "À traiter").length;

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setVue(id); setTuile(null); }}
      style={{
        all: "unset", cursor: "pointer", padding: "11px 20px", fontSize: 13.5,
        display: "flex", alignItems: "center", gap: 10, fontFamily: T.sans,
        background: vue === id ? "rgba(127,176,232,0.16)" : "transparent",
        borderLeft: vue === id ? `3px solid ${T.accentSoft}` : "3px solid transparent",
        color: vue === id ? "#E8EDF5" : "#9FB2C9",
      }}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>

      {/* ---------- BARRE LATÉRALE ---------- */}
      <aside style={{ width: 200, flexShrink: 0, background: T.navy, display: "flex", flexDirection: "column", paddingTop: 24 }}>
        <div style={{ padding: "0 20px 26px", fontFamily: T.serif, fontSize: 19, color: "#fff" }}>
          Osmose <span style={{ fontStyle: "italic", color: T.accentSoft }}>RH</span>
        </div>
        <NavBtn id="dash" icon={ChartBar} label="Tableau de bord" />
        <NavBtn id="prod" icon={FileText} label="Production" />
        <NavBtn id="docs" icon={Folder} label="Documents" />
        <div style={{ marginTop: "auto", padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentSoft, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{initiales}</div>
            <div style={{ fontSize: 11.5, color: "#9FB2C9", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.displayName}<br />{CODE_CLIENT}
            </div>
          </div>
          <button onClick={onLogout} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9FB2C9", fontFamily: T.sans }}>
            <LogOut size={13} /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* ---------- CONTENU ---------- */}
      <main style={{ flex: 1, minWidth: 0, padding: "26px 32px", maxWidth: 1000 }}>

        {/* ===== TABLEAU DE BORD ===== */}
        {vue === "dash" && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Bonjour {prenom}</h1>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Tableau de bord — {CODE_CLIENT}</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <Kpi label="Effectif" val={db.effectif} icon={Users} />
              <Kpi label="Embauches 2026" val={embauches2026} icon={FileText} />
              <Kpi label="DPAE à traiter" val={dpaeATraiter} warn={dpaeATraiter > 0} icon={Clock} />
              <Kpi label="Documents" val={db.documents.length} icon={Folder} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 14, fontFamily: T.serif }}>Répartition des contrats</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(db.repartition).map(([type, n]) => (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span>{type}</span><span style={{ color: T.mut }}>{n}</span>
                      </div>
                      <div style={{ height: 8, background: T.bg, borderRadius: 4 }}>
                        <div style={{ width: `${Math.round((n / totalContrats) * 100)}%`, height: 8, background: BARRES[type] || T.accentSoft, borderRadius: 4, transition: "width .4s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 14, fontFamily: T.serif }}>Embauches par mois</h2>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
                  {db.embauchesParMois.map((x, i) => (
                    <div key={x.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: T.mut }}>{x.n}</span>
                      <div style={{ width: "100%", height: Math.max(6, (x.n / maxMois) * 85), background: i >= db.embauchesParMois.length - 2 ? "#378ADD" : "#B5D4F4", borderRadius: "3px 3px 0 0", transition: "height .4s" }} />
                      <span style={{ fontSize: 11, color: T.mut }}>{x.m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
              <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>À traiter</div>
              {aTraiter.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Rien en attente — tout est à jour.</div>
              )}
              {aTraiter.map((a, i) => (
                <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < aTraiter.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={15} color="#BA7517" /> {a.t}
                  </span>
                  <Badge s={a.s} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut }}>
              <ShieldCheck size={13} /> Données hébergées dans votre tenant Microsoft 365 — conforme RGPD
            </div>
          </>
        )}

        {/* ===== PRODUCTION ===== */}
        {vue === "prod" && !tuile && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Production</h1>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Choisissez une démarche</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
              {TUILES.map((t) => {
                const Icone = t.icone;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTuile(t)}
                    style={{
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                      padding: "22px 16px", cursor: "pointer", textAlign: "center",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                      fontFamily: T.sans, transition: "border-color .15s", position: "relative",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.accent)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
                  >
                    {t.cablee && (
                      <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: T.ok }} title="Démarche active" />
                    )}
                    <Icone size={28} color={T.accent} strokeWidth={1.6} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{t.titre}</span>
                    <span style={{ fontSize: 11.5, color: T.mut }}>{t.sous}</span>
                  </button>
                );
              })}
            </div>

            {db.dpae.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 14, fontFamily: T.serif, margin: "0 0 10px" }}>DPAE en cours</h2>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                  {db.dpae.map((x, i) => (
                    <div key={x.id} style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < db.dpae.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                      <span>{x.nom} {x.prenom} — embauche le {x.debut?.split("-").reverse().join("/")}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge s={x.statut} />
                        {x.statut === "À traiter" && <Btn small primary onClick={() => envoyerDpaeDemo(x.id)}><Send size={12} /> Envoyer</Btn>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {vue === "prod" && tuile && tuile.id === "attestation" && (
          <AttestationEmployeur user={user} onRetour={() => setTuile(null)} />
        )}

        {vue === "prod" && tuile && tuile.id === "acompte" && (
          <DemandeAcompte user={user} onRetour={() => setTuile(null)} />
        )}

        {vue === "prod" && tuile && !tuile.cablee && (
          <FormulaireTuile tuile={tuile} onRetour={() => setTuile(null)} onSave={(f) => enregistrerDemo(tuile.id, f)} />
        )}

        {/* ===== DOCUMENTS ===== */}
        {vue === "docs" && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
            <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>Bibliothèque Documents RH</p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {DOSSIERS.map((f) => (
                <button key={f} onClick={() => setDossierActif(f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    border: `1px solid ${dossierActif === f ? T.accent : T.border}`,
                    background: dossierActif === f ? "#E6F1FB" : T.card,
                    color: dossierActif === f ? "#0C447C" : T.ink,
                    borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: T.sans,
                  }}>
                  <Folder size={15} color={dossierActif === f ? T.accent : T.mut} /> {f}
                  <span style={{ fontSize: 11, color: T.mut }}>
                    {db.documents.filter((d) => d.dossier === f).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 90px", gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                <span>Nom</span><span>Modifié</span><span>Par</span><span>Actions</span>
              </div>
              {db.documents.filter((d) => d.dossier === dossierActif).map((d) => (
                <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 90px", gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={15} color={T.mut} /> {d.nom}</span>
                  <span style={{ color: T.mut }}>{d.modif.split("-").reverse().join("/")}</span>
                  <span style={{ color: T.mut }}>{d.par}</span>
                  <span style={{ display: "flex", gap: 10, color: T.mut }}>
                    <Eye size={16} style={{ cursor: "pointer" }} />
                    <Download size={16} style={{ cursor: "pointer" }} />
                  </span>
                </div>
              ))}
              {db.documents.filter((d) => d.dossier === dossierActif).length === 0 && (
                <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.mut }}>
                  Dossier vide.
                </div>
              )}
            </div>
            <Btn primary onClick={deposerFichierDemo}><Upload size={15} /> Déposer un fichier</Btn>
          </>
        )}
      </main>

      {/* ---------- TOAST ---------- */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.navy, color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 13, zIndex: 60, fontFamily: T.sans }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   ATT-01 — ATTESTATION EMPLOYEUR (câblée sur /api/demande)
   Reprend à l'identique le formulaire du portail public :
   mêmes champs, mêmes validations, même payload, même écran
   de confirmation, même mode démo si l'API est injoignable.
   Différences app authentifiée : email pré-rempli (compte
   Microsoft), client = CODE_CLIENT (pas de paramètre d'URL).
   ================================================================ */
function AttestationEmployeur({ user, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    civilite: "", nom: "", naissance: "", entree: "", poste: "", contrat: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref, demo }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const e = {
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()),
      civilite: !f.civilite,
      nom: f.nom.trim().length < 3,
      naissance: !f.naissance,
      entree: !f.entree || new Date(f.entree) > new Date(),
      poste: f.poste.trim().length < 2,
      contrat: !f.contrat,
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");

    const payload = {
      demarche: "attestation-employeur",
      client: CODE_CLIENT,
      email: f.email.trim(),
      civilite: f.civilite,
      nomSalarie: f.nom.trim(),
      dateNaissance: f.naissance,
      dateEntree: f.entree,
      poste: f.poste.trim(),
      typeContrat: f.contrat,
      xq_note: "", // honeypot : doit rester vide
    };

    let ref = null, demo = false;
    try {
      const r = await fetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        // L'API a répondu mais refuse : on AFFICHE l'erreur, jamais un faux succès
        let msg = "HTTP " + r.status;
        try { const e = await r.json(); if (e.erreur) msg = `${e.erreur} (HTTP ${r.status})`; } catch (_) {}
        if (r.status === 404) msg = "API /api/demande introuvable (404) — vérifier api_location dans le workflow GitHub.";
        setErrbar(msg);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      ref = j.reference || null;
    } catch (_) {
      // Aucune réponse (dev local sans API) : parcours sans envoi réel
      demo = true;
    }

    setFini({ ref, demo });
  };

  const Champ = ({ k, label, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, color: T.mut }}>{label} <span style={{ color: T.err }}>*</span></label>
      {children}
      {err[k] && (
        <span style={{ fontSize: 11, color: T.err }}>
          {k === "entree" ? "La date d'entrée ne peut pas être future."
            : k === "email" ? "Email invalide."
            : k === "naissance" ? "Date requise." : "Champ requis."}
        </span>
      )}
    </div>
  );

  /* ---------- Écran de confirmation ---------- */
  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 520, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Demande transmise</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            Votre demande d'attestation pour <strong>{f.civilite} {f.nom.trim()}</strong> est prise en charge.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Vous recevrez le document en PDF à <strong>{f.email.trim()}</strong> après validation par votre gestionnaire.
          </p>
          {fini.ref && (
            <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>
          )}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  /* ---------- Formulaire ---------- */
  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Award size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Attestation employeur</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {CODE_CLIENT} — traitée après validation par votre gestionnaire.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Votre email (accusé et réception du document) <span style={{ color: T.err }}>*</span></label>
            <input style={err.email ? inputInvalid : inputStyle} value={f.email} onChange={(e) => maj("email", e.target.value)} />
            {err.email && <span style={{ fontSize: 11, color: T.err }}>Email invalide.</span>}
          </div>

          <Champ k="civilite" label="Civilité">
            <select style={err.civilite ? inputInvalid : inputStyle} value={f.civilite} onChange={(e) => maj("civilite", e.target.value)}>
              <option value="">—</option>
              <option>Madame</option>
              <option>Monsieur</option>
            </select>
          </Champ>

          <Champ k="nom" label="Nom et prénom du salarié">
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. Sofia Marques" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </Champ>

          <Champ k="naissance" label="Date de naissance">
            <input type="date" max="2010-12-31" style={err.naissance ? inputInvalid : inputStyle} value={f.naissance} onChange={(e) => maj("naissance", e.target.value)} />
          </Champ>

          <Champ k="entree" label="Date d'entrée">
            <input type="date" style={err.entree ? inputInvalid : inputStyle} value={f.entree} onChange={(e) => maj("entree", e.target.value)} />
          </Champ>

          <Champ k="poste" label="Intitulé du poste">
            <input style={err.poste ? inputInvalid : inputStyle} placeholder="Ex. Agent de service" value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
          </Champ>

          <Champ k="contrat" label="Type de contrat">
            <select style={err.contrat ? inputInvalid : inputStyle} value={f.contrat} onChange={(e) => maj("contrat", e.target.value)}>
              <option value="">—</option>
              <option>contrat à durée indéterminée (CDI)</option>
              <option>contrat à durée déterminée (CDD)</option>
            </select>
          </Champ>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Envoyer la demande"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Un accusé de traitement vous sera adressé. Données traitées par Osmose RH dans le cadre de la mission confiée par votre entreprise.
        </p>
      </div>
    </>
  );
}

/* ================================================================
   ACP-01 — DEMANDE D'ACOMPTE (câblée sur /api/demande)
   Champs alignés colonne à colonne sur la liste SharePoint
   « Acomptes » : MOIS, Agence, NOM, PRENOM, MATRICULE, MONTANT,
   PERMANENT/PONCTUEL. « Statut » (Nouveau → Traité) et
   « Attribué à » sont posés par le flux / le gestionnaire.
   Même contrat que ATT-01 : /api/demande, honeypot, erreurs
   affichées, mode démo si l'API est injoignable en dev local.
   Variable à configurer sur la Static Web App : FLOW_URL_ACOMPTE.
   ================================================================ */
const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/* Champ requis avec message d'erreur — défini au niveau module
   (un composant défini DANS le rendu serait remonté à chaque frappe
   et ferait perdre le focus de l'input). */
const ChampReq = ({ label, erreur, large, children }) => (
  <div style={{ gridColumn: large ? "1 / -1" : "auto", display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 12, color: T.mut }}>{label} <span style={{ color: T.err }}>*</span></label>
    {children}
    {erreur && <span style={{ fontSize: 11, color: T.err }}>{erreur}</span>}
  </div>
);

function DemandeAcompte({ user, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    mois: MOIS_FR[new Date().getMonth()],
    agence: "", nom: "", prenom: "", matricule: "", montant: "", type: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref, demo }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const e = {
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()),
      mois: !f.mois,
      agence: f.agence.trim().length < 2,
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      matricule: !/^\d{1,10}$/.test(f.matricule.trim()),
      montant: !/^\d{1,5}([.,]\d{1,2})?$/.test(f.montant.trim()) || parseFloat(f.montant.trim().replace(",", ".")) <= 0,
      type: !f.type,
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");

    const payload = {
      demarche: "acompte",
      client: CODE_CLIENT,
      email: f.email.trim(),
      mois: f.mois,
      agence: f.agence.trim().toUpperCase(),
      nom: f.nom.trim().toUpperCase(),
      prenom: f.prenom.trim().toUpperCase(),
      matricule: f.matricule.trim(),
      montant: f.montant.trim().replace(",", "."),
      typeAcompte: f.type, // "PERMANENT" | "PONCTUEL"
      xq_note: "", // honeypot : doit rester vide
    };

    let ref = null, demo = false;
    try {
      const r = await fetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        let msg = "HTTP " + r.status;
        try { const e = await r.json(); if (e.erreur) msg = `${e.erreur} (HTTP ${r.status})`; } catch (_) {}
        if (r.status === 404) msg = "API /api/demande introuvable (404) — vérifier api_location dans le workflow GitHub.";
        setErrbar(msg);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      ref = j.reference || null;
    } catch (_) {
      demo = true;
    }

    setFini({ ref, demo });
  };

  /* ---------- Écran de confirmation ---------- */
  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 520, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Demande transmise</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            Demande d'acompte de <strong>{f.montant.trim().replace(".", ",")} €</strong> ({f.type.toLowerCase()}) pour <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim().toUpperCase()}</strong> — {f.mois}, agence {f.agence.trim().toUpperCase()}.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Elle sera traitée par votre gestionnaire ; un accusé sera adressé à <strong>{f.email.trim()}</strong>.
          </p>
          {fini.ref && (
            <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>
          )}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  /* ---------- Formulaire ---------- */
  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Banknote size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Demande d'acompte</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {CODE_CLIENT} — versée après validation par votre gestionnaire.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq large label="Votre email (accusé de traitement)" erreur={err.email && "Email invalide."}>
            <input style={err.email ? inputInvalid : inputStyle} value={f.email} onChange={(e) => maj("email", e.target.value)} />
          </ChampReq>

          <ChampReq label="Mois concerné" erreur={err.mois && "Champ requis."}>
            <select style={err.mois ? inputInvalid : inputStyle} value={f.mois} onChange={(e) => maj("mois", e.target.value)}>
              {MOIS_FR.map((m) => <option key={m}>{m}</option>)}
            </select>
          </ChampReq>

          <ChampReq label="Agence" erreur={err.agence && "Champ requis."}>
            <input style={err.agence ? inputInvalid : inputStyle} placeholder="Ex. MONTPELLIER" value={f.agence} onChange={(e) => maj("agence", e.target.value)} />
          </ChampReq>

          <ChampReq label="Nom du salarié" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. MARQUES" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Prénom du salarié" erreur={err.prenom && "Champ requis."}>
            <input style={err.prenom ? inputInvalid : inputStyle} placeholder="Ex. SOFIA" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Matricule" erreur={err.matricule && "Matricule numérique attendu."}>
            <input inputMode="numeric" style={err.matricule ? inputInvalid : inputStyle} placeholder="Ex. 600138" value={f.matricule} onChange={(e) => maj("matricule", e.target.value)} />
          </ChampReq>

          <ChampReq label="Montant (€)" erreur={err.montant && "Montant invalide (ex. 150 ou 113,35)."}>
            <input inputMode="decimal" style={err.montant ? inputInvalid : inputStyle} placeholder="Ex. 150" value={f.montant} onChange={(e) => maj("montant", e.target.value)} />
          </ChampReq>

          <ChampReq large label="Type d'acompte" erreur={err.type && "Champ requis."}>
            <select style={err.type ? inputInvalid : inputStyle} value={f.type} onChange={(e) => maj("type", e.target.value)}>
              <option value="">—</option>
              <option value="PONCTUEL">Ponctuel — ce mois uniquement</option>
              <option value="PERMANENT">Permanent — reconduit chaque mois</option>
            </select>
          </ChampReq>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Envoyer la demande"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Un accusé de traitement vous sera adressé. Données traitées par Osmose RH dans le cadre de la mission confiée par votre entreprise.
        </p>
      </div>
    </>
  );
}

/* ================================================================
   FORMULAIRE GÉNÉRIQUE (tuiles non câblées — démo locale)
   ================================================================ */
function FormulaireTuile({ tuile, onRetour, onSave }) {
  const [f, setF] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const Icone = tuile.icone;
  const ok = tuile.champs.every((c) => c.type === "select" ? true : (f[c.k] || "").trim() !== "");

  useEffect(() => {
    const init = {};
    tuile.champs.forEach((c) => { if (c.type === "select") init[c.k] = c.opts[0]; });
    setF(init);
  }, [tuile]);

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Icone size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>{tuile.titre}</h1>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: T.mut }}>{tuile.cible}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tuile.champs.map((c) => (
            <div key={c.k} style={{ gridColumn: c.large ? "1 / -1" : "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: T.mut }}>{c.l}</label>
              {c.type === "select" ? (
                <select style={inputStyle} value={f[c.k] || c.opts[0]} onChange={(e) => setF({ ...f, [c.k]: e.target.value })}>
                  {c.opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={c.type || "text"} style={inputStyle} value={f[c.k] || ""} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={!ok || envoi} onClick={async () => { setEnvoi(true); await onSave(f); }}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Btn>
        </div>
      </div>
    </>
  );
}
