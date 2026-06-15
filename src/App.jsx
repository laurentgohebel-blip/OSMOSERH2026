// src/App.jsx
import React, { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import LoginPage  from "./LoginPage.jsx";
import Home       from "./components/Home.jsx";
import Conges     from "./components/Conges.jsx";
import Documents  from "./components/Documents.jsx";
import Formations from "./components/Formations.jsx";
import AdminRH    from "./components/Adminrh.jsx";
import Production from "./components/Production.jsx";

function getRoute() {
  const h = window.location.hash.replace(/^[#/]+/, "").trim();
  return h || "dashboard";
}

export default function App() {
  const { instance } = useMsal();
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const h = () => setRoute(getRoute());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  // Bypass d'auth en DEV uniquement (VITE_DEV_NO_AUTH=true) : permet de voir
  // l'app en local sans login Microsoft. En prod, le flag est absent → MSAL requis.
  const DEV_NO_AUTH = import.meta.env.VITE_DEV_NO_AUTH === "true";
  const accounts = instance.getAllAccounts();
  if (!DEV_NO_AUTH && !accounts.length) return <LoginPage />;

  const account = accounts[0];
  const user   = account
    ? {
        displayName: account.name,
        email:       account.username,
        givenName:   account.idTokenClaims?.given_name,
        tenantLabel: "Client",
      }
    : {
        displayName: "Sophie Martin",
        email:       "sophie.martin@pme-demo.fr",
        givenName:   "Sophie",
        tenantLabel: "PME Démo (dev)",
      };
  const goto   = (r) => { window.location.hash = r; };
  const logout = () => instance.logoutRedirect();
  const props  = { user, onNavigate: goto, onLogout: logout, msalInstance: instance };

  switch (route) {
    case "conges":     return <Conges     {...props} />;
    case "documents":  return <Documents  {...props} />;
    case "formations": return <Formations {...props} />;
    case "admin":      return <AdminRH    {...props} msalInstance={instance} />;
    case "production": return <Production {...props} />;
    default:
      return <Home {...props}
        kpis={{ congesRestants:12, docsNouveaux:3, formationsProchaines:1, equipeCount:18 }}
        activeRoute={route}
      />;
  }
}
