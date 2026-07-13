// src/App.jsx
import React from "react";
import { useMsal } from "@azure/msal-react";
import LoginPage from "./LoginPage.jsx";
import AppShell from "./components/AppShell.jsx";

export default function App() {
  const { instance } = useMsal();
  const accounts = instance.getAllAccounts();
  const isAuth = accounts.length > 0;

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
