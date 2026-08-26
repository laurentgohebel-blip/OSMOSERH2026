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
  GraduationCap, AlertCircle, Check, CalendarDays, Plus, Copy, X, UserMinus, UserPlus, Globe, Receipt
} from "lucide-react";
import { apiFetch } from "../apiClient";
import AdminActivation from "./AdminActivation";

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
  titres: [
    { salarie: "OKAFOR Chidi", type: "Carte de séjour pluriannuelle", numero: "9901234567", dateExpiration: dansNJours(48), joursRestants: 48, alerte: new Date().toISOString() },
  ],
  essais: [
    { salarie: "MARTIN Paul", poste: "Assistant RH", dateFin: dansNJours(11), joursRestants: 11, alerte: new Date().toISOString() },
  ],
  visitesMedicales: [
    { salarie: "DUPONT Marie", poste: "Comptable", echeance: dansNJours(40), joursRestants: 40, alerte: null },
  ],
  habilitations: [
    { salarie: "MARTIN Paul", type: "CACES R489 (chariots élévateurs)", numero: "489-2021-118", dateExpiration: dansNJours(55), joursRestants: 55, alerte: null },
  ],
  entretiens: [
    { salarie: "DUPONT Marie", poste: "Comptable", echeance: dansNJours(45), joursRestants: 45, alerte: null },
  ],
  reprises: [
    { salarie: "BERNARD Luc", motif: "Maladie (arrêt de travail)", dureeJours: 71, retourLe: dansNJours(3), echeance: dansNJours(11), joursRestants: 11, alerte: null },
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
  // Fils de discussion « Mon gestionnaire » (statut vu du client)
  "Transmis":     { bg: "#E6F1FB", fg: "#0C447C" },
  "Répondu":      { bg: "#E1F5EE", fg: "#085041" },
  "Clos":         { bg: "#F1EFE8", fg: "#444441" },
};

const BARRES = { CDI: "#378ADD", CDD: "#5DCAA5", Alternance: "#AFA9EC", Stage: "#F0997B" };

/* ================================================================
   TUILES — id "attestation" est câblée (ATT-01), les autres en démo
   ================================================================ */
/* Option contractuelle requise par tuile (opt-in) — les tuiles sans entrée
   (démos formation/sécurité) restent librement accessibles. */
