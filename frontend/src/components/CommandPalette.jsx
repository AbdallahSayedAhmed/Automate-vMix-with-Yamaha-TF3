import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Zap,
  Activity,
  Settings,
  Keyboard,
  Power,
  Edit3,
  Trash2,
  Hash,
  CheckSquare,
  ListChecks,
} from "lucide-react";

/**
 * Command palette.
 *
 * Fixes vs the previous version:
 * - "Create New Rule" used to call onEditRule(null), but onEditRule is
 *   handleEditClick which immediately reads rule.id — that was a guaranteed
 *   crash the moment someone used it. Now routed through a dedicated
 *   onNewRule prop.
 * - Selecting a rule result used to call onEditRule(t.id) (a number)
 *   instead of onEditRule(t) (the rule object) — handleEditClick does
 *   setEditForm(rule), so this was silently corrupting the editor form
 *   with a bare number instead of rule data. Fixed to pass the object.
 * - onDeleteRule and the per-row toggle were accepted as props/defined
 *   but never actually wired to anything in the UI. Both are now real
 *   buttons on each rule result.
 * - Added: typing a pure number jumps straight to "rule #N" (mirrors the
 *   Ctrl+Q quick-select shortcut), and a couple of missing default actions
 *   (Select All, Toggle All Rules, Open Shortcuts) for parity with the
 *   toolbar.
 */
export function CommandPalette({
  isOpen,
  onClose,
  triggers,
  onToggleRule,
  onEditRule,
  onDeleteRule,
  onNewRule,
  onRunPreset,
  onSelectAll,
  onToggleAllRules,
  onOpenShortcuts,
  presets,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const numberedRules = useMemo(() => {
    return [...triggers]
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((rule, index) => ({ num: index + 1, rule }));
  }, [triggers]);

  const results = useMemo(() => {
    if (!query) {
      return [
        { id: "action-new", type: "action", label: "Create New Rule", hint: "N", icon: Edit3, action: () => { onNewRule?.(); onClose(); } },
        { id: "action-selectall", type: "action", label: "Select All Rules", hint: "Ctrl+A", icon: CheckSquare, action: () => { onSelectAll?.(); onClose(); } },
        { id: "action-killswitch", type: "action", label: "Toggle All Rules (Kill Switch)", hint: "Ctrl+Shift+A", icon: Power, action: () => { onToggleAllRules?.(); onClose(); } },
        { id: "action-shortcuts", type: "action", label: "Keyboard Shortcuts", hint: "?", icon: Keyboard, action: () => { onOpenShortcuts?.(); onClose(); } },
        { id: "action-settings", type: "action", label: "Open Settings", icon: Settings, action: () => { window.dispatchEvent(new CustomEvent("open-settings")); onClose(); } },
        ...presets.map((p) => ({ id: `preset-${p.id}`, type: "preset", label: `Run Preset: ${p.label}`, icon: Zap, action: () => { onRunPreset(p); onClose(); } })),
      ];
    }

    // Pure numeric query → jump straight to "rule #N", mirroring Ctrl+Q.
    if (/^\d+$/.test(query.trim())) {
      const n = parseInt(query.trim(), 10);
      const entry = numberedRules.find((x) => x.num === n);
      if (entry) {
        return [
          {
            id: `jump-${entry.rule.id}`,
            type: "jump",
            label: `Jump to rule #${n}: ${entry.rule.name}`,
            group: entry.rule.group_name,
            active: entry.rule.is_active,
            icon: Hash,
            action: () => { onEditRule(entry.rule); onClose(); },
            toggle: () => onToggleRule(entry.rule.id),
            rule: entry.rule,
          },
        ];
      }
      return [];
    }

    const q = query.toLowerCase();
    return triggers
      .filter((t) => t.name.toLowerCase().includes(q) || (t.group_name && t.group_name.toLowerCase().includes(q)))
      .slice(0, 10)
      .map((t) => ({
        id: `rule-${t.id}`,
        type: "rule",
        label: t.name,
        group: t.group_name,
        active: t.is_active,
        icon: Activity,
        action: () => { onEditRule(t); onClose(); },
        toggle: () => onToggleRule(t.id),
        rule: t,
      }));
  }, [query, triggers, presets, numberedRules, onEditRule, onToggleRule, onRunPreset, onNewRule, onSelectAll, onToggleAllRules, onOpenShortcuts, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (results.length) setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (results.length) setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-xl bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/5">
          <Search size={18} className="text-[#5A6278] mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search rules, presets, actions, or type a number to jump…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#D8DCE6] placeholder-[#5A6278]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-bold text-[#5A6278]">ESC</div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2" ref={listRef}>
          {results.length > 0 ? (
            results.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  index === selectedIndex ? "bg-[#20D9FF]/10 text-[#20D9FF]" : "hover:bg-white/5 text-[#8B93A8]"
                }`}
                onClick={() => item.action()}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center min-w-0">
                  <item.icon size={16} className={`mr-3 shrink-0 ${index === selectedIndex ? "text-[#20D9FF]" : "text-[#5A6278]"}`} />
                  <div className="truncate">
                    <div className={`text-sm font-semibold ${index === selectedIndex ? "text-[#D8DCE6]" : ""}`}>
                      {item.label}
                    </div>
                    {item.group && (
                      <div className="text-[10px] opacity-60 uppercase tracking-wider font-bold">{item.group}</div>
                    )}
                  </div>
                </div>

                {(item.type === "rule" || item.type === "jump") && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title={item.active ? "Disable rule" : "Enable rule"}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.toggle();
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10"
                    >
                      <Power size={13} className={item.active ? "text-[#39E58C]" : "text-[#5A6278]"} />
                    </button>
                    {onDeleteRule && (
                      <button
                        type="button"
                        title="Delete rule"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onDeleteRule(item.rule);
                        }}
                        className="p-1.5 rounded-lg hover:bg-[#FF5C7A]/10"
                      >
                        <Trash2 size={13} className="text-[#5A6278] hover:text-[#FF5C7A]" />
                      </button>
                    )}
                    <div className="text-[10px] font-bold uppercase tracking-tighter opacity-40 ml-1">
                      {item.type === "jump" ? "Jump" : "Rule"}
                    </div>
                  </div>
                )}
                {item.type === "preset" && (
                  <div className="text-[10px] font-bold uppercase tracking-tighter text-[#F6B44B] bg-[#F6B44B]/10 px-1.5 py-0.5 rounded">Preset</div>
                )}
                {item.type === "action" && (
                  <div className="flex items-center gap-2 shrink-0">
                    {item.hint && (
                      <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold text-[#5A6278]">
                        {item.hint}
                      </kbd>
                    )}
                    <div className="text-[10px] font-bold uppercase tracking-tighter opacity-40">Action</div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-[#5A6278] text-sm">
              {/^\d+$/.test(query.trim())
                ? `No rule numbered ${query.trim()} (${numberedRules.length} total)`
                : `No results found for "${query}"`}
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold text-[#5A6278]">↑↓</div>
              <span className="text-[10px] text-[#5A6278]">Navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold text-[#5A6278]">↵</div>
              <span className="text-[10px] text-[#5A6278]">Select</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ListChecks size={11} className="text-[#5A6278]" />
              <span className="text-[10px] text-[#5A6278]">Type a number to jump to a rule</span>
            </div>
          </div>
          <div className="text-[10px] text-[#5A6278] font-medium italic">
            Command Palette
          </div>
        </div>
      </motion.div>
    </div>
  );
}
