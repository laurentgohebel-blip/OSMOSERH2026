// src/authConfig.js
// Authentification : tenant Microsoft Entra External ID « Osmose RH
// Clients » (recréé le 21/08 sous le compte lgohebel@osmoserh.fr —
// l'ancien tenant da198f21 n'était plus administrable). Les clients
// créent leur compte eux-mêmes (email + mot de passe) sur la page de
// connexion aux couleurs Osmose RH ; l'accès réel est contrôlé côté
// serveur par la liste « Utilisateurs portail ».
// L'autorité utilise le GUID du tenant comme sous-domaine ciamlogin —
// même mécanique que l'API (annuaire.js), indépendante du nom choisi.
// Client ID et authority ne sont pas des secrets pour une SPA publique.
const TENANT_CLIENTS = "d0ce15bd-f382-4878-bc70-45e20eb59cfa";
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "19d1eb4c-4b45-44c5-83d1-eaacc3713776", // app « Portail Osmose RH »
    authority: `https://${TENANT_CLIENTS}.ciamlogin.com/${TENANT_CLIENTS}`,
    knownAuthorities: [`${TENANT_CLIENTS}.ciamlogin.com`],

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
export const apiRequest = { scopes: ["api://19d1eb4c-4b45-44c5-83d1-eaacc3713776/access_as_user"] };