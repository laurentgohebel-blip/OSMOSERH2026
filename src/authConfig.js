// src/authConfig.js
export const msalConfig = {
  auth: {
    // ⚠️ mets ici le Client ID de l'App SPA créée dans ton tenant interne (pas celui de CIAM)
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "0cc9877f-07e3-46c0-93e9-1c2f55ade914",

    // Authority = ton tenant interne (remplace par ton TENANT_ID interne)
    authority: "https://login.microsoftonline.com/b9cfc83f-9274-459b-a7ea-62dca3451e8c",

    // Redirection locale (aligne EXACTEMENT avec ce que tu as enregistré dans l'app)
    redirectUri: import.meta.env.VITE_REDIRECT_URI || "https://ashy-pebble-0206b8703.7.azurestaticapps.net/",

    postLogoutRedirectUri: "/",
    // knownAuthorities n'est pas nécessaire avec login.microsoftonline.com
    navigateToLoginRequestUrl: false
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

// Scopes MINIMAUX pour le sign-in (le front ne demande pas Graph)
export const loginRequest = { scopes: ["openid", "profile", "offline_access"] };
