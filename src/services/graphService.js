// src/services/graphService.js
// ─────────────────────────────────────────────────────────────────────────────
// Backend Synapse — toutes les données passent par Microsoft Graph
//   - Utilisateurs   : /me, /me/photo
//   - Congés         : /me/events (Calendar API)
//   - Documents      : /me/drive  (OneDrive / SharePoint)
//   - Stockage JSON  : fichiers .json dans OneDrive (App folder)
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Scopes nécessaires (à ajouter dans authConfig.js → loginRequest)
export const GRAPH_SCOPES = [
  "User.Read",
  "User.ReadBasic.All",
  "Calendars.ReadWrite",
  "Files.ReadWrite.All",
  "Sites.ReadWrite.All",
  "Mail.Send",
];

// ─── Helper : obtenir le token d'accès ───────────────────────────────────────

/**
 * Récupère un access token silencieusement, avec fallback popup.
 * @param {import("@azure/msal-browser").IPublicClientApplication} instance
 * @param {string[]} scopes
 * @returns {Promise<string>} accessToken
 */
export async function getAccessToken(instance, scopes = GRAPH_SCOPES) {
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
  if (!account) throw new Error("[Graph] Aucun compte connecté.");

  try {
    const res = await instance.acquireTokenSilent({ scopes, account });
    return res.accessToken;
  } catch {
    // Token expiré → popup
    const res = await instance.acquireTokenPopup({ scopes, account });
    return res.accessToken;
  }
}

// ─── Helper interne : fetch authentifié ──────────────────────────────────────

async function gFetch(token, path, options = {}) {
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`[Graph ${res.status}] ${err?.error?.message || res.statusText}`);
  }

  // 204 No Content
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.blob(); // pour les photos / binaires
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. UTILISATEUR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Retourne le profil de l'utilisateur connecté.
 */
export async function getCurrentUser(instance) {
  const token = await getAccessToken(instance, ["User.Read"]);
  return gFetch(token, "/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone");
}

/**
 * Retourne la photo de profil (Blob → URL.createObjectURL).
 */
export async function getUserPhoto(instance) {
  try {
    const token = await getAccessToken(instance, ["User.Read"]);
    const blob = await gFetch(token, "/me/photo/$value", {
      headers: { "Content-Type": "image/jpeg" },
    });
    return URL.createObjectURL(blob);
  } catch {
    return null; // pas de photo → afficher initiales
  }
}

/**
 * Liste des membres de l'organisation (limité aux 50 premiers).
 */
