// src/App.jsx
import React from "react";
import { useMsal } from "@azure/msal-react";
import LoginPage from "./LoginPage.jsx";
import AppShell from "./components/AppShell.jsx";
import { demoActive, entrerDemo, quitterDemo, UTILISATEUR_DEMO, ENTREPRISE_DEMO } from "./demo/modeDemo";

/* Bandeau permanent du mode démonstration — au-dessus du portail, jamais
   masquable : personne ne doit confondre la démo avec un espace réel. */
function BandeauDemo({ onQuitter }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap",
      background: "#854F0B", color: "#FDF3E3", padding: "8px 16px",
      fontSize: 12.5, fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <span>
        <strong>Mode démonstration</strong> — {ENTREPRISE_DEMO} (données fictives).
        Rien n'est enregistré, aucun e-mail n'est envoyé.
      </span>
      <button onClick={onQuitter} style={{
        all: "unset", cursor: "pointer", border: "1px solid rgba(253,243,227,0.5)",
        borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600,
      }}>
        Quitter la démonstration
      </button>
    </div>
  );
}

export default function App() {
  const { instance } = useMsal();
  const accounts = instance.getAllAccounts();
  const isAuth = accounts.length > 0;

  // Lien direct vers la démo — espace.synapserh.fr/?demo (page /decouvrir.html,
  // e-mails de prospection) : active le mode démo puis nettoie l'URL.
  // Idempotent : sans effet si la démo est déjà active.
  if (new URLSearchParams(window.location.search).has("demo")) {
    entrerDemo();
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }

  // Mode démonstration (lien « Découvrir la démonstration » de la page de
  // connexion) : portail complet sans compte, appels API servis localement
  // par src/demo/modeDemo.js via apiFetch. Prioritaire sur l'authentification
  // pour qu'un compte connecté puisse aussi montrer la démo.
  if (demoActive()) {
    const sortir = () => { quitterDemo(); window.location.hash = ""; window.location.reload(); };
    return (
      <>
        <BandeauDemo onQuitter={sortir} />
        <AppShell user={UTILISATEUR_DEMO} onLogout={sortir} />
      </>
    );
  }

  // Aperçu UI local : http://localhost:5173/?apercu — rend l'app sans
  // authentification avec un utilisateur factice. import.meta.env.DEV
  // garantit que ce chemin n'existe pas dans le build de production.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("apercu")) {
    return (
      <AppShell
        user={{ displayName: "Sofia Marques", email: "sofia@apercu.local", givenName: "Sofia" }}
        onLogout={() => {}}
      />
    );
  }

  if (!isAuth) return <LoginPage />;

  const account = accounts[0];
  const user = {
    displayName: account.name || account.username,
    email: account.username,
    givenName: account.idTokenClaims?.given_name || (account.name || "").split(" ")[0],
    tenantLabel: "Client",
  };

  return (
    <AppShell
      user={user}
      onLogout={() => instance.logoutRedirect()}
    />
  );
}