// Miroir des verrous d'option posés côté API (demande.js). Les deux
// doivent rester d'accord : le serveur refuse pour de bon, cette table ne
// fait que griser la tuile — un client sans l'option doit le voir avant
// de cliquer, pas récolter un 403. Planning et Procédures y manquaient.
const OPTION_TUILE = { attestation: "attestation", acompte: "acompte", embauche: "embauche", variables: "paie", fin: "embauche", personnel: "embauche", absences: "embauche", visite: "embauche", mutuelle: "embauche", avenant: "embauche", habilitation: "securite", securite: "securite", planning: "paie", procedures: "embauche", frais: "paie", saisie: "paie" };

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
  { id: "avenant", bloc: "salaries", titre: "Avenant au contrat", sous: "Modifier un contrat en cours", icone: FileText, cablee: true },
  { id: "fin", bloc: "salaries", titre: "Fin de contrat", sous: "Départ d'un salarié", icone: UserMinus, cablee: true },
  { id: "absences", bloc: "salaries", titre: "Absences", sous: "Déclarer une absence", icone: Clock, cablee: true },
  { id: "visite", bloc: "salaries", titre: "Visite médicale", sous: "Programmation ou suivi", icone: ShieldCheck, cablee: true },
  { id: "mutuelle", bloc: "salaries", titre: "Mutuelle", sous: "Adhésion ou modification", icone: Banknote, cablee: true },
  // Brique Sécurité (23/08) : développée (VueSecurite, registre des
  // habilitations) mais VOLONTAIREMENT gardée en « Bientôt disponible »
  // (décision Laurent 23/08) — pour l'ouvrir : bloc "salaries".
  // Les habilitations restent accessibles depuis la fiche du salarié
  // (onglet Habilitations) ; la tuile-formulaire est hors grille (cache).
  { id: "habilitation", bloc: "cache", titre: "Habilitations", sous: "CACES, électrique, SST…", icone: GraduationCap, cablee: true },
  { id: "attestation", bloc: "salaries", titre: "Attestation", sous: "Attestation employeur", icone: Award, cablee: true },
  { id: "procedures", bloc: "salaries", titre: "Procédures", sous: "Licenciement, sanction, inaptitude, rupture", icone: ShieldCheck, cablee: true },
  { id: "planning", bloc: "paie", titre: "Planning d'équipe", sous: "Heures, pointage, variables", icone: Clock, cablee: true },
  { id: "variables", bloc: "paie", titre: "Variables de paie", sous: "Éléments du mois", icone: CalendarDays, cablee: true },
  { id: "frais", bloc: "paie", titre: "Notes de frais", sous: "Ticket photographié, validation, paie", icone: Receipt, cablee: true },
  { id: "acompte", bloc: "paie", titre: "Acompte", sous: "Demande d'acompte", icone: Banknote, cablee: true },
  { id: "saisie", bloc: "paie", titre: "Saisie sur salaire", sous: "Quotité, échéancier, obligations", icone: Banknote, cablee: true },
  { id: "contact", bloc: "echanges", titre: "Mon gestionnaire", sous: "Écrire et suivre vos échanges", icone: Send, cablee: true },
  { id: "formation", bloc: "bientot", titre: "Formation", sous: "Demandes et plan de formation", icone: GraduationCap },
  { id: "securite", bloc: "bientot", titre: "Sécurité", sous: "Habilitations, DUERP, registres", icone: ShieldCheck, cablee: true },
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
  // Nature de visite pré-remplie : l'alerte de reprise (page Échéances)
  // ouvre le formulaire déjà réglé sur « Visite de reprise ».
  const [visitePrereglee, setVisitePrereglee] = useState("");
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
  // Pastille « messages non lus » de la tuile Mon gestionnaire : servie
  // par /api/me au chargement, tenue à jour par la messagerie elle-même.
  const [nonLusMsg, setNonLusMsg] = useState(0);
  // Lien profond des e-mails de notification : ?msg=<id> ouvre le fil
  // directement. Lecture PURE ici (StrictMode double-invoque les
  // initialisateurs) ; l'URL est nettoyée dans l'effet, une seule fois.
  const [msgInitial] = useState(() => new URLSearchParams(window.location.search).get("msg"));
  useEffect(() => {
    if (!msgInitial) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("msg")) { // seul msg est retiré — les autres paramètres restent
      params.delete("msg");
      const reste = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (reste ? `?${reste}` : "") + window.location.hash);
    }
    setVue("prod"); setTuile(TUILES.find((t) => t.id === "contact"));
  }, []);

  // External ID enregistre « unknown » comme nom d'affichage quand le flux
  // d'inscription ne collecte pas le nom : on ne salue jamais « unknown » —
  // repli sur la partie locale de l'adresse e-mail, joliment capitalisée.
  const prenom = (() => {
    const brut = user?.givenName || (user?.displayName || "").split(" ")[0] || "";
    const nom = brut && brut.toLowerCase() !== "unknown"
      ? brut
      : ((user?.email || user?.username || "").split("@")[0] || "").split(/[._-]/)[0];
    return nom ? nom.charAt(0).toUpperCase() + nom.slice(1) : "";
  })();
  const initiales = (user?.displayName || "?").split(" ").map((m) => m[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    latence(500).then(() => setDb(JSON.parse(JSON.stringify(seed))));
    apiFetch("/api/me")
      .then(async (r) => {
        if (r.ok) {
          const j = await r.json();
          setNonLusMsg(j.messagesNonLus || 0);
          return setMoi(j);
        }
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

  /* Gestionnaire (ADMIN_EMAILS côté API) : écran d'activation des demandes
     d'accès à la place de l'espace client. */
  if (moi?.admin) {
    // msgInitial : le paramètre ?msg= a déjà été consommé par AppShell —
    // transmis en prop pour que le lien profond marche aussi côté admin.
    return <AdminActivation user={user} onLogout={onLogout} msgInitial={msgInitial} />;
  }

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
    return <DemandeAcces user={user} onLogout={onLogout} raison={moi.bloque} />;
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
        {(moi?.options || []).includes("etrangers") && (
          <NavBtn id="etr" icon={Globe} label="Salariés étrangers" />
        )}
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
                          {t.id === "contact" && inclus && nonLusMsg > 0 ? (
                            <span title={`${nonLusMsg} message${nonLusMsg > 1 ? "s" : ""} non lu${nonLusMsg > 1 ? "s" : ""}`} style={{
                              position: "absolute", top: 10, right: 10, minWidth: 19, height: 19, borderRadius: 10,
                              background: T.accent, color: "#fff", fontSize: 11, fontWeight: 600,
                              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", boxSizing: "border-box",
                            }}>{nonLusMsg}</span>
                          ) : t.cablee && inclus && (
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

        {/* Le planning aussi : une semaine d'équipe ne tient pas en 560 px. */}
        {vue === "prod" && tuile && tuile.id === "planning" && (
          <PlanningEquipe user={user} onRetour={() => setTuile(null)} />
        )}

        {/* Les procédures : la frise des étapes demande de la largeur. */}
        {vue === "prod" && tuile && tuile.id === "procedures" && (
          <Procedures user={user} salaries={refSal} onRetour={() => setTuile(null)} />
        )}

        {/* Les notes de frais : une pile se traite en tableau, pas en fiche. */}
        {vue === "prod" && tuile && tuile.id === "frais" && (
          <NotesDeFrais user={user} salaries={refSal} onRetour={() => setTuile(null)} />
        )}

        {/* La saisie sur salaire : le détail par tranches veut de la place. */}
        {vue === "prod" && tuile && tuile.id === "saisie" && (
          <SaisieSalaire user={user} salaries={refSal} onRetour={() => setTuile(null)} />
        )}

        {/* Le dossier du personnel aussi : liste + fiche en pleine largeur. */}
        {vue === "prod" && tuile && tuile.id === "personnel" && (
          <GestionPersonnel user={user} client={codeClient} onRetour={() => setTuile(null)}
            onDemarche={(id, salarie) => { setSalariePrerempli(salarie); setTuile(TUILES.find((t) => t.id === id)); }} />
        )}

        {/* La brique Sécurité aussi : registre des habilitations en pleine
            largeur (grille par salarié + échéances de recyclage). */}
        {vue === "prod" && tuile && tuile.id === "securite" && (
          <VueSecurite onRetour={() => setTuile(null)}
            onDemarche={(id, salarie) => { setSalariePrerempli(salarie); setTuile(TUILES.find((t) => t.id === id)); }} />
        )}

        {/* La messagerie gestionnaire aussi : liste des fils + conversation,
            un peu plus large qu'un formulaire (lecture confortable). */}
        {vue === "prod" && tuile && tuile.id === "contact" && (
          <div style={{ maxWidth: 660, margin: "0 auto" }}>
            <MessagerieGestionnaire user={user} onRetour={() => setTuile(null)}
              filInitial={msgInitial} onNonLus={setNonLusMsg} />
          </div>
        )}

        {/* Formulaires : largeur volontairement contenue (~560 px, un champ
            trop large se lit mal) mais CENTRÉE dans la zone de contenu. */}
        {vue === "prod" && tuile && tuile.id !== "variables" && tuile.id !== "planning" && tuile.id !== "procedures" && tuile.id !== "personnel" && tuile.id !== "contact" && tuile.id !== "securite" && tuile.id !== "frais" && tuile.id !== "saisie" && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {tuile.id === "attestation" && (
              <AttestationEmployeur user={user} client={codeClient} salaries={refSal} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "acompte" && (
              <DemandeAcompte user={user} client={codeClient} salaries={refSal} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "embauche" && (
              <DemandeEmbauche user={user} client={codeClient} salaries={refSal} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "fin" && (
              <DemandeFinContrat user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "absences" && (
              <DemandeAbsence user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "visite" && (
              <DemandeVisite user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli}
                typeInitial={visitePrereglee} onRetour={() => { setVisitePrereglee(""); setTuile(null); }} />
            )}
            {tuile.id === "mutuelle" && (
              <Demandemutuelle user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "avenant" && (
              <DemandeAvenant user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
            )}
            {tuile.id === "habilitation" && (
              <DemandeHabilitation user={user} client={codeClient} salaries={refSal} salarieInitial={salariePrerempli} onRetour={() => setTuile(null)} />
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

              {(src.reprises || []).length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `2px solid #F0C9A8`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}`, background: "#FDF3E4" }}>
                    Visites de reprise à organiser — obligation sous 8 jours
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Motif de l'arrêt</span><span>Retour le</span><span>Limite</span><span>Action</span>
                  </div>
                  {(src.reprises || []).map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < src.reprises.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`Arrêt de ${x.dureeJours} jours`}>{x.motif}</span>
                      <span>{fr(x.retourLe)}</span>
                      {x.joursRestants < 0
                        ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>EN RETARD</span>
                        : BadgeJours(x.joursRestants)}
                      <span style={{ justifySelf: "start" }} title={x.alerte ? "Alerte e-mail envoyée" : "Alerte e-mail programmée au retour"}>
                        <Btn small onClick={() => {
                          if (!finInclus) return notifier("Option non incluse dans votre contrat — parlez-en à votre gestionnaire Osmose RH.");
                          setSalariePrerempli(x.salarie);
                          setVisitePrereglee("Visite de reprise");
                          setVue("prod"); setTuile(TUILES.find((t) => t.id === "visite"));
                        }}>Demander la visite</Btn>
                      </span>
                    </div>
                  ))}
                  <div style={{ padding: "9px 16px", fontSize: 11.5, color: T.mut, borderTop: `1px solid ${T.border}`, background: "#FCFBF8" }}>
                    Obligatoire après un congé maternité, une maladie professionnelle, 30 jours d'arrêt pour
                    accident du travail ou 60 jours de maladie (art. R.4624-31) — demandez la visite depuis
                    la fiche du salarié, l'alerte s'arrête aussitôt.
                  </div>
                </div>
              )}

              {(src.titres || []).length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>
                    Titres de séjour à renouveler
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Titre</span><span>Expire le</span><span>Échéance</span><span>Alerte e-mail</span>
                  </div>
                  {(src.titres || []).map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < src.titres.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.numero ? `N° ${x.numero}` : undefined}>{x.type || "Titre de séjour"}</span>
                      <span>{fr(x.dateExpiration)}</span>
                      {x.joursRestants < 0
                        ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>EXPIRÉ</span>
                        : BadgeJours(x.joursRestants)}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut }}>
                        {x.alerte
                          ? <><Check size={14} color={T.ok} style={{ flexShrink: 0 }} /> Envoyée le {fr(x.alerte)}</>
                          : <><Clock size={13} style={{ flexShrink: 0 }} /> Programmée à J-90</>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(src.essais || []).length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>
                    Périodes d'essai — décision avant le terme
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Poste</span><span>Terme le</span><span>Échéance</span><span>Alerte e-mail</span>
                  </div>
                  {(src.essais || []).map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < src.essais.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.poste || "—"}</span>
                      <span>{fr(x.dateFin)}</span>
                      {BadgeJours(x.joursRestants)}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut }}>
                        {x.alerte
                          ? <><Check size={14} color={T.ok} style={{ flexShrink: 0 }} /> Envoyée</>
                          : <><Clock size={13} style={{ flexShrink: 0 }} /> Programmée à J-15</>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(src.visitesMedicales || []).length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>
                    Visites médicales à programmer
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Poste</span><span>Échéance le</span><span>Échéance</span><span>Alerte e-mail</span>
                  </div>
                  {(src.visitesMedicales || []).map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < src.visitesMedicales.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.poste || "—"}</span>
                      <span>{fr(x.echeance)}</span>
                      {x.joursRestants < 0
                        ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>EN RETARD</span>
                        : BadgeJours(x.joursRestants)}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut }}>
                        {x.alerte
                          ? <><Check size={14} color={T.ok} style={{ flexShrink: 0 }} /> Envoyée</>
                          : <><Clock size={13} style={{ flexShrink: 0 }} /> Programmée à J-60</>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(src.entretiens || []).length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>
                    Entretiens professionnels à planifier
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Poste</span><span>Échéance le</span><span>Échéance</span><span>Alerte e-mail</span>
                  </div>
                  {(src.entretiens || []).map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < src.entretiens.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.poste || "—"}</span>
                      <span>{fr(x.echeance)}</span>
                      {x.joursRestants < 0
                        ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>EN RETARD</span>
                        : BadgeJours(x.joursRestants)}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut }}>
                        {x.alerte
                          ? <><Check size={14} color={T.ok} style={{ flexShrink: 0 }} /> Envoyée</>
                          : <><Clock size={13} style={{ flexShrink: 0 }} /> Programmée à J-60</>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(src.habilitations || []).length > 0 && (
                <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 14, fontFamily: T.serif, borderBottom: `1px solid ${T.border}` }}>
                    Habilitations à recycler
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
                    <span>Salarié</span><span>Habilitation</span><span>Expire le</span><span>Échéance</span><span>Alerte e-mail</span>
                  </div>
                  {(src.habilitations || []).map((x, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < src.habilitations.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.salarie}</span>
                      <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.numero ? `N° ${x.numero}` : undefined}>{x.type || "Habilitation"}</span>
                      <span>{fr(x.dateExpiration)}</span>
                      {x.joursRestants < 0
                        ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>EXPIRÉE</span>
                        : BadgeJours(x.joursRestants)}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mut }}>
                        {x.alerte
                          ? <><Check size={14} color={T.ok} style={{ flexShrink: 0 }} /> Envoyée</>
                          : <><Clock size={13} style={{ flexShrink: 0 }} /> Programmée à J-90</>}
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
                  : "Rappels automatiques par e-mail : fins de CDD (J-30), titres de séjour (J-90/J-60/J-30), périodes d'essai (J-15/J-7), visites médicales et entretiens professionnels (J-60/J-30, puis retard), habilitations (J-90/J-60/J-30, puis expiration) et visites de reprise (au retour du salarié)."}
              </div>
            </>
          );
        })()}

        {/* ===== SALARIÉS ÉTRANGERS (option) ===== */}
        {vue === "etr" && <VueEtrangers notifier={notifier} />}

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

// Jumeau facultatif de ChampReq : même mise en page, sans l'étoile —
// l'erreur ne sert qu'aux contrôles de FORMAT d'un champ renseigné.
const ChampOpt = ({ label, erreur, large, children }) => (
  <div style={{ gridColumn: large ? "1 / -1" : "auto", display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 12, color: T.mut }}>{label}</label>
    {children}
    {erreur && <span style={{ fontSize: 11, color: T.err }}>{erreur}</span>}
  </div>
);

function DemandeAcompte({ user, client, salaries, onRetour }) {
  const [f, setF] = useState({
    email: user?.email || "",
    nom: "", prenom: "", matricule: "", montant: "", dateVersement: "",
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
      dateVersement: !/^\d{4}-\d{2}-\d{2}$/.test(f.dateVersement) || f.dateVersement < new Date().toISOString().slice(0, 10),
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
      // Même convention que l'attestation (ATT-01) : le flux lit un champ
      // combiné nomSalarie — nom/prenom restent envoyés séparément.
      nomSalarie: `${f.nom.trim().toUpperCase()} ${f.prenom.trim()}`.trim(),
      matricule: Number(f.matricule.trim()),  // colonne Matricule : nombre JSON attendu par le déclencheur du flux
      montant: Number(f.montant.trim().replace(",", ".")), // colonne Montant demandé : nombre JSON attendu par le déclencheur du flux
      dateVersement: f.dateVersement, // AAAA-MM-JJ — colonne Date de versement côté flux
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

          <ChampReq label="Date de versement souhaitée" erreur={err.dateVersement && "Date requise (aujourd'hui ou à venir)."}>
            <input type="date" min={new Date().toISOString().slice(0, 10)} style={err.dateVersement ? inputInvalid : inputStyle} value={f.dateVersement} onChange={(e) => maj("dateVersement", e.target.value)} />
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
// Nationalités dispensées de titre de séjour (UE/EEE/Suisse) — MÊMES
// radicaux que l'API (demande.js) : une nationalité non reconnue ouvre
// le volet « salarié étranger » (sur-inclusif = prudent, le gestionnaire
// tranche). Comparaison sans accents, en minuscules.
const RADICAUX_UE_EEE_SUISSE = ["franc", "allemand", "autrich", "belg", "bulgar", "chypr", "croat", "danois", "danemark", "espagn", "eston", "finland", "grec", "hongr", "irland", "ital", "letton", "lituan", "luxembourg", "malt", "neerland", "holland", "pays-bas", "pays bas", "polon", "portug", "roumain", "slovaqu", "sloven", "sued", "tchec", "island", "liechtenstein", "norveg", "suisse"];
const titreSejourRequis = (nationalite) => {
  const n = String(nationalite || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!n.trim()) return false;
  return !RADICAUX_UE_EEE_SUISSE.some((r) => n.includes(r));
};
const TITRES_SEJOUR = ["Carte de séjour pluriannuelle", "Carte de séjour temporaire", "Carte de résident", "VLS-TS (visa long séjour valant titre)", "Récépissé avec autorisation de travail", "Autorisation provisoire de séjour", "Carte de séjour citoyen UE/famille", "Autre"];

function DemandeEmbauche({ user, client, salaries, onRetour }) {
  const [f, setF] = useState({
    type: "CDI", nom: "", prenom: "", naissance: "", lieuNaissance: "",
    nationalite: "", numeroSS: "", adresse: "", emailSalarie: "",
    telephone: "", debut: "", fin: "", poste: "", duree: "", finEssai: "",
    // Volet administratif (dossier du salarié — alimenté dans « Salariés »).
    // FACULTATIF depuis le modèle « PJ obligatoires » : Osmose transcrit
    // depuis les pièces jointes, le client peut pré-remplir s'il veut.
    sexe: "", nomMarital: "", situationFamiliale: "",
    deptNaissance: "", codeDeptNaissance: "",
    paysNaissance: "France", codePaysNaissance: "FR",
    iban: "", bic: "", bulletinDemat: true, matricule: "",
  });
  // Pièces jointes OBLIGATOIRES (modèle B du 22/08) : pièce d'identité,
  // carte vitale ou attestation de droits, RIB.
  const [pj, setPj] = useState({ identite: null, vitale: null, rib: null, titre: null });
  const majPj = (k, fichier) => { setPj((p) => ({ ...p, [k]: fichier })); setErr((e) => ({ ...e, ["pj" + k]: false })); };
  const pjValide = (fichier) => !!fichier && /\.(pdf|jpe?g|png)$/i.test(fichier.name) && fichier.size <= 10 * 1024 * 1024;
  // Salarié étranger : titre de séjour (volet affiché selon la nationalité)
  const [titre, setTitre] = useState({ type: "", numero: "", expiration: "" });
  const majTitre = (k, v) => { setTitre((p) => ({ ...p, [k]: v })); setErr((e) => ({ ...e, ["titre" + k]: false })); };
  const etranger = titreSejourRequis(f.nationalite);
  const [err, setErr] = useState({});
  const [errbar, setErrbar] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);
  // Deux parcours (23/08 soir) : "direct" = le client a tout (formulaire
  // complet + PJ) ; "invite" = pré-embauche, le client ne saisit que le
  // contrat — le salarié remplit son dossier via le lien d'onboarding et
  // la demande de contrat part TOUTE SEULE à sa soumission.
  const [mode, setMode] = useState(null);

  // Troisième parcours (24/08) : « il a déjà travaillé ici ». Le dossier
  // administratif est au référentiel — on ne redemande que le contrat, et
  // le serveur énonce ce que la réembauche impose (carence entre deux
  // CDD, titre de séjour à revérifier, période d'essai, visite médicale).
  const anciens = (salaries || []).filter((s) => s.statut === "Sorti");
  const [repris, setRepris] = useState(null);      // salarié choisi
  const [controles, setControles] = useState(null); // { points, repris, ancien }
  const [derogation, setDerogation] = useState("");

  const maj = (k, v) => { setF({ ...f, [k]: v }); setErr({ ...err, [k]: false }); };

  // Les points de vigilance dépendent du contrat envisagé : on les
  // redemande au serveur dès qu'un élément déterminant change. Le calcul
  // vit d'un seul côté — le dupliquer ici, c'est le voir diverger.
  useEffect(() => {
    if (mode !== "reprise" || !repris) return;
    let annule = false;
    (async () => {
      try {
        const r = await apiFetch("/api/demande", {
          method: "POST",
          body: JSON.stringify({ action: "reembaucheControles", reprise: repris.id || `${repris.nom} ${repris.prenom}`,
            typeContrat: f.type, dateDebut: f.debut, poste: f.poste }),
        });
        const j = await r.json().catch(() => ({}));
        if (!annule) setControles(r.ok ? j : { erreur: j.erreur || "Dossier illisible." });
      } catch { if (!annule) setControles({ erreur: "Contrôles indisponibles — vérifiez votre connexion." }); }
    })();
    return () => { annule = true; };
  }, [mode, repris, f.type, f.debut, f.poste]);

  const validerInvitation = () => {
    const e = {
      nom: f.nom.trim().length < 2,
      prenom: f.prenom.trim().length < 2,
      debut: !f.debut,
      fin: f.type === "CDD" && (!f.fin || f.fin <= f.debut),
      poste: f.poste.trim().length < 2,
      duree: !/^\d{1,3}([.,]\d{1,2})?$/.test(f.duree.trim()) || parseFloat(f.duree.replace(",", ".")) <= 0,
      finEssai: !!f.finEssai && !!f.debut && f.finEssai <= f.debut,
      emailSalarie: !!f.emailSalarie.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.emailSalarie.trim()),
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyerInvitation = async () => {
    if (!validerInvitation()) return;
    setEnvoi(true); setErrbar("");
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "onboardingEmbauche",
          typeContrat: f.type, nom: f.nom.trim(), prenom: f.prenom.trim(),
          dateDebut: f.debut, ...(f.type === "CDD" ? { dateFin: f.fin } : {}),
          poste: f.poste.trim(), dureeMensuelle: f.duree.trim().replace(",", "."),
          ...(f.finEssai ? { finPeriodeEssai: f.finEssai } : {}),
          ...(f.emailSalarie.trim() ? { emailSalarie: f.emailSalarie.trim() } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErrbar(j.erreur || `Envoi refusé (HTTP ${r.status}).`); setEnvoi(false); return; }
      setFini({ invitation: j });
    } catch { setErrbar("API injoignable — réessayez."); setEnvoi(false); }
  };

  /* Réembauche : on n'envoie QUE le contrat. L'identité, le NIR,
     l'adresse et la banque viennent du dossier côté serveur — les
     réenvoyer depuis le navigateur reviendrait à faire transiter des
     données sensibles sans raison. */
  const envoyerReembauche = async () => {
    const e = {};
    if (!f.poste.trim()) e.poste = true;
    if (!f.debut) e.debut = true;
    if (f.type === "CDD" && (!f.fin || f.fin <= f.debut)) e.fin = true;
    if (!f.duree.trim()) e.duree = true;
    setErr(e);
    if (Object.keys(e).length) { setErrbar("Complétez les champs signalés."); return; }
    const bloquants = (controles?.points || []).filter((p) => p.niveau === "bloquant");
    if (bloquants.length && !derogation) {
      setErrbar("Cette réembauche soulève un point bloquant : indiquez le motif qui permet de passer outre.");
      return;
    }
    setEnvoi(true); setErrbar("");
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demarche: "embauche",
          reprise: repris.id || `${repris.nom} ${repris.prenom}`,
          typeContrat: f.type, dateDebut: f.debut, ...(f.type === "CDD" ? { dateFin: f.fin } : {}),
          poste: f.poste.trim(), dureeMensuelle: f.duree.trim().replace(",", "."),
          ...(f.finEssai ? { finPeriodeEssai: f.finEssai } : {}),
          ...(derogation ? { motifDerogation: derogation } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErrbar(j.erreur || `Envoi refusé (HTTP ${r.status}).`); setEnvoi(false); return; }
      setFini({ reference: j.reference, reprise: true, salarie: `${repris.nom} ${repris.prenom}` });
    } catch { setErrbar("API injoignable — réessayez."); setEnvoi(false); }
  };

  // Après une embauche DIRECTE : proposer quand même l'onboarding pour
  // que le salarié complète son dossier (état civil, banque…).
  const inviterApres = async () => {
    setFini((x) => ({ ...x, invEnvoi: true }));
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboardingInviter", id: fini.idFiche }),
      });
      const j = await r.json().catch(() => ({}));
      setFini((x) => ({ ...x, invEnvoi: false, ...(r.ok ? { lien: j.lien, expireLe: j.expireLe } : { invErreur: j.erreur || `Refusé (HTTP ${r.status}).` }) }));
    } catch { setFini((x) => ({ ...x, invEnvoi: false, invErreur: "API injoignable." })); }
  };

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
      finEssai: !!f.finEssai && !!f.debut && f.finEssai <= f.debut,
      // Volet administratif FACULTATIF : contrôles de format uniquement
      // si le champ est renseigné.
      codeDeptNaissance: !!f.codeDeptNaissance.trim() && !/^(\d{2,3}|2[AB]|9[78]\d)$/i.test(f.codeDeptNaissance.trim()),
      codePaysNaissance: !!f.codePaysNaissance.trim() && !/^[A-Za-z]{2}$/.test(f.codePaysNaissance.trim()),
      emailSalarie: !!f.emailSalarie.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.emailSalarie.trim()),
      telephone: !!f.telephone.trim() && f.telephone.replace(/\D/g, "").length < 6,
      iban: !!f.iban.trim() && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(f.iban.replace(/\s/g, "").toUpperCase()),
      bic: !!f.bic.trim() && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(f.bic.replace(/\s/g, "").toUpperCase()),
      // Les trois pièces jointes sont OBLIGATOIRES (PDF/JPG/PNG, 10 Mo max)
      pjidentite: !pjValide(pj.identite),
      pjvitale: !pjValide(pj.vitale),
      pjrib: !pjValide(pj.rib),
      // Salarié étranger : titre de séjour + sa pièce, obligatoires
      titretype: etranger && !titre.type,
      titrenumero: etranger && titre.numero.trim().length < 4,
      titreexpiration: etranger && (!/^\d{4}-\d{2}-\d{2}$/.test(titre.expiration) || (!!f.debut && titre.expiration < f.debut)),
      pjtitre: etranger && !pjValide(pj.titre),
    };
    setErr(e);
    return !Object.values(e).some(Boolean);
  };

  const envoyer = async () => {
    if (!valider()) return;
    setEnvoi(true);
    setErrbar("");

    // 1. Téléverser les trois pièces jointes (GED, dossier Dépôts du
    // client) — noms structurés pour que le gestionnaire les retrouve.
    const horodatage = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const televerser = async (fichier, type) => {
      const ext = (fichier.name.split(".").pop() || "pdf").toLowerCase();
      const nom = `PJ-Embauche_${f.nom.trim().toUpperCase()}-${f.prenom.trim()}_${type}_${horodatage}.${ext}`;
      const r = await apiFetch(`/api/depot?nom=${encodeURIComponent(nom)}`, {
        method: "POST",
        headers: { "Content-Type": fichier.type || "application/octet-stream" },
        body: fichier,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.erreur || `dépôt « ${type} » refusé (HTTP ${r.status})`);
      }
      return (await r.json().catch(() => ({}))).nom || nom;
    };
    let nomsPj;
    try {
      nomsPj = {
        pjIdentite: await televerser(pj.identite, "piece-identite"),
        pjVitale: await televerser(pj.vitale, "carte-vitale"),
        pjRib: await televerser(pj.rib, "rib"),
        ...(etranger ? { pjTitreSejour: await televerser(pj.titre, "titre-sejour") } : {}),
      };
    } catch (e) {
      setErrbar(`Pièces jointes : ${e.message}`);
      setEnvoi(false);
      return;
    }

    const payload = {
      demarche: "embauche",
      ...nomsPj,
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
      ...(f.finEssai ? { finPeriodeEssai: f.finEssai } : {}),
      // Volet administratif → fiche « Salariés » (dossier complet)
      sexe: f.sexe,
      nomMarital: f.nomMarital.trim(),
      situationFamiliale: f.situationFamiliale,
      departementNaissance: f.deptNaissance.trim(),
      codeDepartementNaissance: f.codeDeptNaissance.trim().toUpperCase(),
      paysNaissance: f.paysNaissance.trim(),
      codePaysNaissance: f.codePaysNaissance.trim().toUpperCase(),
      iban: f.iban.replace(/\s/g, "").toUpperCase(),
      bic: f.bic.replace(/\s/g, "").toUpperCase(),
      bulletinDematerialise: !!f.bulletinDemat,
      matricule: f.matricule.trim(),
      // Salarié étranger : titre de séjour (contrôlé côté API aussi)
      ...(etranger ? {
        titreSejourType: titre.type,
        titreSejourNumero: titre.numero.trim().toUpperCase(),
        titreSejourExpiration: titre.expiration,
      } : {}),
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
      setFini({ ref: j.reference || null, idFiche: j.idFiche || null });
    } catch (_) {
      setFini({ demo: true });
    }
  };

  const copierLien = (lien) => { navigator.clipboard?.writeText(lien); setFini((x) => ({ ...x, copie: true })); };

  if (fini) {
    const invitation = fini.invitation; // parcours « invite » : lien créé

    /* Réembauche : le nom vient du dossier repris, pas du formulaire —
       et on ne propose pas d'onboarding, le dossier est déjà complet. */
    if (fini.reprise) {
      return (
        <>
          <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
            <ArrowLeft size={15} /> Retour aux tuiles
          </button>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Check size={24} />
            </div>
            <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Réembauche déclarée</h1>
            <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
              {f.type} pour <strong>{fini.salarie}</strong>, début le <strong>{f.debut.split("-").reverse().join("/")}</strong>.
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
              Le dossier a été repris de son précédent contrat : aucune pièce à redéposer. Votre gestionnaire
              prépare le contrat et la nouvelle DPAE.
            </p>
            {fini.reference && <p style={{ fontSize: 12, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.reference}</p>}
          </div>
        </>
      );
    }

    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", maxWidth: 560, textAlign: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E1F5EE", color: T.ok, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Check size={24} />
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>
            {invitation ? "Salarié invité — contrat en attente" : "Embauche déclarée"}
          </h1>
          <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
            {f.type} pour <strong>{f.nom.trim().toUpperCase()} {f.prenom.trim()}</strong>, début le <strong>{f.debut.split("-").reverse().join("/")}</strong>.
          </p>
          {invitation ? (
            <>
              <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>
                Envoyez ce lien au salarié : il saisit son état civil, ses coordonnées, sa banque et dépose
                ses pièces — <strong>dès qu'il a terminé, la demande de contrat part automatiquement</strong> chez
                votre gestionnaire (contrat + DPAE), sans autre action de votre part.
              </p>
              <BlocLien lien={invitation.lien} expireLe={invitation.expireLe} copie={fini.copie}
                onCopie={() => copierLien(invitation.lien)}
                texte={invitation.deja ? "Un lien d'invitation était déjà actif pour ce salarié" : "Lien d'invitation"} />
              {invitation.reference && <p style={{ fontSize: 12, color: T.mut, fontFamily: "monospace", marginTop: 12 }}>Référence : {invitation.reference}</p>}
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
                Votre gestionnaire prépare le contrat et la DPAE. Un accusé vous est adressé à <strong>{user?.email}</strong>.
              </p>
              {fini.ref && <p style={{ fontSize: 13, color: T.mut, fontFamily: "monospace" }}>Référence : {fini.ref}</p>}
              {fini.idFiche && !fini.lien && (
                <div style={{ marginTop: 14 }}>
                  <Btn onClick={inviterApres} disabled={fini.invEnvoi}>
                    <Send size={13} /> {fini.invEnvoi ? "Génération du lien…" : "Inviter le salarié à compléter son dossier"}
                  </Btn>
                  {fini.invErreur && <p style={{ fontSize: 12, color: T.err, margin: "8px 0 0" }}>✗ {fini.invErreur}</p>}
                  <p style={{ margin: "8px 0 0", fontSize: 11.5, color: T.mut }}>
                    Facultatif — le salarié saisit lui-même état civil, coordonnées et banque via un lien sécurisé.
                  </p>
                </div>
              )}
              {fini.lien && (
                <BlocLien lien={fini.lien} expireLe={fini.expireLe} copie={fini.copie}
                  onCopie={() => copierLien(fini.lien)}
                  texte="Lien d'invitation — envoyez-le au salarié" />
              )}
            </>
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

  /* ── Choix du parcours ─────────────────────────────────────────── */
  if (mode === null) {
    const CarteChoix = ({ titre, sous, detail, onClick }) => (
      <button onClick={onClick} style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%",
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 18px",
        fontFamily: T.sans, marginBottom: 12,
      }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.accent)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{titre}</span>
        <span style={{ display: "block", fontSize: 12.5, color: T.accent, fontWeight: 600, marginBottom: 6 }}>{sous}</span>
        <span style={{ display: "block", fontSize: 12.5, color: T.mut, lineHeight: 1.5 }}>{detail}</span>
      </button>
    );
    return (
      <>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Retour aux tuiles
        </button>
        <h1 style={{ margin: "0 0 4px", fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Déclarer une embauche</h1>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: T.mut }}>Comment souhaitez-vous procéder ?</p>
        <CarteChoix titre="J'ai les informations du salarié" sous="Embauche directe"
          detail="Vous saisissez le dossier et déposez les trois pièces (identité, Vitale, RIB) — le contrat et la DPAE partent immédiatement en préparation."
          onClick={() => setMode("direct")} />
        <CarteChoix titre="Je fais saisir le salarié" sous="Invitation + contrat automatique"
          detail="Vous ne saisissez que le poste et le contrat. Le salarié reçoit un lien sécurisé, remplit lui-même son dossier et dépose ses pièces — dès qu'il a terminé, la demande de contrat part automatiquement chez votre gestionnaire."
          onClick={() => setMode("invite")} />
        {anciens.length > 0 && (
          <CarteChoix titre="Il a déjà travaillé chez nous" sous={`Réembauche — ${anciens.length} ancien${anciens.length > 1 ? "s" : ""} salarié${anciens.length > 1 ? "s" : ""}`}
            detail="Son dossier est déjà là : identité, numéro de sécurité sociale, adresse, banque, pièces justificatives. Vous ne saisissez que le nouveau contrat, et le portail vous signale ce que cette réembauche impose (délai de carence, titre de séjour, période d'essai, visite médicale)."
            onClick={() => setMode("reprise")} />
        )}
      </>
    );
  }

  /* ── Parcours « réembauche » ─────────────────────────────────────── */
  if (mode === "reprise") {
    const COULEUR = { bloquant: { bg: "#FCEBEB", bd: "#F7C1C1", fg: "#791F1F" },
      attention: { bg: "#FEF6E7", bd: "#F6DFB0", fg: "#7A4E00" },
      info: { bg: "#EEF2F8", bd: "#D6DFEC", fg: "#33465E" } };
    const points = controles?.points || [];
    const bloquants = points.filter((p) => p.niveau === "bloquant");

    return (
      <>
        <button onClick={() => { setMode(null); setRepris(null); setControles(null); setDerogation(""); setErr({}); setErrbar(""); }}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Changer de parcours
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <UserPlus size={20} color={T.accent} strokeWidth={1.6} />
            <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Réembaucher</h1>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
            Choisissez la personne : son dossier est repris tel quel. Vous ne saisissez que le nouveau contrat.
          </p>

          {errbar && (
            <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
              {errbar}
            </div>
          )}

          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>
            Ancien salarié <span style={{ color: T.err }}>*</span>
          </label>
          <select value={repris ? String(repris.id || `${repris.nom} ${repris.prenom}`) : ""}
            onChange={(e) => {
              const s = anciens.find((x) => String(x.id || `${x.nom} ${x.prenom}`) === e.target.value) || null;
              setRepris(s); setControles(null); setDerogation("");
              if (s) setF((p) => ({ ...p, poste: p.poste || s.poste || "" }));
            }}
            style={{ ...inputStyle, marginBottom: 14 }}>
            <option value="">— choisir —</option>
            {anciens.map((s) => (
              <option key={s.id || `${s.nom} ${s.prenom}`} value={String(s.id || `${s.nom} ${s.prenom}`)}>
                {s.nom} {s.prenom}{s.poste ? ` — ${s.poste}` : ""}{s.fin ? ` (parti le ${String(s.fin).split("-").reverse().join("/")})` : ""}
              </option>
            ))}
          </select>

          {repris && (
            <>
              <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <ChampReq label="Type de contrat">
                  <select style={inputStyle} value={f.type} onChange={(e) => maj("type", e.target.value)}>
                    <option>CDI</option><option>CDD</option>
                  </select>
                </ChampReq>
                <ChampReq label="Poste" erreur={err.poste && "Poste requis"}>
                  <input type="text" placeholder="Serveur, vendeuse, aide-soignant…" style={{ ...inputStyle, borderColor: err.poste ? T.err : T.border }} value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
                </ChampReq>
                <ChampReq label="Date de début" erreur={err.debut && "Date requise"}>
                  <input type="date" style={{ ...inputStyle, borderColor: err.debut ? T.err : T.border }} value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
                </ChampReq>
                {f.type === "CDD" ? (
                  <ChampReq label="Date de fin (CDD)" erreur={err.fin && "Fin postérieure au début requise"}>
                    <input type="date" style={{ ...inputStyle, borderColor: err.fin ? T.err : T.border }} value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
                  </ChampReq>
                ) : <div />}
                <ChampReq label="Durée mensuelle du travail (heures)" erreur={err.duree && "Ex. 151,67"}>
                  <input type="text" inputMode="decimal" placeholder="151,67" style={{ ...inputStyle, borderColor: err.duree ? T.err : T.border }} value={f.duree} onChange={(e) => maj("duree", e.target.value)} />
                </ChampReq>
              </div>

              {/* Ce que le dossier reprend — dit explicitement, pour que le
                  client sache ce qu'il n'a PAS à ressaisir. */}
              {controles?.repris && (
                <div style={{ background: "#E1F5EE", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#085041", marginTop: 14 }}>
                  Repris du dossier, rien à ressaisir : {[
                    controles.repris.numeroSS && "numéro de sécurité sociale",
                    controles.repris.dateNaissance && "état civil",
                    controles.repris.adressePostale && "adresse",
                    (controles.repris.iban || controles.repris.bic) && "coordonnées bancaires",
                    controles.repris.titreSejourNumero && "titre de séjour",
                  ].filter(Boolean).join(", ")}. Les pièces justificatives sont déjà dans votre espace documents.
                </div>
              )}

              {controles?.erreur && (
                <p style={{ margin: "12px 0 0", fontSize: 12, color: T.err }}>{controles.erreur}</p>
              )}

              {points.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h2 style={{ margin: "0 0 8px", fontSize: 13.5, fontFamily: T.serif, fontWeight: 600 }}>
                    Ce que cette réembauche implique
                  </h2>
                  {points.map((p) => {
                    const c = COULEUR[p.niveau] || COULEUR.info;
                    return (
                      <div key={p.cle} style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: "9px 11px", marginBottom: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: c.fg, marginBottom: 3 }}>{p.titre}</div>
                        <div style={{ fontSize: 12, color: c.fg, lineHeight: 1.5 }}>{p.detail}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Un point bloquant n'interdit pas : il exige de dire
                  pourquoi on passe outre, et ce motif est transmis au
                  gestionnaire avec la demande. */}
              {bloquants.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>
                    Motif permettant de passer outre <span style={{ color: T.err }}>*</span>
                  </label>
                  <select value={derogation} onChange={(e) => { setDerogation(e.target.value); setErrbar(""); }} style={inputStyle}>
                    <option value="">— choisir —</option>
                    {(controles?.exceptionsCarence || []).map((x) => <option key={x} value={x}>{x}</option>)}
                    <option value="Titre de séjour renouvelé (nouveau titre fourni)">Titre de séjour renouvelé (nouveau titre fourni)</option>
                    <option value="Autre situation — précisée à mon gestionnaire">Autre situation — précisée à mon gestionnaire</option>
                  </select>
                  <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.mut }}>
                    Ce motif est transmis à votre gestionnaire avec la demande : il pourra vérifier qu'il s'applique bien à votre situation.
                  </p>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                <Btn onClick={() => { setMode(null); setRepris(null); setControles(null); setDerogation(""); }}>Annuler</Btn>
                <Btn primary disabled={envoi} onClick={envoyerReembauche}>{envoi ? "Envoi…" : "Demander le contrat"}</Btn>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  /* ── Parcours « invitation » : le contrat seul, le salarié fera le reste ── */
  if (mode === "invite") {
    return (
      <>
        <button onClick={() => { setMode(null); setErr({}); setErrbar(""); }} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
          <ArrowLeft size={15} /> Changer de parcours
        </button>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 24px", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Send size={20} color={T.accent} strokeWidth={1.6} />
            <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Embauche par invitation</h1>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: T.mut }}>
            Renseignez le contrat — le salarié saisira lui-même son état civil, ses coordonnées, sa banque
            et déposera ses pièces. À sa soumission, la demande de contrat part automatiquement.
          </p>

          {errbar && (
            <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
              {errbar}
            </div>
          )}

          <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ChampReq label="Type de contrat">
              <select style={inputStyle} value={f.type} onChange={(e) => maj("type", e.target.value)}>
                <option>CDI</option><option>CDD</option>
              </select>
            </ChampReq>
            <ChampReq label="Poste" erreur={err.poste && "Poste requis"}>
              <input type="text" style={{ ...inputStyle, borderColor: err.poste ? T.err : T.border }} value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
            </ChampReq>
            <ChampReq label="Nom" erreur={err.nom && "Nom requis"}>
              <input type="text" style={{ ...inputStyle, borderColor: err.nom ? T.err : T.border }} value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
            </ChampReq>
            <ChampReq label="Prénom" erreur={err.prenom && "Prénom requis"}>
              <input type="text" style={{ ...inputStyle, borderColor: err.prenom ? T.err : T.border }} value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
            </ChampReq>
            <ChampReq label="Date de début" erreur={err.debut && "Date requise"}>
              <input type="date" style={{ ...inputStyle, borderColor: err.debut ? T.err : T.border }} value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
            </ChampReq>
            {f.type === "CDD" ? (
              <ChampReq label="Date de fin (CDD)" erreur={err.fin && "Fin postérieure au début requise"}>
                <input type="date" style={{ ...inputStyle, borderColor: err.fin ? T.err : T.border }} value={f.fin} onChange={(e) => maj("fin", e.target.value)} />
              </ChampReq>
            ) : <div />}
            <ChampReq label="Durée mensuelle du travail (heures)" erreur={err.duree && "Ex. 151,67"}>
              <input type="text" inputMode="decimal" placeholder="151,67" style={{ ...inputStyle, borderColor: err.duree ? T.err : T.border }} value={f.duree} onChange={(e) => maj("duree", e.target.value)} />
            </ChampReq>
            <ChampOpt label="Fin de la période d'essai (facultatif)" erreur={err.finEssai && "Postérieure au début du contrat"}>
              <input type="date" style={{ ...inputStyle, borderColor: err.finEssai ? T.err : T.border }} value={f.finEssai} onChange={(e) => maj("finEssai", e.target.value)} />
            </ChampOpt>
            <ChampOpt label="E-mail du salarié (facultatif)" erreur={err.emailSalarie && "E-mail invalide"} large>
              <input type="email" style={{ ...inputStyle, borderColor: err.emailSalarie ? T.err : T.border }} value={f.emailSalarie} onChange={(e) => maj("emailSalarie", e.target.value)} />
            </ChampOpt>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Btn onClick={() => setMode(null)}>Annuler</Btn>
            <Btn primary disabled={envoi} onClick={envoyerInvitation}>{envoi ? "Création…" : "Créer le lien d'invitation"}</Btn>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <button onClick={() => { setMode(null); setErr({}); setErrbar(""); }} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Changer de parcours
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

          <ChampOpt label="Email personnel du salarié (facultatif)" erreur={err.emailSalarie && "Adresse e-mail invalide."}>
            <input style={err.emailSalarie ? inputInvalid : inputStyle} value={f.emailSalarie} onChange={(e) => maj("emailSalarie", e.target.value)} />
          </ChampOpt>

          <ChampOpt label="Téléphone personnel du salarié (facultatif)" erreur={err.telephone && "Numéro trop court."}>
            <input inputMode="tel" style={err.telephone ? inputInvalid : inputStyle} value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
          </ChampOpt>

          <ChampReq label="Date de début" erreur={err.debut && "Date requise."}>
            <input type="date" style={err.debut ? inputInvalid : inputStyle} value={f.debut} onChange={(e) => maj("debut", e.target.value)} />
          </ChampReq>

          <ChampReq label="Poste de travail" erreur={err.poste && "Champ requis."}>
            <input style={err.poste ? inputInvalid : inputStyle} placeholder="Ex. Agent de service" value={f.poste} onChange={(e) => maj("poste", e.target.value)} />
          </ChampReq>

          <ChampReq label="Durée du travail (heures/mois)" erreur={err.duree && "Nombre d'heures invalide (ex. 151,67)."}>
            <input inputMode="decimal" style={err.duree ? inputInvalid : inputStyle} placeholder="Ex. 151,67" value={f.duree} onChange={(e) => maj("duree", e.target.value)} />
          </ChampReq>

          <ChampOpt label="Fin de la période d'essai (facultatif)" erreur={err.finEssai && "Date postérieure au début requise."}>
            <input type="date" style={err.finEssai ? inputInvalid : inputStyle} value={f.finEssai} onChange={(e) => maj("finEssai", e.target.value)} />
          </ChampOpt>

          {/* ── Pièces jointes OBLIGATOIRES (modèle B) : Osmose transcrit ── */}
          <div style={{ gridColumn: "1 / -1", margin: "10px 0 2px", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.mut, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Pièces du salarié <span style={{ color: T.err }}>*</span>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.mut }}>
              PDF, JPG ou PNG — 10 Mo max par fichier. Déposées dans vos Documents, elles servent à constituer le dossier du salarié.
            </p>
          </div>

          {[["identite", "Pièce d'identité (CNI, passeport, titre de séjour)"], ["vitale", "Carte vitale ou attestation de droits"], ["rib", "RIB"]].map(([k, lib]) => (
            <ChampReq key={k} large label={lib} erreur={err["pj" + k] && "Fichier requis (PDF/JPG/PNG, 10 Mo max)."}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                style={err["pj" + k] ? inputInvalid : inputStyle}
                onChange={(e) => majPj(k, e.target.files && e.target.files[0])} />
            </ChampReq>
          ))}

          {/* ── Salarié étranger : titre de séjour (selon la nationalité) ── */}
          {etranger && (
            <>
              <div style={{ gridColumn: "1 / -1", margin: "10px 0 2px", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.mut, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Salarié étranger — titre de séjour <span style={{ color: T.err }}>*</span>
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: T.mut }}>
                  L'embauche d'un ressortissant hors UE/EEE/Suisse exige un titre autorisant le
                  travail, <strong>authentifié par la préfecture au moins 2 jours ouvrables avant la
                  prise de poste</strong> — Osmose RH engage cette vérification dès réception.
                </p>
              </div>

              <ChampReq label="Type de titre" erreur={err.titretype && "Choisissez le type de titre."}>
                <select style={err.titretype ? inputInvalid : inputStyle} value={titre.type} onChange={(e) => majTitre("type", e.target.value)}>
                  <option value="">—</option>
                  {TITRES_SEJOUR.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </ChampReq>

              <ChampReq label="Numéro du titre (n° étranger / document)" erreur={err.titrenumero && "Numéro du titre requis."}>
                <input style={err.titrenumero ? inputInvalid : inputStyle} placeholder="Ex. 9902345678" value={titre.numero} onChange={(e) => majTitre("numero", e.target.value)} />
              </ChampReq>

              <ChampReq label="Date d'expiration du titre" erreur={err.titreexpiration && "Date requise, postérieure à la date d'embauche."}>
                <input type="date" style={err.titreexpiration ? inputInvalid : inputStyle} value={titre.expiration} onChange={(e) => majTitre("expiration", e.target.value)} />
              </ChampReq>

              <ChampReq large label="Titre de séjour (recto-verso)" erreur={err.pjtitre && "Fichier requis (PDF/JPG/PNG, 10 Mo max)."}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                  style={err.pjtitre ? inputInvalid : inputStyle}
                  onChange={(e) => majPj("titre", e.target.files && e.target.files[0])} />
              </ChampReq>
            </>
          )}

          {/* ── Volet administratif : alimente le dossier du salarié ─── */}
          <div style={{ gridColumn: "1 / -1", margin: "10px 0 2px", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.mut, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Volet administratif — dossier du salarié (facultatif)
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.mut }}>
              Osmose RH complètera le dossier à partir des pièces jointes ci-dessous — remplissez seulement ce que vous connaissez déjà.
            </p>
          </div>

          <ChampOpt label="Sexe">
            <select style={err.sexe ? inputInvalid : inputStyle} value={f.sexe} onChange={(e) => maj("sexe", e.target.value)}>
              <option value="">—</option>
              <option value="Masculin">Masculin</option>
              <option value="Féminin">Féminin</option>
            </select>
          </ChampOpt>

          <ChampOpt label="Situation familiale">
            <select style={err.situationFamiliale ? inputInvalid : inputStyle} value={f.situationFamiliale} onChange={(e) => maj("situationFamiliale", e.target.value)}>
              <option value="">—</option>
              {["Célibataire", "Marié(e)", "Pacsé(e)", "Divorcé(e)", "Séparé(e)", "Veuf(ve)", "Union libre"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </ChampOpt>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Nom marital (facultatif)</label>
            <input style={inputStyle} value={f.nomMarital} onChange={(e) => maj("nomMarital", e.target.value)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: T.mut }}>Matricule (facultatif)</label>
            <input style={inputStyle} value={f.matricule} onChange={(e) => maj("matricule", e.target.value)} />
          </div>

          <ChampOpt label="Département de naissance">
            <input style={err.deptNaissance ? inputInvalid : inputStyle} placeholder="Ex. Var" value={f.deptNaissance} onChange={(e) => maj("deptNaissance", e.target.value)} />
          </ChampOpt>

          <ChampOpt label="Code département" erreur={err.codeDeptNaissance && "Code invalide (ex. 83, 2A, 99)."}>
            <input style={err.codeDeptNaissance ? inputInvalid : inputStyle} placeholder="Ex. 83" value={f.codeDeptNaissance} onChange={(e) => maj("codeDeptNaissance", e.target.value)} />
          </ChampOpt>

          <ChampOpt label="Pays de naissance">
            <input style={err.paysNaissance ? inputInvalid : inputStyle} value={f.paysNaissance} onChange={(e) => maj("paysNaissance", e.target.value)} />
          </ChampOpt>

          <ChampOpt label="Code pays (2 lettres)" erreur={err.codePaysNaissance && "Ex. FR, PT, DZ."}>
            <input style={err.codePaysNaissance ? inputInvalid : inputStyle} placeholder="Ex. FR" value={f.codePaysNaissance} onChange={(e) => maj("codePaysNaissance", e.target.value)} />
          </ChampOpt>

          <ChampOpt label="IBAN" erreur={err.iban && "IBAN invalide."}>
            <input style={err.iban ? inputInvalid : inputStyle} placeholder="Ex. FR76 3000 6000 0112 3456 7890 189" value={f.iban} onChange={(e) => maj("iban", e.target.value)} />
          </ChampOpt>

          <ChampOpt label="BIC" erreur={err.bic && "BIC invalide (8 ou 11 caractères)."}>
            <input style={err.bic ? inputInvalid : inputStyle} placeholder="Ex. AGRIFRPP" value={f.bic} onChange={(e) => maj("bic", e.target.value)} />
          </ChampOpt>

          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" id="bulletinDemat" checked={!!f.bulletinDemat} onChange={(e) => maj("bulletinDemat", e.target.checked)} />
            <label htmlFor="bulletinDemat" style={{ cursor: "pointer" }}>Bulletin de paie dématérialisé</label>
          </div>
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

/* ================================================================
   PROCÉDURES
   Une procédure RH est une horloge. Cet écran la montre : les étapes
   dans l'ordre, la date de chacune, la fenêtre dans laquelle elle doit
   tomber, et ce qu'il ne faut pas manquer. Le portail tient la FORME —
   les délais, l'ordre, les documents. Le fond reste au gestionnaire.
   ================================================================ */
const COULEUR_ETAPE = {
  faite: { bg: "#E1F5EE", bd: "#B7E4D4", fg: "#085041" },
  "hors-delai": { bg: "#FCEBEB", bd: "#F7C1C1", fg: "#791F1F" },
  "a-faire": { bg: "#FEF6E7", bd: "#F6DFB0", fg: "#7A4E00" },
  attente: { bg: "#EEF2F8", bd: "#D6DFEC", fg: "#33465E" },
  "a-venir": { bg: "#FAF9F7", bd: "#E3E0DA", fg: "#6B6560" },
  "sans-objet": { bg: "#FAF9F7", bd: "#E3E0DA", fg: "#9A948E" },
};
const MOT_STATUT = {
  faite: "Faite", "hors-delai": "Délai dépassé", "a-faire": "À faire",
  attente: "Délai en cours", "a-venir": "À venir", "sans-objet": "Sans objet",
};
const frD = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? String(iso).split("-").reverse().join("/") : "");

/* ================================================================
   SAISIE SUR SALAIRE
   Le courrier d'huissier que personne ne sait traiter. L'écran fait
   trois choses : la déclaration (et le gestionnaire prévenu dans la
   minute pour la réponse des 15 jours), le calcul de la quotité
   DÉTAILLÉ tranche par tranche — un patron doit pouvoir vérifier au
   centime —, et la transmission mensuelle en variables de paie.
   ================================================================ */
function SaisieSalaire({ user, salaries, onRetour }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [form, setForm] = useState(null);   // formulaire de déclaration
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  const mois = new Date().toISOString().slice(0, 7);
  const euros = (v) => `${Number(v || 0).toFixed(2).replace(".", ",")} €`;

  const appel = async (corps) => {
    const r = await apiFetch("/api/demande", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saisie", ...corps }),
    });
    return [r, await r.json().catch(() => ({}))];
  };
  const charger = async () => {
    try {
      const [r, j] = await appel({});
      setEtat(r.ok ? j : { erreur: j.erreur || `Lecture refusée (HTTP ${r.status}).` });
    } catch { setEtat({ erreur: "API injoignable — réessayez." }); }
  };
  useEffect(() => { charger(); }, []);

  const declarer = async () => {
    setEnvoi(true); setMsg(null);
    try {
      const [r, j] = await appel({ mode: "declarer", ...form });
      if (!r.ok) setMsg({ erreur: j.erreur || "Déclaration refusée." });
      else {
        setMsg({ ok: `Saisie déclarée — réf. ${j.reference}. Votre gestionnaire vient d'être prévenu : il prépare la réponse au commissaire de justice.` });
        setForm(null); await charger();
      }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const transmettre = async (id) => {
    setEnvoi(true); setMsg(null);
    try {
      const [r, j] = await appel({ mode: "transmettre", id, mois });
      if (!r.ok) setMsg({ erreur: j.erreur || "Transmission refusée." });
      else {
        setMsg({ ok: j.soldee
          ? `Retenue de ${euros(j.retenue)} transmise — la dette est SOLDÉE. Le dossier est terminé.`
          : `Retenue de ${euros(j.retenue)} transmise en variables de paie${j.restantDu != null ? ` — restant dû : ${euros(j.restantDu)}` : ""}.` });
        await charger();
      }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const cloturer = async (id) => {
    setEnvoi(true); setMsg(null);
    try {
      const [r, j] = await appel({ mode: "cloturer", id });
      if (!r.ok) setMsg({ erreur: j.erreur || "Clôture refusée." });
      else { setMsg({ ok: "Dossier clôturé." }); await charger(); }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const champ = { width: "100%", boxSizing: "border-box", padding: "9px 10px", fontSize: 13,
    border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.sans };
  const lab = { display: "block", fontSize: 11.5, color: T.mut, marginBottom: 4, fontWeight: 600 };
  const enCours = (etat.saisies || []).filter((s) => s.statut === "En cours");
  const closes = (etat.saisies || []).filter((s) => s.statut !== "En cours");

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>
      <h1 style={{ margin: "0 0 4px", fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Saisie sur salaire</h1>
      <p style={{ margin: "0 0 6px", fontSize: 12.5, color: T.mut, maxWidth: 760, lineHeight: 1.55 }}>
        Vous avez reçu un procès-verbal de saisie ou une notification de paiement direct pour un de vos
        salariés. Le portail calcule la retenue exacte — ni plus, ni moins —, tient l'échéancier, et
        votre gestionnaire prépare la réponse obligatoire des 15 jours.
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 11.5, color: "#7A4A05", maxWidth: 760, lineHeight: 1.5 }}>
        ⚠ Information strictement confidentielle : elle ne regarde que les personnes qui traitent la
        paie. Ne sanctionnez jamais un salarié en raison d'une saisie — c'est interdit.
      </p>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>✗ {msg.erreur}</div>}
      {etat.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>{etat.erreur}</div>}
      {etat.chargement && <p style={{ fontSize: 13, color: T.mut }}>Chargement…</p>}

      {!etat.chargement && !etat.erreur && (
        <>
          {etat.bareme?.aVerifier && (
            <div style={{ background: "#FAEEDA", color: "#7A4A05", border: "1px solid #EFD9B0", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
              ⚠ Le barème appliqué est celui de {etat.bareme.annee}, faute de millésime plus récent
              enregistré. Les seuils de saisie sont revalorisés chaque année par décret : faites
              confirmer le calcul par votre gestionnaire avant la première retenue.
            </div>
          )}

          {!form ? (
            <div style={{ marginBottom: 16 }}>
              <Btn primary onClick={() => setForm({ cle: "", type: "saisie", montantDette: "", mensualite: "",
                netMensuel: "", personnesACharge: 0, creancier: "", dateReception: new Date().toISOString().slice(0, 10) })}>
                <Plus size={14} /> Déclarer une saisie reçue
              </Btn>
            </div>
          ) : (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>Le procès-verbal reçu</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={lab}>Salarié concerné</label>
                  <select value={form.cle} onChange={(e) => setForm({ ...form, cle: e.target.value })} style={champ}>
                    <option value="">— choisir —</option>
                    {(salaries || []).map((s) => {
                      const cle = `${String(s.nom || "").toUpperCase()} ${String(s.prenom || "").toUpperCase()}`.trim();
                      return <option key={cle} value={cle}>{s.nom} {s.prenom}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label style={lab}>Nature</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={champ}>
                    <option value="saisie">Saisie des rémunérations (dette)</option>
                    <option value="pension">Pension alimentaire (paiement direct)</option>
                  </select>
                </div>
                {form.type === "saisie" ? (
                  <div>
                    <label style={lab}>Montant total de la dette (€)</label>
                    <input type="number" step="0.01" value={form.montantDette} onChange={(e) => setForm({ ...form, montantDette: e.target.value })} style={champ} />
                  </div>
                ) : (
                  <div>
                    <label style={lab}>Mensualité due (€)</label>
                    <input type="number" step="0.01" value={form.mensualite} onChange={(e) => setForm({ ...form, mensualite: e.target.value })} style={champ} />
                  </div>
                )}
                <div>
                  <label style={lab}>Salaire net mensuel du salarié (€)</label>
                  <input type="number" step="0.01" placeholder="Sur le dernier bulletin" value={form.netMensuel} onChange={(e) => setForm({ ...form, netMensuel: e.target.value })} style={champ} />
                </div>
                <div>
                  <label style={lab}>Personnes à charge</label>
                  <input type="number" min="0" value={form.personnesACharge} onChange={(e) => setForm({ ...form, personnesACharge: e.target.value })} style={champ} />
                </div>
                <div>
                  <label style={lab}>Reçu le</label>
                  <input type="date" value={form.dateReception} onChange={(e) => setForm({ ...form, dateReception: e.target.value })} style={champ} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lab}>Commissaire de justice / référence du dossier</label>
                  <input value={form.creancier} onChange={(e) => setForm({ ...form, creancier: e.target.value })} placeholder="SCP …, dossier n° …" style={champ} />
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: T.mut, margin: "0 0 10px", lineHeight: 1.5 }}>
                Les personnes à charge relèvent les seuils du barème : conjoint aux ressources
                faibles, enfants à charge — au sens du décret, votre gestionnaire confirme.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn primary onClick={declarer} disabled={envoi}>{envoi ? "Enregistrement…" : "Déclarer"}</Btn>
                <Btn onClick={() => setForm(null)}>Annuler</Btn>
              </div>
            </div>
          )}

          {enCours.length === 0 && closes.length === 0 && (
            <p style={{ fontSize: 13, color: T.mut }}>Aucune saisie en cours.</p>
          )}

          {enCours.map((s) => (
            <div key={s.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontFamily: T.serif, fontWeight: 600 }}>
                  {s.prenom} {s.nom} — {s.type === "pension" ? "Pension alimentaire (paiement direct)" : "Saisie des rémunérations"}
                </h2>
                <span style={{ fontSize: 11.5, color: T.mut }}>{s.reference}{s.creancier ? ` · ${s.creancier}` : ""}</span>
              </div>

              {/* L'horloge des 15 jours d'abord : c'est elle qui presse. */}
              <div style={{ background: s.obligations.reponse.enRetard ? "#FCEBEB" : "#FFF7ED",
                border: `1px solid ${s.obligations.reponse.enRetard ? "#F7C1C1" : "#FDBA74"}`,
                borderRadius: 10, padding: "10px 12px", margin: "10px 0", fontSize: 12.5,
                color: s.obligations.reponse.enRetard ? "#791F1F" : "#7C2D12", lineHeight: 1.5 }}>
                {s.obligations.reponse.texte}
              </div>

              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 0" }}>
                <div>
                  <div style={{ fontSize: 11.5, color: T.mut }}>Retenue de {mois.split("-").reverse().join("/")}</div>
                  <div style={{ fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>{euros(s.calcul.retenueDuMois)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: T.mut }}>Reste au salarié</div>
                  <div style={{ fontSize: 24, fontFamily: T.serif, fontWeight: 600, color: T.accent }}>{euros(s.calcul.resteAuSalarie)}</div>
                </div>
                {s.type === "saisie" && s.calcul.echeancier && (
                  <div>
                    <div style={{ fontSize: 11.5, color: T.mut }}>Restant dû → extinction</div>
                    <div style={{ fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>
                      {euros(s.calcul.restantDu)} <span style={{ fontSize: 13, color: T.mut, fontWeight: 400 }}>en ~{s.calcul.echeancier.mois} mois</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Le détail par tranches : vérifiable au centime. */}
              {s.type === "saisie" && (
                <details style={{ marginBottom: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: T.accent, fontWeight: 600 }}>
                    Voir le calcul, tranche par tranche (barème {s.calcul.baremeAnnee})
                  </summary>
                  <table style={{ borderCollapse: "collapse", fontSize: 12, marginTop: 8, minWidth: 380 }}>
                    <thead>
                      <tr>
                        {["Tranche mensuelle", "Fraction", "Assiette", "Part saisie"].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "5px 10px 5px 0", color: T.mut, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.calcul.detail.map((t, i) => (
                        <tr key={i}>
                          <td style={{ padding: "5px 10px 5px 0", borderBottom: `1px solid ${T.border}` }}>
                            {euros(t.de)} {t.a != null ? `→ ${euros(t.a)}` : "et au-delà"}
                          </td>
                          <td style={{ padding: "5px 10px 5px 0", borderBottom: `1px solid ${T.border}` }}>{t.fraction}</td>
                          <td style={{ padding: "5px 10px 5px 0", borderBottom: `1px solid ${T.border}` }}>{euros(t.assiette)}</td>
                          <td style={{ padding: "5px 10px 5px 0", borderBottom: `1px solid ${T.border}`, fontWeight: 600 }}>{euros(t.part)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11.5, color: T.mut, margin: "8px 0 0", lineHeight: 1.5 }}>
                    Net retenu pour le calcul : {euros(s.calcul.netMensuel)}
                    {s.calcul.personnesACharge > 0 && ` · seuils majorés pour ${s.calcul.personnesACharge} personne${s.calcul.personnesACharge > 1 ? "s" : ""} à charge`}.
                    Quoi qu'il arrive, {euros(s.calcul.rsaMensuel)} restent au salarié (montant du RSA).
                    {s.calcul.plafonneParRsa && " Ce plancher plafonne la retenue ce mois-ci."}
                  </p>
                </details>
              )}
              {s.type === "pension" && s.calcul.insuffisant && (
                <p style={{ fontSize: 12, color: "#7A4A05", margin: "0 0 10px", lineHeight: 1.5 }}>
                  ⚠ Le salaire ne couvre pas toute la mensualité : seul {euros(s.calcul.retenue)} peut
                  être prélevé (le RSA reste au salarié). Signalez-le au commissaire de justice.
                </p>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Btn primary disabled={envoi || s.dernierMoisTransmis === mois} onClick={() => transmettre(s.id)}>
                  {s.dernierMoisTransmis === mois
                    ? `Retenue de ${mois.split("-").reverse().join("/")} déjà transmise`
                    : envoi ? "Envoi…" : `Transmettre la retenue de ${mois.split("-").reverse().join("/")}`}
                </Btn>
                <Btn disabled={envoi} onClick={() => cloturer(s.id)}>Clore (mainlevée, départ…)</Btn>
              </div>
              {s.dejaRetenu > 0 && s.type === "saisie" && (
                <p style={{ fontSize: 11.5, color: T.mut, margin: "8px 0 0" }}>
                  Déjà retenu : {euros(s.dejaRetenu)} sur {euros(s.montantDette)}.
                </p>
              )}
            </div>
          ))}

          {closes.length > 0 && (
            <details style={{ marginBottom: 20 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: T.mut }}>
                Dossiers terminés ({closes.length})
              </summary>
              {closes.map((s) => (
                <p key={s.id} style={{ fontSize: 12.5, color: T.mut, margin: "8px 0" }}>
                  {s.prenom} {s.nom} — {s.type === "pension" ? "pension alimentaire" : "saisie"} · {s.statut}
                  {s.type === "saisie" && ` · ${euros(s.dejaRetenu)} retenus`} · {s.reference}
                </p>
              ))}
            </details>
          )}
        </>
      )}
    </>
  );
}

/* ================================================================
   NOTES DE FRAIS
   L'écran de celui qui paie. Il n'a qu'une question : qu'est-ce que je
   rembourse, et qu'est-ce que ça me coûte vraiment ? Les deux colonnes
   « Remboursé » et « En salaire » répondent à la seconde — c'est là que
   se joue la différence entre une note de frais et un redressement.
   ================================================================ */
function NotesDeFrais({ user, salaries, onRetour }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [choix, setChoix] = useState([]);        // ids sélectionnés
  const [apercu, setApercu] = useState(null);
  const [saisie, setSaisie] = useState(null);    // formulaire employeur
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  const mois = new Date().toISOString().slice(0, 7);

  const appel = async (corps) => {
    const r = await apiFetch("/api/demande", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "frais", ...corps }),
    });
    return [r, await r.json().catch(() => ({}))];
  };

  const charger = async () => {
    try {
      const [r, j] = await appel({});
      setEtat(r.ok ? j : { erreur: j.erreur || `Lecture refusée (HTTP ${r.status}).` });
      setChoix([]);
    } catch { setEtat({ erreur: "API injoignable — réessayez." }); }
  };
  useEffect(() => { charger(); }, []);

  const statuer = async (statut) => {
    if (!choix.length) { setMsg({ erreur: "Sélectionnez au moins une note." }); return; }
    setEnvoi(true); setMsg(null);
    try {
      const [r, j] = await appel({ mode: "statuer", statut, ids: choix });
      if (!r.ok) setMsg({ erreur: j.erreur || "Décision refusée." });
      else {
        setMsg({ ok: `${j.traitees} note${j.traitees > 1 ? "s" : ""} ${statut === "Validée" ? "validée" : "refusée"}${j.traitees > 1 ? "s" : ""}.`,
          refusees: j.refusees || [] });
        setApercu(null);
        await charger();
      }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const preparer = async (mode) => {
    setEnvoi(true); setMsg(null);
    try {
      const [r, j] = await appel({ mode, mois });
      if (!r.ok) setMsg({ erreur: j.erreur || "Préparation impossible." });
      else if (mode === "apercu") setApercu(j);
      else { setApercu(null); setMsg({ ok: `${j.lignes} ligne${j.lignes > 1 ? "s" : ""} transmise${j.lignes > 1 ? "s" : ""} à votre gestionnaire.` }); await charger(); }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const enregistrerSaisie = async () => {
    setEnvoi(true); setMsg(null);
    try {
      const [r, j] = await appel({ mode: "saisir", ...saisie });
      if (!r.ok) setMsg({ erreur: j.erreur || "Enregistrement refusé." });
      else { setSaisie(null); await charger(); }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const notes = etat.notes || [];
  const enAttente = notes.filter((n) => n.statut === "Nouvelle");
  const validees = notes.filter((n) => n.statut === "Validée");
  const closes = notes.filter((n) => n.statut === "Refusée" || n.statut === "En paie");
  const euros = (v) => `${Number(v || 0).toFixed(2).replace(".", ",")} €`;
  const basculer = (id) => setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const cat = (cle) => (etat.categories || []).find((c) => c.cle === cle)?.libelle || cle;

  const th = { textAlign: "left", padding: "7px 8px", fontSize: 11.5, color: T.mut, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
  const td = { padding: "7px 8px", fontSize: 12.5, borderBottom: `1px solid ${T.border}`, verticalAlign: "top" };
  const champ = { width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13,
    border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.sans, marginBottom: 8 };

  const tableau = (liste, avecCases) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 14, overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
        <thead>
          <tr>
            {avecCases && <th style={{ ...th, width: 28 }}></th>}
            <th style={th}>Salarié</th>
            <th style={th}>Date</th>
            <th style={th}>Nature</th>
            <th style={th}>Demandé</th>
            <th style={th}>Remboursé</th>
            <th style={th}>En salaire</th>
            <th style={th}>Points de vigilance</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((n) => (
            <tr key={n.id} style={{ background: avecCases && choix.includes(n.id) ? "#F1F7F5" : "transparent" }}>
              {avecCases && (
                <td style={td}>
                  <input type="checkbox" checked={choix.includes(n.id)} onChange={() => basculer(n.id)} />
                </td>
              )}
              <td style={td}>{n.prenom} {n.nom}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{(n.date || "").split("-").reverse().join("/")}</td>
              <td style={td}>
                {cat(n.categorie)}
                {n.commercant && <span style={{ display: "block", color: T.mut, fontSize: 11.5 }}>{n.commercant}</span>}
                {n.categorie === "km" && <span style={{ display: "block", color: T.mut, fontSize: 11.5 }}>{n.km} km · {n.qualification.detail?.puissance} CV</span>}
                {n.justificatif && <span style={{ display: "block", color: T.mut, fontSize: 11 }}>📎 {n.justificatif}</span>}
              </td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{euros(n.qualification.demande)}</td>
              <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600 }}>{euros(n.qualification.exonere)}</td>
              <td style={{ ...td, whiteSpace: "nowrap", color: n.qualification.reintegre > 0 ? "#B45309" : T.mut }}>
                {n.qualification.reintegre > 0 ? euros(n.qualification.reintegre) : "—"}
              </td>
              <td style={{ ...td, maxWidth: 320 }}>
                {(n.points || []).length === 0 && <span style={{ color: T.mut }}>—</span>}
                {(n.points || []).map((p, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.45, marginBottom: 2,
                    color: p.niveau === "bloquant" ? "#791F1F" : p.niveau === "vigilance" ? "#7A4A05" : T.mut }}>
                    {p.niveau === "bloquant" ? "✗ " : p.niveau === "vigilance" ? "⚠ " : "· "}{p.texte}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>
      <h1 style={{ margin: "0 0 4px", fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Notes de frais</h1>
      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: T.mut, maxWidth: 760, lineHeight: 1.55 }}>
        Le salarié photographie son ticket, le portail le lit et le qualifie. Ce qui reste sous le
        plafond d'exonération part en remboursement net ; ce qui le dépasse est du salaire, et part en
        brut soumis. Les deux colonnes sont séparées ici comme elles le seront sur le bulletin.
      </p>

      {msg?.ok && (
        <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>
          ✓ {msg.ok}
          {(msg.refusees || []).map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "#7A4A05", marginTop: 4 }}>Non validée ({r.reference || r.id}) : {r.motif}</div>
          ))}
        </div>
      )}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>✗ {msg.erreur}</div>}
      {etat.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>{etat.erreur}</div>}
      {etat.chargement && <p style={{ fontSize: 13, color: T.mut }}>Chargement…</p>}

      {!etat.chargement && !etat.erreur && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Kpi label="En attente de validation" val={etat.resume?.enAttente ?? 0} icon={Receipt} />
            <Kpi label="Incomplètes" val={etat.resume?.bloquees ?? 0} warn={(etat.resume?.bloquees ?? 0) > 0} icon={AlertCircle} />
            <Kpi label="À rembourser (validé)" val={euros(etat.resume?.aRembourser)} icon={Banknote} />
            <Kpi label="Dont à passer en salaire" val={euros(etat.resume?.aReintegrer)} warn={(etat.resume?.aReintegrer ?? 0) > 0} icon={AlertCircle} />
          </div>

          {etat.bareme?.aVerifier && (
            <div style={{ background: "#FAEEDA", color: "#7A4A05", border: "1px solid #EFD9B0", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
              ⚠ Les plafonds d'exonération appliqués sont ceux du barème {etat.bareme.annee}, faute de
              millésime plus récent enregistré. Les montants restent justes pour les frais de cette
              année-là ; pour l'année en cours, faites confirmer les plafonds par votre gestionnaire
              avant de transmettre en paie.
            </div>
          )}

          {/* Le lien public : c'est lui qui fait disparaître l'enveloppe. */}
          {etat.lien?.actif && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>Le lien à envoyer à votre équipe</h2>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: T.mut, lineHeight: 1.5 }}>
                Un SMS, un QR code affiché au vestiaire : vos salariés photographient leur ticket et la
                note arrive ici. Aucun compte, aucune application. Rien n'est remboursé sans votre
                validation, note par note.
              </p>
              <code style={{ display: "block", background: "#FAF9F7", border: `1px solid ${T.border}`, borderRadius: 8,
                padding: "8px 10px", fontSize: 11.5, wordBreak: "break-all" }}>
                {`${window.location.origin}/?frais=${etat.lien.jeton}`}
              </code>
            </div>
          )}

          {/* Saisie par l'employeur : tout le monde n'a pas de smartphone. */}
          <div style={{ marginBottom: 14 }}>
            {!saisie ? (
              <Btn onClick={() => setSaisie({ cle: "", categorie: "", date: new Date().toISOString().slice(0, 10), montant: "", quantite: 1, km: "", cv: "", commercant: "", motif: "" })}>
                <Plus size={14} /> Saisir une note pour un salarié
              </Btn>
            ) : (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
                <h2 style={{ margin: "0 0 10px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>Nouvelle note</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: T.mut }}>Salarié</label>
                    <select value={saisie.cle} onChange={(e) => setSaisie({ ...saisie, cle: e.target.value })} style={champ}>
                      <option value="">— choisir —</option>
                      {(salaries || []).map((s) => {
                        const cle = `${String(s.nom || "").toUpperCase()} ${String(s.prenom || "").toUpperCase()}`.trim();
                        return <option key={cle} value={cle}>{s.nom} {s.prenom}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: T.mut }}>Nature</label>
                    <select value={saisie.categorie} onChange={(e) => setSaisie({ ...saisie, categorie: e.target.value })} style={champ}>
                      <option value="">— choisir —</option>
                      {(etat.categories || []).map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: T.mut }}>Date</label>
                    <input type="date" value={saisie.date} onChange={(e) => setSaisie({ ...saisie, date: e.target.value })} style={champ} />
                  </div>
                  {saisie.categorie === "km" ? (
                    <>
                      <div>
                        <label style={{ fontSize: 11.5, color: T.mut }}>Kilomètres</label>
                        <input type="number" value={saisie.km} onChange={(e) => setSaisie({ ...saisie, km: e.target.value })} style={champ} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, color: T.mut }}>Puissance (CV)</label>
                        <input type="number" value={saisie.cv} onChange={(e) => setSaisie({ ...saisie, cv: e.target.value })} style={champ} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, color: T.mut }}>Objet du déplacement</label>
                        <input value={saisie.motif} onChange={(e) => setSaisie({ ...saisie, motif: e.target.value })} style={champ} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ fontSize: 11.5, color: T.mut }}>Montant (€)</label>
                        <input type="number" step="0.01" value={saisie.montant} onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })} style={champ} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, color: T.mut }}>Commerçant</label>
                        <input value={saisie.commercant} onChange={(e) => setSaisie({ ...saisie, commercant: e.target.value })} style={champ} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, color: T.mut }}>Nombre d'unités</label>
                        <input type="number" min="1" value={saisie.quantite} onChange={(e) => setSaisie({ ...saisie, quantite: e.target.value })} style={champ} />
                      </div>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 11.5, color: T.mut, margin: "0 0 10px", lineHeight: 1.5 }}>
                  Le justificatif se joint depuis l'onglet Documents, ou par le lien salarié.
                  Sans pièce, un frais au réel restera bloqué à la validation.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn primary onClick={enregistrerSaisie} disabled={envoi}>{envoi ? "Enregistrement…" : "Enregistrer"}</Btn>
                  <Btn onClick={() => setSaisie(null)}>Annuler</Btn>
                </div>
              </div>
            )}
          </div>

          {/* En attente : le geste du mois. */}
          <h2 style={{ margin: "0 0 8px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>
            En attente de validation {enAttente.length > 0 && `(${enAttente.length})`}
          </h2>
          {enAttente.length === 0
            ? <p style={{ fontSize: 13, color: T.mut, marginBottom: 16 }}>Aucune note en attente.</p>
            : (
              <>
                {tableau(enAttente, true)}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <Btn onClick={() => setChoix(enAttente.filter((n) => n.validable).map((n) => n.id))}>
                    Tout sélectionner (validables)
                  </Btn>
                  <Btn primary disabled={envoi || !choix.length} onClick={() => statuer("Validée")}>
                    {envoi ? "…" : `Valider ${choix.length || ""}`.trim()}
                  </Btn>
                  <Btn disabled={envoi || !choix.length} onClick={() => statuer("Refusée")}>Refuser la sélection</Btn>
                </div>
                <p style={{ fontSize: 11.5, color: T.mut, marginBottom: 18, lineHeight: 1.5 }}>
                  Une note marquée ✗ ne peut pas être validée en l'état : il lui manque un justificatif,
                  une date ou une qualification. Elle peut en revanche toujours être refusée.
                </p>
              </>
            )}

          {/* Validées : prêtes pour la paie. */}
          {validees.length > 0 && (
            <>
              <h2 style={{ margin: "0 0 8px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>Validées, à transmettre ({validees.length})</h2>
              {tableau(validees, false)}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Btn onClick={() => preparer("apercu")} disabled={envoi}>
                  Voir le récapitulatif de {mois.split("-").reverse().join("/")}
                </Btn>
                {apercu && (
                  <Btn primary disabled={envoi} onClick={() => preparer("variables")}>
                    {envoi ? "Envoi…" : "Transmettre à mon gestionnaire"}
                  </Btn>
                )}
              </div>
            </>
          )}

          {apercu && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 16, overflowX: "auto" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>
                Ce qui partira en paie pour {apercu.mois.split("-").reverse().join("/")}
              </h2>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%", minWidth: 560 }}>
                <thead>
                  <tr><th style={th}>Salarié</th><th style={th}>Frais remboursés (net)</th><th style={th}>Réintégré en brut</th><th style={th}>Détail</th></tr>
                </thead>
                <tbody>
                  {apercu.lignes.map((l, i) => (
                    <tr key={i}>
                      <td style={td}>{l.nom} {l.prenom}</td>
                      <td style={td}>{euros(l.fraisPro)}</td>
                      <td style={{ ...td, color: l.primeMontant ? "#B45309" : T.mut }}>
                        {l.primeMontant ? `${euros(l.primeMontant)} — ${l.primeLibelle}` : "—"}
                      </td>
                      <td style={{ ...td, color: T.mut, fontSize: 11.5 }}>{l.commentaire}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11.5, color: T.mut, margin: "10px 0 0", lineHeight: 1.5 }}>
                Après transmission, ces notes passent au statut « En paie » et n'apparaîtront plus dans
                les listes à traiter.
              </p>
            </div>
          )}

          {closes.length > 0 && (
            <details style={{ marginBottom: 20 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: T.mut, marginBottom: 8 }}>
                Historique — refusées et déjà en paie ({closes.length})
              </summary>
              {tableau(closes, false)}
            </details>
          )}
        </>
      )}
    </>
  );
}

function Procedures({ user, salaries, onRetour }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [ouverte, setOuverte] = useState(null);   // procédure dépliée
  const [nouvelle, setNouvelle] = useState(null); // { type }
  const [form, setForm] = useState({ salarie: "", depart: "" });
  const [doc, setDoc] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);

  const charger = async () => {
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "procedure" }),
      });
      const j = await r.json().catch(() => ({}));
      setEtat(r.ok ? j : { erreur: j.erreur || `Lecture refusée (HTTP ${r.status}).` });
    } catch { setEtat({ erreur: "API injoignable — réessayez." }); }
  };
  useEffect(() => { charger(); }, []);

  // La date qui arme l'horloge dépend de la procédure : les faits connus
  // pour une sanction, l'avis du médecin pour une inaptitude.
  const DEPART = {
    "sanction-disciplinaire": { cle: "faits", label: "Date à laquelle vous avez eu connaissance des faits",
      aide: "Deux mois pour engager les poursuites à compter de cette date (L.1332-4)." },
    "inaptitude": { cle: "avis", label: "Date de l'examen médical (avis d'inaptitude)",
      aide: "Un mois pour reclasser ou licencier, sinon le salaire doit être repris (L.1226-4)." },
    "licenciement-personnel": { cle: "", label: "", aide: "" },
    "rupture-conventionnelle": { cle: "", label: "", aide: "" },
  };

  const ouvrir = async () => {
    const d = DEPART[nouvelle.type] || {};
    if (!form.salarie.trim()) { setMsg({ erreur: "Choisissez le salarié concerné." }); return; }
    if (d.cle && !form.depart) { setMsg({ erreur: "Cette date est indispensable : elle déclenche le délai." }); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "procedure", mode: "ouvrir", type: nouvelle.type,
          nom: form.salarie.trim(), ...(d.cle && form.depart ? { faites: { [d.cle]: form.depart } } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ erreur: j.erreur || `Refusé (HTTP ${r.status}).` });
      else { setNouvelle(null); setForm({ salarie: "", depart: "" }); await charger(); }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const majEtape = async (id, etape, valeur) => {
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "procedure", mode: "etape", id, etape, valeur }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ erreur: j.erreur || "Enregistrement refusé." });
      else await charger();
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
  };

  const voirDocument = async (id, etape) => {
    setDoc({ chargement: true });
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "procedure", mode: "document", id, etape }),
      });
      const j = await r.json().catch(() => ({}));
      setDoc(r.ok ? j : { erreur: j.erreur || "Document indisponible." });
    } catch { setDoc({ erreur: "API injoignable." }); }
  };

  const enCours = (etat.procedures || []).filter((p) => p.statut === "En cours");
  const closes = (etat.procedures || []).filter((p) => p.statut !== "En cours");

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>
      <h1 style={{ margin: "0 0 4px", fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Procédures</h1>
      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: T.mut, maxWidth: 720, lineHeight: 1.55 }}>
        Le portail tient les délais, l'ordre des étapes et les documents obligatoires — la forme, là où
        les erreurs coûtent le plus cher. Le fond, lui, relève de votre gestionnaire : la cause réelle et
        sérieuse, la proportionnalité d'une sanction, le sérieux d'une recherche de reclassement ne se
        calculent pas.
      </p>

      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>✗ {msg.erreur}</div>}
      {etat.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>{etat.erreur}</div>}
      {etat.chargement && <p style={{ fontSize: 13, color: T.mut }}>Chargement…</p>}

      {!etat.chargement && !etat.erreur && (
        <>
          {/* Ouvrir une procédure */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))", gap: 10, marginBottom: 20 }}>
            {(etat.catalogue || []).map((c) => (
              <button key={c.cle} onClick={() => { setNouvelle({ type: c.cle }); setForm({ salarie: "", depart: "" }); setMsg(null); }}
                style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", background: T.card,
                  border: `1px solid ${T.border}`, borderRadius: 10, padding: "13px 14px", fontFamily: T.sans }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{c.libelle}</span>
                <span style={{ display: "block", fontSize: 11.5, color: T.mut, lineHeight: 1.45 }}>{c.resume}</span>
              </button>
            ))}
          </div>

          {enCours.length === 0 && closes.length === 0 && (
            <p style={{ fontSize: 13, color: T.mut }}>Aucune procédure ouverte. Choisissez-en une ci-dessus pour commencer.</p>
          )}

          {[["En cours", enCours], ["Terminées et abandonnées", closes]].map(([titre, liste]) => liste.length > 0 && (
            <div key={titre} style={{ marginBottom: 18 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>{titre}</h2>
              {liste.map((p) => {
                const deplie = ouverte === p.id;
                const grave = (p.alertes || [])[0];
                return (
                  <div key={p.id} style={{ background: T.card, border: `1px solid ${grave?.niveau === "depasse" ? "#F7C1C1" : T.border}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                    <button onClick={() => { setOuverte(deplie ? null : p.id); setDoc(null); }}
                      style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%", padding: "12px 14px", fontFamily: T.sans }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{p.nom} {p.prenom}</span>
                        <span style={{ fontSize: 12.5, color: T.mut }}>{p.libelle}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: T.mut }}>{deplie ? "▾" : "▸"}</span>
                      </div>
                      {grave && (
                        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5,
                          color: grave.niveau === "depasse" ? "#791F1F" : grave.niveau === "urgent" ? "#7A4E00" : T.mut }}>
                          <strong>{grave.titre}</strong> — {grave.detail}
                        </div>
                      )}
                      {!grave && p.echeance && (
                        <div style={{ marginTop: 6, fontSize: 12, color: T.mut }}>Prochaine limite : {frD(p.echeance)}</div>
                      )}
                    </button>

                    {deplie && (
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 14px" }}>
                        {p.etapes.map((e) => {
                          const c = COULEUR_ETAPE[e.statut] || COULEUR_ETAPE["a-venir"];
                          return (
                            <div key={e.cle} style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: c.fg }}>{e.libelle}</span>
                                {e.obligatoire && <span style={{ fontSize: 10.5, color: c.fg, opacity: 0.75 }}>obligatoire</span>}
                                <span style={{ marginLeft: "auto", fontSize: 11.5, color: c.fg, fontWeight: 600 }}>{MOT_STATUT[e.statut]}</span>
                              </div>

                              <div style={{ fontSize: 11.5, color: c.fg, marginBottom: 6 }}>
                                {e.auPlusTot && !e.date && <>Au plus tôt le <strong>{frD(e.auPlusTot)}</strong>. </>}
                                {e.auPlusTard && !e.date && <>Au plus tard le <strong>{frD(e.auPlusTard)}</strong>. </>}
                                {e.date && <>Réalisée le <strong>{frD(e.date)}</strong>. </>}
                              </div>

                              {e.irregularites.map((i, n) => (
                                <div key={n} style={{ fontSize: 11.5, color: "#791F1F", background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>⚠ {i}</div>
                              ))}

                              {e.aide && <div style={{ fontSize: 11.5, color: c.fg, opacity: 0.9, lineHeight: 1.5, marginBottom: 8 }}>{e.aide}</div>}

                              {p.statut === "En cours" && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                  <input type="date" value={e.date || ""} onChange={(ev) => majEtape(p.id, e.cle, ev.target.value)}
                                    style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12.5 }} />
                                  {e.date && <Btn small onClick={() => majEtape(p.id, e.cle, "")}>Effacer</Btn>}
                                  {!e.obligatoire && e.statut !== "sans-objet" && !e.date && (
                                    <Btn small onClick={() => majEtape(p.id, e.cle, "sans-objet")}>Sans objet</Btn>
                                  )}
                                  {e.statut === "sans-objet" && <Btn small onClick={() => majEtape(p.id, e.cle, "")}>Rétablir</Btn>}
                                  {e.document && <Btn small onClick={() => voirDocument(p.id, e.cle)}>Voir la trame du courrier</Btn>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <p style={{ fontSize: 11.5, color: T.mut, margin: "4px 2px 0", lineHeight: 1.5 }}>
                          Les délais affichés sont ceux de la loi. Votre convention collective peut les allonger
                          ou ajouter des étapes — vérifiez ce point avec votre gestionnaire.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {/* Ouverture d'une procédure */}
      {nouvelle && (
        <div onClick={() => setNouvelle(null)} style={{ position: "fixed", inset: 0, background: "rgba(29,27,24,.34)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: 12, padding: "22px 24px", width: "100%", maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 17, fontFamily: T.serif, fontWeight: 600 }}>
              {(etat.catalogue || []).find((c) => c.cle === nouvelle.type)?.libelle}
            </h2>
            <ChampReq label="Salarié concerné">
              <input list="osrh-salaries-proc" type="text" style={inputStyle} value={form.salarie}
                onChange={(e) => setForm({ ...form, salarie: e.target.value })} placeholder="NOM Prénom" />
              <datalist id="osrh-salaries-proc">
                {(salaries || []).filter((s) => s.statut !== "Sorti").map((s) => (
                  <option key={s.cle || `${s.nom} ${s.prenom}`} value={`${s.nom} ${s.prenom}`} />
                ))}
              </datalist>
            </ChampReq>
            {DEPART[nouvelle.type]?.cle && (
              <div style={{ marginTop: 12 }}>
                <ChampReq label={DEPART[nouvelle.type].label}>
                  <input type="date" style={inputStyle} value={form.depart} onChange={(e) => setForm({ ...form, depart: e.target.value })} />
                </ChampReq>
                <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.mut, lineHeight: 1.5 }}>{DEPART[nouvelle.type].aide}</p>
              </div>
            )}
            {msg?.erreur && <p style={{ margin: "10px 0 0", fontSize: 12, color: T.err }}>{msg.erreur}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Btn onClick={() => setNouvelle(null)}>Annuler</Btn>
              <Btn primary disabled={envoi} onClick={ouvrir}>{envoi ? "Ouverture…" : "Ouvrir la procédure"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Trame de courrier */}
      {doc && (
        <div onClick={() => setDoc(null)} style={{ position: "fixed", inset: 0, background: "rgba(29,27,24,.34)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: 12, padding: "20px 22px", width: "100%", maxWidth: 640, maxHeight: "86vh", overflowY: "auto" }}>
            {doc.chargement && <p style={{ fontSize: 13, color: T.mut }}>Préparation…</p>}
            {doc.erreur && <p style={{ fontSize: 13, color: T.err }}>{doc.erreur}</p>}
            {doc.corps && (
              <>
                <h2 style={{ margin: "0 0 4px", fontSize: 16, fontFamily: T.serif, fontWeight: 600 }}>{doc.objet}</h2>
                <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.mut, lineHeight: 1.5 }}>
                  Trame pré-remplie de votre dossier. <strong>À relire et à adapter</strong> : les passages entre
                  crochets attendent votre rédaction, et un courrier envoyé sans être lu est un risque, pas un gain de temps.
                </p>
                <pre style={{ background: "#FAF9F7", border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px",
                  fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: T.sans, margin: 0 }}>{doc.corps}</pre>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                  <Btn onClick={() => setDoc(null)}>Fermer</Btn>
                  <Btn primary onClick={() => { navigator.clipboard?.writeText(doc.corps); setDoc({ ...doc, copie: true }); }}>
                    {doc.copie ? "Copié" : "Copier le texte"}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================
   PLANNING D'ÉQUIPE
   Le planning que le client fait déjà — sur un cahier, un tableau, un
   tableur — mais qui produit les heures de la paie au lieu d'être
   recompté à la main. Et qui dit, à la saisie, ce qu'une semaine a
   d'illégal : c'est le seul moment où corriger coûte encore un simple
   déplacement de créneau.
   ================================================================ */
const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

function PlanningEquipe({ user, onRetour }) {
  const lundiCourant = () => {
    const d = new Date();
    const decalage = (d.getDay() + 6) % 7;
    return new Date(d.getTime() - decalage * 86400000).toISOString().slice(0, 10);
  };
  const [lundi, setLundi] = useState(lundiCourant());
  const [etat, setEtat] = useState({ chargement: true });
  const [saisie, setSaisie] = useState(null);   // { cle, nom, prenom, jour }
  const [form, setForm] = useState({ debut: "09:00", fin: "17:00", pause: 0 });
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  const [apercu, setApercu] = useState(null);

  const jours = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(lundi) + i * 86400000).toISOString().slice(0, 10));
  const dimanche = jours[6];

  const charger = async () => {
    setEtat({ chargement: true });
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "planning", depuis: lundi, jusqu: dimanche }),
      });
      const j = await r.json().catch(() => ({}));
      setEtat(r.ok ? j : { erreur: j.erreur || `Lecture refusée (HTTP ${r.status}).` });
    } catch { setEtat({ erreur: "API injoignable — réessayez." }); }
  };
  useEffect(() => { charger(); }, [lundi]);

  const enregistrer = async () => {
    if (!saisie) return;
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "planning", mode: "poser", creneaux: [{
          nom: saisie.nom, prenom: saisie.prenom, jour: saisie.jour,
          debut: form.debut, fin: form.fin, pause: Number(form.pause) || 0,
        }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ erreur: j.erreur || `Enregistrement refusé (HTTP ${r.status}).` });
      else { setSaisie(null); await charger(); }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const supprimer = async (id) => {
    try {
      await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "planning", mode: "supprimer", id }),
      });
      await charger();
    } catch { setMsg({ erreur: "Suppression impossible." }); }
  };

  const preparerVariables = async (mode) => {
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "planning", mode, mois: lundi.slice(0, 7) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ erreur: j.erreur || `Refusé (HTTP ${r.status}).` });
      else if (mode === "apercu") setApercu(j);
      else { setApercu(null); setMsg({ ok: `${j.lignes} ligne${j.lignes > 1 ? "s" : ""} transmise${j.lignes > 1 ? "s" : ""} pour ${j.mois}.` }); }
    } catch { setMsg({ erreur: "API injoignable — réessayez." }); }
    setEnvoi(false);
  };

  const frCourt = (iso) => `${JOURS_COURTS[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const cell = { border: `1px solid ${T.border}`, padding: "6px 5px", verticalAlign: "top", minWidth: 92 };

  return (
    <>
      <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.mut, marginBottom: 16, fontFamily: T.sans }}>
        <ArrowLeft size={15} /> Retour aux tuiles
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontFamily: T.serif, fontWeight: 600 }}>Planning d'équipe</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <Btn onClick={() => setLundi(new Date(Date.parse(lundi) - 7 * 86400000).toISOString().slice(0, 10))}>← Semaine précédente</Btn>
          <span style={{ fontSize: 13, color: T.mut, minWidth: 168, textAlign: "center" }}>
            du {lundi.split("-").reverse().join("/")} au {dimanche.split("-").reverse().join("/")}
          </span>
          <Btn onClick={() => setLundi(new Date(Date.parse(lundi) + 7 * 86400000).toISOString().slice(0, 10))}>Semaine suivante →</Btn>
        </div>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>✗ {msg.erreur}</div>}
      {etat.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>{etat.erreur}</div>}
      {etat.chargement && <p style={{ fontSize: 13, color: T.mut }}>Chargement…</p>}

      {!etat.chargement && !etat.erreur && (
        <>
          {/* Ce que la loi dit de cette semaine — avant qu'elle soit travaillée. */}
          {(etat.points || []).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {etat.points.map((p) => (
                <div key={p.cle} style={{
                  background: p.niveau === "bloquant" ? "#FCEBEB" : "#FEF6E7",
                  border: `1px solid ${p.niveau === "bloquant" ? "#F7C1C1" : "#F6DFB0"}`,
                  color: p.niveau === "bloquant" ? "#791F1F" : "#7A4E00",
                  borderRadius: 8, padding: "9px 11px", marginBottom: 7,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{p.titre}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>{p.detail}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ overflowX: "auto", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...cell, textAlign: "left", minWidth: 170, background: "#FAF9F7" }}>Salarié</th>
                  {jours.map((j) => (
                    <th key={j} style={{ ...cell, background: j === dimanche ? "#FAF6F0" : "#FAF9F7", fontWeight: 600 }}>{frCourt(j)}</th>
                  ))}
                  <th style={{ ...cell, background: "#FAF9F7", minWidth: 76 }}>Semaine</th>
                </tr>
              </thead>
              <tbody>
                {(etat.salaries || []).map((s) => {
                  const sem = (s.semaines || [])[0];
                  return (
                    <tr key={s.cle}>
                      <td style={{ ...cell }}>
                        <div style={{ fontWeight: 600 }}>{s.nom} {s.prenom}</div>
                        <div style={{ fontSize: 11, color: T.mut }}>{s.poste || "—"} · {s.hebdoContractuel} h/sem.</div>
                      </td>
                      {jours.map((j) => {
                        const siens = (etat.creneaux || []).filter((c) => c.cle === s.cle && c.jour === j);
                        return (
                          <td key={j} style={{ ...cell, background: j === dimanche ? "#FDFBF7" : "#fff" }}>
                            {siens.map((c) => (
                              <div key={c.id} style={{
                                background: c.source === "Pointage" ? "#E8F1FB" : "#EFEDE8",
                                borderRadius: 6, padding: "3px 5px", marginBottom: 3, display: "flex", alignItems: "center", gap: 4,
                              }}>
                                <span style={{ flex: 1 }}>{c.debut}{c.fin ? `–${c.fin}` : " …"}</span>
                                <button onClick={() => supprimer(c.id)} title="Supprimer"
                                  style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 13, lineHeight: 1 }}>×</button>
                              </div>
                            ))}
                            <button onClick={() => { setSaisie({ cle: s.cle, nom: s.nom, prenom: s.prenom, jour: j }); setMsg(null); }}
                              style={{ all: "unset", cursor: "pointer", color: T.accent, fontSize: 11.5, fontWeight: 600 }}>+ ajouter</button>
                          </td>
                        );
                      })}
                      <td style={{ ...cell, textAlign: "center", background: "#FAF9F7" }}>
                        <div style={{ fontWeight: 600 }}>{sem ? `${sem.total} h` : "—"}</div>
                        {sem?.sup25 > 0 && <div style={{ fontSize: 10.5, color: "#7A4E00" }}>+25 % : {sem.sup25} h</div>}
                        {sem?.sup50 > 0 && <div style={{ fontSize: 10.5, color: "#791F1F" }}>+50 % : {sem.sup50} h</div>}
                        {sem?.complementaires > 0 && <div style={{ fontSize: 10.5, color: "#7A4E00" }}>compl. : {sem.complementaires} h</div>}
                        {sem?.nuit > 0 && <div style={{ fontSize: 10.5, color: T.mut }}>nuit : {sem.nuit} h</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(etat.salaries || []).length === 0 && (
              <p style={{ fontSize: 13, color: T.mut, margin: "10px 4px" }}>Aucun salarié actif dans votre effectif.</p>
            )}
          </div>

          {/* Le pointage : un lien à afficher, rien à installer. */}
          {etat.pointage?.actif && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>Pointage sans matériel</h2>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: T.mut, lineHeight: 1.5 }}>
                Affichez ce lien près de la porte (un QR code suffit) : vos salariés pointent leur arrivée et
                leur départ depuis leur téléphone, sans compte ni mot de passe. L'heure enregistrée est celle
                du portail, et vous pouvez toujours la corriger ici.
              </p>
              <code style={{ display: "block", background: "#FAF9F7", border: `1px solid ${T.border}`, borderRadius: 8,
                padding: "8px 10px", fontSize: 11.5, wordBreak: "break-all" }}>
                {`${window.location.origin}/?pointage=${etat.pointage.jeton}`}
              </code>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn onClick={() => preparerVariables("apercu")} disabled={envoi}>
              Voir les heures du mois ({lundi.slice(0, 7).split("-").reverse().join("/")})
            </Btn>
            {apercu && (
              <Btn primary disabled={envoi} onClick={() => preparerVariables("variables")}>
                {envoi ? "Envoi…" : "Transmettre ces heures à mon gestionnaire"}
              </Btn>
            )}
          </div>

          {apercu && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginTop: 12, overflowX: "auto" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 14, fontFamily: T.serif, fontWeight: 600 }}>
                Heures calculées pour {apercu.mois.split("-").reverse().join("/")}
              </h2>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
                <thead>
                  <tr>
                    {["Salarié", "Normales", "Compl.", "+25 %", "+50 %", "Nuit", "Dim./fériés"].map((t) => (
                      <th key={t} style={{ ...cell, background: "#FAF9F7", textAlign: t === "Salarié" ? "left" : "center" }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apercu.lignes.map((l) => (
                    <tr key={`${l.nom} ${l.prenom}`}>
                      <td style={cell}>{l.nom} {l.prenom}</td>
                      {[l.heuresNormales, l.heuresComplementaires, l.heuresSup25, l.heuresSup50, l.heuresNuit, l.heuresDimancheFerie]
                        .map((v, i) => <td key={i} style={{ ...cell, textAlign: "center" }}>{v || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: "8px 2px 0", fontSize: 11.5, color: T.mut, lineHeight: 1.5 }}>
                Les heures de nuit et du dimanche sont déjà comprises dans les colonnes précédentes : elles
                s'y ajoutent comme majorations, pas comme heures supplémentaires. Les taux appliqués dépendent
                de votre convention collective — votre gestionnaire les applique.
              </p>
            </div>
          )}
        </>
      )}

      {/* Saisie d'un créneau — volontairement minuscule : trois champs. */}
      {saisie && (
        <div onClick={() => setSaisie(null)} style={{ position: "fixed", inset: 0, background: "rgba(29,27,24,.34)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: 12, padding: "20px 22px", width: "100%", maxWidth: 380 }}>
            <h2 style={{ margin: "0 0 3px", fontSize: 16, fontFamily: T.serif, fontWeight: 600 }}>{saisie.nom} {saisie.prenom}</h2>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: T.mut }}>{frCourt(saisie.jour)}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <ChampReq label="Début">
                <input type="time" style={inputStyle} value={form.debut} onChange={(e) => setForm({ ...form, debut: e.target.value })} />
              </ChampReq>
              <ChampReq label="Fin">
                <input type="time" style={inputStyle} value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} />
              </ChampReq>
              <ChampOpt label="Pause (minutes)" large>
                <input type="number" min="0" step="5" style={inputStyle} value={form.pause} onChange={(e) => setForm({ ...form, pause: e.target.value })} />
              </ChampOpt>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: T.mut }}>
              Une fin avant le début passe minuit — un service de soirée se saisit 18:00 → 02:00.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Btn onClick={() => setSaisie(null)}>Annuler</Btn>
              <Btn primary disabled={envoi} onClick={enregistrer}>{envoi ? "Enregistrement…" : "Ajouter"}</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
function DemandeAcces({ user, onLogout, raison }) {
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
        {/* Motif exact renvoyé par le serveur : discrimine « compte non
            rattaché » de « client inactif/inconnu » — précieux pour le
            diagnostic d'activation (le gestionnaire le demande au client). */}
        {raison && (
          <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.mut, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px" }}>
            Motif serveur : {raison}
          </p>
        )}
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

// Motifs qui déplient le volet accident — miroir de MOTIFS_ACCIDENT
// côté serveur (accident.js). La maladie professionnelle n'en fait pas
// partie : c'est le SALARIÉ qui la déclare à la CPAM, pas l'employeur.
const MOTIFS_AT = ["Accident du travail", "Accident de trajet"];

function DemandeAbsence({ user, client, salaries, salarieInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", dateDebut: "", dateFin: "", motif: "", justificatifUrl: "",
    accidentDate: "", accidentHeure: "", accidentLieu: "", accidentCirconstances: "",
    accidentLesions: "", accidentTemoins: "", accidentTiers: "", connaissanceDate: "", connaissanceHeure: "" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null); // { ok } | { erreur }
  const [envoi, setEnvoi] = useState(false);

  const justifRequis = MOTIFS_ABSENCE.find((x) => x.m === f.motif)?.justif === true;
  const estAccident = MOTIFS_AT.includes(f.motif);
  // Photo de l'arrêt : dépôt direct + lecture automatique. Les champs
  // reconnus sont PROPOSÉS (jamais imposés) — le client corrige ce qu'il
  // veut avant d'envoyer. Sans OCR configuré, le dépôt marche quand même
  // et remplit simplement le justificatif.
  // `lecture` distingue l'option ABSENTE (rien à dire au client) d'une
  // lecture qui a échoué (là, on l'invite à saisir). Sans ce partage, le
  // portail annonçait « les dates n'ont pas pu être lues » à des clients
  // chez qui l'OCR n'est tout simplement pas activé — un service jamais
  // promis ne doit pas passer pour un service en panne.
  const [depot, setDepot] = useState(null); // null | {envoi} | {nom, lus[], lecture} | {erreur}

  const deposerJustificatif = async (fichier) => {
    if (!fichier) return;
    setDepot({ envoi: true });
    try {
      const r = await apiFetch(`/api/depot?analyser=arret&nom=${encodeURIComponent(fichier.name)}`, {
        method: "POST", headers: { "Content-Type": fichier.type || "application/octet-stream" }, body: fichier,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setDepot({ erreur: j.erreur || `Dépôt refusé (HTTP ${r.status}).` });
      const c = j.extraction?.champs || null;
      const lus = [];
      setF((p) => {
        const n = { ...p, justificatifUrl: j.nom };
        if (c?.dateDebut && !p.dateDebut) { n.dateDebut = c.dateDebut; lus.push("date de début"); }
        if (c?.dateFin && !p.dateFin) { n.dateFin = c.dateFin; lus.push("date de fin"); }
        if (c?.motif && !p.motif && MOTIFS_ABSENCE.some((x) => x.m === c.motif)) { n.motif = c.motif; lus.push("motif"); }
        return n;
      });
      setErr(false);
      setDepot({ nom: j.nom, lus, lecture: j.extraction?.motif !== "non configuré" });
    } catch { setDepot({ erreur: "Dépôt impossible — vérifiez votre connexion." }); }
  };

  const envoyer = async () => {
    const voletIncomplet = estAccident &&
      (!f.accidentDate || !f.accidentLieu.trim() || f.accidentCirconstances.trim().length < 15);
    if (!f.salarie.trim() || !f.dateDebut || !f.motif || (justifRequis && !f.justificatifUrl.trim()) || voletIncomplet) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=absences", { method: "POST", body: JSON.stringify({ demarche: "absences", ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg(j.accident
          ? { ok: `Accident déclaré — réf. ${j.reference}. Votre gestionnaire vient d'être prévenu.`, accident: j.accident }
          : { ok: `Absence déclarée — réf. ${j.reference}. Un accusé de réception vous est adressé ; votre gestionnaire est prévenu.` });
        setF(VIDE); setErr(false);
      }
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

      {/* Après un accident : les gestes et leurs horloges, dans l'ordre.
          C'est la réponse du serveur qui parle — la date limite de la
          DAT est calculée hors dimanches et fériés, pas devinée ici. */}
      {msg?.accident && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 600, color: "#7C2D12" }}>
            Ce qu'il faut faire maintenant
          </p>
          {msg.accident.gestes.map((g) => (
            <div key={g.cle} style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: g.quand.includes("DÉPASSÉ") ? "#B91C1C" : "#9A3412" }}>{g.quand}</span>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#431407", lineHeight: 1.5 }}>{g.texte}</p>
            </div>
          ))}
        </div>
      )}

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
          {f.motif === "Maladie professionnelle" && (
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.mut, lineHeight: 1.5 }}>
              La maladie professionnelle se déclare à la CPAM par le <strong>salarié</strong>, pas par
              l'employeur — vous n'avez pas de déclaration à faire, seulement cette absence à enregistrer.
            </p>
          )}
        </div>

        {/* ── Volet accident ────────────────────────────────────────
            Se déplie quand le motif est un accident du travail ou de
            trajet. Il capte les faits À CHAUD : la déclaration (48 h) et
            les réserves (10 jours) reprendront ces mots-là. Miroir des
            exigences serveur (accident.js) : date, lieu, circonstances. */}
        {estAccident && (
          <div style={{ gridColumn: "1 / -1", background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10, padding: "14px 14px 6px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#7C2D12" }}>
              Les faits — pendant qu'ils sont frais
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "#9A3412", lineHeight: 1.5 }}>
              Vous avez <strong>48 heures</strong> pour déclarer l'accident à la CPAM (dimanches et jours
              fériés non comptés). Ce que vous écrivez ici sera repris mot pour mot dans la déclaration —
              et dans six mois, plus personne ne se souviendra des détails.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Date de l'accident *</label>
                <input type="date" style={{ ...inputStyle, borderColor: err && !f.accidentDate ? T.err : T.border }}
                  value={f.accidentDate} onChange={(e) => setF({ ...f, accidentDate: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Heure (si connue)</label>
                <input type="time" style={inputStyle} value={f.accidentHeure} onChange={(e) => setF({ ...f, accidentHeure: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Lieu précis *</label>
                <input type="text" style={{ ...inputStyle, borderColor: err && !f.accidentLieu.trim() ? T.err : T.border }}
                  placeholder="Atelier, chantier de…, trajet domicile-travail…" value={f.accidentLieu}
                  onChange={(e) => setF({ ...f, accidentLieu: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Circonstances — que s'est-il passé ? *</label>
                <textarea rows={3} style={{ ...inputStyle, resize: "vertical", borderColor: err && f.accidentCirconstances.trim().length < 15 ? T.err : T.border }}
                  placeholder="L'activité en cours, ce qui a provoqué l'accident, comment. Une phrase précise vaut mieux qu'un roman."
                  value={f.accidentCirconstances} onChange={(e) => setF({ ...f, accidentCirconstances: e.target.value })} />
                {err && f.accidentCirconstances.trim().length < 15 && (
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.err }}>Décrivez les circonstances en une phrase au moins.</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Siège et nature des lésions</label>
                <input type="text" style={inputStyle} placeholder="Main droite, coupure profonde…"
                  value={f.accidentLesions} onChange={(e) => setF({ ...f, accidentLesions: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Témoins (noms)</label>
                <input type="text" style={inputStyle} placeholder="Ou la première personne avisée"
                  value={f.accidentTemoins} onChange={(e) => setF({ ...f, accidentTemoins: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Tiers impliqué (véhicule, autre entreprise…)</label>
                <input type="text" style={inputStyle} placeholder="Important : un tiers responsable permet un recours qui allège votre taux AT"
                  value={f.accidentTiers} onChange={(e) => setF({ ...f, accidentTiers: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Vous l'avez appris le</label>
                <input type="date" style={inputStyle} value={f.connaissanceDate} onChange={(e) => setF({ ...f, connaissanceDate: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>À</label>
                <input type="time" style={inputStyle} value={f.connaissanceHeure} onChange={(e) => setF({ ...f, connaissanceHeure: e.target.value })} />
              </div>
              <p style={{ gridColumn: "1 / -1", margin: "0 0 8px", fontSize: 11.5, color: "#9A3412", lineHeight: 1.5 }}>
                C'est ce moment qui fait courir les 48 heures. Laissez vide si vous l'apprenez maintenant.
                Un doute sur la réalité de l'accident ? Dites-le à votre gestionnaire dès l'envoi : les
                réserves doivent être émises dans les dix jours, et motivées.
              </p>
            </div>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>
            Justificatif {justifRequis ? <span style={{ color: T.err }}>*</span> : <span style={{ fontWeight: 400 }}>(lien optionnel)</span>}
          </label>
          <div style={{ border: `1px dashed ${err && justifRequis && !f.justificatifUrl.trim() ? T.err : T.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12.5, color: T.accent, cursor: depot?.envoi ? "default" : "pointer", fontWeight: 600 }}>
              {depot?.envoi ? "Envoi du document…" : "📷 Photographier ou joindre l'arrêt"}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" capture="environment" style={{ display: "none" }}
                disabled={depot?.envoi} onChange={(e) => deposerJustificatif(e.target.files?.[0])} />
            </label>
            <span style={{ fontSize: 11.5, color: T.mut, flex: 1, minWidth: 140 }}>
              {depot?.nom ? `✓ ${depot.nom}` : "Le document est joint à votre déclaration."}
            </span>
          </div>
          {depot?.lus?.length > 0 && (
            <p style={{ margin: "0 0 8px", fontSize: 11.5, background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "7px 10px" }}>
              Lu sur le document : {depot.lus.join(", ")} — vérifiez et corrigez si besoin avant d'envoyer.
            </p>
          )}
          {depot?.nom && depot.lus.length === 0 && depot.lecture && (
            <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.mut }}>
              Document joint. Les dates n'ont pas pu être lues automatiquement : saisissez-les ci-dessus.
            </p>
          )}
          {depot?.erreur && <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.err }}>✗ {depot.erreur}</p>}
          <input type="text" style={{ ...inputStyle, borderColor: err && justifRequis && !f.justificatifUrl.trim() ? T.err : T.border }}
            placeholder="…ou collez le lien d'un document déjà déposé" value={f.justificatifUrl} onChange={(e) => setF({ ...f, justificatifUrl: e.target.value })} />
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
        <Btn primary disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : estAccident ? "Déclarer l'accident" : "Déclarer l'absence"}</Btn>
      </div>
    </>
  );
}

/* ================================================================
   VISITE MÉDICALE
   ================================================================ */
/* Nature de la visite — miroir strict de TYPES_VISITE côté serveur
   (demande.js). La reprise après arrêt est une obligation distincte du
   suivi périodique : c'est elle que l'alerte de reprise pré-remplit. */
const TYPES_VISITE = ["Visite d'information et de prévention (embauche)", "Visite périodique", "Visite de reprise", "Visite de pré-reprise", "Visite à la demande"];

function DemandeVisite({ user, client, salaries, salarieInitial, typeInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", dateVisite: "", typeVisite: typeInitial || "Visite périodique" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!f.salarie.trim() || !f.dateVisite) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=visite-medicale", { method: "POST", body: JSON.stringify({ demarche: "visite-medicale", ...f }) });
      // (le type part avec f — voir TYPES_VISITE, validé côté serveur)
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
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Nature de la visite *</label>
          <select style={inputStyle} value={f.typeVisite} onChange={(e) => setF({ ...f, typeVisite: e.target.value })}>
            {TYPES_VISITE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Date souhaitée *</label>
          <input type="date" style={{ ...inputStyle, borderColor: err && !f.dateVisite ? T.err : T.border }} value={f.dateVisite} onChange={(e) => setF({ ...f, dateVisite: e.target.value })} />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: T.mut, margin: "-8px 0 16px" }}>
        {f.typeVisite === "Visite de reprise"
          ? "Obligatoire dans les 8 jours du retour (art. R.4624-31) : indiquez une date au plus près de la reprise — votre gestionnaire saisit le service de santé au travail en priorité."
          : "Votre gestionnaire prend contact avec le service de santé au travail et vous confirme le rendez-vous."}
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
   HABILITATIONS & CACES — déclaration (obtention ou recyclage).
   Une déclaration = une ligne dans « Habilitations » ; l'historique se
   conserve, les alertes de recyclage (J-90/J-60/J-30, puis EXPIRÉE) ne
   regardent que la plus récente par salarié + type.
   ================================================================ */
const TYPES_HABILITATION = ["CACES R489 (chariots élévateurs)", "CACES R486 (nacelles / PEMP)", "CACES R482 (engins de chantier)", "CACES R490 (grues auxiliaires)", "Habilitation électrique B0/H0", "Habilitation électrique B1/B2/BR/BC", "SST (sauveteur secouriste du travail)", "Travail en hauteur / port du harnais", "AIPR (travaux à proximité des réseaux)", "Autre"];

function DemandeHabilitation({ user, client, salaries, salarieInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", type: "", typeAutre: "", numero: "", organisme: "", dateObtention: "", dateExpiration: "" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const typeFinal = f.type === "Autre" ? f.typeAutre.trim() : f.type;

  const envoyer = async () => {
    if (!f.salarie.trim() || !typeFinal || !f.dateExpiration) { setErr(true); return; }
    if (f.dateObtention && f.dateExpiration <= f.dateObtention) { setMsg({ erreur: "La fin de validité doit être postérieure à l'obtention." }); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=habilitation", { method: "POST", body: JSON.stringify({
        demarche: "habilitation", salarie: f.salarie, typeHabilitation: typeFinal,
        numero: f.numero, organisme: f.organisme,
        ...(f.dateObtention ? { dateObtention: f.dateObtention } : {}), dateExpiration: f.dateExpiration,
      }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: `Habilitation enregistrée — réf. ${j.reference}. Le recyclage sera rappelé automatiquement avant l'expiration.` }); setF(VIDE); setErr(false); }
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 14 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Habilitation / CACES</h2>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

      <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Salarié *</label>
          <ChampSalarie salaries={salaries} valeur={f.salarie} onChange={(v) => setF({ ...f, salarie: v })} invalide={err && !f.salarie.trim()} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Type d'habilitation *</label>
          <select style={{ ...inputStyle, borderColor: err && !typeFinal ? T.err : T.border }} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="">— Choisir —</option>
            {TYPES_HABILITATION.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {f.type === "Autre" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Précisez l'habilitation *</label>
            <input type="text" style={{ ...inputStyle, borderColor: err && !typeFinal ? T.err : T.border }} placeholder="Ex. FIMO, habilitation gaz, ADR…" value={f.typeAutre} onChange={(e) => setF({ ...f, typeAutre: e.target.value })} />
          </div>
        )}
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Numéro / référence</label>
          <input type="text" style={inputStyle} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Organisme formateur</label>
          <input type="text" style={inputStyle} placeholder="Ex. AFTRAL, APAVE…" value={f.organisme} onChange={(e) => setF({ ...f, organisme: e.target.value })} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Date d'obtention</label>
          <input type="date" style={inputStyle} value={f.dateObtention} onChange={(e) => setF({ ...f, dateObtention: e.target.value })} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Fin de validité *</label>
          <input type="date" style={{ ...inputStyle, borderColor: err && !f.dateExpiration ? T.err : T.border }} value={f.dateExpiration} onChange={(e) => setF({ ...f, dateExpiration: e.target.value })} />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: T.mut, margin: "-8px 0 16px" }}>
        Déclarez chaque obtention ET chaque recyclage : la fiche du salarié garde l'historique, et les rappels de recyclage partent automatiquement (J-90, J-60, J-30 avant la fin de validité).
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onRetour}>{msg?.ok ? "Retour aux démarches" : "Annuler"}</Btn>
        <Btn primary disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : "Enregistrer l'habilitation"}</Btn>
      </div>
    </>
  );
}

/* ================================================================
   AVENANT AU CONTRAT — demande de modification d'un contrat en cours ;
   le gestionnaire produit et fait signer l'avenant (même circuit humain
   que les fins de contrat). Liste TYPES_AVENANT = miroir du serveur.
   ================================================================ */
const TYPES_AVENANT = ["Changement de poste / qualification", "Durée du travail", "Rémunération", "Lieu de travail", "Passage temps partiel / temps plein", "Télétravail", "Prolongation de CDD", "Renouvellement de période d'essai", "Autre modification"];

function DemandeAvenant({ user, client, salaries, salarieInitial, onRetour }) {
  const VIDE = { salarie: salarieInitial || "", typeAvenant: "", dateEffet: "", details: "" };
  const [f, setF] = useState(VIDE);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!f.salarie.trim() || !f.typeAvenant || !f.dateEffet || f.details.trim().length < 10) { setErr(true); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande?demarche=avenant", { method: "POST", body: JSON.stringify({ demarche: "avenant", ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: `Demande transmise — réf. ${j.reference}. Votre gestionnaire prépare l'avenant et revient vers vous pour la signature.` }); setF(VIDE); setErr(false); }
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onRetour} style={{ all: "unset", cursor: "pointer", color: T.mut, fontSize: 14 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Avenant au contrat</h2>
      </div>

      {msg?.ok && <div style={{ background: "#E1F5EE", color: "#085041", border: "1px solid #B7E4D4", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✓ {msg.ok}</div>}
      {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

      <div className="osrh-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Salarié *</label>
          <ChampSalarie salaries={salaries} valeur={f.salarie} onChange={(v) => setF({ ...f, salarie: v })} invalide={err && !f.salarie.trim()} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Objet de l'avenant *</label>
          <select style={{ ...inputStyle, borderColor: err && !f.typeAvenant ? T.err : T.border }} value={f.typeAvenant} onChange={(e) => setF({ ...f, typeAvenant: e.target.value })}>
            <option value="">— Choisir —</option>
            {TYPES_AVENANT.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Date d'effet souhaitée *</label>
          <input type="date" style={{ ...inputStyle, borderColor: err && !f.dateEffet ? T.err : T.border }} value={f.dateEffet} onChange={(e) => setF({ ...f, dateEffet: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Modification souhaitée *</label>
          <textarea rows={4} style={{ ...inputStyle, resize: "vertical", borderColor: err && f.details.trim().length < 10 ? T.err : T.border }}
            placeholder="Décrivez précisément le changement : nouveau poste, nouvel horaire hebdomadaire, nouveau salaire brut, nouvelle adresse du lieu de travail…"
            value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
          {err && f.details.trim().length < 10 && <span style={{ fontSize: 11, color: T.err }}>Décrivez la modification (10 caractères minimum).</span>}
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: T.mut, margin: "-8px 0 16px" }}>
        Votre gestionnaire vérifie la faisabilité (convention collective, délais légaux), rédige l'avenant et vous le transmet pour signature avant la date d'effet.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onRetour}>{msg?.ok ? "Retour aux démarches" : "Annuler"}</Btn>
        <Btn primary disabled={envoi} onClick={envoyer}>{envoi ? "Envoi…" : "Demander l'avenant"}</Btn>
      </div>
    </>
  );
}

/* ================================================================
   SÉCURITÉ — registre des habilitations & CACES de l'effectif.
   Données : /api/personnel (habilitations + salariés, déjà filtrées
   par client côté serveur). La déclaration passe par la tuile cachée
   « habilitation » (onDemarche) ; les recyclages sont rappelés par
   e-mail (J-90/J-60/J-30 puis EXPIRÉE) et listés page Échéances.
   ================================================================ */
function VueSecurite({ onRetour, onDemarche }) {
  const [dossier, setDossier] = useState(null);

  useEffect(() => {
    apiFetch("/api/personnel")
      .then(async (r) => {
        if (r.ok) return setDossier(await r.json());
        const e = await r.json().catch(() => ({}));
        setDossier(import.meta.env.DEV ? { demo: true } : { erreur: e.erreur || `Données indisponibles (HTTP ${r.status}).` });
      })
      .catch(() => setDossier(import.meta.env.DEV ? { demo: true } : { erreur: "Données momentanément indisponibles — réessayez." }));
  }, []);

  const fr = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

  if (dossier === null) {
    return (
      <>
        <EnteteFiche titre="Sécurité" onRetour={onRetour} />
        <p style={{ fontSize: 13, color: T.mut }}>Chargement des habilitations…</p>
      </>
    );
  }
  if (dossier.erreur) {
    return (
      <>
        <EnteteFiche titre="Sécurité" onRetour={onRetour} />
        <p style={{ fontSize: 13, color: T.mut, margin: "12px 0" }}>{dossier.erreur}</p>
        <Btn primary onClick={() => window.location.reload()}>Réessayer</Btn>
      </>
    );
  }
  const src = dossier.demo ? DEMO_PERSONNEL : dossier;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dans90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  // La plus récente par salarié + type fait foi (le recyclage éteint
  // l'ancienne ligne) — même règle que les alertes côté serveur.
  const parCle = {};
  for (const h of src.habilitations || []) {
    if (!h.expiration) continue;
    const k = `${h.cle}|${String(h.type).toUpperCase()}`;
    if (!parCle[k] || parCle[k].expiration < h.expiration) parCle[k] = h;
  }
  const habs = Object.values(parCle).sort((a, b) => String(a.expiration).localeCompare(String(b.expiration)));
  const expirees = habs.filter((h) => h.expiration < aujourdhui).length;
  const aRecycler = habs.filter((h) => h.expiration >= aujourdhui && h.expiration <= dans90).length;

  const BadgeHab = (h) => h.expiration < aujourdhui
    ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>EXPIRÉE</span>
    : h.expiration <= dans90
      ? <span style={{ background: "#FAEEDA", color: "#854F0B", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>À recycler</span>
      : <span style={{ background: "#E1F5EE", color: "#085041", fontSize: 11, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>Valide</span>;

  return (
    <>
      <EnteteFiche titre="Sécurité" onRetour={onRetour} />
      <div style={{ margin: "-12px 0 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, color: T.mut, flex: 1, minWidth: 220 }}>
          Habilitations & CACES de votre effectif — la plus récente par salarié et par type fait foi,
          les recyclages sont rappelés automatiquement par e-mail.
        </p>
        <Btn primary onClick={() => onDemarche("habilitation", "")}><Plus size={14} /> Déclarer une habilitation</Btn>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Kpi label="Habilitations suivies" val={habs.length} icon={ShieldCheck} />
        <Kpi label="À recycler sous 90 jours" val={aRecycler} warn={aRecycler > 0} icon={Clock} />
        <Kpi label="Expirées" val={expirees} warn={expirees > 0} icon={AlertCircle} />
      </div>

      {habs.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
          Aucune habilitation déclarée pour l'instant.<br />
          Déclarez les CACES, habilitations électriques, SST… de vos salariés : le portail suivra les recyclages.
        </div>
      ) : (
        <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 2fr 1.2fr 110px 110px", gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
            <span>Salarié</span><span>Habilitation</span><span>Organisme</span><span>Fin de validité</span><span>État</span>
          </div>
          {habs.map((h, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 2fr 1.2fr 110px 110px", gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: i < habs.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
              <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.salarie || h.cle}</span>
              <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.numero ? `N° ${h.numero}` : undefined}>{h.type || "—"}</span>
              <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.organisme || "—"}</span>
              <span>{fr(h.expiration)}</span>
              {BadgeHab(h)}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12, padding: "14px 16px", fontSize: 12.5, color: T.mut, marginBottom: 14 }}>
        <strong style={{ color: T.ink }}>Bientôt dans cette brique :</strong> DUERP (document unique),
        registres de sécurité et affichages obligatoires.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut }}>
        <ShieldCheck size={13} />
        {dossier.demo
          ? "Données de démonstration — connectez-vous en production pour vos habilitations réelles"
          : "Rappels de recyclage automatiques par e-mail : J-90, J-60, J-30, puis expiration."}
      </div>
    </>
  );
}

/* ================================================================
   SALARIÉS ÉTRANGERS — brique autonome (option « etrangers »)
   GET /api/me?vue=etrangers : états des titres calculés côté serveur
   (Valide / À renouveler / En renouvellement / EXPIRÉ sans droits) ;
   le client déclare récépissés et nouveaux titres (PJ via /api/depot,
   POST /api/demande action titreRenouvellement).
   ================================================================ */
const BADGE_ETAT_TITRE = (s) => {
  const rendu = (bg, fg, txt) => (
    <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", justifySelf: "start" }}>{txt}</span>
  );
  switch (s.etat) {
    case "expire": return rendu("#FCEBEB", "#791F1F", "EXPIRÉ — interdiction d'emploi");
    case "en-renouvellement": return rendu("#E6F1FB", "#0C447C", `En renouvellement (récépissé → ${String(s.recepisse?.fin || "").split("-").reverse().join("/")})`);
    case "a-renouveler": return rendu("#FAEEDA", "#854F0B", `À renouveler — ${s.joursRestants} j`);
    case "valide": return rendu("#E4F3EE", "#0F6E56", "Valide");
    default: return rendu("#F4F6F9", "#5C6B80", "Titre à renseigner");
  }
};

function VueEtrangers({ notifier }) {
  const [donnees, setDonnees] = useState(null); // null | {salaries…} | {erreur}
  const [ouvert, setOuvert] = useState(null);   // { id, mode }
  const [f, setF] = useState({ numero: "", date: "", type: "", fichier: null });
  const [envoi, setEnvoi] = useState(false);

  const charger = () => {
    setDonnees(null);
    apiFetch("/api/me?vue=etrangers")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setDonnees(r.ok ? j : { erreur: j.erreur || `HTTP ${r.status}` });
      })
      .catch(() => setDonnees({ erreur: "Suivi momentanément indisponible — réessayez." }));
  };
  useEffect(charger, []);

  const ouvrir = (id, mode, sal) => {
    setOuvert({ id, mode });
    setF({ numero: "", date: "", type: sal?.titre?.type || "", fichier: null });
  };

  const envoyer = async (sal) => {
    const recepisse = ouvert.mode === "recepisse";
    if (!f.date) return notifier(recepisse ? "Indiquez la fin de validité du récépissé." : "Indiquez la date d'expiration du nouveau titre.");
    if (!recepisse && (!f.type || f.numero.trim().length < 4)) return notifier("Type et numéro du nouveau titre requis.");
    setEnvoi(true);
    try {
      let pj = "";
      if (f.fichier) {
        const ext = (f.fichier.name.split(".").pop() || "pdf").toLowerCase();
        const nom = `Titre-sejour_${sal.nom}-${sal.prenom}_${recepisse ? "recepisse" : "nouveau-titre"}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.${ext}`;
        const rd = await apiFetch(`/api/depot?nom=${encodeURIComponent(nom)}`, {
          method: "POST", headers: { "Content-Type": f.fichier.type || "application/octet-stream" }, body: f.fichier,
        });
        if (!rd.ok) { notifier("Dépôt de la pièce refusé — réessayez."); setEnvoi(false); return; }
        pj = (await rd.json().catch(() => ({}))).nom || nom;
      }
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "titreRenouvellement", id: sal.id, mode: ouvert.mode, pj,
          ...(recepisse
            ? { recepisseNumero: f.numero.trim(), recepisseFin: f.date }
            : { titreType: f.type, titreNumero: f.numero.trim(), titreExpiration: f.date }),
        }),
      });
      const j = await r.json().catch(() => ({}));
      setEnvoi(false);
      if (!r.ok) return notifier(j.erreur || `Enregistrement refusé (HTTP ${r.status}).`);
      notifier(recepisse ? "✓ Récépissé enregistré — les relances sont suspendues." : "✓ Nouveau titre enregistré.");
      setOuvert(null);
      charger();
    } catch { setEnvoi(false); notifier("API injoignable — réessayez."); }
  };

  if (donnees === null) return <p style={{ fontSize: 13, color: T.mut }}>Chargement du suivi…</p>;
  if (donnees.erreur) return <p style={{ fontSize: 13, color: T.mut }}>{donnees.erreur}</p>;
  const salaries = donnees.salaries || [];
  const expires = salaries.filter((s) => s.etat === "expire");
  const fr = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
  const grille = "1.6fr 1.2fr 1.8fr 110px 1.6fr 1.6fr";
  const petit = { ...inputStyle, padding: "7px 9px", fontSize: 12.5 };

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 24, fontFamily: T.serif, fontWeight: 600 }}>Salariés étrangers</h1>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.mut }}>
        Titres de séjour de vos salariés hors UE/EEE/Suisse : validité, renouvellements,
        droit au travail. Déclarez ici le récépissé dès le dépôt du renouvellement en
        préfecture, puis le nouveau titre à sa réception — Osmose RH suit le reste.
      </p>

      {expires.length > 0 && (
        <div style={{ background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#791F1F" }}>
          <strong>⚠ {expires.length === 1 ? "Un titre de séjour a expiré" : `${expires.length} titres de séjour ont expiré`} sans récépissé de renouvellement.</strong>{" "}
          L'emploi d'un salarié sans titre valide est interdit (art. L.8251-1 du code du travail) :
          déclarez le récépissé ci-dessous s'il existe, sinon contactez immédiatement votre gestionnaire Osmose RH.
        </div>
      )}

      {salaries.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "34px 24px", textAlign: "center", fontSize: 13.5, color: T.mut }}>
          Aucun salarié étranger suivi pour l'instant.<br />
          Les salariés hors UE/EEE/Suisse déclarés via la démarche Embauche apparaissent ici automatiquement.
        </div>
      ) : (
        <div className="osrh-table" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "10px 16px", fontSize: 11, color: T.mut, borderBottom: `1px solid ${T.border}` }}>
            <span>Salarié</span><span>Nationalité</span><span>Titre de séjour</span><span>Fin des droits</span><span>État</span><span></span>
          </div>
          {salaries.map((s, i) => (
            <React.Fragment key={s.id || i}>
              <div style={{ display: "grid", gridTemplateColumns: grille, gap: 8, padding: "11px 16px", fontSize: 13, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nom} {s.prenom}</span>
                <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nationalite || "—"}</span>
                <span style={{ color: T.mut, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.titre?.numero ? `N° ${s.titre.numero}` : undefined}>
                  {s.titre?.type || "—"}
                </span>
                <span>{fr(s.finDroits)}</span>
                {BADGE_ETAT_TITRE(s)}
                <span style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {s.etat !== "en-renouvellement" && (
                    <button onClick={() => (ouvert?.id === s.id && ouvert.mode === "recepisse" ? setOuvert(null) : ouvrir(s.id, "recepisse", s))}
                      style={{ all: "unset", cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Déclarer un récépissé
                    </button>
                  )}
                  <button onClick={() => (ouvert?.id === s.id && ouvert.mode === "nouveauTitre" ? setOuvert(null) : ouvrir(s.id, "nouveauTitre", s))}
                    style={{ all: "unset", cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    Nouveau titre reçu
                  </button>
                </span>
              </div>
              {ouvert?.id === s.id && (
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.bg, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {ouvert.mode === "nouveauTitre" && (
                    <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3, minWidth: 220 }}>
                      Type du nouveau titre *
                      <select style={petit} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                        <option value="">—</option>
                        {(donnees.titres || []).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  )}
                  <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3, minWidth: 160 }}>
                    {ouvert.mode === "recepisse" ? "N° du récépissé" : "N° du titre *"}
                    <input style={petit} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3 }}>
                    {ouvert.mode === "recepisse" ? "Valide jusqu'au *" : "Expire le *"}
                    <input type="date" style={petit} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, color: T.mut, display: "flex", flexDirection: "column", gap: 3, minWidth: 200 }}>
                    Copie (PDF/JPG/PNG — recommandé)
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={petit}
                      onChange={(e) => setF({ ...f, fichier: e.target.files && e.target.files[0] })} />
                  </label>
                  <Btn primary disabled={envoi} onClick={() => envoyer(s)}>
                    {envoi ? "Enregistrement…" : ouvert.mode === "recepisse" ? "Enregistrer le récépissé" : "Enregistrer le titre"}
                  </Btn>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mut }}>
        <ShieldCheck size={13} />
        Rappels automatiques par e-mail à J-90, J-60 et J-30 avant l'expiration, puis en cas
        d'expiration — un récépissé déclaré suspend les relances. Copies conservées dans vos Documents.
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
    { cle: "DUPONT MARIE", salarie: "Dupont Marie", date: dansNJours(9), type: "Visite périodique", statut: "À planifier", reference: "VIS-DEMO1" },
  ],
  mutuelles: [],
  habilitations: [
    { cle: "MARTIN PAUL", salarie: "Martin Paul", type: "CACES R489 (chariots élévateurs)", numero: "489-2021-118", organisme: "AFTRAL", obtention: dansNJours(-1650), expiration: dansNJours(55), alerte: null, reference: "HAB-DEMO1" },
  ],
  avenants: [],
  fins: [],
};

/* ── Onglet « Dossier » de la fiche salarié : état civil, naissance,
      coordonnées, banque & paie. Lecture par sections ; « Modifier »
      ouvre le formulaire complet → POST /api/demande action majSalarie
      (route historique, verrou client + option côté serveur). ───────── */
const FICHE_VIDE = {
  sexe: "", nomNaissance: "", nomMarital: "", situationFamiliale: "",
  dateNaissance: "", numeroSS: "", departementNaissance: "",
  codeDepartementNaissance: "", paysNaissance: "", codePaysNaissance: "",
  adressePostale: "", email: "", telephone: "", iban: "", bic: "",
  matricule: "", bulletinDematerialise: false,
  nationalite: "", titreSejourType: "", titreSejourNumero: "", titreSejourExpiration: "",
  finPeriodeEssai: "", periodiciteVisiteMois: "", derniereVisiteMedicale: "",
  dernierEntretienPro: "",
};
// Champs OBLIGATOIRES du dossier (décision du 22/08) — tout sauf le nom
// marital (n'existe pas pour tous) et le matricule (attribué par la paie).
const REQUIS_DOSSIER = [
  "adressePostale", "numeroSS", "dateNaissance", "sexe", "nomNaissance",
  "situationFamiliale", "departementNaissance", "codeDepartementNaissance",
  "paysNaissance", "codePaysNaissance", "email", "telephone", "iban", "bic",
];
const SECTIONS_DOSSIER = [
  ["État civil", [
    ["sexe", "Sexe", "choix", ["", "Masculin", "Féminin"]],
    ["nomNaissance", "Nom de naissance", "texte"],
    ["nomMarital", "Nom marital", "texte"],
    ["situationFamiliale", "Situation familiale", "choix",
      ["", "Célibataire", "Marié(e)", "Pacsé(e)", "Divorcé(e)", "Séparé(e)", "Veuf(ve)", "Union libre"]],
    ["dateNaissance", "Date de naissance", "date"],
    ["numeroSS", "N° de sécurité sociale", "texte"],
  ]],
  ["Naissance", [
    ["departementNaissance", "Département de naissance", "texte"],
    ["codeDepartementNaissance", "Code département", "texte"],
    ["paysNaissance", "Pays de naissance", "texte"],
    ["codePaysNaissance", "Code pays (ex. FR)", "texte"],
  ]],
  // Salariés étrangers uniquement — champs FACULTATIFS (hors de la règle
  // « dossier complet ») : le titre vient de l'embauche, Osmose le tient
  // à jour au renouvellement.
  // Suivi du contrat — FACULTATIF (hors règle « dossier complet ») :
  // alimente les échéances (fin d'essai J-15/J-7, visite médicale
  // périodique — 60 mois par défaut, 48 en suivi renforcé).
  ["Suivi du contrat", [
    ["finPeriodeEssai", "Fin de la période d'essai", "date"],
    ["periodiciteVisiteMois", "Périodicité visite médicale (mois)", "choix", ["", "12", "24", "48", "60"]],
    ["derniereVisiteMedicale", "Dernière visite médicale", "date"],
    ["dernierEntretienPro", "Dernier entretien professionnel", "date"],
  ]],
  ["Nationalité & titre de séjour", [
    ["nationalite", "Nationalité", "texte"],
    ["titreSejourType", "Type de titre de séjour", "choix",
      ["", "Carte de séjour pluriannuelle", "Carte de séjour temporaire", "Carte de résident", "VLS-TS (visa long séjour valant titre)", "Récépissé avec autorisation de travail", "Autorisation provisoire de séjour", "Carte de séjour citoyen UE/famille", "Autre"]],
    ["titreSejourNumero", "Numéro du titre", "texte"],
    ["titreSejourExpiration", "Date d'expiration du titre", "date"],
  ]],
  ["Coordonnées", [
    ["adressePostale", "Adresse postale", "texte"],
    ["email", "E-mail personnel", "texte"],
    ["telephone", "Téléphone personnel", "texte"],
  ]],
  ["Banque & paie", [
    ["matricule", "Matricule", "texte"],
    ["iban", "IBAN", "texte"],
    ["bic", "BIC", "texte"],
    ["bulletinDematerialise", "Bulletin de paie dématérialisé", "ouinon"],
  ]],
];

function DossierSalarie({ sal, onMaj }) {
  const [edition, setEdition] = useState(false);
  const [f, setF] = useState({ ...FICHE_VIDE, matricule: sal.matricule || "", ...(sal.fiche || {}) });
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null); // { ok } | { erreur }
  const [invitation, setInvitation] = useState(null); // null | { envoi } | { lien, expireLe, deja } | { erreur }
  const maj = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // Onboarding : le salarié remplit lui-même son dossier via un lien à
  // jeton (14 jours). Le lien est affiché au client, qui l'envoie par le
  // canal de son choix (e-mail, SMS, WhatsApp…).
  const inviterSalarie = async () => {
    setInvitation({ envoi: true });
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboardingInviter", id: sal.id }),
      });
      const j = await r.json().catch(() => ({}));
      setInvitation(r.ok ? j : { erreur: j.erreur || `Invitation refusée (HTTP ${r.status}).` });
    } catch { setInvitation({ erreur: "API injoignable — réessayez." }); }
  };

  const libelles = Object.fromEntries(SECTIONS_DOSSIER.flatMap(([, champs]) => champs.map(([c, l]) => [c, l])));
  const manquants = (fiche) => REQUIS_DOSSIER.filter((k) => !String(fiche[k] ?? "").trim());

  const enregistrer = async () => {
    const m = manquants(f);
    if (m.length)
      return setMsg({ erreur: `Champs obligatoires manquants : ${m.map((k) => libelles[k]).join(", ")}.` });
    setEnvoi(true); setMsg(null);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "majSalarie", id: sal.id, cle: sal.cle, fiche: f }),
      });
      const j = await r.json().catch(() => ({}));
      setEnvoi(false);
      if (!r.ok) return setMsg({ erreur: j.erreur || `Enregistrement refusé (HTTP ${r.status}).` });
      onMaj({ ...f });
      setEdition(false);
      setMsg({ ok: true });
    } catch {
      setEnvoi(false);
      setMsg({ erreur: "API injoignable — réessayez." });
    }
  };

  const afficher = (champ, type) => {
    const v = f[champ];
    if (type === "ouinon") return v ? "Oui" : "Non";
    if (type === "date") return v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—";
    if (champ === "iban" && v) return v.replace(/(.{4})/g, "$1 ").trim();
    return v || "—";
  };

  if (!edition) {
    const m = manquants(f);
    return (
      <>
        {msg?.ok && (
          <p style={{ fontSize: 12.5, color: T.ok, margin: "0 0 10px" }}>✓ Dossier enregistré.</p>
        )}
        {m.length > 0 && (
          <p style={{ fontSize: 12.5, background: "#FDF3E4", color: "#7A5416", border: "1px solid #F0DCB4", borderRadius: 8, padding: "9px 12px", margin: "0 0 12px" }}>
            ⚠ Dossier incomplet — à renseigner : {m.map((k) => libelles[k]).join(", ")}.
          </p>
        )}
        {m.length > 0 && sal.id && !invitation?.lien && (
          <div style={{ margin: "0 0 14px" }}>
            <Btn onClick={inviterSalarie} disabled={invitation?.envoi}>
              <Send size={13} /> {invitation?.envoi ? "Génération du lien…" : "Inviter le salarié à compléter son dossier"}
            </Btn>
            {invitation?.erreur && <p style={{ fontSize: 12, color: T.err, margin: "8px 0 0" }}>✗ {invitation.erreur}</p>}
          </div>
        )}
        {invitation?.lien && (
          <div style={{ background: "#E6F1FB", border: "1px solid #BFDCF7", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#0C447C", margin: "0 0 14px" }}>
            {invitation.deja ? "Un lien d'invitation est déjà actif" : "Lien d'invitation créé"} — envoyez-le au salarié
            (valable jusqu'au {String(invitation.expireLe).slice(0, 10).split("-").reverse().join("/")}) :
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <code style={{ fontSize: 11, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", wordBreak: "break-all", flex: 1, minWidth: 200 }}>{invitation.lien}</code>
              <Btn small onClick={() => { navigator.clipboard?.writeText(invitation.lien); setInvitation((i) => ({ ...i, copie: true })); }}>
                {invitation.copie ? "✓ Copié" : "Copier"}
              </Btn>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11.5 }}>
              Le salarié y saisit son état civil, ses coordonnées, sa banque et dépose ses pièces — sa fiche se complète toute seule.
            </p>
          </div>
        )}
        {SECTIONS_DOSSIER.map(([titre, champs]) => (
          <div key={titre} style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: T.mut, textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</p>
            <Carte>
              {champs.map(([champ, libelle, type], i) => (
                <Rangee key={champ} gauche={<span style={{ color: T.mut }}>{libelle}</span>}
                  droite={<strong>{afficher(champ, type)}</strong>} dernier={i === champs.length - 1} />
              ))}
            </Carte>
          </div>
        ))}
        <Btn primary onClick={() => { setMsg(null); setEdition(true); }}>Modifier le dossier</Btn>
      </>
    );
  }

  return (
    <>
      {SECTIONS_DOSSIER.map(([titre, champs]) => (
        <div key={titre} style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: T.mut, textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {champs.map(([champ, libelle, type, opts]) => (
              <label key={champ} style={{ fontSize: 12, color: T.mut, display: "flex", flexDirection: "column", gap: 4, ...(champ === "adressePostale" ? { gridColumn: "1 / -1" } : {}) }}>
                {libelle}{REQUIS_DOSSIER.includes(champ) ? " *" : ""}
                {type === "choix" ? (
                  <select style={inputStyle} value={f[champ]} onChange={(e) => maj(champ, e.target.value)}>
                    {opts.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                  </select>
                ) : type === "ouinon" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 13, color: T.ink }}>
                    <input type="checkbox" checked={!!f[champ]} onChange={(e) => maj(champ, e.target.checked)} /> Oui
                  </span>
                ) : (
                  <input style={inputStyle} type={type === "date" ? "date" : "text"} value={f[champ] || ""}
                    onChange={(e) => maj(champ, e.target.value)} />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      {msg?.erreur && (
        <p style={{ fontSize: 12.5, color: T.err, margin: "0 0 10px" }}>{msg.erreur}</p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn primary onClick={enregistrer} disabled={envoi}>{envoi ? "Enregistrement…" : "Enregistrer"}</Btn>
        <Btn onClick={() => { setEdition(false); setMsg(null); setF({ ...FICHE_VIDE, matricule: sal.matricule || "", ...(sal.fiche || {}) }); }}>Annuler</Btn>
      </div>
    </>
  );
}

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
    const habilitations = (src.habilitations || []).filter((x) => x.cle === sal.cle);
    const avenants = (src.avenants || []).filter((x) => x.cle === sal.cle);
    const onglets = [
      { id: "Contrat", n: null }, { id: "Dossier", n: null },
      { id: "Absences", n: absences.length },
      { id: "Visites", n: visites.length }, { id: "Mutuelle", n: mutuelles.length },
      { id: "Habilitations", n: habilitations.length },
      { id: "Avenants", n: avenants.length },
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

        {ong === "Dossier" && (
          <DossierSalarie sal={sal} onMaj={(fiche) =>
            setDossier((d) => ({
              ...d,
              salaries: (d.salaries || src.salaries).map((s) => (s.cle === sal.cle ? { ...s, fiche } : s)),
            }))} />
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
                  gauche={<><strong>{v.type || "Visite médicale"}</strong><span style={{ color: T.mut }}> — {fr(v.date)}</span></>}
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

        {ong === "Habilitations" && (
          <>
            <Carte>
              {habilitations.length === 0 && <Vide texte="Aucune habilitation déclarée pour ce salarié." />}
              {habilitations.map((h, i) => {
                const expiree = h.expiration && h.expiration < new Date().toISOString().slice(0, 10);
                return (
                  <Rangee key={i} dernier={i === habilitations.length - 1}
                    gauche={<><strong>{h.type || "Habilitation"}</strong><span style={{ color: T.mut }}>{h.numero ? ` — n° ${h.numero}` : ""}{h.organisme ? ` · ${h.organisme}` : ""}</span></>}
                    milieu={h.reference}
                    droite={expiree
                      ? <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>Expirée le {fr(h.expiration)}</span>
                      : <span style={{ background: "#E1F5EE", color: "#085041", fontSize: 11, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>Valide → {fr(h.expiration)}</span>} />
                );
              })}
            </Carte>
            <div style={{ marginTop: 12 }}>
              <Btn primary onClick={() => onDemarche("habilitation", nomComplet)}><Plus size={14} /> Déclarer une habilitation</Btn>
            </div>
            <p style={{ marginTop: 10, fontSize: 11.5, color: T.mut }}>
              L'historique se conserve : un recyclage se déclare comme une nouvelle habilitation du même type — les rappels suivent automatiquement la plus récente.
              Ces habilitations alimentent la brique <strong>Sécurité</strong> (bientôt disponible) : registre de l'effectif, DUERP, registres réglementaires.
            </p>
          </>
        )}

        {ong === "Avenants" && (
          <>
            <Carte>
              {avenants.length === 0 && <Vide texte="Aucun avenant demandé pour ce salarié." />}
              {avenants.map((a, i) => (
                <Rangee key={i} dernier={i === avenants.length - 1}
                  gauche={<><strong>{a.type || "Avenant"}</strong><span style={{ color: T.mut }}> — effet au {fr(a.dateEffet)}</span></>}
                  milieu={a.reference}
                  droite={<Badge s={a.statut} />} />
              ))}
            </Carte>
            <div style={{ marginTop: 12 }}>
              <Btn primary onClick={() => onDemarche("avenant", nomComplet)}><Plus size={14} /> Demander un avenant</Btn>
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

  // Export des fiches : CSV « ; » UTF-8 (BOM) — s'ouvre directement dans
  // Excel en français, sans dépendance. Généré côté navigateur à partir
  // des données déjà chargées (rien ne transite de plus par le réseau).
  const exporterFiches = () => {
    const entetes = ["Matricule", "Nom", "Prénom", "Poste", "Type de contrat", "Date d'entrée", "Date de sortie", "Statut",
      "E-mail", "Téléphone", "Adresse postale", "N° sécurité sociale", "Date de naissance", "Sexe",
      "Nom de naissance", "Nom marital", "Situation familiale", "Département de naissance", "Code département",
      "Pays de naissance", "Code pays", "IBAN", "BIC", "Bulletin dématérialisé"];
    const cel = (v) => {
      const t = String(v ?? "");
      return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lignes = salaries.map((s) => {
      const f = s.fiche || {};
      return [s.matricule, s.nom, s.prenom, s.poste, s.type, fr(s.debut), s.fin ? fr(s.fin) : "", s.statut,
        f.email, f.telephone, f.adressePostale, f.numeroSS, f.dateNaissance ? fr(f.dateNaissance) : "", f.sexe,
        f.nomNaissance, f.nomMarital, f.situationFamiliale, f.departementNaissance, f.codeDepartementNaissance,
        f.paysNaissance, f.codePaysNaissance, f.iban, f.bic,
        "bulletinDematerialise" in f ? (f.bulletinDematerialise ? "Oui" : "Non") : ""].map(cel).join(";");
    });
    const csv = "\uFEFF" + [entetes.map(cel).join(";"), ...lignes].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Effectif_${client || "osmose"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <EnteteFiche titre="Gestion du personnel" onRetour={onRetour} />
      <div style={{ margin: "-12px 0 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, color: T.mut, flex: 1, minWidth: 220 }}>
          Les salariés déclarés via la démarche Embauche — cliquez pour ouvrir le dossier.
        </p>
        {salaries.length > 0 && (
          <Btn onClick={exporterFiches}><Download size={14} /> Exporter les fiches (Excel)</Btn>
        )}
      </div>

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
            const n = compteur("absences", s.cle) + compteur("visites", s.cle) + compteur("mutuelles", s.cle) + compteur("habilitations", s.cle) + compteur("avenants", s.cle) + compteur("fins", s.cle);
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
   MON GESTIONNAIRE — fil de discussion (canal de base, jamais optionnel).
   GET /api/me?vue=messages liste les fils du client (un élément de
   « Messages gestionnaire » = un fil ; réponses dans la colonne
   Echanges — voir docs/Fil-messagerie-portail.md). L'envoi d'un
   premier message reste POST /api/demande { demarche: "contact" }.
   ================================================================ */
const STATUT_FIL = (f) => (f.clos ? "Clos" : f.statut === "Répondu" ? "Répondu" : "Transmis");
const fmtJourFil = (iso) => {
  const d = new Date(iso || "");
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};
const fmtJourHeureFil = (iso) => {
  const d = new Date(iso || "");
  return isNaN(d) ? "" : `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};
const dernierTexteFil = (f) =>
  ((f.echanges && f.echanges.length ? f.echanges[f.echanges.length - 1].texte : f.message) || "").trim();

/* Une réplique de la conversation — client à droite (bleu), gestionnaire
   à gauche (carte). Les retours à la ligne saisis sont conservés. */
function BulleFil({ qui, quand, texte }) {
  const client = qui !== "gestionnaire";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: client ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.55, color: T.ink,
        whiteSpace: "pre-wrap", overflowWrap: "anywhere",
        background: client ? "#E6F1FB" : T.card,
        border: `1px solid ${client ? "#CBDFF5" : T.border}`,
        borderRadius: client ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
      }}>{texte}</div>
      <span style={{ fontSize: 11, color: T.mut, margin: "4px 2px 0" }}>
        {client ? "Vous" : "Votre gestionnaire"} — {fmtJourHeureFil(quand)}
      </span>
    </div>
  );
}

/* Une ligne de la liste des fils : objet, date, statut, dernier échange. */
function LigneFil({ fil, onOuvrir }) {
  return (
    <button onClick={onOuvrir} style={{
      all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: "pointer",
      // minWidth 0 : sans lui, les textes nowrap fixent la largeur min de
      // l'élément de grille et la carte déborde du conteneur (660 px).
      minWidth: 0, overflow: "hidden",
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 16px", fontFamily: T.sans,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {fil.nonLu && <span title="Réponse non lue" style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />}
          <span style={{ fontSize: 14, fontWeight: fil.nonLu ? 700 : 600, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fil.objet}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: T.mut }}>{fmtJourFil(fil.derniereMaj)}</span>
          <Badge s={STATUT_FIL(fil)} />
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: T.mut, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {fil.dernierAuteur === "gestionnaire" ? "Votre gestionnaire : " : "Vous : "}{dernierTexteFil(fil)}
      </div>
    </button>
  );
}

function MessagerieGestionnaire({ user, onRetour, filInitial, onNonLus }) {
  const [fils, setFils] = useState(null);      // null = chargement ; { erreur } = panne ; [] = fils
  const [ouvert, setOuvert] = useState(null);  // id du fil déplié
  const [nouveau, setNouveau] = useState(false);
  const [rep, setRep] = useState("");          // réponse en cours de saisie
  const [repEnvoi, setRepEnvoi] = useState(false);
  const [repErr, setRepErr] = useState(null);
  // Fil à ouvrir dès la première liste (lien profond ?msg= des e-mails).
  const initRef = useRef(filInitial || null);

  // Toute mise à jour de la liste passe ici : la pastille de la tuile
  // (AppShell) suit le nombre de fils non lus sans rechargement.
  const majFils = (liste) => {
    setFils(liste);
    if (Array.isArray(liste)) onNonLus?.(liste.filter((f) => f.nonLu).length);
  };

  const charger = () => {
    apiFetch("/api/me?vue=messages")
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          return setFils({ erreur: e.erreur || `Messages indisponibles (HTTP ${r.status}).` });
        }
        const liste = (await r.json()).fils || [];
        majFils(liste);
        if (initRef.current) {
          const f = liste.find((x) => String(x.id) === String(initRef.current));
          initRef.current = null;
          if (f) ouvrirFil(f);
        }
      })
      // Échec réseau : API absente en dev local — liste vide, le formulaire
      // reste utilisable ; en production, message et bouton Réessayer.
      .catch(() => setFils(import.meta.env.DEV ? [] : { erreur: "Messages momentanément indisponibles — vérifiez votre connexion." }));
  };
  useEffect(charger, []);

  // Ouverture d'un fil : saisie remise à zéro et côté client marqué lu
  // (pastilles non-lu) — silencieux, l'échec n'empêche pas la lecture.
  const ouvrirFil = (f) => {
    setOuvert(f.id); setRep(""); setRepErr(null);
    if (f.nonLu) {
      setFils((prev) => {
        if (!Array.isArray(prev)) return prev;
        const maj = prev.map((x) => (x.id === f.id ? { ...x, nonLu: false } : x));
        onNonLus?.(maj.filter((x) => x.nonLu).length);
        return maj;
      });
      apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "messageStatut", id: f.id, lu: true }),
      }).catch(() => {});
    }
  };

  // Réponse dans le fil — POST messageRepondre, puis fil relu (la liste
  // est rechargée sans passer par l'état « chargement » : pas de saut).
  const envoyerReponse = async () => {
    const texte = rep.trim();
    if (!texte) return;
    setRepEnvoi(true); setRepErr(null);
    try {
      const r = await apiFetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "messageRepondre", id: ouvert, texte }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setRep(""); charger(); }
      else setRepErr(j.erreur || `Envoi refusé (HTTP ${r.status}).`);
    } catch { setRepErr("Envoi impossible — vérifiez votre connexion."); }
    setRepEnvoi(false);
  };

  // ── Nouveau message : le formulaire historique ; retour = liste rafraîchie
  if (nouveau) return <ContactGestionnaire user={user} onRetour={() => { setNouveau(false); setFils(null); charger(); }} />;

  // ── Fil déplié : la conversation
  const fil = Array.isArray(fils) ? fils.find((f) => f.id === ouvert) : null;
  if (ouvert && fil) {
    const statut = STATUT_FIL(fil);
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={() => setOuvert(null)} aria-label="Retour aux messages" style={{ all: "unset", cursor: "pointer", color: T.mut, padding: 4 }}><ArrowLeft size={18} /></button>
          <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fil.objet}</h2>
          <Badge s={statut} />
        </div>
        <p style={{ margin: "0 0 18px 32px", fontSize: 11.5, color: T.mut }}>
          Réf. {fil.reference || "—"} — ouvert le {fmtJourFil(fil.creeLe)}
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          <BulleFil qui="client" quand={fil.creeLe} texte={fil.message} />
          {(fil.echanges || []).map((e, i) => <BulleFil key={i} qui={e.qui} quand={e.quand} texte={e.texte} />)}
        </div>
        {statut === "Clos" ? (
          <p style={{ marginTop: 18, fontSize: 12.5, color: T.mut }}>
            Fil clos — pour une nouvelle demande, écrivez un nouveau message.
          </p>
        ) : (
          <div style={{ marginTop: 18 }}>
            {(fil.echanges || []).length === 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12, padding: "10px 14px", background: "#FDFBF3", border: "1px solid #EDE6D2", borderRadius: 10, fontSize: 12.5, color: T.mut, lineHeight: 1.55 }}>
                <Clock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Votre gestionnaire a été prévenu — sa réponse arrivera dans ce fil et par e-mail à <strong>{user?.email || "votre adresse de connexion"}</strong>.</span>
              </div>
            )}
            <textarea rows={3} value={rep} onChange={(e) => setRep(e.target.value)}
              placeholder="Répondre dans ce fil…" style={{ ...inputStyle, resize: "vertical" }} />
            {repErr && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.err }}>✗ {repErr}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <Btn primary disabled={repEnvoi || !rep.trim()} onClick={envoyerReponse}>
                <Send size={14} /> {repEnvoi ? "Envoi…" : "Répondre"}
              </Btn>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Liste des fils
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={onRetour} aria-label="Retour" style={{ all: "unset", cursor: "pointer", color: T.mut, padding: 4 }}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600, flex: 1 }}>Mon gestionnaire</h2>
        {Array.isArray(fils) && fils.length > 0 && (
          <Btn primary onClick={() => setNouveau(true)}><Plus size={14} /> Nouveau message</Btn>
        )}
      </div>
      <p style={{ margin: "0 0 18px 32px", fontSize: 12.5, color: T.mut }}>
        Vos échanges avec votre gestionnaire Osmose RH — il connaît déjà votre dossier.
      </p>

      {fils === null && <p style={{ fontSize: 13, color: T.mut }}>Chargement de vos messages…</p>}

      {fils?.erreur && (
        <>
          <p style={{ fontSize: 13, color: T.mut, margin: "0 0 12px" }}>{fils.erreur}</p>
          <Btn primary onClick={() => { setFils(null); charger(); }}>Réessayer</Btn>
        </>
      )}

      {Array.isArray(fils) && fils.length === 0 && (
        <div style={{ textAlign: "center", padding: "44px 24px", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12 }}>
          <Send size={26} color={T.accentSoft} strokeWidth={1.6} />
          <p style={{ margin: "12px 0 4px", fontSize: 14.5, fontWeight: 600, color: T.ink }}>Aucun message pour l'instant</p>
          <p style={{ margin: "0 0 18px", fontSize: 12.5, color: T.mut }}>
            Une question sur la paie, un contrat, une information à transmettre ?
          </p>
          <Btn primary onClick={() => setNouveau(true)}><Plus size={14} /> Écrire à mon gestionnaire</Btn>
        </div>
      )}

      {Array.isArray(fils) && fils.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {fils.map((f) => <LigneFil key={f.id} fil={f} onOuvrir={() => ouvrirFil(f)} />)}
        </div>
      )}
    </>
  );
}

/* Écran « nouveau message » de la messagerie ci-dessus : le message part
   dans « Messages gestionnaire » (tête de fil) ; le flux notifie le
   gestionnaire et accuse réception au demandeur. */
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
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600 }}>Nouveau message</h2>
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
        <Btn onClick={onRetour}>{msg?.ok ? "Voir mes messages" : "Annuler"}</Btn>
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
