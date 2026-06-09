import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

function mergeTriggers(prev, updated) {
  const map = new Map(updated.map((t) => [t.id, t]));
  return prev.map((t) => (map.has(t.id) ? map.get(t.id) : t));
}

export function useTriggers() {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTriggers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTriggers();
      setTriggers(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const addTrigger = async (triggerData) => {
    const newTrigger = await api.createTrigger(triggerData);
    setTriggers((prev) => [...prev, newTrigger].sort((a, b) => a.sort_order - b.sort_order));
    return newTrigger;
  };

  const updateTrigger = async (id, triggerData) => {
    const updatedTrigger = await api.updateTrigger(id, triggerData);
    setTriggers((prev) => prev.map((t) => (t.id === id ? updatedTrigger : t)));
    return updatedTrigger;
  };

  const deleteTrigger = async (id) => {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTrigger(id);
    } catch (err) {
      await fetchTriggers();
      throw err;
    }
  };

  const toggleTrigger = async (id) => {
    const prev = triggers.find((t) => t.id === id);
    if (prev) {
      setTriggers((ts) => ts.map((t) => (t.id === id ? { ...t, is_active: !t.is_active } : t)));
    }
    try {
      const updated = await api.toggleTrigger(id);
      setTriggers((ts) => ts.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (err) {
      if (prev) setTriggers((ts) => ts.map((t) => (t.id === id ? prev : t)));
      setError(err.message);
      throw err;
    }
  };

  const duplicateTrigger = async (id) => {
    const copy = await api.duplicateTrigger(id);
    setTriggers((prev) => [...prev, copy].sort((a, b) => a.sort_order - b.sort_order));
    return copy;
  };

  const reorderTriggers = async (items) => {
    const orderMap = Object.fromEntries(items.map((i) => [i.id, i.sort_order]));
    setTriggers((prev) => {
      const sorted = prev.map((t) =>
        orderMap[t.id] !== undefined ? { ...t, sort_order: orderMap[t.id] } : t
      );
      return sorted.sort((a, b) => a.sort_order - b.sort_order);
    });
    try {
      await api.reorderTriggers(items);
    } catch (err) {
      await fetchTriggers();
      throw err;
    }
  };

  const bulkGroup = async (ids, groupName, groupColor, groupId = null) => {
    const updated = await api.bulkGroup(ids, groupName, groupColor, groupId);
    setTriggers((prev) => mergeTriggers(prev, updated));
    return updated;
  };

  const bulkDelete = async (ids) => {
    setTriggers((prev) => prev.filter((t) => !ids.includes(t.id)));
    try {
      await api.bulkDelete(ids);
    } catch (err) {
      await fetchTriggers();
      throw err;
    }
  };

  const bulkToggle = async (ids, is_active) => {
    setTriggers((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, is_active } : t)));
    try {
      const updated = await api.bulkToggle(ids, is_active);
      setTriggers((prev) => mergeTriggers(prev, updated));
    } catch (err) {
      await fetchTriggers();
      throw err;
    }
  };

  const bulkCreate = async (rules) => {
    const newRules = await api.bulkCreate(rules);
    setTriggers((prev) => [...prev, ...newRules].sort((a, b) => a.sort_order - b.sort_order));
    return newRules;
  };

  return {
    triggers,
    loading,
    error,
    fetchTriggers,
    addTrigger,
    updateTrigger,
    deleteTrigger,
    toggleTrigger,
    duplicateTrigger,
    reorderTriggers,
    bulkGroup,
    bulkDelete,
    bulkToggle,
    bulkCreate,
  };
}
