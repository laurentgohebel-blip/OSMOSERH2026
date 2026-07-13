// src/apiClient.js — fetch vers /api/* avec le jeton External ID.
// L'API valide ce jeton (verrou serveur) : sans lui, 401.
// En dev local sans compte, le fetch part sans jeton — l'API absente
// déclenche le mode démo des formulaires, comme avant.
import { pca } from "./msalClient";
import { apiRequest } from "./authConfig";

export async function apiFetch(chemin, options = {}) {
  let jeton = null;
  const compte = pca.getAllAccounts()[0];
  if (compte) {
    try {
      ({ accessToken: jeton } = await pca.acquireTokenSilent({ ...apiRequest, account: compte }));
    } catch {
      // jeton silencieux impossible (session expirée) : une interaction est nécessaire
      try { ({ accessToken: jeton } = await pca.acquireTokenPopup({ ...apiRequest, account: compte })); }
      catch { /* l'utilisateur a refermé la fenêtre — l'API répondra 401 */ }
    }
  }
  return fetch(chemin, {
    ...options,
    headers: { ...(options.headers || {}), ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
  });
}
