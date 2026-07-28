// src/components/AppShell.jsx — v2.2
// Tableau de bord / Production (tuiles → formulaires) / Documents
// ATT-01 câblé : la tuile « Attestation » poste vers /api/demande
// ACP-01 câblé : la tuile « Acompte » poste vers /api/demande,
// champs alignés sur la liste SharePoint « Acompte » du site RH
// (Matricule, Nom, Prénom, Montant demandé — Date de demande et
// Statut sont posés par le flux). Le flux Power Automate fait
// tout le reste. Les autres tuiles restent en démo locale.

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChartBar, FileText, Folder, Send, Download, Eye, Upload,
  Users, Clock, ShieldCheck, ArrowLeft, LogOut, Award, Banknote,
  GraduationCap, AlertCircle, Check, CalendarDays, Plus, Copy, X, UserMinus
} from "lucide-react";
import { apiFetch } from "../apiClient";

/* ================================================================
   CONFIGURATION
   Le client est RÉSOLU CÔTÉ SERVEUR (/api/me : jeton vérifié →
   listes « Utilisateurs portail » / « Paramètres clients » du site RH).
   CODE_CLIENT ne sert plus que de repli d'affichage en dev local
   sans API — le payload envoyé est de toute façon écrasé par l'API.
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

/* Échéances de démonstration (dev local sans API) — dates relatives au jour
   courant pour que badges et compteurs restent réalistes. */
const dansNJours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const DEMO_ECHEANCES = {
  echeances: [
    { salarie: "MARTIN Paul", poste: "Assistant RH", dateFin: dansNJours(12), joursRestants: 12, alerte: new Date().toISOString() },
    { salarie: "BERNARD Luc", poste: "Agent logistique", dateFin: dansNJours(26), joursRestants: 26, alerte: new Date().toISOString() },
    { salarie: "PETIT Chloé", poste: "Hôtesse d'accueil", dateFin: dansNJours(74), joursRestants: 74, alerte: null },
  ],
  recentes: [
    { salarie: "LEROY Anne", poste: "Chargée de com", dateFin: dansNJours(-9), joursRestants: -9, alerte: dansNJours(-40) },
  ],
};

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
/* Option contractuelle requise par tuile (opt-in) — les tuiles sans entrée
   (démos formation/sécurité) restent librement accessibles. */
const OPTION_TUILE = { attestation: "attestation", acompte: "acompte", embauche: "embauche", variables: "paie", fin: "embauche", personnel: "embauche", absences: "embauche", visite: "embauche", mutuelle: "embauche" };

/* Tuiles groupées par bloc métier (miroir de la page services) — le bloc
   « bientot » est affiché grisé, non cliquable (feuille de route visible). */
const BLOCS_TUILES = [
  { id: "salaries", titre: "Vos salariés" },
  { id: "paie", titre: "Votre paie" },
  { id: "echanges", titre: "Vos échanges" },
  { id: "bientot", titre: "Bientôt disponible" },
];

const TUILES = [
  { id: "personnel", bloc: "salaries", titre: "Gestion du personnel", sous: "Fiche salarié centralisée", icone: Users, cablee: true },
  { id: "embauche", bloc: "salaries", titre: "Embauche", sous: "Contrat + DPAE", icone: FileText, cablee: true },
  { id: "fin", bloc: "salaries", titre: "Fin de contrat", sous: "Départ d'un salarié", icone: UserMinus, cablee: true },
  { id: "absences", bloc: "salaries", titre: "Absences", sous: "Déclarer une absence", icone: Clock, cablee: true },
  { id: "visite", bloc: "salaries", titre: "Visite médicale", sous: "Programmation ou suivi", icone: ShieldCheck, cablee: true },
  { id: "mutuelle", bloc: "salaries", titre: "Mutuelle", sous: "Adhésion ou modification", icone: Banknote, cablee: true },
  { id: "attestation", bloc: "salaries", titre: "Attestation", sous: "Attestation employeur", icone: Award, cablee: true },
  { id: "variables", bloc: "paie", titre: "Variables de paie", sous: "Éléments du mois", icone: CalendarDays, cablee: true },
  { id: "acompte", bloc: "paie", titre: "Acompte", sous: "Demande d'acompte", icone: Banknote, cablee: true },
  { id: "contact", bloc: "echanges", titre: "Mon gestionnaire", sous: "Poser une question, transmettre", icone: Send, cablee: true },
  { id: "formation", bloc: "bientot", titre: "Formation", sous: "Demandes et plan de formation", icone: GraduationCap },
  { id: "securite", bloc: "bientot", titre: "Sécurité", sous: "DUERP, registres, affichages", icone: ShieldCheck },
];

/* ================================================================
   PETITS COMPOSANTS
   ================================================================ */
const Badge = ({ s }) => {
  const c = STATUTS[s] || { bg: "#F1EFE8", fg: "#444441" };
  return <span style={{ background: c.bg, color: c.fg, fontSize: 11, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{s}</span>;
};

const Kpi = ({ label, val, warn, icon: Icon }) => (
  <div className="osrh-kpi" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.mut, marginBottom: 8 }}>
      {Icon && (
        <span style={{ width: 26, height: 26, borderRadius: 8, background: warn ? "#FAEEDA" : "#E6F1FB", color: warn ? "#854F0B" : T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} />
        </span>
      )}
      {label}
    </div>
    <div className="osrh-kpi-val" style={{ fontSize: 26, fontWeight: 600, color: warn ? "#B45309" : T.ink, fontFamily: T.serif }}>{val}</div>
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
   SÉLECTION D'UN SALARIÉ (référentiel /api/personnel)
   Deux variantes, au niveau module (règle anti-remount) :
   — ChampSalarie : remplace un champ « Salarié » texte ; liste déroulante
     des actifs + bascule saisie libre ; simple input si pas de référentiel.
   — SelectSalarie : sélecteur optionnel qui PRÉ-REMPLIT des champs
     détaillés existants (nom, prénom, matricule…) sans les remplacer.
   ================================================================ */
const nomComplet = (s) => `${s.nom} ${s.prenom}`.trim();

function ChampSalarie({ salaries, valeur, onChange, invalide }) {
  const [libre, setLibre] = useState(false);
  const liste = (salaries || []).filter((s) => s.statut !== "Sorti");
  if (liste.length === 0 || libre) {
    return (
      <>
        <input type="text" style={{ ...inputStyle, borderColor: invalide ? T.err : T.border }} placeholder="Nom Prénom" value={valeur} onChange={(e) => onChange(e.target.value)} />
        {liste.length > 0 && (
          <button type="button" onClick={() => { setLibre(false); onChange(""); }} style={{ all: "unset", cursor: "pointer", fontSize: 11.5, color: T.accent, marginTop: 4 }}>
            ← Choisir dans votre effectif
          </button>
        )}
      </>
    );
  }
  return (
    <select style={{ ...inputStyle, borderColor: invalide ? T.err : T.border }} value={valeur}
      onChange={(e) => {
        if (e.target.value === "__libre") { setLibre(true); onChange(""); return; }
        onChange(e.target.value);
      }}>
      <option value="">— Choisir un salarié —</option>
      {liste.map((s, i) => (
        <option key={s.cle + i} value={nomComplet(s)}>{nomComplet(s)}{s.poste ? ` — ${s.poste}` : ""}</option>
      ))}
      <option value="__libre">Autre salarié (saisie libre)…</option>
    </select>
  );
}

function SelectSalarie({ salaries, onSelection }) {
  const [choix, setChoix] = useState("");
  const liste = (salaries || []).filter((s) => s.statut !== "Sorti");
  if (liste.length === 0) return null;
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, color: T.mut }}>Salarié de votre effectif <span style={{ fontStyle: "italic" }}>(pré-remplit les champs)</span></label>
      <select style={inputStyle} value={choix}
        onChange={(e) => {
          setChoix(e.target.value);
          const s = liste[Number(e.target.value)];
          if (s) onSelection(s);
        }}>
        <option value="">— Choisir pour pré-remplir —</option>
        {liste.map((s, i) => (
          <option key={s.cle + i} value={i}>{nomComplet(s)}{s.poste ? ` — ${s.poste}` : ""}</option>
        ))}
      </select>
    </div>
  );
}

/* ================================================================
   APPLICATION
   ================================================================ */
