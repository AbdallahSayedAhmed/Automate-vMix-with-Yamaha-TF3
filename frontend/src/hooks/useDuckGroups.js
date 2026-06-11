import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

export function useDuckGroups() {
  const [duckGroups, setDuckGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDuckGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDuckGroups();
      setDuckGroups(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDuckGroups();
  }, [fetchDuckGroups]);

  const addDuckGroup = async (data) => {
    const created = await api.createDuckGroup(data);
    setDuckGroups((prev) =>
      [...prev, created].sort((a, b) => a.sort_order - b.sort_order),
    );
    return created;
  };

  const updateDuckGroup = async (id, data) => {
    const updated = await api.updateDuckGroup(id, data);
    setDuckGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
    return updated;
  };

  const deleteDuckGroup = async (id) => {
    setDuckGroups((prev) => prev.filter((g) => g.id !== id));
    try {
      await api.deleteDuckGroup(id);
    } catch (err) {
      await fetchDuckGroups();
      throw err;
    }
  };

  const toggleDuckGroup = async (id) => {
    const prev = duckGroups.find((g) => g.id === id);
    if (prev) {
      setDuckGroups((gs) =>
        gs.map((g) => (g.id === id ? { ...g, is_active: !g.is_active } : g)),
      );
    }
    try {
      const updated = await api.toggleDuckGroup(id);
      setDuckGroups((gs) => gs.map((g) => (g.id === id ? updated : g)));
      return updated;
    } catch (err) {
      if (prev) setDuckGroups((gs) => gs.map((g) => (g.id === id ? prev : g)));
      throw err;
    }
  };

  const duplicateDuckGroup = async (id) => {
    const copy = await api.duplicateDuckGroup(id);
    setDuckGroups((prev) =>
      [...prev, copy].sort((a, b) => a.sort_order - b.sort_order),
    );
    return copy;
  };

  return {
    duckGroups,
    loading,
    error,
    fetchDuckGroups,
    addDuckGroup,
    updateDuckGroup,
    deleteDuckGroup,
    toggleDuckGroup,
    duplicateDuckGroup,
  };
}