export async function getOrgUsers(instance) {
  const token = await getAccessToken(instance, ["User.ReadBasic.All"]);
  const data = await gFetch(token, "/users?$select=id,displayName,mail,jobTitle,department&$top=50");
  return data.value || [];
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. CONGÉS — stockés comme événements Calendrier (catégorie "Congé")
// ═════════════════════════════════════════════════════════════════════════════

const CONGE_CATEGORY = "Congé Synapse";

/**
 * Récupère tous les congés de l'utilisateur (events avec catégorie "Congé Synapse").
 * @param {object} instance
 * @param {string} [year] - ex: "2025"  (défaut: année en cours)
 */
export async function getConges(instance, year) {
  const token = await getAccessToken(instance, ["Calendars.ReadWrite"]);
  const y = year || new Date().getFullYear();
  const start = `${y}-01-01T00:00:00Z`;
  const end   = `${y}-12-31T23:59:59Z`;

  const data = await gFetch(
    token,
    `/me/calendarView?startDateTime=${start}&endDateTime=${end}` +
    `&$filter=categories/any(c:c eq '${CONGE_CATEGORY}')` +
    `&$select=id,subject,start,end,categories,bodyPreview,showAs` +
    `&$orderby=start/dateTime asc` +
    `&$top=200`
  );
  return (data.value || []).map(_mapEvent);
}

/**
 * Crée une demande de congé (événement calendrier).
 * @param {object} instance
 * @param {{ subject, startDate, endDate, type, comment }} conge
 */
export async function createConge(instance, { subject, startDate, endDate, type = "CP", comment = "" }) {
  const token = await getAccessToken(instance, ["Calendars.ReadWrite"]);
  const body = {
    subject: subject || `Congé ${type}`,
    start:   { dateTime: `${startDate}T00:00:00`, timeZone: "Europe/Paris" },
    end:     { dateTime: `${endDate}T23:59:59`,   timeZone: "Europe/Paris" },
    isAllDay: true,
    showAs: "oof",
    categories: [CONGE_CATEGORY],
    body: { contentType: "text", content: comment },
  };
  const event = await gFetch(token, "/me/events", { method: "POST", body: JSON.stringify(body) });
  return _mapEvent(event);
}

/**
 * Supprime un congé (annulation).
 */
export async function deleteConge(instance, eventId) {
  const token = await getAccessToken(instance, ["Calendars.ReadWrite"]);
  await gFetch(token, `/me/events/${eventId}`, { method: "DELETE" });
  return { deleted: true };
}

/**
 * Met à jour un congé existant.
 */
export async function updateConge(instance, eventId, patch) {
  const token = await getAccessToken(instance, ["Calendars.ReadWrite"]);
  const event = await gFetch(token, `/me/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return _mapEvent(event);
}

function _mapEvent(e) {
  return {
    id:       e.id,
    subject:  e.subject,
    start:    e.start?.dateTime?.split("T")[0],
    end:      e.end?.dateTime?.split("T")[0],
    status:   e.showAs === "oof" ? "Approuvé" : "En attente",
    comment:  e.bodyPreview || "",
    categories: e.categories || [],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. DOCUMENTS — OneDrive de l'utilisateur (ou SharePoint)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les fichiers d'un dossier OneDrive.
 * @param {object} instance
 * @param {string} [folderPath] - ex: "RH/Bulletins" (défaut: racine)
 */
export async function getDocuments(instance, folderPath = "") {
  const token = await getAccessToken(instance, ["Files.ReadWrite.All"]);
  const path  = folderPath
    ? `/me/drive/root:/${encodeURIComponent(folderPath)}:/children`
    : "/me/drive/root/children";

  const data = await gFetch(
    token,
    `${path}?$select=id,name,size,lastModifiedDateTime,lastModifiedBy,webUrl,file,folder,@microsoft.graph.downloadUrl`
  );
  return (data.value || []).map(_mapDriveItem);
}

/**
 * Téléverse un fichier dans un dossier OneDrive.
 * @param {object} instance
 * @param {File}   file        - objet File du navigateur
 * @param {string} [folder]    - ex: "RH/Documents"
 */
export async function uploadDocument(instance, file, folder = "Synapse RH") {
  const token = await getAccessToken(instance, ["Files.ReadWrite.All"]);
  const path  = `/me/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(file.name)}:/content`;
  const arrayBuffer = await file.arrayBuffer();

  const item = await fetch(`${GRAPH_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: arrayBuffer,
  }).then((r) => r.json());

  return _mapDriveItem(item);
}

/**
 * Supprime un fichier OneDrive par son ID.
 */
export async function deleteDocument(instance, itemId) {
  const token = await getAccessToken(instance, ["Files.ReadWrite.All"]);
  await gFetch(token, `/me/drive/items/${itemId}`, { method: "DELETE" });
  return { deleted: true };
}

/**
 * Retourne l'URL de téléchargement direct d'un fichier OneDrive.
 */
export async function getDownloadUrl(instance, itemId) {
  const token = await getAccessToken(instance, ["Files.ReadWrite.All"]);
  const item  = await gFetch(token, `/me/drive/items/${itemId}?$select=id,@microsoft.graph.downloadUrl`);
  return item["@microsoft.graph.downloadUrl"];
}

