// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { pca, initMsalAndHandleRedirect } from "./msalClient";
import App from "./App.jsx";

function Splash() {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}>
      Initialisationâ€¦
    </div>
  );
}

(async () => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(<Splash />);

  // Lance MSAL + traite le retour redirect
  const nextRoute = await initMsalAndHandleRedirect();

  // Rends l'app
  root.render(
    <React.StrictMode>
      <MsalProvider instance={pca}>
        <App initialRoute={nextRoute} />
      </MsalProvider>
    </React.StrictMode>
  );

  // Si tu utilises React Router, on peut pousser ici vers initialRoute
  // Exemple (pseudo):
  // import { navigate } from "./router";
  // navigate(nextRoute);
})();