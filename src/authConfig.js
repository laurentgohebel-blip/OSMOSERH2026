// src/authConfig.js
// Authentification : tenant Microsoft Entra External ID « Osmose RH »
// (osmoserh.onmicrosoft.com). Les clients créent leur compte eux-mêmes
// (email + mot de passe) sur la page de connexion aux couleurs Osmose RH ;
// l'accès réel est contrôlé côté serveur par la liste « Utilisateurs portail ».
// Client ID et authority ne sont pas des secrets pour une SPA publique.
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "09b5b72f-45e9-44cc-bd35-4472cf480c16", // app « Portail Osmose RH » (tenant External ID)
    authority: "https://osmoserh.ciamlogin.com/da198f21-6842-4cd2-91fb-72e91195d784",
    knownAuthorities: ["osmoserh.ciamlogin.com"],

    // En prod : l'URL de la Static Web App ; en dev : http://localhost:5173.
    // Les deux sont déclarées dans l'inscription d'application.
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,

    postLogoutRedirectUri: "/",
    navigateToLoginRequestUrl: false
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

// Scopes MINIMAUX pour le sign-in (le front ne demande pas Graph).
// "email" garantit la présence du claim email dans les jetons — c'est
// l'identité que l'API utilise pour résoudre le client.
export const loginRequest = { scopes: ["openid", "profile", "email", "offline_access"] };

// Scope de l'API du portail (/api/*) — exposé par la même app, pré-autorisé :
// aucun écran de consentement supplémentaire pour l'utilisateur.
export const apiRequest = { scopes: ["api://09b5b72f-45e9-44cc-bd35-4472cf480c16/access_as_user"] };