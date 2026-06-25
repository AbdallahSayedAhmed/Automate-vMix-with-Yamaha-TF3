const BASE_URL = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = 'Request failed';
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch { /* ignore */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return true;
  return res.json();
}

export const api = {
  getTriggers: () => request(`${BASE_URL}/triggers/`),

  createTrigger: (trigger) =>
    request(`${BASE_URL}/triggers/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trigger),
    }),

  updateTrigger: (id, trigger) =>
    request(`${BASE_URL}/triggers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trigger),
    }),

  deleteTrigger: (id) => request(`${BASE_URL}/triggers/${id}`, { method: 'DELETE' }),

  toggleTrigger: (id) => request(`${BASE_URL}/triggers/${id}/toggle`, { method: 'PATCH' }),

  duplicateTrigger: (id) => request(`${BASE_URL}/triggers/${id}/duplicate`, { method: 'POST' }),

  reorderTriggers: (items) =>
    request(`${BASE_URL}/triggers/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    }),

  bulkGroup: (ids, group_name, group_color, group_id = null) =>
    request(`${BASE_URL}/triggers/bulk-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, group_name, group_color, group_id }),
    }),

  bulkDelete: (ids) =>
    request(`${BASE_URL}/triggers/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),

  bulkToggle: (ids, is_active) =>
    request(`${BASE_URL}/triggers/bulk-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, is_active }),
    }),

  bulkCreate: (rules) =>
    request(`${BASE_URL}/triggers/bulk-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    }),

  getVmixInputs: () => request(`${BASE_URL}/vmix/inputs`),
  getVmixStatus: () => request(`${BASE_URL}/vmix/status`),
  getDuckGroups: () => request(`${BASE_URL}/duck-groups/`),

  createDuckGroup: (group) =>
    request(`${BASE_URL}/duck-groups/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group),
    }),

  updateDuckGroup: (id, group) =>
    request(`${BASE_URL}/duck-groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group),
    }),

  deleteDuckGroup: (id) => request(`${BASE_URL}/duck-groups/${id}`, { method: 'DELETE' }),

  toggleDuckGroup: (id) => request(`${BASE_URL}/duck-groups/${id}/toggle`, { method: 'PATCH' }),

  duplicateDuckGroup: (id) =>
    request(`${BASE_URL}/duck-groups/${id}/duplicate`, { method: 'POST' }),

  getSettings: () => request(`${BASE_URL}/settings/`),
  updateSettings: (settings) =>
    request(`${BASE_URL}/settings/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }),
};
