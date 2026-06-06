import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

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
    try {
      const newTrigger = await api.createTrigger(triggerData);
      setTriggers(prev => [...prev, newTrigger]);
      return newTrigger;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateTrigger = async (id, triggerData) => {
    try {
      const updatedTrigger = await api.updateTrigger(id, triggerData);
      setTriggers(prev => prev.map(t => (t.id === id ? updatedTrigger : t)));
      return updatedTrigger;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteTrigger = async (id) => {
    try {
      await api.deleteTrigger(id);
      setTriggers(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const toggleTrigger = async (id) => {
    try {
      const updatedTrigger = await api.toggleTrigger(id);
      setTriggers(prev => prev.map(t => (t.id === id ? updatedTrigger : t)));
      return updatedTrigger;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const reorderTriggers = async (items) => {
    try {
      await api.reorderTriggers(items);
      // Optimistic update of local state
      setTriggers(prev => {
        const sorted = [...prev];
        const orderMap = {};
        items.forEach(item => orderMap[item.id] = item.sort_order);
        sorted.forEach(t => {
          if (orderMap[t.id] !== undefined) t.sort_order = orderMap[t.id];
        });
        return sorted.sort((a, b) => a.sort_order - b.sort_order);
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const bulkGroup = async (ids, groupName, groupColor) => {
    try {
      await api.bulkGroup(ids, groupName, groupColor);
      await fetchTriggers(); // Refresh completely to get new UUIDs
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const bulkDelete = async (ids) => {
    try {
      await api.bulkDelete(ids);
      setTriggers(prev => prev.filter(t => !ids.includes(t.id)));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const bulkToggle = async (ids, is_active) => {
    try {
      await api.bulkToggle(ids, is_active);
      setTriggers(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_active } : t));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const bulkCreate = async (rules) => {
    try {
      const newRules = await api.bulkCreate(rules);
      setTriggers(prev => [...prev, ...newRules].sort((a, b) => a.sort_order - b.sort_order));
    } catch (err) {
      setError(err.message);
      throw err;
    }
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
    reorderTriggers,
    bulkGroup,
    bulkDelete,
    bulkToggle,
    bulkCreate
  };
}
