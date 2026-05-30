// src/LoginPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Page de connexion Synapse RH
//  - loginPopup MSAL  → App.jsx détecte isAuthenticated et redirige vers /dashboard
//  - Gestion état (idle / loading / error)
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
          <div style={s.logoMark}>S</div>
          <h1 style={s.title}>Synapse RH</h1>
          <p style={s.subtitle}>Votre espace RH digital & collaboratif</p>
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
            <>
              <MicrosoftIcon />
              Se connecter avec Microsoft
            </>
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
          Connectez-vous avec votre compte professionnel Microsoft 365.
          <br />
          Aucun mot de passe supplémentaire requis.
        </p>
      </div>

      {/* ── Baseline ── */}
      <p style={s.footer}>Propulsé par Synapse · Microsoft Graph</p>
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
    background: "linear-gradient(135deg, #1e0a3c 0%, #4c1d95 50%, #7c3aed 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
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
    background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
    color: "white",
    fontSize: "28px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
  },
  title: {
    margin: "0 0 6px 0",
    fontSize: "26px",
    fontWeight: "700",
    color: "#1e0a3c",
    letterSpacing: "-0.5px",
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
    background: "#0078d4",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "600",
    transition: "background .2s, transform .1s",
    boxShadow: "0 4px 16px rgba(0,120,212,0.3)",
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