// src/components/AppShell.jsx — v2
// Tableau de bord / Production (tuiles → formulaires) / Documents
// La couche données simule Microsoft Graph : chaque écriture est annotée
// avec l'endpoint Graph qui la remplacera au branchement SharePoint.

import React, { useState, useEffect, useMemo } from "react";
import {
  ChartBar, FileText, Folder, Send, Download, Eye, Upload, X,
  Users, Clock, ShieldCheck, ArrowLeft, LogOut, Award, Banknote,
  GraduationCap, AlertCircle
} from "lucide-react";

/* ================================================================
   DONNÉES DE DÉMONSTRATION
   Mapping colonnes SharePoint ("Production contrat") :
   prenom → Pr_x00e9_nom, typeContrat → Type_x0020_contrat, etc.
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
  demandes: [], // acomptes, formations, attestations, sécurité
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
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};

const STATUTS = {
  "Signé":        { bg: "#E1F5EE", fg: "#085041" },
  "Brouillon":    { bg: "#F1EFE8", fg: "#444441" },
  "En relecture": { bg: "#EEEDFE", fg: "#3C3489" },
  "À traiter":    { bg: "#FAEEDA", fg: "#854F0B" },
  "Envoyée":      { bg: "#E6F1FB", fg: "#0C447C" },
  "Générée":      { bg: "#E6F1FB", fg: "#0C447C" },
  "Enregistrée":  { bg: "#E6F1FB", fg: "#0C447C" },
};

const BARRES = { CDI: "#378ADD", CDD: "#5DCAA5", Alternance: "#AFA9EC", Stage: "#F0997B" };

/* ================================================================
   DÉFINITION DES TUILES DE PRODUCTION
   Chaque tuile = un formulaire (champs) + une action d'enregistrement.
   cible : liste SharePoint visée au branchement Graph.
   ================================================================ */