function _mapDriveItem(item) {
  return {
    id:         item.id,
    name:       item.name,
    size:       item.size || 0,
    modified:   item.lastModifiedDateTime,
    modifiedBy: item.lastModifiedBy?.user?.displayName || "—",
    url:        item.webUrl,
    downloadUrl: item["@microsoft.graph.downloadUrl"],
    type:       item.folder ? "folder" : "file",
    ext:        item.name?.split(".").pop()?.toLowerCase() || "",
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. STOCKAGE JSON CUSTOM (App Folder OneDrive)
//    Permet de persister n'importe quelle donnée métier sous forme JSON.
//    Chemin : /me/drive/special/approot/<filename>.json
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Lit un fichier JSON dans l'App Folder OneDrive.
 * @param {object} instance
 * @param {string} filename - ex: "synapse_profil.json"
 * @returns {object|null}
 */
export async function readJsonData(instance, filename) {
  const token = await getAccessToken(instance, ["Files.ReadWrite.All"]);
  try {
    const item = await gFetch(
      token,
      `/me/drive/special/approot:/${encodeURIComponent(filename)}:/content`,
      { headers: { "Content-Type": "application/json" } }
    );
    return item; // déjà parsé par gFetch si JSON
  } catch (err) {
    if (err.message.includes("404") || err.message.includes("itemNotFound")) return null;
    throw err;
  }
}

/**
 * Écrit / écrase un fichier JSON dans l'App Folder OneDrive.
 * @param {object} instance
 * @param {string} filename - ex: "synapse_profil.json"
 * @param {object} data
 */
export async function writeJsonData(instance, filename, data) {
  const token = await getAccessToken(instance, ["Files.ReadWrite.All"]);
  const blob  = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const res   = await fetch(
    `${GRAPH_BASE}/me/drive/special/approot:/${encodeURIComponent(filename)}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: blob,
    }
  );
  if (!res.ok) throw new Error(`[Graph writeJson] ${res.status} ${res.statusText}`);
  return res.json();
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. NOTIFICATIONS — envoi d'email via Graph Mail
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Envoie un email via Microsoft Graph (Mail.Send).
 * @param {object} instance
 * @param {{ to, subject, bodyHTML }} mail
 */
export async function sendEmail(instance, { to, subject, bodyHTML }) {
  const token = await getAccessToken(instance, ["Mail.Send"]);
  await gFetch(token, "/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: bodyHTML },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  });
  return { sent: true };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. MICROSOFT LISTS (SharePoint) — pour données multi-utilisateurs
//    Idéal pour un admin RH qui gère l'ensemble des congés de l'équipe.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les items d'une liste SharePoint.
 * @param {object} instance
 * @param {string} siteId   - ID du site SharePoint
 * @param {string} listId   - ID de la liste
 * @param {string} [filter] - ex: "fields/Statut eq 'En attente'"
 */
export async function getListItems(instance, siteId, listId, filter = "") {
  const token = await getAccessToken(instance, ["Sites.ReadWrite.All"]);
  let path = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;
  if (filter) path += `&$filter=${encodeURIComponent(filter)}`;
  const data = await gFetch(token, path);
  return (data.value || []).map((i) => ({ id: i.id, ...i.fields }));
}

/**
 * Crée un item dans une liste SharePoint.
 */
export async function createListItem(instance, siteId, listId, fields) {
  const token = await getAccessToken(instance, ["Sites.ReadWrite.All"]);
  const item  = await gFetch(token, `/sites/${siteId}/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  return { id: item.id, ...item.fields };
}

/**
 * Met à jour un item dans une liste SharePoint.
 */
export async function updateListItem(instance, siteId, listId, itemId, fields) {
  const token = await getAccessToken(instance, ["Sites.ReadWrite.All"]);
  await gFetch(token, `/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  return { updated: true };
}

/**
 * Supprime un item dans une liste SharePoint.
 */
export async function deleteListItem(instance, siteId, listId, itemId) {
  const token = await getAccessToken(instance, ["Sites.ReadWrite.All"]);
  await gFetch(token, `/sites/${siteId}/lists/${listId}/items/${itemId}`, { method: "DELETE" });
  return { deleted: true };
}

// ─── Export groupé (pratique pour l'import) ──────────────────────────────────
export default {
  // Auth helper
  getAccessToken,
  // User
  getCurrentUser,
  getUserPhoto,
  getOrgUsers,
  // Congés
  getConges,
  createConge,
  deleteConge,
  updateConge,
  // Documents
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDownloadUrl,
  // JSON storage
  readJsonData,
  writeJsonData,
  // Email
  sendEmail,
  // SharePoint Lists
  getListItems,
  createListItem,
  updateListItem,
  deleteListItem,
};