export default function AppShell({ user, onLogout }) {
  const [vue, setVue] = useState("dash");
  const [tuile, setTuile] = useState(null);
  // Salarié pré-rempli quand une démarche est lancée depuis sa fiche
  // (Gestion du personnel) — vidé à toute ouverture depuis la grille.
  const [salariePrerempli, setSalariePrerempli] = useState("");
  const [dossierActif, setDossierActif] = useState("Contrats");
  const [db, setDb] = useState(null);
  const [toast, setToast] = useState(null);
  // moi : { client, raisonSociale } résolu par l'API, { bloque } si compte
  // non rattaché, { client: CODE_CLIENT } en repli dev local (API absente).
  const [moi, setMoi] = useState(null);
  // stats : KPI réels par client (/api/dashboard) ; null = repli démo (dev local).
  const [stats, setStats] = useState(null);
  // docs : documents réels (/api/documents) ; { demo } = maquette dev local.
  const [docs, setDocs] = useState(null);
  // eches : fins de CDD réelles (/api/echeances) ; { demo } = maquette dev local.
  const [eches, setEches] = useState(null);
  // refSal : effectif du client (référentiel Salariés fusionné aux embauches)
  // pour les listes déroulantes des formulaires ; null = indisponible
  // (option absente, panne) → les formulaires retombent en saisie libre.
  const [refSal, setRefSal] = useState(null);

  const prenom = user?.givenName || (user?.displayName || "").split(" ")[0] || "";
  const initiales = (user?.displayName || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    latence(500).then(() => setDb(JSON.parse(JSON.stringify(seed))));
    apiFetch("/api/me")
      .then(async (r) => {
        if (r.ok) return setMoi(await r.json());
        if (r.status === 401 || r.status === 403) {
          const e = await r.json().catch(() => ({}));
          return setMoi({ bloque: e.erreur || `Accès refusé (HTTP ${r.status}).`, code: r.status });
        }
        // Panne API : on N'ENTRE PAS avec un client de repli (affichage
        // trompeur). Le verrou serveur bloquerait de toute façon les envois.
        setMoi({ bloque: `Service momentanément indisponible (HTTP ${r.status}) — réessayez dans quelques minutes.`, code: r.status });
      })
      .catch(() => {
        // Échec réseau : API absente en dev local (mode démo assumé) ;
        // en production, indisponibilité réelle → écran d'attente.
        if (import.meta.env.DEV) return setMoi({ client: CODE_CLIENT, demo: true });
        setMoi({ bloque: "Service momentanément indisponible — vérifiez votre connexion et réessayez.", code: 0 });
      });
    // KPI réels — en cas d'échec on reste sur la maquette de démonstration
    apiFetch("/api/dashboard")
      .then(async (r) => { if (r.ok) setStats(await r.json()); })
      .catch(() => {});
    chargerDocs();
    // Effectif pour les listes déroulantes — silencieux en cas d'échec.
    apiFetch("/api/personnel")
      .then(async (r) => {
        if (r.ok) { const j = await r.json(); return setRefSal(j.salaries || []); }
        if (import.meta.env.DEV) setRefSal(DEMO_PERSONNEL.salaries);
      })
      .catch(() => { if (import.meta.env.DEV) setRefSal(DEMO_PERSONNEL.salaries); });
    // Échéances réelles — maquette uniquement en dev local, message en prod.
    apiFetch("/api/echeances")
      .then(async (r) => {
        if (r.ok) return setEches(await r.json());
        const e = await r.json().catch(() => ({}));
        setEches(import.meta.env.DEV ? { demo: true } : { erreur: e.erreur || `Échéances indisponibles (HTTP ${r.status}).` });
      })
      .catch(() => setEches(import.meta.env.DEV ? { demo: true } : { erreur: "Échéances momentanément indisponibles — réessayez." }));
  }, []);

  // Documents réels — maquette uniquement en dev local, message en prod.
  // Fonction réutilisable : appelée au chargement ET après chaque dépôt.
  const chargerDocs = () => {
    apiFetch("/api/documents")
      .then(async (r) => {
        if (r.ok) return setDocs(await r.json());
        const e = await r.json().catch(() => ({}));
        setDocs(import.meta.env.DEV ? { demo: true } : { erreur: e.erreur || `Documents indisponibles (HTTP ${r.status}).` });
      })
      .catch(() => setDocs(import.meta.env.DEV ? { demo: true } : { erreur: "Documents momentanément indisponibles — réessayez." }));
  };

  /* Dépôt de fichiers : envois séquentiels vers /api/depot (le serveur
     impose liste blanche d'extensions, 10 Mo max, dossier du client). */
  const [depotEnCours, setDepotEnCours] = useState(null);
  const refChoixFichiers = useRef(null);
  const EXT_DEPOT = ["pdf", "jpg", "jpeg", "png", "heic", "xlsx", "xls", "csv", "docx", "doc", "odt", "ods", "txt", "zip"];
  const deposerFichiers = async (fichiers) => {
    for (const f of [...fichiers]) {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (!EXT_DEPOT.includes(ext)) { notifier(`« ${f.name} » : type de fichier non accepté.`); continue; }
      if (f.size > 10 * 1024 * 1024) { notifier(`« ${f.name} » : 10 Mo maximum.`); continue; }
      setDepotEnCours(f.name);
      try {
        const r = await apiFetch(`/api/depot?nom=${encodeURIComponent(f.name)}`, {
          method: "POST",
          headers: { "Content-Type": f.type || "application/octet-stream" },
          body: f,
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          notifier(j.erreur || `Échec du dépôt de « ${f.name} ».`);
        } else {
          notifier(`« ${f.name} » déposé — visible par votre gestionnaire.`);
        }
      } catch (_) { notifier(`Échec du dépôt de « ${f.name} » — vérifiez votre connexion.`); }
    }
    setDepotEnCours(null);
    chargerDocs();
  };

  /* Téléchargement via l'API (jeton + contrôle d'appartenance côté serveur),
     puis déclenchement du « Enregistrer sous » du navigateur. */
  const telechargerDoc = async (d) => {
    try {
      const r = await apiFetch(`/api/document?id=${encodeURIComponent(d.id)}`);
      if (!r.ok) { notifier("Téléchargement refusé — rechargez la page et réessayez."); return; }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = d.nom;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { notifier("Téléchargement impossible — vérifiez votre connexion."); }
  };

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

  /* 401 : la session côté API n'est pas exploitable — on propose de se
     reconnecter. 403 : compte valide mais non rattaché — c'est le début
     du parcours d'onboarding, on affiche le formulaire de demande d'accès. */
  if (moi?.bloque && moi.code !== 403) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 30px", maxWidth: 460, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#FAEEDA", color: "#854F0B", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <AlertCircle size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>
            {moi.code === 401 ? "Reconnexion nécessaire" : "Service momentanément indisponible"}
          </h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5, color: T.ink }}>
            Compte : <strong>{user?.email}</strong>
          </p>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: T.mut }}>{moi.bloque}</p>
          {moi.code === 401 ? (
            <Btn primary onClick={onLogout}><LogOut size={14} /> Se reconnecter</Btn>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
              <Btn onClick={onLogout}><LogOut size={14} /> Se déconnecter</Btn>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (moi?.bloque && moi.code === 403) {
    return <DemandeAcces user={user} onLogout={onLogout} />;
  }

  if (!db) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans, color: T.mut, fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  const codeClient = moi?.client || CODE_CLIENT;

  const totalContrats = Object.values(db.repartition).reduce((a, b) => a + b, 0);
  const maxMois = Math.max(...db.embauchesParMois.map((x) => x.n), 1);
  const embauches2026 = db.embauchesParMois.reduce((a, x) => a + x.n, 0);
  const dpaeATraiter = db.dpae.filter((x) => x.statut === "À traiter").length;

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button
      className="osrh-navbtn"
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
    <div className="osrh-racine" style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      {/* Adaptation mobile : les media queries ci-dessous priment (via
          !important) sur les styles inline pensés pour l'écran large.
          ≤ 760 px : la barre latérale devient une barre de navigation
          horizontale collante, grilles et formulaires passent en 1 colonne. */}
      <style>{`
        /* Tableau de bord : grille à zones nommées.
           < 1500 px : 2 rangées (graphiques / listes) — ≥ 1500 px : 3 cartes
           en rangée du milieu, « À traiter » pleine largeur. */
        .osrh-dashgrid { display: grid; gap: 14px; grid-template-columns: repeat(6, 1fr); align-items: stretch;
          grid-template-areas: "rep rep rep mois mois mois" "tra tra tra tra pro pro"; }
        .osrh-b-rep { grid-area: rep; } .osrh-b-mois { grid-area: mois; }
        .osrh-b-pro { grid-area: pro; } .osrh-b-tra { grid-area: tra; }
        @media (min-width: 1500px) {
          .osrh-dashgrid { grid-template-areas: "rep rep mois mois pro pro" "tra tra tra tra tra tra"; }
          .osrh-main { padding: 34px 44px !important; }
          .osrh-kpi { padding: 18px 20px !important; }
          .osrh-kpi-val { font-size: 30px !important; }
          .osrh-carte h2 { font-size: 15px; }
          .osrh-barres { height: 170px !important; }
          /* Hauteur des tuiles : naturelle à toutes les tailles (correctif
             Laurent — ne pas forcer les hauteurs, le padding suffit).
             auto-FILL : une section peu remplie ne s'étire pas. */
          .osrh-tuilegrid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important; }
          .osrh-tuile { padding: 40px 20px !important; }
        }
        @media (max-width: 760px) {
          .osrh-dashgrid { grid-template-columns: 1fr; grid-template-areas: "rep" "mois" "pro" "tra"; }
          .osrh-tuilegrid { min-height: 0 !important; grid-auto-rows: auto !important; }
          .osrh-tuile { padding: 20px 16px !important; }
        }
        .osrh-kpi { transition: transform .15s, box-shadow .15s; }
        .osrh-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(6,24,64,0.07); }
        .osrh-tuile { transition: transform .15s, box-shadow .15s, border-color .15s !important; }
        .osrh-tuile:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(6,24,64,0.08); }
        /* Focus clavier visible partout — !important requis : les boutons
           utilisent all:unset en inline, qui neutralise l'outline. */
        .osrh-racine :focus-visible { outline: 2px solid #1668D9 !important; outline-offset: 2px; }
        @media (max-width: 760px) {
          .osrh-racine { flex-direction: column !important; }
          .osrh-aside { width: 100% !important; flex-direction: row !important; align-items: center !important; padding: 10px 14px !important; position: sticky; top: 0; z-index: 40; gap: 2px; overflow-x: auto; }
          .osrh-logo { padding: 0 12px 0 0 !important; font-size: 17px !important; white-space: nowrap; }
          .osrh-navbtn { padding: 9px 10px !important; border-left: none !important; border-radius: 8px !important; white-space: nowrap !important; flex-shrink: 0 !important; }
          .osrh-user { margin: 0 0 0 auto !important; padding: 0 0 0 10px !important; border-top: none !important; }
          .osrh-user-info { display: none !important; }
          .osrh-user-label { display: none !important; }
          .osrh-main { padding: 18px 14px !important; }
          .osrh-grille2 { grid-template-columns: 1fr !important; }
          .osrh-form { grid-template-columns: 1fr !important; }
          .osrh-table { overflow-x: auto !important; }
          .osrh-table > div { min-width: 540px; }
        }
      `}</style>

      {/* ---------- BARRE LATÉRALE (barre du haut sur mobile) ---------- */}
      <aside className="osrh-aside" style={{ width: 224, flexShrink: 0, background: T.navy, display: "flex", flexDirection: "column", paddingTop: 24 }}>
        <div className="osrh-logo" style={{ padding: "0 20px 26px", fontFamily: T.serif, fontSize: 19, color: "#fff" }}>
          Osmose <span style={{ fontStyle: "italic", color: T.accentSoft }}>RH</span>
        </div>
        <NavBtn id="dash" icon={ChartBar} label="Tableau de bord" />
        <NavBtn id="prod" icon={FileText} label="Production" />
        <NavBtn id="eche" icon={Clock} label="Échéances" />
        <NavBtn id="docs" icon={Folder} label="Documents" />
        <div className="osrh-user" style={{ marginTop: "auto", padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="osrh-user-info" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentSoft, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{initiales}</div>
            <div style={{ fontSize: 11.5, color: "#9FB2C9", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.displayName}<br />{moi?.raisonSociale || codeClient}
            </div>
          </div>
          <button onClick={onLogout} title="Se déconnecter" style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9FB2C9", fontFamily: T.sans, padding: 4 }}>
            <LogOut size={15} /> <span className="osrh-user-label">Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* ---------- CONTENU ---------- */}
      {/* Colonne de contenu centrée : plafond 1360 px, marges auto — sur
          grand écran le contenu occupe le cœur de la page au lieu de
          rester collé à la barre latérale. */}
      {/* Pleine largeur avec gouttières : les grilles habitent l'écran.
          Garde-fou 2240 px : rempli sur un 2560, borné sur les ultra-larges. */}
      <main className="osrh-main" style={{ flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", padding: "26px 32px", maxWidth: 2240, margin: "0 auto" }}>

        {/* ===== TABLEAU DE BORD ===== */}
        {vue === "dash" && (() => {
          /* KPI réels (/api/dashboard) quand disponibles, maquette sinon (dev
             local). Un bloc null = option non souscrite : ni carte ni graphique. */
          const emb = stats ? stats.embauches : null;
          const rep = stats ? (emb?.repartition || {}) : db.repartition;
          const totalRep = Object.values(rep).reduce((a, b) => a + b, 0) || 1;
          const mois = stats ? (emb?.parMois || []) : db.embauchesParMois;
          const maxM = Math.max(...mois.map((x) => x.n), 1);
          const enAttente = stats ? stats.aTraiter : aTraiter;
          /* Prochaines embauches : calculées par l'API (dates de début à
             venir) ; en démo locale, dérivées des contrats de la maquette. */
          const prochaines = stats
            ? (emb?.prochaines || [])
            : db.contrats.slice(0, 3).map((x) => ({ nom: x.nom, prenom: x.prenom, type: x.type, debut: x.debut }));
          const avecGraphiques = !stats || !!emb;
          const kpis = stats ? [
            ...(emb ? [{ label: "Embauches en attente", val: emb.enAttente, warn: emb.enAttente > 0, icon: Users }] : []),
            ...(stats.acomptes ? [
              { label: "Acomptes à traiter", val: stats.acomptes.enAttente, warn: stats.acomptes.enAttente > 0, icon: Banknote },
              { label: "Montant acomptes (€)", val: stats.acomptes.montantEnAttente, icon: Clock },
            ] : []),
            ...(stats.attestations ? [{ label: "Attestations ce mois-ci", val: stats.attestations.moisCourant, icon: FileText }] : []),
          ] : [
            { label: "Effectif", val: db.effectif, icon: Users },
            { label: "Embauches 2026", val: embauches2026, icon: FileText },
            { label: "DPAE à traiter", val: dpaeATraiter, warn: dpaeATraiter > 0, icon: Clock },
            { label: "Documents", val: db.documents.length, icon: Folder },
          ];
          return (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Bonjour {prenom}</h1>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Tableau de bord — {moi?.raisonSociale || codeClient}</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {kpis.map((k) => <Kpi key={k.label} label={k.label} val={k.val} warn={k.warn} icon={k.icon} />)}
              {kpis.length === 0 && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: T.mut }}>
                  Aucune option active sur votre contrat — contactez votre gestionnaire Osmose RH pour ouvrir vos démarches.
                </div>
              )}
            </div>

            {/* Grille unique aux zones nommées : la disposition change par
                media query (voir <style>) — 2 rangées classiques sous 1500 px,
                3 colonnes + « À traiter » pleine largeur au-delà. */}
            {avecGraphiques ? (
            <div className="osrh-dashgrid">
              <div className="osrh-b-rep osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 14, fontFamily: T.serif }}>Répartition des contrats</h2>
                {Object.keys(rep).length === 0 && (
                  <p style={{ fontSize: 12.5, color: T.mut, margin: 0 }}>Aucune embauche déclarée pour l'instant.</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(rep).map(([type, n]) => (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span>{type}</span><span style={{ color: T.mut }}>{n}</span>
                      </div>
                      <div style={{ height: 8, background: T.bg, borderRadius: 4 }}>
                        <div style={{ width: `${Math.round((n / totalRep) * 100)}%`, height: 8, background: BARRES[type] || T.accentSoft, borderRadius: 4, transition: "width .4s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="osrh-b-mois osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 14, fontFamily: T.serif }}>Embauches par mois</h2>
                <div className="osrh-barres" style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
                  {mois.map((x, i) => (
                    <div key={x.m + i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: T.mut }}>{x.n}</span>
                      <div style={{ width: "100%", height: `${Math.max(5, (x.n / maxM) * 72)}%`, background: i >= mois.length - 2 ? "#378ADD" : "#B5D4F4", borderRadius: "3px 3px 0 0", transition: "height .4s" }} />
                      <span style={{ fontSize: 11, color: T.mut }}>{x.m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="osrh-b-pro osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, alignSelf: "start" }}>
                <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>Prochaines embauches</div>
                {prochaines.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Aucune embauche planifiée.</div>
                )}
                {prochaines.map((x, i) => (
                  <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: i < prochaines.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>{(x.nom || "").toUpperCase()} {x.prenom}</strong>
                      <span style={{ color: T.mut }}> — {x.type}</span>
                    </span>
                    <span style={{ fontSize: 12, color: T.mut, flexShrink: 0 }}>
                      {String(x.debut).slice(0, 10).split("-").reverse().join("/")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="osrh-b-tra osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, alignSelf: "start" }}>
                <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>À traiter</div>
                {enAttente.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Rien en attente — tout est à jour.</div>
                )}
                {enAttente.map((a, i) => (
                  <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: i < enAttente.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertCircle size={15} color="#BA7517" style={{ flexShrink: 0 }} /> {a.t}
                    </span>
                    <Badge s={a.s} />
                  </div>
                ))}
              </div>
            </div>
            ) : (
            <div className="osrh-carte" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
              <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>À traiter</div>
              {enAttente.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.mut }}>Rien en attente — tout est à jour.</div>
              )}
              {enAttente.map((a, i) => (
                <div key={i} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: i < enAttente.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={15} color="#BA7517" style={{ flexShrink: 0 }} /> {a.t}
                  </span>
                  <Badge s={a.s} />
                </div>
              ))}
            </div>
            )}

            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut, flexWrap: "wrap" }}>
              <ShieldCheck size={13} />
              {stats
                ? "Indicateurs calculés en direct depuis vos démarches — données hébergées en Europe"
                : "Données de démonstration — connectez-vous en production pour vos indicateurs réels"}
              <span>·</span>
              <a href="/mentions-legales.html" target="_blank" rel="noopener" style={{ color: T.mut }}>Mentions légales &amp; confidentialité</a>
            </div>
          </>
          );
        })()}

        {/* ===== PRODUCTION ===== */}
        {vue === "prod" && !tuile && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Production</h1>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: T.mut }}>Choisissez une démarche</p>

            {/* Tuiles groupées par bloc métier, avec titres de section.
                auto-FILL (pas auto-fit) : une section d'une seule tuile garde
                une tuile de largeur normale au lieu de s'étirer sur l'écran.
                Hauteurs naturelles ; compact sur mobile (voir media query). */}
            {BLOCS_TUILES.map((b) => {
              const tuilesBloc = TUILES.filter((t) => t.bloc === b.id);
              if (tuilesBloc.length === 0) return null;
              return (
                <div key={b.id} style={{ marginBottom: 26 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 15, fontFamily: T.serif, fontWeight: 600, color: T.navy, display: "flex", alignItems: "center", gap: 10 }}>
                    {b.titre}
                    <span style={{ flex: 1, height: 1, background: T.border }} />
                  </h2>
                  <div className="osrh-tuilegrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, gridAutoRows: "auto" }}>
                    {tuilesBloc.map((t) => {
                      const Icone = t.icone;
                      /* Deux raisons d'être grisée : option non souscrite
                         (opt-in contractuel — le refus réel est côté API) ou
                         démarche pas encore ouverte (bloc « bientot »). */
                      const aVenir = b.id === "bientot";
                      const opt = OPTION_TUILE[t.id];
                      const inclus = !aVenir && (!opt || !moi?.options || moi.options.includes(opt));
                      return (
                        <button
                          key={t.id}
                          className="osrh-tuile"
                          onClick={() => {
                            if (aVenir) return notifier("Cette démarche arrive prochainement — parlez-en à votre gestionnaire si vous êtes intéressé.");
                            if (!inclus) return notifier("Option non incluse dans votre contrat — parlez-en à votre gestionnaire Osmose RH.");
                            setSalariePrerempli(""); setTuile(t);
                          }}
                          style={{
                            background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
                            padding: "26px 18px", cursor: "pointer", textAlign: "center",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                            fontFamily: T.sans, transition: "border-color .15s", position: "relative",
                            opacity: inclus ? 1 : 0.45,
                          }}
                          onMouseEnter={(e) => { if (inclus) e.currentTarget.style.borderColor = T.accent; }}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
                        >
                          {t.cablee && inclus && (
                            <span style={{ position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: "50%", background: T.ok }} title="Démarche active" />
                          )}
                          <span style={{ width: 62, height: 62, borderRadius: 16, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icone size={30} color={T.accent} strokeWidth={1.6} />
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>{t.titre}</span>
                          <span style={{ fontSize: 12.5, color: T.mut }}>{t.sous}</span>
                          {aVenir && (
                            <span style={{ fontSize: 10.5, color: T.mut, fontStyle: "italic" }}>Bientôt disponible</span>
                          )}
                          {!aVenir && !inclus && (
                            <span style={{ fontSize: 10.5, color: T.mut, fontStyle: "italic" }}>Option non incluse</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          </>
        )}

        {/* La grille des variables de paie occupe toute la largeur. */}
        {vue === "prod" && tuile && tuile.id === "variables" && (
          <VariablesPaie user={user} client={codeClient} onRetour={() => setTuile(null)} />
        )}

        {/* Le dossier du personnel aussi : liste + fiche en pleine largeur. */}
        {vue === "prod" && tuile && tuile.id === "personnel" && (
          <GestionPersonnel user={user} client={codeClient} onRetour={() => setTuile(null)}
            onDemarche={(id, salarie) => { setSalariePrerempli(salarie); setTuile(TUILES.find((t) => t.id === id)); }} />
        )}

        {/* Formulaires : largeur volontairement contenue (~560 px, un champ
            trop large se lit mal) mais CENTRÉE dans la zone de contenu. */}
        {vue === "prod" && tuile && tuile.id !== "variables" && tuile.id !== "personnel" && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {tuile.id === "attestation" && (
              <AttestationEmployeur user={user} client={codeClient} salaries={refSal} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "acompte" && (
              <DemandeAcompte user={user} client={codeClient} salaries={refSal} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "embauche" && (
              <DemandeEmbauche user={user} client={codeClient} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "fin" && (
              <DemandeFinContrat user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "contact" && (
              <ContactGestionnaire user={user} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "absences" && (
              <DemandeAbsence user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "visite" && (
              <DemandeVisite user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "mutuelle" && (
              <Demandemutuelle user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {!tuile.cablee && (
              <FormulaireTuile tuile={tuile} onRetour={() => setTuile(null)} onSave={(f) => enregistrerDemo(tuile.id, f)} />
            )}
          </div>
        )}

        {/* ===== ÉCHÉANCES ===== */}
        {vue === "eche" && (() => {
          if (eches === null) {
            return (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Échéances</h1>
                <p style={{ margin: "12px 0", fontSize: 13, color: T.mut }}>Chargement de vos échéances…</p>
              </>
            );
          }
          if (eches.erreur) {
            return (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Échéances</h1>
                <p style={{ margin: "12px 0", fontSize: 13, color: T.mut }}>{eches.erreur}</p>
                <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
              </>
            );
          }
          const src = eches.demo ? DEMO_ECHEANCES : eches;
          const aVenir = src.echeances || [];
          const recentes = src.recentes || [];
          const sous30 = aVenir.filter((x) => x.joursRestants <= 30).length;
          const sous90 = aVenir.filter((x) => x.joursRestants <= 90).length;
          const finInclus = !moi?.options || moi.options.includes("embauche");
          const fr = (d) => String(d).slice(0, 10).split("-").reverse().join("/");
          const BadgeJours = (j) => {
            const c = j <= 7 ? { bg: "#FCEBEB", fg: "#791F1F" } : j <= 30 ? { bg: "#FAEEDA", fg: "#854F0B" } : { bg: "#E6F1FB", fg: "#0C447C" };
            const txt = j <= 0 ? "Aujourd'hui" : j === 1 ? "Demain" : `Dans ${j} j`;
            return <span style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>{txt}</span>;
          };
          const grille = "2fr 2fr 100px 110px 1.4fr";
          return (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Échéances</h1>
                  <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>
                    Fins de CDD à venir — anticipez le renouvellement, la transformation en CDI ou la fin au terme prévu.
                  </p>
                </div>
                <Btn primary onClick={() => {
                  if (!finInclus) return notifier("Option non incluse dans votre contrat — parlez-en à votre gestionnaire Osmose RH.");
                  setVue("prod"); setTuile(TUILES.find((t) => t.id === "fin"));
                }}>
                  <UserMinus size={15} /> Déclarer une fin de contrat
                </Btn>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <Kpi label="Fins sous 30 jours" val={sous30} warn={sous30 > 0} icon={AlertCircle} />
                <Kpi label="Fins sous 90 jours" val={sous90} icon={Clock} />
                <Kpi label="CDD suivis" val={aVenir.length} icon={Users} />
              </div>

              {aVenir.length === 0 ? (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
                  Aucune fin de CDD à venir.<br />
                  Les CDD déclarés via la démarche Embauche apparaissent ici automatiquement, avec leur date de fin.
                </div>
              ) : (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Poste</span><span>Fin le</span><span>Échéance</span><span>Alerte e-mail</span>
                  </div>
                  {aVenir.map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < aVenir.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.poste || "—"}</span>
                      <span>{fr(x.dateFin)}</span>
                      {BadgeJours(x.joursRestants)}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut }}>
                        {x.alerte
                          ? <><Check size={14} color={T.ok} style={{ flexShrink: 0 }} /> Envoyée le {fr(x.alerte)}</>
                          : <><Clock size={13} style={{ flexShrink: 0 }} /> Programmée à J-30</>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {recentes.length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>Terminés récemment</div>
                  {recentes.map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < recentes.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center", opacity: 0.75 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.poste || "—"}</span>
                      <span>{fr(x.dateFin)}</span>
                      <Badge s="Terminé" />
                      <span style={{ fontSize: 12, color: T.mut }}>—</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut, flexWrap: "wrap" }}>
                <ShieldCheck size={13} />
                {eches.demo
                  ? "Données de démonstration — connectez-vous en production pour vos échéances réelles"
                  : "En complément, un rappel automatique par e-mail est envoyé 30 jours avant chaque fin de CDD."}
              </div>
            </>
          );
        })()}

        {/* ===== DOCUMENTS ===== */}
        {vue === "docs" && (() => {
          /* Documents RÉELS (bibliothèque « Documents clients », dossier du
             client résolu) — la maquette ne subsiste qu'en dev local. */
          if (docs === null || docs.demo) {
            return (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
                <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>
                  {docs === null ? "Chargement de vos documents…" : "Maquette de démonstration (dev local)"}
                </p>
                {docs?.demo && (
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
                )}
                {docs?.demo && (
                  <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                    {db.documents.filter((d) => d.dossier === dossierActif).map((d) => (
                      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 90px", gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={15} color={T.mut} /> {d.nom}</span>
                        <span style={{ color: T.mut }}>{d.modif.split("-").reverse().join("/")}</span>
                        <span style={{ color: T.mut }}><Download size={16} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          }
          if (docs.erreur) {
            return (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
                <p style={{ margin: "12px 0", fontSize: 13, color: T.mut }}>{docs.erreur}</p>
                <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
              </>
            );
          }
          const reels = docs.documents || [];
          const ordre = ["Attestations", "Contrats", "Paie", "Dépôts", "Général"];
          const cats = [...new Set(reels.map((d) => d.categorie))]
            .sort((a, b) => (ordre.indexOf(a) + 99 * (ordre.indexOf(a) < 0)) - (ordre.indexOf(b) + 99 * (ordre.indexOf(b) < 0)));
          const catActive = cats.includes(dossierActif) ? dossierActif : cats[0];
          const visibles = reels.filter((d) => d.categorie === catActive);
          const taille = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
          return (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Documents</h1>
                  <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>
                    Vos documents — déposés par votre gestionnaire, générés par vos démarches, ou transmis par vous.
                  </p>
                </div>
                <div>
                  <input ref={refChoixFichiers} type="file" multiple style={{ display: "none" }}
                    accept={EXT_DEPOT.map((e) => "." + e).join(",")}
                    onChange={(e) => { if (e.target.files?.length) deposerFichiers(e.target.files); e.target.value = ""; }} />
                  <Btn primary disabled={!!depotEnCours} onClick={() => refChoixFichiers.current?.click()}>
                    <Upload size={15} /> {depotEnCours ? `Dépôt de ${depotEnCours.slice(0, 24)}…` : "Déposer un fichier"}
                  </Btn>
                  <p style={{ fontSize: 10.5, color: T.mut, margin: "6px 0 0", textAlign: "right" }}>10 Mo max — PDF, images, Office</p>
                </div>
              </div>

              {reels.length === 0 && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
                  Aucun document pour l'instant.<br />
                  Vos attestations et contrats générés apparaîtront ici automatiquement.
                </div>
              )}

              {reels.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {cats.map((f) => (
                      <button key={f} onClick={() => setDossierActif(f)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          border: `1px solid ${catActive === f ? T.accent : T.border}`,
                          background: catActive === f ? "#E6F1FB" : T.card,
                          color: catActive === f ? "#0C447C" : T.ink,
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: T.sans,
                        }}>
                        <Folder size={15} color={catActive === f ? T.accent : T.mut} /> {f}
                        <span style={{ fontSize: 11, color: T.mut }}>{reels.filter((d) => d.categorie === f).length}</span>
                      </button>
                    ))}
                  </div>

                  <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 110px", gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                      <span>Nom</span><span>Modifié</span><span>Taille</span><span>Action</span>
                    </div>
                    {visibles.map((d) => (
                      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 110px", gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <FileText size={15} color={T.mut} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nom}</span>
                        </span>
                        <span style={{ color: T.mut }}>{String(d.modifie).slice(0, 10).split("-").reverse().join("/")}</span>
                        <span style={{ color: T.mut }}>{taille(d.taille)}</span>
                        <Btn small onClick={() => telechargerDoc(d)}>
                          <Download size={13} /> Télécharger
                        </Btn>
                      </div>
                    ))}
                    {visibles.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.mut }}>Dossier vide.</div>
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()}
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
function AttestationEmployeur({ user, client, salaries, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    civilite: "", nom: "", naissance: "", entree: "", poste: "", contrat: "",
    format: "PDF",
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
      client, // indicatif : l'API impose le client résolu côté serveur
      email: f.email.trim(),
      civilite: f.civilite,
      nomSalarie: f.nom.trim(),
      dateNaissance: f.naissance,
      dateEntree: f.entree,
      poste: f.poste.trim(),
      typeContrat: f.contrat,
      formatSouhaite: f.format, // "PDF" | "Word" — format du document généré par le flux
      xq_note: "", // honeypot : doit rester vide
    };

    let ref = null, demo = false;
    try {
      const r = await apiFetch("/api/demande", {
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

  /* Les champs utilisent ChampReq (défini au niveau module) : un composant
     défini ICI serait recréé à chaque frappe et ferait perdre le focus. */

  /* ---------- Écran de confirmation ---------- */
  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
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

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Award size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Attestation employeur</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — traitée après validation par votre gestionnaire.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Votre email (accusé et réception du document) <span style={{ color: T.err }}>*</span></label>
            <input style={err.email ? inputInvalid : inputStyle} value={f.email} onChange={(e) => maj("email", e.target.value)} />
            {err.email && <span style={{ fontSize: 11, color: T.err }}>Email invalide.</span>}
          </div>

          <SelectSalarie salaries={salaries} onSelection={(s) => {
            setF((p) => ({ ...p,
              nom: `${s.prenom} ${s.nom}`.trim(),
              entree: s.debut || p.entree,
              poste: s.poste || p.poste,
              contrat: s.type === "CDI" ? "contrat à durée indéterminée (CDI)" : s.type === "CDD" ? "contrat à durée déterminée (CDD)" : p.contrat,
            }));
            setErr((p) => ({ ...p, nom: false, entree: false, poste: false, contrat: false }));
          }} />

          <ChampReq label="Civilité" erreur={err.civilite && "Champ requis."}>
            <select style={err.civilite ? inputInvalid : inputStyle} value={f.civilite} onChange={(e) => maj("civilite", e.target.value)}>
              <option value="">—</option>
              <option>Madame</option>
              <option>Monsieur</option>
            </select>
          </ChampReq>

          <ChampReq label="Nom et prénom du salarié" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. Sofia Marques" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Date de naissance" erreur={err.naissance && "Date requise."}>
            <input type="date" max="2010-12-31" style={err.naissance ? inputInvalid : inputStyle} value={f.naissance} onChange={(e) => maj("naissance", e.target.value)} />
          </ChampReq>

          <ChampReq label="Date d'entrée" erreur={err.entree && "La date d'entrée ne peut pas être future."}>
            <input type="date" style={err.entree ? inputInvalid : inputStyle} value={f.entree} onChange={(e) => maj("entree", e.target.value)} />
          </ChampReq>

          <ChampReq label="Intitulé du poste" erreur={err.poste && "Champ requis."}>
            <input style={err.poste ? inputInvalid : inputStyle} placeholder="Ex. Agent de service" value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
          </ChampReq>

          <ChampReq label="Type de contrat" erreur={err.contrat && "Champ requis."}>
            <select style={err.contrat ? inputInvalid : inputStyle} value={f.contrat} onChange={(e) => maj("contrat", e.target.value)}>
              <option value="">—</option>
              <option>contrat à durée indéterminée (CDI)</option>
              <option>contrat à durée déterminée (CDD)</option>
            </select>
          </ChampReq>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Format du document</label>
            <select style={inputStyle} value={f.format} onChange={(e) => maj("format", e.target.value)}>
              <option value="PDF">PDF (recommandé — non modifiable)</option>
              <option value="Word">Word (.docx)</option>
            </select>
          </div>
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
   « Acompte » (site RH) : Matricule (nombre), Nom, Prénom,
   Montant demandé (nombre). « Date de demande » et
   « Statut » (Nouveau → Traité) sont posés par le flux ;
   « Title » reçoit la référence ACOMPTE-… générée par l'API.
   Même contrat que ATT-01 : /api/demande, honeypot, erreurs
   affichées, mode démo si l'API est injoignable en dev local.
   Variable à configurer sur la Static Web App : FLOW_URL_ACOMPTE.
   ================================================================ */

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

function DemandeAcompte({ user, client, salaries, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    nom: "", prenom: "", matricule: "", montant: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref, demo }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const e = {
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()),
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      matricule: !/^\d{1,10}$/.test(f.matricule.trim()),
      montant: !/^\d{1,5}([.,]\d{1,2})?$/.test(f.montant.trim()) || parseFloat(f.montant.trim().replace(",", ".")) <= 0,
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
      client, // indicatif : l'API impose le client résolu côté serveur
      email: f.email.trim(),
      nom: f.nom.trim().toUpperCase(),
      prenom: f.prenom.trim(),
      matricule: Number(f.matricule.trim()),  // colonne Matricule : nombre JSON attendu par le déclencheur du flux
      montant: Number(f.montant.trim().replace(",", ".")), // colonne Montant demandé : nombre JSON attendu par le déclencheur du flux
      xq_note: "", // honeypot : doit rester vide
    };

    let ref = null, demo = false;
    try {
      const r = await apiFetch("/api/demande", {
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
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Demande transmise</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            Demande d'acompte de <strong>{f.montant.trim().replace(".", ",")} €</strong> pour <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim()}</strong> (matricule {f.matricule.trim()}).
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

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Banknote size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Demande d'acompte</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — versée après validation par votre gestionnaire.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq large label="Votre email (accusé de traitement)" erreur={err.email && "Email invalide."}>
            <input style={err.email ? inputInvalid : inputStyle} value={f.email} onChange={(e) => maj("email", e.target.value)} />
          </ChampReq>

          <SelectSalarie salaries={salaries} onSelection={(s) => {
            setF((p) => ({ ...p, nom: s.nom, prenom: s.prenom, matricule: s.matricule || p.matricule }));
            setErr((p) => ({ ...p, nom: false, prenom: false, matricule: false }));
          }} />

          <ChampReq label="Nom du salarié" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. MARQUES" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Prénom du salarié" erreur={err.prenom && "Champ requis."}>
            <input style={err.prenom ? inputInvalid : inputStyle} placeholder="Ex. Sofia" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Matricule" erreur={err.matricule && "Matricule numérique attendu."}>
            <input inputMode="numeric" style={err.matricule ? inputInvalid : inputStyle} placeholder="Ex. 600138" value={f.matricule} onChange={(e) => maj("matricule", e.target.value)} />
          </ChampReq>

          <ChampReq label="Montant demandé (€)" erreur={err.montant && "Montant invalide (ex. 150 ou 113,35)."}>
            <input inputMode="decimal" style={err.montant ? inputInvalid : inputStyle} placeholder="Ex. 150" value={f.montant} onChange={(e) => maj("montant", e.target.value)} />
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
   EMB-01 — EMBAUCHE (contrat + DPAE), câblée sur /api/demande
   Une seule déclaration du client alimente la production du contrat
   ET la DPAE : l'API écrit dans la liste « Production contrat » du
   site RH, dont le flux existant « Production contrat + AR » assure
   l'accusé, l'approbation (gestionnaire du client) et la génération.
   L'accusé part sur l'email du compte connecté — pas de champ email.
   ================================================================ */
function DemandeEmbauche({ user, client, onRetour }) {
  const [f, setF] = useState({
    type: "CDI", nom: "", prenom: "", naissance: "", lieuNaissance: "",
    nationalite: "", numeroSS: "", adresse: "", emailSalarie: "",
    telephone: "", debut: "", fin: "", poste: "", duree: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const ss = f.numeroSS.replace(/\s/g, "");
    const e = {
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      naissance: !f.naissance,
      lieuNaissance: f.lieuNaissance.trim().length < 2,
      nationalite: f.nationalite.trim().length < 2,
      numeroSS: !/^[12]\d{12}(\d{2})?$/.test(ss),
      adresse: f.adresse.trim().length < 8,
      debut: !f.debut,
      fin: f.type === "CDD" && (!f.fin || f.fin <= f.debut),
      poste: f.poste.trim().length < 2,
      duree: !/^\d{1,3}([.,]\d{1,2})?$/.test(f.duree.trim()) || parseFloat(f.duree.replace(",", ".")) <= 0,
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");
    const payload = {
      demarche: "embauche",
      client, // indicatif : l'API impose le client résolu côté serveur
      typeContrat: f.type,
      nom: f.nom.trim(),
      prenom: f.prenom.trim(),
      dateNaissance: f.naissance,
      lieuNaissance: f.lieuNaissance.trim(),
      nationalite: f.nationalite.trim(),
      numeroSS: f.numeroSS.replace(/\s/g, ""),
      adressePostale: f.adresse.trim(),
      emailSalarie: f.emailSalarie.trim(),
      telephoneSalarie: f.telephone.trim(),
      dateDebut: f.debut,
      ...(f.type === "CDD" ? { dateFin: f.fin } : {}),
      poste: f.poste.trim(),
      dureeMensuelle: f.duree.trim().replace(",", "."),
      xq_note: "", // honeypot : doit rester vide
    };
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrbar(j.erreur ? `${j.erreur} (HTTP ${r.status})` : `HTTP ${r.status}`);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setFini({ ref: j.reference || null });
    } catch (_) {
      setFini({ demo: true });
    }
  };

  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Embauche déclarée</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            {f.type} pour <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim()}</strong>, début le <strong>{f.debut.split("-").reverse().join("/")}</strong>.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Votre gestionnaire prépare le contrat et la DPAE. Un accusé vous est adressé à <strong>{user?.email}</strong>.
          </p>
          {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <FileText size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Déclarer une embauche</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — votre gestionnaire produit le contrat et effectue la DPAE. Accusé envoyé à {user?.email}.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq label="Type de contrat">
            <select style={inputStyle} value={f.type} onChange={(e) => maj("type", e.target.value)}>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
            </select>
          </ChampReq>

          {f.type === "CDD" ? (
            <ChampReq label="Date de fin (CDD)" erreur={err.fin && "Requise et postérieure au début."}>
              <input type="date" style={err.fin ? inputInvalid : inputStyle} value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
            </ChampReq>
          ) : <div />}

          <ChampReq label="Nom de naissance" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. MARQUES" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Prénom" erreur={err.prenom && "Champ requis."}>
            <input style={err.prenom ? inputInvalid : inputStyle} placeholder="Ex. Sofia" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Date de naissance" erreur={err.naissance && "Date requise."}>
            <input type="date" style={err.naissance ? inputInvalid : inputStyle} value={f.naissance} onChange={(e) => maj("naissance", e.target.value)} />
          </ChampReq>

          <ChampReq label="Lieu de naissance" erreur={err.lieuNaissance && "Champ requis."}>
            <input style={err.lieuNaissance ? inputInvalid : inputStyle} placeholder="Ex. Montpellier" value={f.lieuNaissance} onChange={(e) => maj("lieuNaissance", e.target.value)} />
          </ChampReq>

          <ChampReq label="Nationalité" erreur={err.nationalite && "Champ requis."}>
            <input style={err.nationalite ? inputInvalid : inputStyle} placeholder="Ex. Française" value={f.nationalite} onChange={(e) => maj("nationalite", e.target.value)} />
          </ChampReq>

          <ChampReq label="N° de sécurité sociale" erreur={err.numeroSS && "13 ou 15 chiffres, commençant par 1 ou 2."}>
            <input inputMode="numeric" style={err.numeroSS ? inputInvalid : inputStyle} placeholder="Ex. 2 90 05 34 172 118 90" value={f.numeroSS} onChange={(e) => maj("numeroSS", e.target.value)} />
          </ChampReq>

          <ChampReq large label="Adresse postale du salarié" erreur={err.adresse && "Adresse complète requise."}>
            <input style={err.adresse ? inputInvalid : inputStyle} placeholder="Ex. 12 rue des Lilas, 34000 Montpellier" value={f.adresse} onChange={(e) => maj("adresse", e.target.value)} />
          </ChampReq>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Email du salarié (facultatif)</label>
            <input style={inputStyle} value={f.emailSalarie} onChange={(e) => maj("emailSalarie", e.target.value)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Téléphone du salarié (facultatif)</label>
            <input inputMode="tel" style={inputStyle} value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          </div>

          <ChampReq label="Date de début" erreur={err.debut && "Date requise."}>
            <input type="date" style={err.debut ? inputInvalid : inputStyle} value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
          </ChampReq>

          <ChampReq label="Poste de travail" erreur={err.poste && "Champ requis."}>
            <input style={err.poste ? inputInvalid : inputStyle} placeholder="Ex. Agent de service" value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
          </ChampReq>

          <ChampReq label="Durée du travail (heures/mois)" erreur={err.duree && "Nombre d'heures invalide (ex. 151,67)."}>
            <input inputMode="decimal" style={err.duree ? inputInvalid : inputStyle} placeholder="Ex. 151,67" value={f.duree} onChange={(e) => maj("duree", e.target.value)} />
          </ChampReq>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Déclarer l'embauche"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Données transmises à votre gestionnaire Osmose RH pour l'établissement du contrat de travail et de la déclaration préalable à l'embauche (DPAE).
        </p>
      </div>
    </>
  );
}

/* ================================================================
   FIN-01 — FIN DE CONTRAT (câblée sur /api/demande)
   Symétrique de l'embauche : le client déclare un départ, le gestionnaire
   produit STC, certificat de travail et attestation France Travail.
   Écrit dans la liste « Fins de contrat » (Nouvelle → En cours → Traitée).
   Gouvernée par l'option 'embauche' (le cycle contrat, entrées ET sorties).
   ================================================================ */
const MOTIFS_FIN = ["Démission", "Rupture conventionnelle", "Licenciement pour motif personnel", "Licenciement pour motif économique", "Fin de CDD (terme prévu)", "Rupture anticipée de CDD", "Rupture période d'essai (employeur)", "Rupture période d'essai (salarié)", "Départ à la retraite", "Mise à la retraite", "Décès", "Autre"];

function DemandeFinContrat({ user, client, salaries, salarieInitial, onRetour }) {
  // salarieInitial (« NOM Prénom ») vient de la fiche salarié : premier mot
  // = nom, le reste = prénom — modifiable librement dans le formulaire.
  const initSal = String(salarieInitial || "").trim().split(/\s+/);
  const [f, setF] = useState({
    typeContrat: "CDI", motif: "", nom: initSal[0] || "", prenom: initSal.slice(1).join(" "), matricule: "",
    dateFin: "", dernierJour: "", preavis: "", congesRestants: "", commentaire: "",
  });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const valider = () => {
    const e = {
      motif: !f.motif,
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      dateFin: !f.dateFin,
      congesRestants: f.congesRestants.trim() !== "" && !/^\d{1,3}([.,]\d{1,2})?$/.test(f.congesRestants.trim()),
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demarche: "fin-contrat",
          client, // indicatif : l'API impose le client résolu côté serveur
          typeContrat: f.typeContrat,
          motif: f.motif,
          nom: f.nom.trim(),
          prenom: f.prenom.trim(),
          matricule: f.matricule.trim(),
          dateFin: f.dateFin,
          ...(f.dernierJour ? { dernierJourTravaille: f.dernierJour } : {}),
          ...(f.preavis ? { preavis: f.preavis } : {}),
          ...(f.congesRestants.trim() ? { congesRestants: f.congesRestants.trim().replace(",", ".") } : {}),
          commentaire: f.commentaire.trim(),
          xq_note: "", // honeypot : doit rester vide
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrbar(j.erreur ? `${j.erreur} (HTTP ${r.status})` : `HTTP ${r.status}`);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setFini({ ref: j.reference || null });
    } catch (_) {
      setFini({ demo: true });
    }
  };

  if (fini) {
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Départ déclaré</h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            {f.motif} — <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim()}</strong>, fin de contrat le <strong>{f.dateFin.split("-").reverse().join("/")}</strong>.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            Votre gestionnaire prépare le solde de tout compte, le certificat de travail et l'attestation France Travail. Un accusé vous est adressé à <strong>{user?.email}</strong>.
          </p>
          {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <UserMinus size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Déclarer une fin de contrat</h1>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
          Client : {client} — votre gestionnaire produit le solde de tout compte, le certificat de travail et l'attestation France Travail. Accusé envoyé à {user?.email}.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ Envoi refusé : {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SelectSalarie salaries={salaries} onSelection={(s) => {
            setF((p) => ({ ...p,
              nom: s.nom, prenom: s.prenom, matricule: s.matricule || p.matricule,
              typeContrat: ["CDI", "CDD"].includes(s.type) ? s.type : p.typeContrat,
            }));
            setErr((p) => ({ ...p, nom: false, prenom: false }));
          }} />

          <ChampReq label="Type de contrat">
            <select style={inputStyle} value={f.typeContrat} onChange={(e) => maj("typeContrat", e.target.value)}>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Autre">Autre</option>
            </select>
          </ChampReq>

          <ChampReq label="Motif de fin de contrat" erreur={err.motif && "Champ requis."}>
            <select style={err.motif ? inputInvalid : inputStyle} value={f.motif} onChange={(e) => maj("motif", e.target.value)}>
              <option value="">—</option>
              {MOTIFS_FIN.map((m) => <option key={m}>{m}</option>)}
            </select>
          </ChampReq>

          <ChampReq label="Nom du salarié" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} placeholder="Ex. MARQUES" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Prénom du salarié" erreur={err.prenom && "Champ requis."}>
            <input style={err.prenom ? inputInvalid : inputStyle} placeholder="Ex. Sofia" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
          </ChampReq>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Matricule (facultatif)</label>
            <input style={inputStyle} value={f.matricule} onChange={(e) => maj("matricule", e.target.value)} />
          </div>

          <ChampReq label="Date de fin de contrat" erreur={err.dateFin && "Date requise."}>
            <input type="date" style={err.dateFin ? inputInvalid : inputStyle} value={f.dateFin} onChange={(e) => maj("dateFin", e.target.value)} />
          </ChampReq>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Dernier jour travaillé (si différent)</label>
            <input type="date" style={inputStyle} value={f.dernierJour} onChange={(e) => maj("dernierJour", e.target.value)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Préavis</label>
            <select style={inputStyle} value={f.preavis} onChange={(e) => maj("preavis", e.target.value)}>
              <option value="">—</option>
              <option>Effectué</option>
              <option>Non effectué</option>
              <option>Dispensé</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Congés restants (jours, facultatif)</label>
            <input inputMode="decimal" style={err.congesRestants ? inputInvalid : inputStyle} placeholder="Ex. 4,5" value={f.congesRestants} onChange={(e) => maj("congesRestants", e.target.value)} />
            {err.congesRestants && <span style={{ fontSize: 11, color: T.err }}>Nombre de jours invalide.</span>}
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Commentaire (facultatif)</label>
            <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Ex. précisions sur le motif, adresse d'envoi des documents…" value={f.commentaire} onChange={(e) => maj("commentaire", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Btn onClick={onRetour}>Annuler</Btn>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Déclarer le départ"}
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Données transmises à votre gestionnaire Osmose RH pour l'établissement des documents de fin de contrat.
        </p>
      </div>
    </>
  );
}

/* ================================================================
   PAI-01 — VARIABLES DE PAIE (grille mensuelle, câblée sur /api/demande)
   Une ligne = un salarié pour le mois (un salarié peut occuper plusieurs
   lignes, ex. deux absences). Colonnes volontairement LARGES multi-secteurs
   — TOUT s'ajuste dans COLONNES_VARIABLES ci-dessous, rien d'autre à
   toucher. Brouillon auto-sauvegardé en local par client et par mois.
   L'API écrit une ligne de liste SharePoint par salarié transmis.
   ================================================================ */
const COLONNES_VARIABLES = [
  { k: "matricule", l: "Matricule", type: "text", w: 90 },
  { k: "nom", l: "Nom *", type: "text", w: 130 },
  { k: "prenom", l: "Prénom", type: "text", w: 110 },
  { k: "heuresNormales", l: "H. normales", type: "nombre", w: 78 },
  { k: "heuresComplementaires", l: "H. compl.", type: "nombre", w: 78 },
  { k: "heuresSup25", l: "H. sup 25%", type: "nombre", w: 78 },
  { k: "heuresSup50", l: "H. sup 50%", type: "nombre", w: 78 },
  { k: "heuresNuit", l: "H. nuit", type: "nombre", w: 70 },
  { k: "heuresDimancheFerie", l: "H. dim/férié", type: "nombre", w: 80 },
  { k: "absenceType", l: "Absence", type: "choix", w: 150,
    opts: ["", "Maladie", "Accident du travail", "Congés payés", "Congé sans solde", "Absence injustifiée", "Maternité / Paternité", "Formation", "Activité partielle", "Autre"] },
  { k: "absenceDu", l: "Abs. du", type: "date", w: 128 },
  { k: "absenceAu", l: "Abs. au", type: "date", w: 128 },
  { k: "primeLibelle", l: "Prime (libellé)", type: "text", w: 130 },
  { k: "primeMontant", l: "Prime (€)", type: "nombre", w: 80 },
  { k: "acompte", l: "Acompte (€)", type: "nombre", w: 84 },
  { k: "titresResto", l: "Titres resto", type: "nombre", w: 78 },
  { k: "fraisPro", l: "Frais pro (€)", type: "nombre", w: 84 },
  { k: "avantagesNature", l: "Avantages (€)", type: "nombre", w: 88 },
  { k: "commentaire", l: "Commentaire", type: "text", w: 190 },
];
const LIGNE_VIDE = () => Object.fromEntries(COLONNES_VARIABLES.map((c) => [c.k, ""]));
const MOIS_COURANT = () => new Date().toISOString().slice(0, 7);

function VariablesPaie({ user, client, onRetour }) {
  const [mois, setMois] = useState(MOIS_COURANT());
  const [lignes, setLignes] = useState([LIGNE_VIDE()]);
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);
  // Alternative transition : déposer son fichier Excel de variables plutôt
  // que saisir la grille — même /api/depot que l'onglet Documents, nom
  // préfixé du mois pour que le gestionnaire s'y retrouve.
  const [depotXls, setDepotXls] = useState(null); // null | "en cours" | { ok } | { erreur }
  const refXls = useRef(null);
  const deposerExcel = async (fichier) => {
    if (!fichier) return;
    const ext = (fichier.name.split(".").pop() || "").toLowerCase();
    if (!["xlsx", "xls", "csv", "ods"].includes(ext)) { setDepotXls({ erreur: "Fichier Excel ou CSV attendu (.xlsx, .xls, .csv, .ods)." }); return; }
    if (fichier.size > 10 * 1024 * 1024) { setDepotXls({ erreur: "10 Mo maximum." }); return; }
    setDepotXls("en cours");
    try {
      const r = await apiFetch(`/api/depot?nom=${encodeURIComponent(`Variables_${mois}_${fichier.name}`)}`, {
        method: "POST",
        headers: { "Content-Type": fichier.type || "application/octet-stream" },
        body: fichier,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setDepotXls({ erreur: j.erreur || `Échec du dépôt (HTTP ${r.status}).` });
      } else {
        const j = await r.json().catch(() => ({}));
        setDepotXls({ ok: j.nom || fichier.name });
      }
    } catch (_) { setDepotXls({ erreur: "Dépôt impossible — vérifiez votre connexion." }); }
  };

  const cleBrouillon = `osrh-variables-${client}-${mois}`;

  /* Brouillon local : rechargé au changement de mois, sauvegardé à chaque
     modification — on peut remplir la grille en plusieurs fois. */
  useEffect(() => {
    try {
      const brut = localStorage.getItem(cleBrouillon);
      setLignes(brut ? JSON.parse(brut) : [LIGNE_VIDE()]);
    } catch { setLignes([LIGNE_VIDE()]); }
  }, [cleBrouillon]);
  useEffect(() => {
    try { localStorage.setItem(cleBrouillon, JSON.stringify(lignes)); } catch (_) {}
  }, [lignes, cleBrouillon]);

  const majCellule = (i, k, v) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const ajouterLigne = () => setLignes([...lignes, LIGNE_VIDE()]);
  const dupliquerLigne = (i) => setLignes([...lignes.slice(0, i + 1), { ...lignes[i] }, ...lignes.slice(i + 1)]);
  const supprimerLigne = (i) => setLignes(lignes.length > 1 ? lignes.filter((_, j) => j !== i) : [LIGNE_VIDE()]);

  const celluleStyle = (large) => ({
    ...inputStyle, padding: "6px 8px", fontSize: 12.5, borderRadius: 6, minWidth: large,
  });

  const envoyer = async () => {
    setErrbar("");
    const remplies = lignes.filter((l) => Object.values(l).some((v) => String(v).trim() !== ""));
    if (remplies.length === 0) { setErrbar("La grille est vide."); return; }
    const sansNom = remplies.findIndex((l) => String(l.nom).trim().length < 2);
    if (sansNom >= 0) { setErrbar(`Ligne ${sansNom + 1} : le nom du salarié est requis.`); return; }
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demarche: "variables-paie", client, mois, lignes: remplies, xq_note: "" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrbar(j.erreur ? `${j.erreur} (HTTP ${r.status})` : `HTTP ${r.status}`);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      try { localStorage.removeItem(cleBrouillon); } catch (_) {}
      setFini({ ref: j.reference || null, nb: remplies.length });
    } catch (_) {
      setFini({ demo: true, nb: remplies.length });
    }
  };

  if (fini) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Variables transmises</h1>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            <strong>{fini.nb} ligne{fini.nb > 1 ? "s" : ""}</strong> transmise{fini.nb > 1 ? "s" : ""} pour <strong>{mois.split("-").reverse().join("/")}</strong>. Votre gestionnaire les intègre à la paie du mois ; un complément reste possible en renvoyant la grille.
          </p>
          {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
          {fini.demo && (
            <p style={{ fontSize: 11.5, color: T.mut, fontStyle: "italic" }}>
              Mode démo : aucun envoi réel (API /api/demande injoignable — normal en dev local).
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CalendarDays size={22} color={T.accent} strokeWidth={1.6} />
            <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Variables de paie</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Mois concerné</label>
            <input type="month" style={{ ...inputStyle, width: 160 }} value={mois} onChange={(e) => setMois(e.target.value)} />
          </div>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: T.mut }}>
          Client : {client} — une ligne par salarié (plusieurs lignes possibles pour un même salarié, ex. deux absences).
          Brouillon enregistré automatiquement sur ce poste. Accusé envoyé à {user?.email}.
        </p>

        {/* Alternative : dépôt du fichier Excel de variables (transition) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#F4F8FD", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12.5 }}>
          <span style={{ color: T.mut }}>Vous tenez vos variables dans un fichier Excel ?</span>
          <a href="/modeles/Modele_variables_paie.xlsx" download
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.accent, fontWeight: 600, textDecoration: "none", fontSize: 12.5 }}>
            <Download size={13} /> Télécharger le modèle
          </a>
          <span style={{ color: T.border }}>|</span>
          <input ref={refXls} type="file" accept=".xlsx,.xls,.csv,.ods" style={{ display: "none" }}
            onChange={(e) => { deposerExcel(e.target.files?.[0]); e.target.value = ""; }} />
          <Btn small onClick={() => refXls.current?.click()} disabled={depotXls === "en cours"}>
            <Upload size={13} /> {depotXls === "en cours" ? "Dépôt en cours…" : `Déposer le fichier de ${mois.split("-").reverse().join("/")}`}
          </Btn>
          {depotXls?.ok && <span style={{ color: T.ok }}>✓ « {depotXls.ok} » transmis à votre gestionnaire.</span>}
          {depotXls?.erreur && <span style={{ color: T.err }}>✗ {depotXls.erreur}</span>}
        </div>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ {errbar}
          </div>
        )}

        <div className="osrh-table" style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {COLONNES_VARIABLES.map((c) => (
                  <th key={c.k} style={{ padding: "8px 6px", fontSize: 11, color: T.mut, fontWeight: 600, textAlign: "left", borderBottom: `1px solid ${T.border}`, background: "#FAFBFD", whiteSpace: "nowrap", minWidth: c.w }}>
                    {c.l}
                  </th>
                ))}
                <th style={{ borderBottom: `1px solid ${T.border}`, background: "#FAFBFD", minWidth: 66 }} />
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne, i) => (
                <tr key={i}>
                  {COLONNES_VARIABLES.map((c) => (
                    <td key={c.k} style={{ padding: 4, borderBottom: `1px solid ${T.border}` }}>
                      {c.type === "choix" ? (
                        <select style={celluleStyle(c.w)} value={ligne[c.k]} onChange={(e) => majCellule(i, c.k, e.target.value)}>
                          {c.opts.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                        </select>
                      ) : (
                        <input
                          type={c.type === "date" ? "date" : "text"}
                          inputMode={c.type === "nombre" ? "decimal" : undefined}
                          style={celluleStyle(c.w)}
                          value={ligne[c.k]}
                          onChange={(e) => majCellule(i, c.k, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ padding: 4, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
                    <button title="Dupliquer la ligne" onClick={() => dupliquerLigne(i)} style={{ all: "unset", cursor: "pointer", padding: 5, color: T.mut }}><Copy size={14} /></button>
                    <button title="Supprimer la ligne" onClick={() => supprimerLigne(i)} style={{ all: "unset", cursor: "pointer", padding: 5, color: T.err }}><X size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
          <Btn onClick={ajouterLigne}><Plus size={14} /> Ajouter un salarié</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={onRetour}>Fermer (brouillon conservé)</Btn>
            <Btn primary disabled={envoi} onClick={envoyer}>
              {envoi ? "Transmission…" : `Transmettre ${lignes.filter((l) => Object.values(l).some((v) => String(v).trim() !== "")).length} ligne(s)`}
            </Btn>
          </div>
        </div>
        <p style={{ fontSize: 11, color: T.mut, marginTop: 12, marginBottom: 0 }}>
          Transmises à votre gestionnaire Osmose RH pour l'établissement de la paie de {mois.split("-").reverse().join("/")}. Les acomptes demandés via le portail sont déjà connus de votre gestionnaire.
        </p>
      </div>
    </>
  );
}

/* ================================================================
   ONBOARDING — DEMANDE D'ACCÈS
   Affiché à la place du portail quand le compte connecté n'est
   rattaché à aucun client (403 sur /api/me). L'email vient du compte
   (vérifié) ; le gestionnaire traite la demande en ajoutant la ligne
   Email → CodeClient dans « Utilisateurs portail ».
   ================================================================ */
function DemandeAcces({ user, onLogout }) {
  const [f, setF] = useState({ nom: user?.displayName || "", entreprise: "", telephone: "", message: "" });
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null); // { ref } | { dejaEnCours: msg }

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  const envoyer = async () => {
    const e = { nom: f.nom.trim().length < 2, entreprise: f.entreprise.trim().length < 2 };
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    setEnvoi(true);
    setErrbar("");
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demarche: "acces",
          nom: f.nom.trim(),
          entreprise: f.entreprise.trim(),
          telephone: f.telephone.trim(),
          message: f.message.trim(),
          xq_note: "", // honeypot : doit rester vide
        }),
      });
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        setFini({ dejaEnCours: j.erreur || "Votre demande est déjà en cours de traitement." });
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErrbar(j.erreur ? `${j.erreur} (HTTP ${r.status})` : `HTTP ${r.status}`);
        setEnvoi(false);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setFini({ ref: j.reference || null });
    } catch (_) {
      setErrbar("API injoignable — réessayez dans un instant.");
      setEnvoi(false);
    }
  };

  const cadre = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: T.sans, padding: 20 };

  if (fini) {
    return (
      <div style={cadre}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "32px 28px", maxWidth: 480, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: fini.dejaEnCours ? "#E6F1FB" : "#E1F5EE", color: fini.dejaEnCours ? "#0C447C" : T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            {fini.dejaEnCours ? <Clock size={24} /> : <Check size={24} />}
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>
            {fini.dejaEnCours ? "Demande en cours" : "Demande transmise"}
          </h1>
          <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
            {fini.dejaEnCours || <>Votre gestionnaire Osmose RH va activer votre accès. Vous serez prévenu à <strong>{user?.email}</strong>, puis il suffira de vous reconnecter.</>}
          </p>
          {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
          <Btn onClick={onLogout}><LogOut size={14} /> Se déconnecter</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={cadre}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 26px", maxWidth: 480, width: "100%" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 21, fontFamily: T.serif, fontWeight: 600 }}>Bienvenue sur Osmose RH</h1>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.mut }}>
          Votre compte <strong>{user?.email}</strong> est créé. Dernière étape : demandez l'activation de votre accès — votre gestionnaire s'en charge rapidement.
        </p>

        {errbar && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
            ✗ {errbar}
          </div>
        )}

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ChampReq label="Votre nom complet" erreur={err.nom && "Champ requis."}>
            <input style={err.nom ? inputInvalid : inputStyle} value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
          </ChampReq>

          <ChampReq label="Votre entreprise" erreur={err.entreprise && "Champ requis."}>
            <input style={err.entreprise ? inputInvalid : inputStyle} placeholder="Ex. ACME Propreté" value={f.entreprise} onChange={(e) => maj("entreprise", e.target.value)} />
          </ChampReq>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Téléphone (facultatif)</label>
            <input inputMode="tel" style={inputStyle} placeholder="Ex. 06 12 34 56 78" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Message (facultatif)</label>
            <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Ex. Contact RH de l'agence de Montpellier" value={f.message} onChange={(e) => maj("message", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button onClick={onLogout} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: T.mut, display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={13} /> Se déconnecter
          </button>
          <Btn primary disabled={envoi} onClick={envoyer}>
            {envoi ? "Envoi en cours…" : "Demander l'accès"}
          </Btn>
        </div>
      </div>
    </div>
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

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Icone size={22} color={T.accent} strokeWidth={1.6} />
          <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>{tuile.titre}</h1>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: T.mut }}>{tuile.cible}</p>

        <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

/* ================================================================
   ABSENCES
   ================================================================ */
/* Motifs d'absence — nomenclature inspirée de la DSN (arrêts de travail
   S21.G00.60 + autres suspensions S21.G00.65), libellés client.
   justif = pièce justificative EXIGÉE à la déclaration (arrêt de travail,
   certificat…). Tenir demande.js (API) en miroir : le verrou réel est là. */
const MOTIFS_ABSENCE = [
  { m: "Maladie (arrêt de travail)", justif: true },
  { m: "Maladie professionnelle", justif: true },
  { m: "Accident du travail", justif: true },
  { m: "Accident de trajet", justif: true },
  { m: "Congé maternité", justif: true },
  { m: "Congé paternité / accueil de l'enfant", justif: true },
  { m: "Congé d'adoption", justif: true },
  { m: "Temps partiel thérapeutique", justif: true },
  { m: "Enfant malade", justif: true },
  { m: "Congés payés", justif: false },
  { m: "Congé sans solde", justif: false },
  { m: "Congé parental d'éducation", justif: false },
  { m: "Événement familial (mariage, naissance, décès…)", justif: false },
  { m: "Absence injustifiée", justif: false },
  { m: "Autre absence", justif: false },
];

function DemandeAbsence({ user, client, salaries, salarieInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", dateDebut: "", dateFin: "", motif: "", justificatifUrl: "" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null); // { ok } | { erreur }
  const [envoi, setEnvoi] = useState(false);

  const justifRequis = MOTIFS_ABSENCE.find((x) => x.m === f.motif)?.justif === true;

  const envoyer = async () => {
    if (!f.salarie.trim() || !f.dateDebut || !f.motif || (justifRequis && !f.justificatifUrl.trim())) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=absences", { method: "POST", body: JSON.stringify({ demarche: "absences", ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: `Absence déclarée — réf. ${j.reference}. Un accusé de réception vous est adressé ; votre gestionnaire est prévenu.` }); setF(VIDE); setErr(false); }
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 14 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Déclarer une absence</h2>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

      <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Salarié *</label>
          <ChampSalarie salaries={salaries} valeur={f.salarie} onChange={(v) => setF({ ...f, salarie: v })} invalide={err && !f.salarie.trim()} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Du *</label>
          <input type="date" style={{ ...inputStyle, borderColor: err && !f.dateDebut ? T.err : T.border }} value={f.dateDebut} onChange={(e) => setF({ ...f, dateDebut: e.target.value })} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Au (si connu)</label>
          <input type="date" style={inputStyle} value={f.dateFin} onChange={(e) => setF({ ...f, dateFin: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Motif *</label>
          <select style={{ ...inputStyle, borderColor: err && !f.motif ? T.err : T.border }} value={f.motif}
            onChange={(e) => setF({ ...f, motif: e.target.value })}>
            <option value="">— Choisir un motif —</option>
            {MOTIFS_ABSENCE.map((x) => <option key={x.m} value={x.m}>{x.m}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>
            Justificatif {justifRequis ? <span style={{ color: T.err }}>*</span> : <span style={{ fontWeight: 400 }}>(lien optionnel)</span>}
          </label>
          <input type="text" style={{ ...inputStyle, borderColor: err && justifRequis && !f.justificatifUrl.trim() ? T.err : T.border }}
            placeholder="Lien vers le document déposé dans l'onglet Documents" value={f.justificatifUrl} onChange={(e) => setF({ ...f, justificatifUrl: e.target.value })} />
          {justifRequis && (
            <p style={{ margin: "5px 0 0", fontSize: 11.5, color: err && !f.justificatifUrl.trim() ? T.err : T.mut }}>
              Ce motif exige un justificatif (arrêt de travail, certificat…) : déposez-le dans l'onglet <strong>Documents</strong> puis collez son lien ici.
            </p>
          )}
        </div>
      </div>
      {!justifRequis && (
        <p style={{ fontSize: 11.5, color: T.mut, margin: "-8px 0 16px" }}>
          Un justificatif papier ? Déposez-le dans l'onglet Documents puis collez le lien ici — ou transmettez-le à votre gestionnaire.
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onRetour}>{msg?.ok ? "Retour aux démarches" : "Annuler"}</Btn>
        <Btn primary disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : "Déclarer l'absence"}</Btn>
      </div>
    </>
  );
}

/* ================================================================
   VISITE MÉDICALE
   ================================================================ */
function DemandeVisite({ user, client, salaries, salarieInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", dateVisite: "" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!f.salarie.trim() || !f.dateVisite) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=visite-medicale", { method: "POST", body: JSON.stringify({ demarche: "visite-medicale", ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: `Demande transmise — réf. ${j.reference}. Votre gestionnaire organise la visite et vous confirme le rendez-vous.` }); setF(VIDE); setErr(false); }
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 14 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Visite médicale</h2>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

      <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Salarié *</label>
          <ChampSalarie salaries={salaries} valeur={f.salarie} onChange={(v) => setF({ ...f, salarie: v })} invalide={err && !f.salarie.trim()} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Date souhaitée *</label>
          <input type="date" style={{ ...inputStyle, borderColor: err && !f.dateVisite ? T.err : T.border }} value={f.dateVisite} onChange={(e) => setF({ ...f, dateVisite: e.target.value })} />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: T.mut, margin: "-8px 0 16px" }}>
        Embauche, reprise après arrêt, visite périodique… votre gestionnaire prend contact avec le service de santé au travail.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onRetour}>{msg?.ok ? "Retour aux démarches" : "Annuler"}</Btn>
        <Btn primary disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : "Demander la visite"}</Btn>
      </div>
    </>
  );
}

/* ================================================================
   MUTUELLE
   ================================================================ */
function Demandemutuelle({ user, client, salaries, salarieInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", mutuelle: "", dateAdhesion: new Date().toISOString().slice(0, 10) };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!f.salarie.trim() || !f.mutuelle.trim()) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=mutuelle", { method: "POST", body: JSON.stringify({ demarche: "mutuelle", ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: `Demande transmise — réf. ${j.reference}. Votre gestionnaire traite l'adhésion et revient vers vous.` }); setF(VIDE); setErr(false); }
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 14 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Adhésion mutuelle</h2>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

      <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Salarié *</label>
          <ChampSalarie salaries={salaries} valeur={f.salarie} onChange={(v) => setF({ ...f, salarie: v })} invalide={err && !f.salarie.trim()} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Mutuelle / demande *</label>
          <input type="text" style={{ ...inputStyle, borderColor: err && !f.mutuelle.trim() ? T.err : T.border }} placeholder="Ex. adhésion Alan, dispense (mutuelle du conjoint)…" value={f.mutuelle} onChange={(e) => setF({ ...f, mutuelle: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Date d'effet souhaitée</label>
          <input type="date" style={inputStyle} value={f.dateAdhesion} onChange={(e) => setF({ ...f, dateAdhesion: e.target.value })} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onRetour}>{msg?.ok ? "Retour aux démarches" : "Annuler"}</Btn>
        <Btn primary disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : "Transmettre"}</Btn>
      </div>
    </>
  );
}

/* ================================================================
   GESTION DU PERSONNEL — dossier salarié centralisé
   ================================================================ */
const DEMO_PERSONNEL = {
  salaries: [
    { cle: "DUPONT MARIE", nom: "DUPONT", prenom: "Marie", type: "CDI", poste: "Comptable", debut: "2026-09-01", fin: null },
    { cle: "MARTIN PAUL", nom: "MARTIN", prenom: "Paul", type: "CDD", poste: "Assistant RH", debut: "2026-08-15", fin: dansNJours(26) },
  ],
  absences: [
    { cle: "MARTIN PAUL", salarie: "Martin Paul", du: dansNJours(-6), au: dansNJours(-4), motif: "Maladie", justificatifUrl: "", statut: "Nouvelle", reference: "ABS-DEMO1" },
  ],
  visites: [
    { cle: "DUPONT MARIE", salarie: "Dupont Marie", date: dansNJours(9), statut: "À planifier", reference: "VIS-DEMO1" },
  ],
  mutuelles: [],
  fins: [],
};

function GestionPersonnel({ user, client, onRetour, onDemarche }) {
  const [dossier, setDossier] = useState(null); // null | { salaries… } | { erreur } | { demo }
  const [salCle, setSalCle] = useState(null);
  const [ong, setOng] = useState("Contrat");

  useEffect(() => {
    apiFetch("/api/personnel")
      .then(async (r) => {
        if (r.ok) return setDossier(await r.json());
        const e = await r.json().catch(() => ({}));
        setDossier(import.meta.env.DEV ? { demo: true } : { erreur: e.erreur || `Dossier indisponible (HTTP ${r.status}).` });
      })
      .catch(() => setDossier(import.meta.env.DEV ? { demo: true } : { erreur: "Dossier momentanément indisponible — réessayez." }));
  }, []);

  const fr = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

  if (dossier === null) {
    return (
      <>
        <EnteteFiche titre="Gestion du personnel" onRetour={onRetour} />
        <p style={{ fontSize: 13, color: T.mut }}>Chargement du dossier…</p>
      </>
    );
  }
  if (dossier.erreur) {
    return (
      <>
        <EnteteFiche titre="Gestion du personnel" onRetour={onRetour} />
        <p style={{ fontSize: 13, color: T.mut, margin: "12px 0" }}>{dossier.erreur}</p>
        <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
      </>
    );
  }
  const src = dossier.demo ? DEMO_PERSONNEL : dossier;
  const salaries = src.salaries || [];
  const sal = salaries.find((s) => s.cle === salCle);

  /* ── Fiche d'un salarié ─────────────────────────────────────── */
  if (sal) {
    const nomComplet = `${sal.nom} ${sal.prenom}`.trim();
    const absences = (src.absences || []).filter((x) => x.cle === sal.cle);
    const visites = (src.visites || []).filter((x) => x.cle === sal.cle);
    const mutuelles = (src.mutuelles || []).filter((x) => x.cle === sal.cle);
    const fins = (src.fins || []).filter((x) => x.cle === sal.cle);
    const onglets = [
      { id: "Contrat", n: null }, { id: "Absences", n: absences.length },
      { id: "Visites", n: visites.length }, { id: "Mutuelle", n: mutuelles.length },
      { id: "Fin", n: fins.length },
    ];

    return (
      <>
        <EnteteFiche titre={nomComplet} onRetour={() => { setSalCle(null); setOng("Contrat"); }} />
        <p style={{ margin: "-12px 0 16px", fontSize: 12.5, color: T.mut }}>
          {sal.type}{sal.poste ? ` — ${sal.poste}` : ""} · entré le {fr(sal.debut)}{sal.fin ? ` · fin prévue le ${fr(sal.fin)}` : ""}
        </p>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          {onglets.map((o) => (
            <button key={o.id} onClick={() => setOng(o.id)} style={{
              all: "unset", cursor: "pointer", padding: "8px 14px", fontSize: 13, fontFamily: T.sans,
              color: ong === o.id ? T.accent : T.mut,
              borderBottom: ong === o.id ? `2px solid ${T.accent}` : "2px solid transparent",
              fontWeight: ong === o.id ? 600 : 400,
            }}>
              {o.id}{o.n ? ` (${o.n})` : ""}
            </button>
          ))}
        </div>

        {ong === "Contrat" && (
          <Carte>
            {[["Type de contrat", sal.type || "—"], ["Poste", sal.poste || "—"], ["Date d'entrée", fr(sal.debut)], ["Fin prévue", sal.fin ? fr(sal.fin) : "— (contrat en cours)"]].map(([l, v], i, t) => (
              <Rangee key={l} gauche={<span style={{ color: T.mut }}>{l}</span>} droite={<strong>{v}</strong>} dernier={i === t.length - 1} />
            ))}
          </Carte>
        )}

        {ong === "Absences" && (
          <>
            <Carte>
              {absences.length === 0 && <Vide texte="Aucune absence déclarée pour ce salarié." />}
              {absences.map((a, i) => (
                <Rangee key={i} dernier={i === absences.length - 1}
                  gauche={<><strong>{a.motif || "Absence"}</strong><span style={{ color: T.mut }}> — du {fr(a.du)}{a.au ? ` au ${fr(a.au)}` : ""}</span></>}
                  milieu={a.reference}
                  droite={<Badge s={a.statut} />} />
              ))}
            </Carte>
            <div style={{ marginTop: 12 }}>
              <Btn primary onClick={() => onDemarche("absences", nomComplet)}><Plus size={14} /> Déclarer une absence</Btn>
            </div>
          </>
        )}

        {ong === "Visites" && (
          <>
            <Carte>
              {visites.length === 0 && <Vide texte="Aucune visite médicale enregistrée pour ce salarié." />}
              {visites.map((v, i) => (
                <Rangee key={i} dernier={i === visites.length - 1}
                  gauche={<><strong>Visite médicale</strong><span style={{ color: T.mut }}> — {fr(v.date)}</span></>}
                  milieu={v.reference}
                  droite={<Badge s={v.statut} />} />
              ))}
            </Carte>
            <div style={{ marginTop: 12 }}>
              <Btn primary onClick={() => onDemarche("visite", nomComplet)}><Plus size={14} /> Demander une visite</Btn>
            </div>
          </>
        )}

        {ong === "Mutuelle" && (
          <>
            <Carte>
              {mutuelles.length === 0 && <Vide texte="Aucune demande mutuelle pour ce salarié." />}
              {mutuelles.map((m, i) => (
                <Rangee key={i} dernier={i === mutuelles.length - 1}
                  gauche={<><strong>{m.mutuelle || "Mutuelle"}</strong><span style={{ color: T.mut }}> — effet {fr(m.date)}</span></>}
                  milieu={m.reference}
                  droite={<Badge s={m.statut} />} />
              ))}
            </Carte>
            <div style={{ marginTop: 12 }}>
              <Btn primary onClick={() => onDemarche("mutuelle", nomComplet)}><Plus size={14} /> Demande mutuelle</Btn>
            </div>
          </>
        )}

        {ong === "Fin" && (
          <>
            <Carte>
              {fins.length === 0 && <Vide texte="Aucune fin de contrat déclarée — contrat en cours." />}
              {fins.map((x, i) => (
                <Rangee key={i} dernier={i === fins.length - 1}
                  gauche={<><strong>{x.motif || "Fin de contrat"}</strong><span style={{ color: T.mut }}> — au {fr(x.date)}</span></>}
                  milieu={x.reference}
                  droite={<Badge s={x.statut} />} />
              ))}
            </Carte>
            <div style={{ marginTop: 12 }}>
              <Btn primary onClick={() => onDemarche("fin", nomComplet)}><UserMinus size={14} /> Déclarer une fin de contrat</Btn>
            </div>
          </>
        )}
      </>
    );
  }

  /* ── Liste des salariés ─────────────────────────────────────── */
  const compteur = (liste, cle) => (src[liste] || []).filter((x) => x.cle === cle).length;
  return (
    <>
      <EnteteFiche titre="Gestion du personnel" onRetour={onRetour} />
      <p style={{ margin: "-12px 0 16px", fontSize: 13, color: T.mut }}>
        Les salariés déclarés via la démarche Embauche — cliquez pour ouvrir le dossier.
      </p>

      {salaries.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
          Aucun salarié déclaré pour l'instant.<br />
          Déclarez une embauche pour créer le premier dossier.
        </div>
      ) : (
        <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 90px 100px 1fr", gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
            <span>Salarié</span><span>Poste</span><span>Contrat</span><span>Entrée</span><span>Suivi</span>
          </div>
          {salaries.map((s, i) => {
            const n = compteur("absences", s.cle) + compteur("visites", s.cle) + compteur("mutuelles", s.cle) + compteur("fins", s.cle);
            return (
              <button key={s.cle + i} onClick={() => { setSalCle(s.cle); setOng("Contrat"); }} style={{
                all: "unset", boxSizing: "border-box", width: "100%", display: "grid",
                gridTemplateColumns: "2fr 2fr 90px 100px 1fr", gap: 8, padding: "12px 16px",
                borderBottom: i < salaries.length - 1 ? `1px solid ${T.border}` : "none",
                cursor: "pointer", fontSize: 13, fontFamily: T.sans, color: T.ink, alignItems: "center",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFBFD")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nom} {s.prenom}</span>
                <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.poste || "—"}</span>
                <span>{s.type || "—"}</span>
                <span style={{ color: T.mut }}>{fr(s.debut)}</span>
                <span style={{ color: T.mut, fontSize: 12 }}>{n > 0 ? `${n} élément${n > 1 ? "s" : ""} →` : "→"}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut }}>
        <ShieldCheck size={13} />
        {dossier.demo
          ? "Données de démonstration — connectez-vous en production pour vos salariés réels"
          : "Dossier alimenté par vos démarches — les déclarations sont rapprochées par nom et prénom du salarié."}
      </div>
    </>
  );
}

/* ================================================================
   CONTACTER MON GESTIONNAIRE — canal de base, jamais optionnel.
   Le message part dans « Messages gestionnaire » ; le flux notifie le
   gestionnaire (réponse par e-mail classique) et accuse réception.
   ================================================================ */
const OBJETS_CONTACT = ["Question sur la paie", "Question contrat / salarié", "Transmission d'informations", "Demande de document", "Autre demande"];

function ContactGestionnaire({ user, onRetour }) {
  const VIDE = { objet: "", message: "" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!f.objet || f.message.trim().length < 10) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=contact", { method: "POST", body: JSON.stringify({ demarche: "contact", ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: `Message transmis — réf. ${j.reference}. Votre gestionnaire vous répond par e-mail.` }); setF(VIDE); setErr(false); }
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 14 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Contacter mon gestionnaire</h2>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

      <div style={{ display: "grid", gap: 14, marginBottom: 8 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Objet *</label>
          <select style={{ ...inputStyle, borderColor: err && !f.objet ? T.err : T.border }} value={f.objet} onChange={(e) => setF({ ...f, objet: e.target.value })}>
            <option value="">— Choisir un objet —</option>
            {OBJETS_CONTACT.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Votre message *</label>
          <textarea rows={7} style={{ ...inputStyle, resize: "vertical", borderColor: err && f.message.trim().length < 10 ? T.err : T.border }}
            placeholder="Décrivez votre question ou l'information à transmettre — votre gestionnaire a déjà votre contexte client."
            value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          {err && f.message.trim().length < 10 && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.err }}>Quelques mots de plus — au moins une phrase.</p>}
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: T.mut, margin: "0 0 16px" }}>
        Réponse par e-mail à <strong>{user?.email || "votre adresse de connexion"}</strong> — un accusé de réception vous est envoyé immédiatement.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onRetour}>{msg?.ok ? "Retour aux démarches" : "Annuler"}</Btn>
        <Btn primary disabled={envoi} onClick={envoyer}><Send size={14} /> {envoi ? "Envoi…" : "Envoyer le message"}</Btn>
      </div>
    </>
  );
}

/* En-tête commun des vues « gestion du personnel » (retour + titre). */
function EnteteFiche({ titre, onRetour }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <button onClick={onRetour} aria-label="Retour" style={{ all: "unset", cursor: "pointer", color: T.mut, padding: 4 }}><ArrowLeft size={18} /></button>
      <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>{titre}</h2>
    </div>
  );
}

/* Blocs de la fiche salarié — au niveau module (jamais de composant défini
   dans un composant : cause de démontages à chaque rendu). */
function Carte({ children }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>{children}</div>;
}
function Rangee({ gauche, milieu, droite, dernier }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 16px", fontSize: 13, borderBottom: dernier ? "none" : `1px solid ${T.border}` }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{gauche}</span>
      {milieu && <span style={{ color: T.mut, fontSize: 12, flexShrink: 0 }}>{milieu}</span>}
      {droite}
    </div>
  );
}
function Vide({ texte }) {
  return <div style={{ padding: "18px 16px", fontSize: 13, color: T.mut }}>{texte}</div>;
}
