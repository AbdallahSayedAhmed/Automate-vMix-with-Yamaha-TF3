import { useState, useEffect, useCallback } from "react";
import { DEFAULT_PRESETS } from "../constants/ruleConfig";

const PREFS_KEY = "avbridge_prefs";
const PRESETS_KEY = "avbridge_presets";
const SHORTCUTS_KEY = "avbridge_shortcuts";

export const DEFAULT_SHORTCUTS = {
  newRule: { id: "newRule", keys: "n", label: "New rule", category: "Rules" },
  saveRule: {
    id: "saveRule",
    keys: "ctrl+s",
    label: "Save rule (in editor)",
    category: "Rules",
  },
  closePanel: {
    id: "closePanel",
    keys: "escape",
    label: "Cancel / clear clipboard / close",
    category: "General",
  },
  confirmAction: {
    id: "confirmAction",
    keys: "enter",
    label: "Confirm dialog action",
    category: "General",
  },
  focusSearch: {
    id: "focusSearch",
    keys: "/",
    label: "Focus search",
    category: "Navigation",
  },
  selectAll: {
    id: "selectAll",
    keys: "ctrl+a",
    label: "Select all rules",
    category: "Selection",
  },
  clearSelection: {
    id: "clearSelection",
    keys: "ctrl+shift+a",
    label: "Clear rule selection",
    category: "Selection",
  },
  duplicate: {
    id: "duplicate",
    keys: "ctrl+d",
    label: "Duplicate selected",
    category: "Rules",
  },
  copyRule: {
    id: "copyRule",
    keys: "ctrl+c",
    label: "Copy selected to clipboard (ready to paste)",
    category: "Clipboard",
  },
  pasteRule: {
    id: "pasteRule",
    keys: "ctrl+v",
    label: "Paste as new rule(s)",
    category: "Clipboard",
  },
  pasteInto: {
    id: "pasteInto",
    keys: "ctrl+shift+v",
    label: "Paste into selected rule(s)",
    category: "Clipboard",
  },
  clearClipboard: {
    id: "clearClipboard",
    keys: "ctrl+shift+x",
    label: "Clear copy clipboard",
    category: "Clipboard",
  },
  togglePower: {
    id: "togglePower",
    keys: "ctrl+shift+o",
    label: "Toggle on/off selected",
    category: "Selection",
  },
  groupRules: {
    id: "groupRules",
    keys: "ctrl+g",
    label: "Group selected rules",
    category: "Selection",
  },
  deleteSelected: {
    id: "deleteSelected",
    keys: "delete",
    label: "Delete selected rule(s)",
    category: "Rules",
  },
  selectByNumber: {
    id: "selectByNumber",
    keys: "ctrl+q",
    label: "Select rule by number",
    category: "Selection",
  },
  editRule: {
    id: "editRule",
    keys: "e",
    label: "Edit selected rule",
    category: "Rules",
  },
  undo: {
    id: "undo",
    keys: "ctrl+z",
    label: "Undo last action",
    category: "General",
  },
  shortcutsHelp: {
    id: "shortcutsHelp",
    keys: "?",
    label: "Show shortcuts",
    category: "General",
  },
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeKeys(keys) {
  return (keys || "").toLowerCase().replace(/\s+/g, "").trim();
}

/** Split "delete,ctrl+backspace" into normalized binding list. */
export function normalizeKeysList(keysString) {
  if (!keysString) return [];
  return keysString
    .split(",")
    .map((k) => normalizeKeys(k))
    .filter(Boolean);
}

export function normalizeKeysListInput(keysString) {
  return normalizeKeysList(keysString).join(",");
}

export function bindingUsesModifier(keys) {
  const k = normalizeKeys(keys);
  return (
    k.includes("ctrl+") || k.includes("alt+") || k.includes("shift+backspace")
  );
}

export function eventMatchesBindings(e, keysString) {
  const parsed = parseShortcutEvent(e);
  return normalizeKeysList(keysString).includes(parsed);
}

export function parseShortcutEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  let key = e.key.toLowerCase();
  if (key === " ") key = "space";
  if (!["control", "shift", "alt", "meta"].includes(key)) parts.push(key);
  return parts.join("+");
}

export function findMatchingShortcut(e, shortcuts) {
  const parsed = parseShortcutEvent(e);
  for (const sc of Object.values(shortcuts)) {
    if (sc && normalizeKeysList(sc.keys).includes(parsed)) return sc;
  }
  return null;
}

/** Which binding within a shortcut matched this key event (if any). */
export function findMatchedBinding(e, keysString) {
  const parsed = parseShortcutEvent(e);
  return normalizeKeysList(keysString).find((b) => b === parsed) ?? null;
}

