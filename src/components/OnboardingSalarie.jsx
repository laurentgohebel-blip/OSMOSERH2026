// src/components/OnboardingSalarie.jsx — formulaire PUBLIC d'onboarding.
// Ouvert via https://espace.osmoserh.fr/?onboarding=<jeton> : AUCUN compte,
// AUCUNE authentification MSAL (main.jsx court-circuite l'init) — le jeton
// d'invitation, généré par l'employeur depuis la fiche du salarié, est
// l'unique clé. Le salarié saisit son état civil, ses coordonnées et sa
// banque, dépose ses pièces, et la fiche « Salariés » est complétée.

import React, { useEffect, useState } from "react";

const T = {
  navy: "#0D1F33", accent: "#1668D9", bg: "#F4F6F9", card: "#FFFFFF",
  border: "#E3E8EF", ink: "#1A2433", mut: "#5C6B80", err: "#A8564A",
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};
const input = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14,
  fontFamily: T.sans, border: `1px solid ${T.border}`, borderRadius: 8,
  background: "#fff", color: T.ink, outline: "none",
};

const VIDE = {
  sexe: "", nomNaissance: "", nomMarital: "", situationFamiliale: "",
  dateNaissance: "", numeroSS: "", departementNaissance: "",
  codeDepartementNaissance: "", paysNaissance: "France", codePaysNaissance: "FR",
  adressePostale: "", email: "", telephone: "", iban: "", bic: "",
  bulletinDematerialise: true, nationalite: "",
};
const REQUIS = ["sexe", "nomNaissance", "situationFamiliale", "dateNaissance", "numeroSS",
  "departementNaissance", "codeDepartementNaissance", "paysNaissance", "codePaysNaissance",
  "adressePostale", "email", "telephone", "iban", "bic"];

const PIECES = [
  ["identite", "Pièce d'identité (recto-verso)"],
  ["vitale", "Carte Vitale ou attestation"],
  ["rib", "RIB"],
];

