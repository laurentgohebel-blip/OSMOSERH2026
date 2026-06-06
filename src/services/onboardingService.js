// src/services/onboardingService.js
// ─────────────────────────────────────────────────────────────────────────────
// Couche métier Onboarding — persistance SharePoint
//
// Structure de la liste "Onboarding" :
//   Title          (text)   — ID parcours, ex: ONB-2026-001
//   EmployeeName   (text)
//   EmployeeEmail  (text)
//   Position       (text)   — Intitulé poste
//   Department     (text)
//   Manager        (text)   — Nom du manager
//   StartDate      (text)   — YYYY-MM-DD
//   Status         (choice) — in_progress | completed | canceled
//   TasksJson      (text)   — JSON sérialisé des tâches
//   CreatedAt      (text)
// ─────────────────────────────────────────────────────────────────────────────

import { getAccessToken } from "./graphService.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Sites.ReadWrite.All"];

function getSiteId()   { return import.meta.env.VITE_SP_SITE_ID || null; }
function getListId()   { return import.meta.env.VITE_SP_ONBOARDING_LIST_ID || null; }

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

function mapItem(item) {
  const f = item.fields || {};
  let tasks = [];
  try { tasks = JSON.parse(f.TasksJson || "[]"); } catch { tasks = []; }
  return {
    id:            f.Title         || item.id,
    spItemId:      item.id,
    employeeName:  f.EmployeeName  || "",
    employeeEmail: f.EmployeeEmail || "",
    position:      f.Position      || "",
    department:    f.Department    || "",
    manager:       f.Manager       || "",
    startDate:     f.StartDate     || "",
    status:        f.Status        || "in_progress",
    tasks,
    createdAt:     f.CreatedAt     || "",
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE — Tâches d'onboarding standard pour une PME
// ═════════════════════════════════════════════════════════════════════════════

export const DEFAULT_TASKS = [
  { id: "t1",  category: "Administratif",  icon: "📄", title: "Contrat de travail signé",         responsible: "RH",        daysBeforeStart: 7,  done: false },
  { id: "t2",  category: "Administratif",  icon: "📋", title: "DPAE déclarée",                    responsible: "RH",        daysBeforeStart: 1,  done: false },
  { id: "t3",  category: "Administratif",  icon: "🏥", title: "Affiliation mutuelle/prévoyance",   responsible: "RH",        daysBeforeStart: 3,  done: false },
  { id: "t4",  category: "Logistique",     icon: "🪑", title: "Préparer le poste de travail",     responsible: "Office Mgr",daysBeforeStart: 2,  done: false },
  { id: "t5",  category: "IT",             icon: "💻", title: "Création comptes M365 / Email",    responsible: "IT",        daysBeforeStart: 3,  done: false },
  { id: "t6",  category: "IT",             icon: "📱", title: "Matériel (laptop, téléphone)",     responsible: "IT",        daysBeforeStart: 2,  done: false },
  { id: "t7",  category: "Logistique",     icon: "🔑", title: "Badge d'accès et clés bureau",     responsible: "Office Mgr",daysBeforeStart: 1,  done: false },
  { id: "t8",  category: "Intégration",    icon: "🤝", title: "Accueil et tour des locaux",       responsible: "Manager",   daysAfterStart:  0,  done: false },
  { id: "t9",  category: "Intégration",    icon: "👥", title: "Présentation à l'équipe",          responsible: "Manager",   daysAfterStart:  0,  done: false },
  { id: "t10", category: "Intégration",    icon: "📚", title: "Documentation interne remise",     responsible: "Manager",   daysAfterStart:  1,  done: false },
  { id: "t11", category: "Suivi",          icon: "☕", title: "Café d'intégration avec l'équipe", responsible: "Manager",   daysAfterStart:  3,  done: false },
  { id: "t12", category: "Suivi",          icon: "📊", title: "Point manager fin J+7",            responsible: "Manager",   daysAfterStart:  7,  done: false },
  { id: "t13", category: "Suivi",          icon: "🎯", title: "Entretien fin période d'essai",    responsible: "RH",        daysAfterStart: 60,  done: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// CRUD
// ═════════════════════════════════════════════════════════════════════════════

export async function getAllOnboardings(instance) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) return null;

  const token = await getAccessToken(instance, SCOPES);
  const data = await gFetch(
    token,
    `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200&$orderby=fields/StartDate desc`
  );
  return (data.value || []).map(mapItem);
}

export async function createOnboarding(instance, payload) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) return null;

  const token = await getAccessToken(instance, SCOPES);
  const today = new Date().toISOString().split("T")[0];

  const item = await gFetch(token, `/sites/${siteId}/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({
      fields: {
        Title:         payload.id,
        EmployeeName:  payload.employeeName  || "",
        EmployeeEmail: payload.employeeEmail || "",
        Position:      payload.position      || "",
        Department:    payload.department    || "",
        Manager:       payload.manager       || "",
        StartDate:     payload.startDate     || "",
        Status:        "in_progress",
        TasksJson:     JSON.stringify(payload.tasks || DEFAULT_TASKS),
        CreatedAt:     today,
      },
    }),
  });
  return mapItem(item);
}

export async function updateOnboardingTasks(instance, spItemId, tasks) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) return null;

  const token = await getAccessToken(instance, SCOPES);
  await gFetch(token, `/sites/${siteId}/lists/${listId}/items/${spItemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify({ TasksJson: JSON.stringify(tasks) }),
  });
  return { updated: true };
}

export async function updateOnboardingStatus(instance, spItemId, newStatus) {
  const siteId = getSiteId();
  const listId = getListId();
  if (!siteId || !listId) return null;

  const token = await getAccessToken(instance, SCOPES);
  await gFetch(token, `/sites/${siteId}/lists/${listId}/items/${spItemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify({ Status: newStatus }),
  });
  return { updated: true };
}

export function isSharePointConfigured() {
  return !!(import.meta.env.VITE_SP_SITE_ID && import.meta.env.VITE_SP_ONBOARDING_LIST_ID);
}
