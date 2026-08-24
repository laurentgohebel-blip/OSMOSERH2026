// src/components/PointageSalarie.jsx — la page que le QR code ouvre.
//
// Affichée sur le téléphone d'un salarié qui n'a aucun compte : deux
// boutons, gros, lisibles d'un coup d'œil, utilisables avec les mains
// occupées. Rien à installer, rien à retenir.
//
// L'heure retenue est celle du SERVEUR : ce que le téléphone affiche
// n'a aucune valeur ici, et c'est volontaire.

import React, { useState, useEffect } from "react";

const T = {
  bg: "#F7F6F3", card: "#FFFFFF", ink: "#1D1B18", mut: "#6B6560",
  accent: "#0F5C4A", border: "#E3E0DA", err: "#B23B3B", ok: "#0F7A5F",
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
};

export default function PointageSalarie({ jeton }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [choisi, setChoisi] = useState("");
  const [envoi, setEnvoi] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/demande", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pointage", mode: "info", jeton }),
        });
        const j = await r.json().catch(() => ({}));
        setEtat(r.ok ? { ...j } : { erreur: j.erreur || "Lien de pointage indisponible." });
      } catch { setEtat({ erreur: "Connexion impossible — réessayez dans un instant." }); }
    })();
  }, [jeton]);

  const pointer = async (mode) => {
    if (!choisi) { setMsg({ erreur: "Choisissez votre nom." }); return; }
    setEnvoi(mode); setMsg(null);
    try {
      const r = await fetch("/api/demande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pointage", mode, jeton, cle: choisi }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok
        ? { ok: `${j.sens === "depart" ? "Départ" : "Arrivée"} enregistré${j.sens === "depart" ? "" : "e"} à ${j.heure}`, qui: j.salarie }
        : { erreur: j.erreur || "Pointage refusé." });
    } catch { setMsg({ erreur: "Connexion impossible — prévenez votre responsable." }); }
    setEnvoi("");
  };

  const cadre = { minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 18 };
  const carte = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
    padding: "26px 22px", width: "100%", maxWidth: 420 };

  if (etat.chargement) return <div style={cadre}><div style={carte}>Chargement…</div></div>;
  if (etat.erreur) {
    return (
      <div style={cadre}>
        <div style={{ ...carte, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, fontFamily: T.serif, margin: "0 0 10px" }}>Pointage indisponible</h1>
          <p style={{ fontSize: 13.5, color: T.mut, margin: 0 }}>{etat.erreur}</p>
          <p style={{ fontSize: 12.5, color: T.mut, marginTop: 12 }}>Prévenez votre responsable — vos heures seront saisies à la main.</p>
        </div>
      </div>
    );
  }

  const bouton = (fond, couleur) => ({
    all: "unset", boxSizing: "border-box", display: "block", width: "100%", textAlign: "center",
    background: fond, color: couleur, fontFamily: T.sans, fontSize: 17, fontWeight: 600,
    padding: "20px 0", borderRadius: 12, cursor: "pointer", marginBottom: 12,
  });

  return (
    <div style={cadre}>
      <div style={carte}>
        <p style={{ fontSize: 12, color: T.accent, fontWeight: 600, margin: "0 0 2px", letterSpacing: 0.4 }}>POINTAGE</p>
        <h1 style={{ fontSize: 20, fontFamily: T.serif, fontWeight: 600, margin: "0 0 18px" }}>{etat.raisonSociale}</h1>

        {msg?.ok && (
          <div style={{ background: "#E1F5EE", border: "1px solid #B7E4D4", color: "#085041", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{msg.ok}</div>
            {msg.qui && <div style={{ fontSize: 12.5, marginTop: 2 }}>{msg.qui}</div>}
          </div>
        )}
        {msg?.erreur && (
          <div style={{ background: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F", borderRadius: 10, padding: "11px 13px", marginBottom: 14, fontSize: 13 }}>
            {msg.erreur}
          </div>
        )}

        <label style={{ display: "block", fontSize: 12.5, color: T.mut, marginBottom: 6, fontWeight: 600 }}>Votre nom</label>
        <select value={choisi} onChange={(e) => { setChoisi(e.target.value); setMsg(null); }}
          style={{ width: "100%", boxSizing: "border-box", padding: "14px 12px", fontSize: 16,
            border: `1px solid ${T.border}`, borderRadius: 10, background: "#fff", fontFamily: T.sans, marginBottom: 18 }}>
          <option value="">— choisir —</option>
          {(etat.salaries || []).map((s) => (
            <option key={s.cle} value={s.cle}>{s.prenom} {s.nom}</option>
          ))}
        </select>

        <button onClick={() => pointer("arrivee")} disabled={!!envoi} style={{ ...bouton(T.accent, "#fff"), opacity: envoi ? 0.6 : 1 }}>
          {envoi === "arrivee" ? "Enregistrement…" : "J'arrive"}
        </button>
        <button onClick={() => pointer("depart")} disabled={!!envoi} style={{ ...bouton("#EFEDE8", T.ink), opacity: envoi ? 0.6 : 1 }}>
          {envoi === "depart" ? "Enregistrement…" : "Je pars"}
        </button>

        <p style={{ fontSize: 11.5, color: T.mut, textAlign: "center", margin: "14px 0 0", lineHeight: 1.5 }}>
          L'heure enregistrée est celle du portail, pas celle de votre téléphone.
          Votre employeur peut la corriger.
        </p>
      </div>
    </div>
  );
}
