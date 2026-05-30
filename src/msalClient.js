// src/msalClient.js
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";

export const pca = new PublicClientApplication(msalConfig);

/**
 * Récupère la cible (next) depuis l'URL ou fallback '/dashboard'
 */
export function getNextFromQuery() {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("next") || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

/**
 * Initialise MSAL et gère le retour de redirection.
 * Retourne la "nextRoute" (= où aller après login).
 */
export async function initMsalAndHandleRedirect() {
  // Initialise MSAL (doit précéder handleRedirectPromise)
  await pca.initialize();

  // 1) Traite le retour de loginRedirect
  const result = await pca.handleRedirectPromise().catch((e) => {
    console.error("[MSAL] handleRedirectPromise error:", e);
    return null;
  });

  // 2) Si MSAL a renvoyé un compte actif, on le sélectionne
  const accounts = pca.getAllAccounts();
  if (accounts.length > 0) {
    pca.setActiveAccount(accounts[0]);
  }

  // 3) Détermine la cible
  //    Priorité: result?.state -> query ?next=... -> '/dashboard'
  let next = "/dashboard";
  if (result?.state && typeof result.state === "string") {
    next = result.state;
  } else {
    next = getNextFromQuery();
  }

  return next;
}