// src/services/congesService.js
// ─────────────────────────────────────────────────────────────────────────────
// Couche métier Congés — persistance dans une liste SharePoint "Conges"
//
// Structure de la liste SharePoint attendue (colonnes) :
//   Title         (text)   — ID de la demande ex: REQ-2026-001
//   EmployeeEmail (text)
//   EmployeeName  (text)
//   Type          (text)   — CP | RTT | Récup | Sans solde
//   StartDate     (text)   — YYYY-MM-DD
//   EndDate       (text)
//   StartHalf     (text)   — AM | PM
//   EndHalf       (text)   — AM | PM
//   Days          (number)
//   Statut        (choice) — pending | approved | rejected | canceled
//   Comment       (text)   — commentaire employé
//   ManagerComment(text)   — commentaire manager lors de la décision
//   CreatedAt     (text)   — YYYY-MM-DD
//
// Configuration : VITE_SP_SITE_ID et VITE_SP_CONGES_LIST_ID dans .env.local
// ─────────────────────────────────────────────────────────────────────────────

import { getAccessToken } from "./graphService.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Sites.ReadWrite.All"];

function getSiteId() {
  return import.meta.env.VITE_SP_SITE_ID || null;
}
function getListId() {
  return import.meta.env.VITE_SP_CONGES_LIST_ID || null;
}

/** Helper interne : fetch Graph authentifié */
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
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = body?.error?.message || body || res.statusText;
    throw new Error(`[Graph ${res.status}] ${msg}`);
  }
  return body;
}

/** Mappe un item SharePoint → objet demande normalisé */
function mapItem(item) {
  const f = item.fields || {};
  return {
    id:              f.Title        || item.id,
    spItemId:        item.id,           // ID interne SharePoint (pour PATCH/DELETE)
    employeeName:    f.EmployeeName  || "",
    employeeEmail:   f.EmployeeEmail || "",
    type:            f.Type          || "CP",
    startDate:       f.StartDate     || "",
    endDate:         f.EndDate       || "",
    startHalf:       f.StartHalf     || "AM",
    endHalf:         f.EndHalf       || "PM",
    days:            Number(f.Days)  || 0,
    status:          f.Statut        || "pending",
    comment:         f.Comment       || "",
    managerComment:  f.ManagerComment|| "",
    createdAt:       f.CreatedAt     || "",
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// READ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Récupère toutes les demandes de congé (admin / manager).
 * @param {object} instance — MSAL instance
 * @param {string} [statut]  — filtre optionnel : "pending" | "approved" | "rejected" | "canceled"
 */
export async function getAllConges(instance, statut = null) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) {
    console.warn("[congesService] VITE_SP_SITE_ID ou VITE_SP_CONGES_LIST_ID manquant — données mock utilisées.");
    return null; // signal "pas configuré" → les composants utilisent leurs mocks
  }

  const token = await getAccessToken(instance, SCOPES);
  let path = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=500&$orderby=fields/CreatedAt desc`;
  if (statut) {
    path += `&$filter=fields/Statut eq '${statut}'`;
  }
  const data = await gFetch(token, path);
  return (data.value || []).map(mapItem);
}

/**
 * Récupère les demandes d'un employé précis.
 * @param {object} instance
 * @param {string} email — email de l'employé
 */
export async function getCongesEmployee(instance, email) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) return null;

  const token = await getAccessToken(instance, SCOPES);
  const path = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`
    + `&$filter=fields/EmployeeEmail eq '${encodeURIComponent(email)}'`
    + `&$orderby=fields/StartDate desc`;
  const data = await gFetch(token, path);
  return (data.value || []).map(mapItem);
}

// ═════════════════════════════════════════════════════════════════════════════
// CREATE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Crée une demande de congé dans SharePoint.
 * @param {object} instance
 * @param {object} payload — { id, employeeName, employeeEmail, type, startDate, endDate, startHalf, endHalf, days, comment }
 */
export async function createCongeRequest(instance, payload) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) {
    console.warn("[congesService] SharePoint non configuré — demande sauvegardée localement uniquement.");
    return null;
  }

  const token = await getAccessToken(instance, SCOPES);
  const today = new Date().toISOString().split("T")[0];

  const item = await gFetch(token, `/sites/${siteId}/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({
      fields: {
        Title:         payload.id,
        EmployeeEmail: payload.employeeEmail || "",
        EmployeeName:  payload.employeeName  || "",
        Type:          payload.type,
        StartDate:     payload.startDate,
        EndDate:       payload.endDate,
        StartHalf:     payload.startHalf     || "AM",
        EndHalf:       payload.endHalf       || "PM",
        Days:          payload.days,
        Statut:        "pending",
        Comment:       payload.comment       || "",
        ManagerComment:"",
        CreatedAt:     today,
      },
    }),
  });

  return mapItem(item);
}

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE STATUS (approbation / refus / annulation)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Met à jour le statut d'une demande (approve | reject | cancel).
 * @param {object} instance
 * @param {string} spItemId       — ID SharePoint de l'item
 * @param {"approved"|"rejected"|"canceled"} newStatus
 * @param {string} [managerComment]
 */
export async function updateCongeStatus(instance, spItemId, newStatus, managerComment = "") {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) return null;

  const token = await getAccessToken(instance, SCOPES);
  await gFetch(token, `/sites/${siteId}/lists/${listId}/items/${spItemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify({
      Statut:        newStatus,
      ManagerComment: managerComment,
    }),
  });
  return { updated: true };
}

/**
 * Annule une demande (par l'employé lui-même).
 */
export async function cancelCongeRequest(instance, spItemId) {
  return updateCongeStatus(instance, spItemId, "canceled");
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═════════════════════════════════════════════════════════════════════════════

/** Retourne true si le service SharePoint est configuré */
export function isSharePointConfigured() {
  return !!(import.meta.env.VITE_SP_SITE_ID && import.meta.env.VITE_SP_CONGES_LIST_ID);
}
