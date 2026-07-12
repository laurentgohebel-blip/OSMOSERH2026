// src/App.jsx
import React from "react";
import { useMsal } from "@azure/msal-react";
import LoginPage from "./LoginPage.jsx";
import AppShell from "./components/AppShell.jsx";

export default function App() {
  const { instance } = useMsal();
  const accounts = instance.getAllAccounts();
  const isAuth = accounts.length > 0;

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
