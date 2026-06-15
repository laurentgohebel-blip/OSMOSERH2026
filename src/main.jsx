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
