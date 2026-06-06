const BASE_URL = '/api';

export const api = {
  // Triggers
  getTriggers: async () => {
    const res = await fetch(`${BASE_URL}/triggers/`);
    if (!res.ok) throw new Error('Failed to fetch triggers');
    return res.json();
  },
  
  createTrigger: async (trigger) => {
    const res = await fetch(`${BASE_URL}/triggers/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trigger)
    });
    if (!res.ok) throw new Error('Failed to create trigger');
    return res.json();
  },

  updateTrigger: async (id, trigger) => {
    const res = await fetch(`${BASE_URL}/triggers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trigger)
    });
    if (!res.ok) throw new Error('Failed to update trigger');
    return res.json();
  },

  deleteTrigger: async (id) => {
    const res = await fetch(`${BASE_URL}/triggers/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete trigger');
    return true;
  },

  toggleTrigger: async (id) => {
    const res = await fetch(`${BASE_URL}/triggers/${id}/toggle`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Failed to toggle trigger');
    return res.json();
  },

  reorderTriggers: async (items) => {
    const res = await fetch(`${BASE_URL}/triggers/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    });
    if (!res.ok) throw new Error('Failed to reorder triggers');
    return res.json();
  },

  bulkGroup: async (ids, group_name, group_color) => {
    const res = await fetch(`${BASE_URL}/triggers/bulk-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, group_name, group_color })
    });
    if (!res.ok) throw new Error('Failed to group triggers');
    return res.json();
  },

  bulkDelete: async (ids) => {
    const res = await fetch(`${BASE_URL}/triggers/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) throw new Error('Failed to delete triggers');
    return res.json();
  },

  bulkToggle: async (ids, is_active) => {
    const res = await fetch(`${BASE_URL}/triggers/bulk-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, is_active })
    });
    if (!res.ok) throw new Error('Failed to toggle triggers');
    return res.json();
  },

  bulkCreate: async (rules) => {
    const res = await fetch(`${BASE_URL}/triggers/bulk-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules })
    });
    if (!res.ok) throw new Error('Failed to bulk create triggers');
    return res.json();
  },

  // vMix
  getVmixInputs: async () => {
    const res = await fetch(`${BASE_URL}/vmix/inputs`);
    if (!res.ok) throw new Error('Failed to fetch vMix inputs');
    return res.json();
  },
  
  getVmixStatus: async () => {
    const res = await fetch(`${BASE_URL}/vmix/status`);
    if (!res.ok) throw new Error('Failed to fetch vMix status');
    return res.json();
  },

  // Settings
  getSettings: async () => {
    const res = await fetch(`${BASE_URL}/settings/`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (settings) => {
    const res = await fetch(`${BASE_URL}/settings/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  }
};
