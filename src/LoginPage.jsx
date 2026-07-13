// src/LoginPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Page d'accueil de l'espace client Osmose RH — UNE seule porte d'entrée :
// le bouton ouvre la page External ID qui gère à la fois la connexion et la
// création de compte (email + mot de passe, vérification par code).
// Un compte fraîchement créé mais non rattaché arrive sur le formulaire de
// demande d'accès (AppShell → DemandeAcces) : c'est le parcours d'onboarding.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";

export default function LoginPage() {
  const { instance } = useMsal();
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const result = await instance.loginPopup(loginRequest);
      if (result?.account) {
        instance.setActiveAccount(result.account);
        // App.jsx réagit à useIsAuthenticated() → redirige vers #/dashboard
        window.location.hash = "/dashboard";
      }
    } catch (err) {
      // Popup fermée volontairement → pas d'erreur affichée
      if (err?.errorCode === "user_cancelled") {
        setStatus("idle");
        return;
      }
      setErrorMsg(err?.message || "Erreur d'authentification. Réessayez.");
      setStatus("error");
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* ── Logo / Titre ── */}
        <div style={s.logoZone}>
          <div style={s.logoMark}>O</div>
          <h1 style={s.title}>Osmose <em style={{ fontStyle: "italic", color: "#60A5FA" }}>RH</em></h1>
          <p style={s.subtitle}>Espace client — vos démarches RH en quelques clics</p>
        </div>

        {/* ── Bouton connexion ── */}
        <button
          onClick={handleLogin}
          disabled={status === "loading"}
          style={{
            ...s.btn,
            opacity: status === "loading" ? 0.75 : 1,
            cursor:  status === "loading" ? "not-allowed" : "pointer",
          }}
        >
          {status === "loading" ? (
            <>
              <Spinner /> Connexion en cours…
            </>
          ) : (
            "Se connecter ou créer un compte"
          )}
        </button>

        {/* ── Message d'erreur ── */}
        {status === "error" && (
          <div style={s.error}>
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {/* ── Note bas de page ── */}
        <p style={s.note}>
          Première visite ? Créez votre compte avec votre adresse email
          professionnelle — votre gestionnaire Osmose RH activera ensuite
          votre accès.
        </p>
      </div>

      {/* ── Baseline ── */}
      <p style={s.footer}>Osmose RH — données hébergées en Europe</p>
    </div>
  );
}

// ─── Icône Microsoft ─────────────────────────────────────────────────────────
function MicrosoftIcon() {
 
}

// ─── Spinner inline ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <>
      <style>{`
        @keyframes lspin { to { transform: rotate(360deg); } }
        .lspin { animation: lspin .6s linear infinite; }
      `}</style>
      <span className="lspin" style={{
        display: "inline-block", width: 18, height: 18,
        border: "2px solid rgba(255,255,255,0.4)",
        borderTopColor: "white", borderRadius: "50%",
      }} />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(160deg, #061840 0%, #0D1F33 60%, #0A1628 100%)",
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
    padding: "24px",
  },
  card: {
    background: "white",
    borderRadius: "20px",
    padding: "48px 40px",
    maxWidth: "400px",
    width: "100%",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0",
  },
  logoZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "36px",
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: "16px",
    background: "linear-gradient(135deg, #1668D9, #061840)",
    color: "white",
    fontSize: "28px",
    fontWeight: "700",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    boxShadow: "0 8px 24px rgba(22,104,217,0.35)",
  },
  title: {
    margin: "0 0 6px 0",
    fontSize: "26px",
    fontWeight: "600",
    color: "#0A1628",
    letterSpacing: "-0.5px",
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "#64748b",
    textAlign: "center",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    padding: "14px 20px",
    background: "#1668D9",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "600",
    transition: "background .2s, transform .1s",
    boxShadow: "0 4px 16px rgba(22,104,217,0.3)",
  },
  error: {
    marginTop: "16px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    width: "100%",
    textAlign: "center",
    boxSizing: "border-box",
  },
  note: {
    marginTop: "28px",
    fontSize: "12px",
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: "1.6",
  },
  footer: {
    marginTop: "24px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.4)",
  },
};