/** Block browser default when this key combo is assigned to the app. */
export function shouldBlockBrowserForShortcut(shortcut, isInput) {
  if (!shortcut) return false;
  return normalizeKeysList(shortcut.keys).some((keys) => {
    if (keys.includes("ctrl+") || keys.includes("alt+")) return true;
    if (keys === "escape") return true;
    if (isInput)
      return keys === "ctrl+s" || keys === "ctrl+z" || keys === "escape";
    return true;
  });
}

export function blockBrowserShortcut(e) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function")
    e.stopImmediatePropagation();
}

export function findShortcutConflict(shortcuts, id, keys) {
  const newBindings = normalizeKeysList(keys);
  if (!newBindings.length) return "Shortcut cannot be empty";
  for (const binding of newBindings) {
    for (const [sid, sc] of Object.entries(shortcuts)) {
      if (sid === id) continue;
      if (normalizeKeysList(sc.keys).includes(binding)) {
        return `Already used by "${sc.label}"`;
      }
    }
  }
  return null;
}

export function useAppPreferences() {
  const [showFieldHints, setShowFieldHints] = useState(
    () => loadJson(PREFS_KEY, { showFieldHints: true }).showFieldHints ?? true,
  );
  const [presets, setPresets] = useState(() =>
    loadJson(PRESETS_KEY, DEFAULT_PRESETS),
  );
  const [shortcuts, setShortcuts] = useState(() => {
    const saved = loadJson(SHORTCUTS_KEY, null);
    const merged = saved
      ? { ...DEFAULT_SHORTCUTS, ...saved }
      : { ...DEFAULT_SHORTCUTS };

    if (merged.copyRule?.keys === "ctrl+shift+c")
      merged.copyRule = { ...merged.copyRule, keys: "ctrl+c" };
    if (merged.pasteRule?.keys === "ctrl+shift+v")
      merged.pasteRule = { ...merged.pasteRule, keys: "ctrl+v" };
    if (merged.editRule?.keys === "enter")
      merged.editRule = { ...merged.editRule, keys: "e" };
    return merged;
  });

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ showFieldHints }));
  }, [showFieldHints]);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
  }, [shortcuts]);

  const updateShortcut = useCallback(
    (id, keys) => {
      const conflict = findShortcutConflict(shortcuts, id, keys);
      if (conflict) return conflict;
      setShortcuts((prev) => ({
        ...prev,
        [id]: { ...prev[id], keys: normalizeKeysListInput(keys) },
      }));
      return null;
    },
    [shortcuts],
  );

  const resetShortcuts = useCallback(
    () => setShortcuts({ ...DEFAULT_SHORTCUTS }),
    [],
  );

  const addPreset = useCallback((label, form) => {
    const id = `preset-${Date.now()}`;
    setPresets((p) => [...p, { id, label, form }]);
    return id;
  }, []);

  const updatePreset = useCallback((id, updates) => {
    setPresets((p) => p.map((x) => (x.id === id ? { ...x, ...updates } : x)));
  }, []);

  const removePreset = useCallback((id) => {
    setPresets((p) => p.filter((x) => x.id !== id));
  }, []);

  const saveCurrentAsPreset = useCallback(
    (label, form) => {
      const clean = { ...form };
      [
        "id",
        "created_at",
        "updated_at",
        "fire_count",
        "last_fired_at",
        "group_id",
        "group_name",
        "group_color",
        "sort_order",
      ].forEach((k) => delete clean[k]);
      return addPreset(label, clean);
    },
    [addPreset],
  );

  const matchShortcut = useCallback(
    (e, actionId) => {
      const sc = shortcuts[actionId];
      return sc && eventMatchesBindings(e, sc.keys);
    },
    [shortcuts],
  );

  const matchedBinding = useCallback(
    (e, actionId) => {
      const sc = shortcuts[actionId];
      return sc ? findMatchedBinding(e, sc.keys) : null;
    },
    [shortcuts],
  );

  const findMatch = useCallback(
    (e) => findMatchingShortcut(e, shortcuts),
    [shortcuts],
  );

  const shouldBlockBrowser = useCallback(
    (e, isInput) => {
      const matched = findMatchingShortcut(e, shortcuts);
      return shouldBlockBrowserForShortcut(matched, isInput);
    },
    [shortcuts],
  );

  const getKeysLabel = useCallback(
    (actionId) => {
      const sc = shortcuts[actionId];
      if (!sc) return "";
      return normalizeKeysList(sc.keys)
        .map((binding) =>
          binding
            .split("+")
            .map((k) => (k.length === 1 ? k.toUpperCase() : k))
            .join(" + "),
        )
        .join(" · ");
    },
    [shortcuts],
  );

  return {
    showFieldHints,
    setShowFieldHints,
    presets,
    addPreset,
    updatePreset,
    removePreset,
    saveCurrentAsPreset,
    shortcuts,
    updateShortcut,
    resetShortcuts,
    matchShortcut,
    matchedBinding,
    findMatch,
    shouldBlockBrowser,
    blockBrowserShortcut,
    getKeysLabel,
    DEFAULT_SHORTCUTS,
  };
}
