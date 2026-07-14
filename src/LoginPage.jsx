// src/LoginPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Page d'accueil de l'espace client Osmose RH — UNE seule porte d'entrée :
// le bouton ouvre la page External ID qui gère à la fois la connexion et la
// création de compte (email + mot de passe, vérification par code).
// Gabarit aligné sur la page Connexion de synapserh.fr : panneau visuel navy
// à gauche, carte de connexion à droite — empilés sur mobile.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import { entrerDemo } from "./demo/modeDemo";

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
        window.location.hash = "/dashboard";
      }
    } catch (err) {
      if (err?.errorCode === "user_cancelled") {
        setStatus("idle");
        return;
      }
      setErrorMsg(err?.message || "Erreur d'authentification. Réessayez.");
      setStatus("error");
    }
  }

  return (
    <div className="osrh-login">
      <style>{`
        .osrh-login { display: flex; min-height: 100vh; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #fff; }
        .osrh-login-illu {
          width: 44%; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between;
          padding: 44px 48px; box-sizing: border-box; color: #fff;
          background: linear-gradient(160deg, #061840 0%, #0D1F33 60%, #0A1628 100%);
        }
        .osrh-login-logo { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; color: #fff; text-decoration: none; }
        .osrh-login-logo em { font-style: italic; color: #60A5FA; }
        .osrh-login-headline { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 500; font-size: 38px; line-height: 1.18; margin: 48px 0 16px; }
        .osrh-login-sub { font-size: 14.5px; color: rgba(255,255,255,0.65); line-height: 1.65; max-width: 340px; margin: 0; }
        .osrh-login-trust { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; }
        .osrh-login-trust-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.75); }
        .osrh-login-dot { width: 7px; height: 7px; border-radius: 50%; background: #60A5FA; flex-shrink: 0; }
        .osrh-login-copy { font-size: 11.5px; color: rgba(255,255,255,0.4); }
        .osrh-login-panel { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px; box-sizing: border-box; }
        .osrh-login-card { width: 100%; max-width: 380px; }
        .osrh-login-eyebrow { display: flex; align-items: center; gap: 10px; font-size: 11px; letter-spacing: 0.18em; color: #1668D9; font-weight: 700; margin: 0 0 14px; }
        .osrh-login-eyebrow::before { content: ''; width: 26px; height: 1px; background: #1668D9; }
        .osrh-login-title { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; font-size: 34px; color: #0A1628; margin: 0 0 8px; }
        .osrh-login-subtitle { font-size: 14px; color: #5C6B80; margin: 0 0 30px; }
        .osrh-login-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;
          padding: 15px 20px; background: linear-gradient(135deg, #1668D9 0%, #061840 100%); color: #fff;
          border: none; border-radius: 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(22,104,217,0.3);
          transition: transform .15s, box-shadow .15s; font-family: inherit;
        }
        .osrh-login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(22,104,217,0.4); }
        .osrh-login-btn:disabled { opacity: 0.75; cursor: not-allowed; }
        .osrh-login-error { margin-top: 16px; background: #FCEBEB; border: 1px solid #F7C1C1; color: #791F1F; border-radius: 8px; padding: 10px 14px; font-size: 13px; text-align: center; }
        .osrh-login-note { margin-top: 26px; font-size: 12.5px; color: #8794A8; text-align: center; line-height: 1.65; }
        @media (max-width: 820px) {
          .osrh-login { flex-direction: column; }
          .osrh-login-illu { width: 100%; min-height: 0; padding: 26px 24px 30px; }
          .osrh-login-headline { font-size: 26px; margin: 18px 0 8px; }
          .osrh-login-sub { font-size: 13px; }
          .osrh-login-trust, .osrh-login-copy { display: none; }
          .osrh-login-panel { padding: 34px 20px 44px; align-items: flex-start; }
        }
      `}</style>

      {/* ── Panneau visuel (identité landing) ── */}
      <div className="osrh-login-illu">
        <div>
          <span className="osrh-login-logo">Osmose <em>RH</em></span>
          <h2 className="osrh-login-headline">Vos démarches RH,<br />en quelques clics.</h2>
          <p className="osrh-login-sub">
            Attestations, acomptes, embauches : déclarez, votre gestionnaire dédié s'occupe du reste — documents générés et suivis depuis un seul endroit.
          </p>
          <div className="osrh-login-trust">
            <div className="osrh-login-trust-item"><span className="osrh-login-dot" />Hébergé en Europe</div>
            <div className="osrh-login-trust-item"><span className="osrh-login-dot" />Données sécurisées, accès par entreprise</div>
            <div className="osrh-login-trust-item"><span className="osrh-login-dot" />Conforme RGPD</div>
          </div>
        </div>
        <div className="osrh-login-copy">© 2026 Osmose RH · Cabinet de conseil en ressources humaines</div>
      </div>

      {/* ── Carte de connexion ── */}
      <div className="osrh-login-panel">
        <div className="osrh-login-card">
          <p className="osrh-login-eyebrow">ESPACE CLIENT</p>
          <h1 className="osrh-login-title">Connexion</h1>
          <p className="osrh-login-subtitle">Bienvenue sur votre plateforme Osmose RH</p>

          <button className="osrh-login-btn" onClick={handleLogin} disabled={status === "loading"}>
            {status === "loading" ? (
              <>
                <Spinner /> Connexion en cours…
              </>
            ) : (
              "Se connecter ou créer un compte"
            )}
          </button>

          {status === "error" && (
            <div className="osrh-login-error">⚠️ {errorMsg}</div>
          )}

          <p className="osrh-login-note">
            Première visite ? Créez votre compte avec votre adresse email
            professionnelle — votre gestionnaire Osmose RH activera ensuite
            votre accès.
          </p>

          {/* Mode démonstration : portail complet sur un client fictif,
              sans compte — aucun envoi réel (voir src/demo/modeDemo.js). */}
          <button
            onClick={() => { entrerDemo(); window.location.hash = "/dashboard"; window.location.reload(); }}
            style={{
              all: "unset", cursor: "pointer", display: "block", width: "100%",
              boxSizing: "border-box", marginTop: 22, padding: "11px 20px", textAlign: "center",
              border: "1px solid #D5DDE8", borderRadius: 10, fontSize: 12.5,
              color: "#5C6B80", fontFamily: "inherit",
            }}>
            Vous découvrez Osmose RH ? <strong style={{ color: "#1668D9", whiteSpace: "nowrap" }}>Explorer la démonstration&nbsp;→</strong>
          </button>

          <p className="osrh-login-note" style={{ marginTop: 14 }}>
            <a href="/mentions-legales.html" style={{ color: "#8794A8" }}>Mentions légales &amp; confidentialité</a>
          </p>
        </div>
      </div>
    </div>
  );
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
