// src/authConfig.js
export const msalConfig = {
  auth: {
    clientId: "c7631e50-4129-4e08-b27d-3445b5c37082",
    authority: "https://login.microsoftonline.com/b9cfc83f-9274-459b-a7ea-62dca3451e8c",
    redirectUri: import.meta.env.VITE_REDIRECT_URI || "https://ashy-pebble-0206b8703.7.azurestaticapps.net/",
    postLogoutRedirectUri: "/",
    navigateToLoginRequestUrl: false
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

export const loginRequest = {
  scopes: ["openid", "profile"]
};
