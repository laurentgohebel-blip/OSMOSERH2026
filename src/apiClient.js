// src/apiClient.js — fetch vers /api/* avec le jeton External ID.
// L'API valide ce jeton (verrou serveur) : sans lui, 401.
// En dev local sans compte, le fetch part sans jeton — l'API absente
// déclenche le mode démo des formulaires, comme avant.
import { pca } from "./msalClient";
import { apiRequest } from "./authConfig";
import { demoActive, reponseDemo } from "./demo/modeDemo";

export async function apiFetch(chemin, options = {}) {
  // Mode démonstration : tout /api/* est servi localement (données fictives),
  // aucun appel réseau, aucun jeton — voir src/demo/modeDemo.js.
  if (demoActive()) return reponseDemo(chemin, options);

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
  // « x-osmose-jeton » : Static Web Apps écrase Authorization avant les
  // fonctions managées ; un en-tête personnalisé arrive intact. On envoie
  // aussi Authorization pour le dev local (func start, pas de proxy SWA).
  return fetch(chemin, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(jeton ? { "x-osmose-jeton": jeton, Authorization: `Bearer ${jeton}` } : {}),
    },
  });
}