export default function OnboardingSalarie({ jeton }) {
  const [etat, setEtat] = useState({ chargement: true }); // {chargement}|{erreur}|{nom,prenom,raisonSociale}
  const [f, setF] = useState(VIDE);
  const [pj, setPj] = useState({}); // { identite: "nom-final.pdf", ... }
  const [envoiPj, setEnvoiPj] = useState(null);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(false);

  useEffect(() => {
    fetch("/api/demande", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "onboarding", mode: "info", jeton }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setEtat(r.ok ? j : { erreur: j.erreur || "Lien indisponible — réessayez plus tard." });
      })
      .catch(() => setEtat({ erreur: "Connexion impossible — vérifiez votre réseau et rechargez la page." }));
  }, [jeton]);

  const deposer = async (cle, fichier) => {
    if (!fichier) return;
    setEnvoiPj(cle);
    try {
      const r = await fetch(`/api/depot?invitation=${encodeURIComponent(jeton)}&nom=${encodeURIComponent(fichier.name)}`,
        { method: "POST", headers: { "Content-Type": fichier.type || "application/octet-stream" }, body: fichier });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setPj((p) => ({ ...p, [cle]: j.nom }));
      else setMsg({ erreur: j.erreur || "Dépôt du fichier refusé." });
    } catch { setMsg({ erreur: "Dépôt impossible — vérifiez votre connexion." }); }
    setEnvoiPj(null);
  };

  const envoyer = async () => {
    if (REQUIS.some((k) => !String(f[k] || "").trim())) { setErr(true); setMsg({ erreur: "Complétez tous les champs marqués d'une étoile." }); return; }
    setEnvoi(true); setMsg(null);
    try {
      const r = await fetch("/api/demande", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboarding", mode: "soumettre", jeton, fiche: f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setFini(true);
      else setMsg({ erreur: j.erreur || `Envoi refusé (HTTP ${r.status}).` });
    } catch { setMsg({ erreur: "Envoi impossible — vérifiez votre connexion." }); }
    setEnvoi(false);
  };

  const Cadre = ({ children }) => (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, padding: "24px 14px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
          <span style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, color: T.navy }}>Osmose RH</span>
          <span style={{ fontSize: 12.5, color: T.mut }}>Dossier salarié</span>
        </div>
        {children}
        <p style={{ marginTop: 22, fontSize: 11, color: T.mut, lineHeight: 1.5 }}>
          Les informations saisies sont transmises uniquement à votre employeur et à Osmose RH
          (gestion de la paie et du personnel) — elles ne sont jamais communiquées à des tiers.
        </p>
      </div>
    </div>
  );

  if (etat.chargement) return <Cadre><p style={{ fontSize: 14, color: T.mut }}>Vérification du lien…</p></Cadre>;
  if (etat.erreur) return (
    <Cadre>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, fontSize: 14, color: T.ink }}>
        {etat.erreur}
      </div>
    </Cadre>
  );
  if (fini) return (
    <Cadre>
      <div style={{ background: "#E1F5EE", border: "1px solid #B7E4D4", borderRadius: 12, padding: 24, fontSize: 14.5, color: "#085041" }}>
        ✓ <strong>Dossier transmis — merci {etat.prenom} !</strong><br /><br />
        {etat.raisonSociale || "Votre employeur"} et Osmose RH disposent maintenant de vos informations
        pour préparer votre contrat et votre paie. Vous pouvez fermer cette page.
      </div>
    </Cadre>
  );

  const Champ = ({ k, label, type = "text", requis = true, enfant }) => (
    <div style={{ gridColumn: enfant ? undefined : "1 / -1" }}>
      <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 5, fontWeight: 600 }}>
        {label}{requis ? " *" : ""}
      </label>
      <input type={type} style={{ ...input, borderColor: err && requis && !String(f[k] || "").trim() ? T.err : T.border }}
        value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <Cadre>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "22px 20px" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, fontWeight: 600, color: T.ink }}>
          Bonjour {etat.prenom} {etat.nom} 👋
        </h1>
        <p style={{ margin: "8px 0 20px", fontSize: 13.5, color: T.mut, lineHeight: 1.55 }}>
          <strong>{etat.raisonSociale || "Votre employeur"}</strong> vous invite à compléter votre dossier
          salarié : ces informations servent à préparer votre contrat de travail et vos bulletins de paie.
          Comptez 5 minutes — munissez-vous de votre carte Vitale et d'un RIB.
        </p>

        {msg?.erreur && <div style={{ background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>✗ {msg.erreur}</div>}

        <h2 style={{ fontSize: 14, fontFamily: T.serif, margin: "0 0 12px" }}>État civil</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 5, fontWeight: 600 }}>Sexe *</label>
            <select style={{ ...input, borderColor: err && !f.sexe ? T.err : T.border }} value={f.sexe} onChange={(e) => setF({ ...f, sexe: e.target.value })}>
              <option value="">—</option><option>Masculin</option><option>Féminin</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: T.mut, marginBottom: 5, fontWeight: 600 }}>Situation familiale *</label>
            <select style={{ ...input, borderColor: err && !f.situationFamiliale ? T.err : T.border }} value={f.situationFamiliale} onChange={(e) => setF({ ...f, situationFamiliale: e.target.value })}>
              <option value="">—</option>
              {["Célibataire", "Marié(e)", "Pacsé(e)", "Divorcé(e)", "Séparé(e)", "Veuf(ve)", "Union libre"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Champ k="nomNaissance" label="Nom de naissance" enfant />
          <Champ k="nomMarital" label="Nom marital" requis={false} enfant />
          <Champ k="dateNaissance" label="Date de naissance" type="date" enfant />
          <Champ k="numeroSS" label="N° de sécurité sociale (15 chiffres)" enfant />
          <Champ k="departementNaissance" label="Département de naissance" enfant />
          <Champ k="codeDepartementNaissance" label="Code département (ex. 83)" enfant />
          <Champ k="paysNaissance" label="Pays de naissance" enfant />
          <Champ k="codePaysNaissance" label="Code pays (ex. FR)" enfant />
          <Champ k="nationalite" label="Nationalité" requis={false} enfant />
        </div>

        <h2 style={{ fontSize: 14, fontFamily: T.serif, margin: "0 0 12px" }}>Coordonnées</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <Champ k="adressePostale" label="Adresse postale complète" />
          <Champ k="email" label="E-mail personnel" type="email" enfant />
          <Champ k="telephone" label="Téléphone" type="tel" enfant />
        </div>

        <h2 style={{ fontSize: 14, fontFamily: T.serif, margin: "0 0 12px" }}>Banque & paie</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
          <Champ k="iban" label="IBAN" enfant />
          <Champ k="bic" label="BIC" enfant />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink, margin: "6px 0 20px", cursor: "pointer" }}>
          <input type="checkbox" checked={f.bulletinDematerialise} onChange={(e) => setF({ ...f, bulletinDematerialise: e.target.checked })} />
          Je souhaite recevoir mes bulletins de paie au format dématérialisé
        </label>

        <h2 style={{ fontSize: 14, fontFamily: T.serif, margin: "0 0 6px" }}>Pièces justificatives</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: T.mut }}>
          Photos ou PDF acceptés (10 Mo max par fichier) — facultatif si vous les avez déjà remises à votre employeur.
        </p>
        <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
          {PIECES.map(([cle, label]) => (
            <div key={cle} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px dashed ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 13, flex: 1, minWidth: 180 }}>{label}</span>
              {pj[cle]
                ? <span style={{ fontSize: 12, color: "#085041" }}>✓ {pj[cle]}</span>
                : (
                  <label style={{ fontSize: 12.5, color: T.accent, cursor: "pointer", fontWeight: 600 }}>
                    {envoiPj === cle ? "Envoi…" : "Choisir un fichier"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                      disabled={envoiPj !== null}
                      onChange={(e) => deposer(cle, e.target.files?.[0])} />
                  </label>
                )}
            </div>
          ))}
        </div>

        <button onClick={envoyer} disabled={envoi} style={{
          width: "100%", padding: "13px 16px", fontSize: 15, fontWeight: 600, fontFamily: T.sans,
          background: envoi ? "#9DB8DF" : T.accent, color: "#fff", border: "none", borderRadius: 10, cursor: envoi ? "default" : "pointer",
        }}>
          {envoi ? "Transmission…" : "Transmettre mon dossier"}
        </button>
      </div>
    </Cadre>
  );
}
