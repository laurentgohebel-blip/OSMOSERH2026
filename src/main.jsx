// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { pca, initMsalAndHandleRedirect } from "./msalClient";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

function Splash() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      Initialisation…
    </div>
  );
}

function FatalError({ error }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 820, margin: "40px auto" }}>
      <h2 style={{ color: "#dc2626", marginBottom: 12 }}>Échec de l'initialisation</h2>
      <pre style={{
        background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8,
        padding: 16, whiteSpace: "pre-wrap", fontSize: 13, color: "#7f1d1d", overflow: "auto",
      }}>
        {String(error?.stack || error?.message || error)}
      </pre>
    </div>
  );
}

(async () => {
  const root = ReactDOM.createRoot(document.getElementById("root"));

  // Onboarding salarié : lien public ?onboarding=<jeton> — formulaire
  // autonome SANS authentification (le salarié n'a pas de compte), donc
  // avant toute initialisation MSAL.
  const jetonOnboarding = new URLSearchParams(window.location.search).get("onboarding");
  if (jetonOnboarding) {
    const { default: OnboardingSalarie } = await import("./components/OnboardingSalarie.jsx");
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <OnboardingSalarie jeton={jetonOnboarding} />
        </ErrorBoundary>
      </React.StrictMode>
    );
    return;
  }

  // Pointage : lien public ?pointage=<jeton> ouvert par le QR code
  // affiché près de la porte. Même principe que l'onboarding — le
  // salarié n'a pas de compte, donc rien de MSAL ne doit démarrer.
  const jetonPointage = new URLSearchParams(window.location.search).get("pointage");
  if (jetonPointage) {
    const { default: PointageSalarie } = await import("./components/PointageSalarie.jsx");
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <PointageSalarie jeton={jetonPointage} />
        </ErrorBoundary>
      </React.StrictMode>
    );
    return;
  }

  root.render(<Splash />);

  try {
    const nextRoute = await initMsalAndHandleRedirect();
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <MsalProvider instance={pca}>
            <App initialRoute={nextRoute} />
          </MsalProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e) {
    console.error("[init]", e);
    root.render(<FatalError error={e} />);
  }
})();
