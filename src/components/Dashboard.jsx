// src/components/Dashboard.jsx (version dÃ©mo sans Graph)
import React from "react";
import { useMsal } from "@azure/msal-react";

export default function Dashboard() {
  const { instance } = useMsal();
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0];

  const handleLogout = () => instance.logoutRedirect({ account });

  return (
    <div style={{padding:24,fontFamily:"system-ui"}}>
      <h1>Dashboard</h1>
      <p>Bonjour {account?.username}</p>
      <button onClick={handleLogout}>Se dÃ©connecter</button>
    </div>
  );
}