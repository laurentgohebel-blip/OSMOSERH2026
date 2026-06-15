// src/services/synapseApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Client de l'API synapse-core (backend souverain).
//   - getAttention() : surface "à traiter" (déterministe)
//   - askAssistant() : copilote RH (nécessite une clé Mistral côté backend)
//
// Base configurable via VITE_SYNAPSE_API (défaut: http://localhost:8080).
// ─────────────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_SYNAPSE_API || "http://localhost:8080";

// ⚠️ DEV — identité de démo (alignée sur le seed du backend).
// À remplacer par la vraie session/rôle quand l'auth sera branchée.
const DEMO_HEADERS = {
  "x-tenant-id": "11111111-1111-1111-1111-111111111111",
  "x-user-id": "22222222-2222-2222-2222-222222222222",
  "x-user-role": "hr",
};

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `API ${res.status}`);
  }
  return res.json();
}

/** Surface "à traiter" — { items: [{ type, severity, data, summary }] } */
export async function getAttention() {
  const res = await fetch(`${API}/attention`, { headers: DEMO_HEADERS });
  return handle(res);
}

/** Copilote RH — { route, intent, data, answer, sources, confidence } */
export async function askAssistant(question) {
  const res = await fetch(`${API}/assistant/ask`, {
    method: "POST",
    headers: { ...DEMO_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return handle(res);
}

/** Tâches générées par le moteur de cascades. */
export async function getTasks(status) {
  const url = status ? `${API}/tasks?status=${encodeURIComponent(status)}` : `${API}/tasks`;
  const res = await fetch(url, { headers: DEMO_HEADERS });
  return handle(res);
}

/** Met à jour une tâche : { status } (Fait) ou { due_date } (Reporter). */
export async function updateTask(id, patch) {
  const res = await fetch(`${API}/tasks/${id}`, {
    method: "PATCH",
    headers: { ...DEMO_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle(res);
}

/** Lance le scan d'échéances (déclenche les cascades applicables). */
export async function runScan() {
  const res = await fetch(`${API}/cascades/scan`, { method: "POST", headers: DEMO_HEADERS });
  return handle(res);
}

// ── Workflows (situations guidées) ───────────────────────────────────────────

export async function getWorkflows() {
  const res = await fetch(`${API}/workflows`, { headers: DEMO_HEADERS });
  return handle(res);
}
export async function getWorkflowRuns() {
  const res = await fetch(`${API}/workflows/runs`, { headers: DEMO_HEADERS });
  return handle(res);
}
export async function startWorkflow(type) {
  const res = await fetch(`${API}/workflows`, {
    method: "POST",
    headers: { ...DEMO_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  return handle(res);
}
export async function getWorkflowRun(id) {
  const res = await fetch(`${API}/workflows/runs/${id}`, { headers: DEMO_HEADERS });
  return handle(res);
}
export async function saveWorkflowFiche(id, fiche) {
  const res = await fetch(`${API}/workflows/runs/${id}/fiche`, {
    method: "PUT",
    headers: { ...DEMO_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ fiche }),
  });
  return handle(res);
}
export async function completeWorkflowStep(id, key) {
  const res = await fetch(`${API}/workflows/runs/${id}/steps/${key}/complete`, {
    method: "POST",
    headers: DEMO_HEADERS,
  });
  return handle(res);
}
export async function getWorkflowDocument(id, key) {
  const res = await fetch(`${API}/workflows/runs/${id}/steps/${key}/document`, { headers: DEMO_HEADERS });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.text();
}

export const SYNAPSE_API = API;