const TUILES = [
  {
    id: "contrat", titre: "Contrat de travail", sous: "CDI, CDD, alternance", icone: FileText,
    cible: "Liste « Production contrat »",
    champs: [
      { k: "nom", l: "Nom" }, { k: "prenom", l: "Prénom" },
      { k: "type", l: "Type de contrat", type: "select", opts: ["CDI", "CDD", "Alternance", "Stage"] },
      { k: "debut", l: "Date de début", type: "date" },
      { k: "poste", l: "Poste", large: true },
    ],
  },
  {
    id: "dpae", titre: "DPAE", sous: "Déclaration d'embauche", icone: Send,
    cible: "Liste « DPAE »",
    champs: [
      { k: "nom", l: "Nom" }, { k: "prenom", l: "Prénom" },
      { k: "naissance", l: "Date de naissance", type: "date" },
      { k: "debut", l: "Date d'embauche", type: "date" },
    ],
    note: "Transmission au plus tôt 8 jours avant l'embauche (API URSSAF via Azure Function).",
  },
  {
    id: "attestation", titre: "Attestation", sous: "Employeur, travail", icone: Award,
    cible: "Génération PDF → Documents / Attestations",
    champs: [
      { k: "salarie", l: "Salarié", large: true },
      { k: "type", l: "Type", type: "select", opts: ["Attestation employeur", "Attestation de travail", "Certificat de travail"], large: true },
    ],
  },
  {
    id: "acompte", titre: "Acompte", sous: "Demande d'acompte", icone: Banknote,
    cible: "Liste « Acompte »",
    champs: [
      { k: "salarie", l: "Salarié", large: true },
      { k: "montant", l: "Montant (€)" },
      { k: "versement", l: "Date de versement", type: "date" },
    ],
  },
  {
    id: "formation", titre: "Formation", sous: "Demande de formation", icone: GraduationCap,
    cible: "Liste « Formations »",
    champs: [
      { k: "salarie", l: "Salarié", large: true },
      { k: "intitule", l: "Intitulé", large: true },
      { k: "organisme", l: "Organisme" },
      { k: "date", l: "Date souhaitée", type: "date" },
    ],
  },
  {
    id: "securite", titre: "Sécurité", sous: "DUERP, registres", icone: ShieldCheck,
    cible: "Documents / Sécurité",
    champs: [
      { k: "type", l: "Document", type: "select", opts: ["DUERP", "Registre du personnel", "Registre sécurité", "Affichage obligatoire"], large: true },
      { k: "commentaire", l: "Commentaire", large: true },
    ],
  },
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

/* ================================================================
   APPLICATION
   ================================================================ */
export default function AppShell({ user, onLogout }) {
  const [vue, setVue] = useState("dash");
  const [tuile, setTuile] = useState(null); // tuile ouverte (formulaire)
  const [dossierActif, setDossierActif] = useState("Contrats");
  const [db, setDb] = useState(null);
  const [toast, setToast] = useState(null);

  const prenom = user?.givenName || (user?.displayName || "").split(" ")[0] || "";
  const initiales = (user?.displayName || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase();

  /* GET initial — futurs GET /sites/{siteId}/lists/{liste}/items */
  useEffect(() => {
    latence(500).then(() => setDb(JSON.parse(JSON.stringify(seed))));
  }, []);

  const notifier = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  /* ---------- ÉCRITURE GÉNÉRIQUE (futurs POST Graph) ----------
     contrat     → POST /sites/{siteId}/lists/Production contrat/items
     dpae        → POST /sites/{siteId}/lists/DPAE/items
     acompte     → POST /sites/{siteId}/lists/Acompte/items
     formation   → POST /sites/{siteId}/lists/Formations/items
     attestation → PUT  /sites/{siteId}/drives/{driveId}/root:/Attestations/{fichier}:/content
     securite    → PUT  /sites/{siteId}/drives/{driveId}/root:/Sécurité/{fichier}:/content
  ---------------------------------------------------------------- */
  const enregistrer = async (tuileId, f) => {
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
      } else if (tuileId === "attestation") {
        const fichier = `Attestation_${(f.salarie || "X").split(" ")[0]}_${Date.now().toString().slice(-4)}.pdf`;
        n.demandes = [{ id: Date.now(), type: f.type, salarie: f.salarie, statut: "Générée", ts }, ...d.demandes];
        n.documents = [{ id: Date.now(), nom: fichier, dossier: "Attestations", modif: ts.slice(0, 10), par: "Osmose RH" }, ...d.documents];
      } else if (tuileId === "securite") {
        const fichier = `${(f.type || "Document").replace(/ /g, "_")}_${Date.now().toString().slice(-4)}.pdf`;
        n.documents = [{ id: Date.now(), nom: fichier, dossier: "Sécurité", modif: ts.slice(0, 10), par: "Osmose RH" }, ...d.documents];
      } else {
        n.demandes = [{ id: Date.now(), type: tuileId === "acompte" ? "Acompte" : "Formation", ...f, statut: "Enregistrée", ts }, ...d.demandes];
      }
      return n;
    });
    setTuile(null);
    notifier(
      tuileId === "attestation" ? "Attestation générée et déposée dans la GED"
      : tuileId === "securite" ? "Document déposé dans Documents / Sécurité"
      : "Enregistré"
    );
  };

  // PATCH statut DPAE (après appel API URSSAF via Azure Function)
  const envoyerDpae = async (id) => {
    await latence(400);
    setDb((d) => ({ ...d, dpae: d.dpae.map((x) => (x.id === id ? { ...x, statut: "Envoyée" } : x)) }));
    notifier("DPAE marquée envoyée");
  };

  // PUT /sites/{siteId}/drives/{driveId}/root:/{dossier}/{nom}:/content
  const deposerFichier = async () => {
    await latence();
    setDb((d) => ({
      ...d,
      documents: [{ id: Date.now(), nom: `Document_${Date.now().toString().slice(-4)}.pdf`, dossier: dossierActif, modif: new Date().toISOString().slice(0, 10), par: user?.displayName || "Utilisateur" }, ...d.documents],
    }));
    notifier(`Fichier déposé dans ${dossierActif}`);
  };

  /* ---------- DÉRIVÉS TABLEAU DE BORD ---------- */
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
        Connexion au SharePoint client…
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

  /* ================================================================ */
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
              {user?.displayName}<br />{user?.tenantLabel || "Client"}
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
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Tableau de bord — {user?.tenantLabel || "Client"}</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <Kpi label="Effectif" val={db.effectif} icon={Users} />
              <Kpi label="Embauches 2026" val={embauches2026} icon={FileText} />
              <Kpi label="DPAE à traiter" val={dpaeATraiter} warn={dpaeATraiter > 0} icon={Clock} />
              <Kpi label="Documents" val={db.documents.length} icon={Folder} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {/* Répartition des contrats */}
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

              {/* Embauches par mois */}
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

            {/* À traiter */}
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

        {/* ===== PRODUCTION : TUILES → FORMULAIRE ===== */}
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
                      fontFamily: T.sans, transition: "border-color .15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.accent)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
                  >
                    <Icone size={28} color={T.accent} strokeWidth={1.6} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{t.titre}</span>
                    <span style={{ fontSize: 11.5, color: T.mut }}>{t.sous}</span>
                  </button>
                );
              })}
            </div>

            {/* Suivi DPAE sous la grille */}
            {db.dpae.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 14, fontFamily: T.serif, margin: "0 0 10px" }}>DPAE en cours</h2>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                  {db.dpae.map((x, i) => (
                    <div key={x.id} style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < db.dpae.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                      <span>{x.nom} {x.prenom} — embauche le {x.debut?.split("-").reverse().join("/")}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge s={x.statut} />
                        {x.statut === "À traiter" && <Btn small primary onClick={() => envoyerDpae(x.id)}><Send size={12} /> Envoyer</Btn>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {vue === "prod" && tuile && (
          <FormulaireTuile
            tuile={tuile}
            onRetour={() => setTuile(null)}
            onSave={(f) => enregistrer(tuile.id, f)}
          />
        )}

        {/* ===== DOCUMENTS ===== */}
        {vue === "docs" && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
            <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>Bibliothèque Documents RH — SharePoint du client</p>

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
                  Dossier vide — déposez un premier fichier.
                </div>
              )}
            </div>
            <Btn primary onClick={deposerFichier}><Upload size={15} /> Déposer un fichier</Btn>
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
   FORMULAIRE GÉNÉRIQUE (piloté par la définition de la tuile)
   ================================================================ */
function FormulaireTuile({ tuile, onRetour, onSave }) {
  const [f, setF] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const Icone = tuile.icone;
  const ok = tuile.champs.every((c) => c.type === "select" ? true : (f[c.k] || "").trim() !== "");

  useEffect(() => {
    // Pré-remplir les selects avec leur première option
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
                <input
                  type={c.type || "text"}
                  style={inputStyle}
                  value={f[c.k] || ""}
                  onChange={(e) => setF({ ...f, [c.k]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        {tuile.note && <p style={{ fontSize: 11.5, color: T.mut, margin: "12px 0 0" }}>{tuile.note}</p>}

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
