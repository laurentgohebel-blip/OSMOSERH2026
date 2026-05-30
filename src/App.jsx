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

  const accounts = instance.getAllAccounts();
  if (!accounts.length) return <LoginPage />;

  const user   = {
    displayName: accounts[0].name,
    email:       accounts[0].username,
    givenName:   accounts[0].idTokenClaims?.given_name,
    tenantLabel: "Client",
  };
  const goto   = (r) => { window.location.hash = r; };
  const logout = () => instance.logoutRedirect();
  const props  = { user, onNavigate: goto, onLogout: logout };

  switch (route) {
    case "conges":     return <Conges     {...props} />;
    case "documents":  return <Documents  {...props} />;
    case "formations": return <Formations {...props} />;
    case "admin":      return <AdminRH    {...props} />;
    case "production": return <Production {...props} />;
    default:
      return <Home {...props}
        kpis={{ congesRestants:12, docsNouveaux:3, formationsProchaines:1, equipeCount:18 }}
        activeRoute={route}
      />;
  }
}
