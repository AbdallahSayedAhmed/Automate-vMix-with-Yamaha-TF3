import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  CopyPlus,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Download,
  Upload,
  CheckSquare,
  Square,
  Layers,
  Clipboard,
  Mic,
  Video,
  Speaker,
  MonitorSpeaker,
  AlertTriangle,
  Unlink,
  Hash,
  Pencil,
  Search,
  GripVertical,
  Keyboard,
  X,
  Zap,
  Undo2,
} from "lucide-react";
import { QuickPresetsPanel } from "./QuickPresetsPanel";
import { useUndoHistory } from "../hooks/useUndoHistory";
import { ActivationToggle } from "./ActivationToggle";
import { FloatingActionBar } from "./FloatingActionBar";
import { RuleEditorDrawer, DEFAULT_RULE_FORM } from "./RuleEditorDrawer";
import { GroupModal } from "./GroupModal";
import { useTriggers } from "../hooks/useTriggers";
import {
  useAppPreferences,
  blockBrowserShortcut,
} from "../hooks/useAppPreferences";
import {
  formatListenDetail,
  formatCommandDetail,
  formatLastFired,
  ruleMatchesSearch,
  ruleMatchesFilter,
  RULE_FILTERS,
  YAMAHA_CMD_LABELS,
  VMIX_FN_LABELS,
} from "../constants/ruleConfig";
import {
  meterLevelToWidth,
  meterLevelToColor,
  formatMemberAction,
  parseMultiFade,
  formatMultiFade,
} from "../constants/duckGroupConfig";
import { ShortcutsPanel } from "./ShortcutsPanel";
import { toast } from "sonner";
import { api } from "../services/api";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function nextCopyName(base, existingNames) {
  const stripped = (base || "Copy").replace(/ \(\d+\)$/, "");
  let n = 1;
  while (existingNames.includes(`${stripped} (${n})`)) n += 1;
  return `${stripped} (${n})`;
}

function lastRuleByOrder(rules) {
  return [...rules].sort((a, b) => a.sort_order - b.sort_order).at(-1);
}

function snapshotRule(t) {
  if (!t) return null;
  return JSON.parse(JSON.stringify(t));
}

/** Full PUT payload for restoring a rule (all mutable fields, explicit nulls). */
function buildRestorePayload(rule) {
  if (!rule) return null;
  return {
    name: rule.name,
    sort_order: rule.sort_order ?? 0,
    group_id: rule.group_id ?? null,
    group_name: rule.group_name ?? null,
    group_color: rule.group_color ?? null,
    listen_source: rule.listen_source ?? "vmix",
    trigger_event: rule.trigger_event,
    vmix_input_number: rule.vmix_input_number ?? null,
    vmix_input_name: rule.vmix_input_name ?? null,
    threshold: rule.threshold ?? null,
    release_threshold: rule.release_threshold ?? null,
    silence_timeout_ms: rule.silence_timeout_ms ?? null,
    time_threshold: rule.time_threshold ?? null,
    is_multi_duck: rule.is_multi_duck ?? false,
    duck_members: rule.duck_members ?? [],
    action_target: rule.action_target ?? "yamaha",
    yamaha_command: rule.yamaha_command,
    yamaha_channel: rule.yamaha_channel ?? 1,
    yamaha_mix: rule.yamaha_mix ?? 0,
    vmix_function: rule.vmix_function ?? null,
    vmix_target_input: rule.vmix_target_input ?? null,
    parameter_value: rule.parameter_value ?? "0",
    delay_ms: rule.delay_ms ?? 0,
    is_active: rule.is_active !== false,
  };
}

function normalizeMultiDuckPayload(payload) {
  if (!(payload.listen_source === "yamaha" && payload.is_multi_duck)) return payload;
  const fade = parseMultiFade(payload.parameter_value);
  return {
    ...payload,
    parameter_value: formatMultiFade(fade.attack, fade.release),
    duck_members: Array.isArray(payload.duck_members) ? payload.duck_members : [],
  };
}

function snapshotOrderIds(list) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.id);
}

function hexToRgba(hex, alpha) {
  const n = parseInt((hex || "#3b82f6").replace("#", ""), 16) || 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const RuleNum = React.memo(({ n }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "22px",
      height: "22px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 900,
      flexShrink: 0,
      background: "rgba(148,163,184,0.08)",
      color: "#475569",
      border: "1px solid rgba(148,163,184,0.1)",
    }}
  >
    {n}
  </span>
));

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}) {
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const runConfirm = () => {
    const result = onConfirmRef.current?.();
    if (result?.then) {
      result.then(() => onCancel()).catch(() => {});
    } else {
      onCancel();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter") {
        const tag = e.target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        e.stopPropagation();
        runConfirm();
      }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "linear-gradient(145deg,#1e2535,#16202e)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "28px",
          width: "380px",
          boxShadow: "0 0 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: danger
                ? "rgba(239,68,68,0.12)"
                : "rgba(245,158,11,0.12)",
              border: danger
                ? "1px solid rgba(239,68,68,0.2)"
                : "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <AlertTriangle
              size={26}
              style={{ color: danger ? "#f87171" : "#fbbf24" }}
            />
          </div>
        </div>
        <h3
          style={{
            textAlign: "center",
            fontWeight: 900,
            fontSize: "16px",
            color: "white",
            marginBottom: "8px",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.6,
            marginBottom: "20px",
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel <span style={{ opacity: 0.5, fontSize: 11 }}>Esc</span>
          </button>
          <button
            onClick={runConfirm}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "10px",
              background: danger
                ? "linear-gradient(135deg,#ef4444,#b91c1c)"
                : "linear-gradient(135deg,#f59e0b,#b45309)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: danger
                ? "0 4px 24px rgba(239,68,68,0.3)"
                : "0 4px 24px rgba(245,158,11,0.3)",
            }}
          >
            {confirmLabel}{" "}
            <span style={{ opacity: 0.65, fontSize: 11 }}>↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Wrapper ─────────────────────────────────────────────────────────
function SortableRuleWrapper({
  id,
  item,
  idx,
  editingId,
  ruleNumbers,
  selectedIds,
  toggleTrigger,
  handleEditClick,
  handleDeleteRule,
  handleDuplicate,
  handlePasteInto,
  toggleSelection,
  handleMove,
  displayItems,
  meters,
  triggeredRules,
  actionStates,
  vmixInputs,
  pasteMode,
  expandedMultiDuckIds,
  toggleMultiDuckExpand,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <RuleRow
      key={item.rule.id}
      trigger={item.rule}
      ruleNum={ruleNumbers[item.rule.id]}
      isGrouped={false}
      pasteMode={pasteMode}
      isSelected={selectedIds.includes(item.rule.id)}
      isEditing={editingId === item.rule.id}
      onToggle={toggleTrigger}
      onEdit={handleEditClick}
      onDelete={handleDeleteRule}
      onDuplicate={handleDuplicate}
      onPasteInto={handlePasteInto}
      onSelect={toggleSelection}
      onMove={(dir) => handleMove(idx, dir)}
      isFirst={idx === 0}
      isLast={idx === displayItems.length - 1}
      meters={meters}
      triggeredRules={triggeredRules}
      actionStates={actionStates}
      vmixInputs={vmixInputs}
      multiExpanded={expandedMultiDuckIds?.has(item.rule.id)}
      onToggleMultiExpand={() => toggleMultiDuckExpand?.(item.rule.id)}
      style={style}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
    />
  );
}

function SortableGroupWrapper({
  id,
  item,
  idx,
  selectedIds,
  editingId,
  ruleNumbers,
  toggleGroupSelection,
  openGroupModal,
  handleUngroup,
  handleMove,
  handleCopy,
  handleDuplicateGroup,
  toggleTrigger,
  handleEditClick,
  handleDeleteRule,
  handleDuplicate,
  handlePasteInto,
  toggleSelection,
  displayItems,
  meters,
  triggeredRules,
  actionStates,
  collapsedGroups,
  toggleGroupCollapse,
  vmixInputs,
  pasteMode,
  expandedMultiDuckIds,
  toggleMultiDuckExpand,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  const gSel = item.rules.every((r) => selectedIds.includes(r.id));
  const bg = hexToRgba(item.color, 0.07);
  const bgD = hexToRgba(item.color, 0.13);
  const col = item.color || "#3b82f6";

  return (
    <React.Fragment key={"g-" + item.id}>
      <tr
        ref={setNodeRef}
        style={{ background: bgD, borderTop: `2px solid ${col}`, ...style }}
      >
        <td style={{ padding: "8px 8px", borderLeft: `3px solid ${col}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div
              {...attributes}
              {...listeners}
              style={{ cursor: "grab", color: "#64748b" }}
            >
              <GripVertical size={14} />
            </div>
            <button
              onClick={() => toggleGroupSelection(item.rules)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#475569",
                lineHeight: 1,
              }}
            >
              {gSel ? (
                <CheckSquare size={14} style={{ color: "#22d3ee" }} />
              ) : (
                <Square size={14} />
              )}
            </button>
          </div>
        </td>
        <td colSpan={4} style={{ padding: "8px 12px", background: bgD }}>
          <button
            type="button"
            onClick={() => toggleGroupCollapse(item.id)}
            className="flex items-center gap-2"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <ChevronRight
              size={14}
              style={{
                color: col,
                transform: collapsedGroups[item.id]
                  ? "rotate(0deg)"
                  : "rotate(90deg)",
                transition: "transform 0.2s",
              }}
            />
            <span style={{ fontWeight: 900, fontSize: "13px", color: col }}>
              {item.name}
            </span>
            <span style={{ fontSize: "11px", color: "#5A6278" }}>
              ({item.rules.length})
            </span>
          </button>
        </td>
        <td style={{ background: bgD }} />
        <td style={{ padding: "8px 8px", background: bgD, textAlign: "right" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "2px",
            }}
          >
            <button
              onClick={() =>
                openGroupModal({
                  id: item.id,
                  name: item.name,
                  color: item.color,
                })
              }
              title="Edit group name/color"
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Pencil size={11} /> Edit
            </button>
            <button
              onClick={() => handleUngroup(item.rules)}
              title="Dissolve group"
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Unlink size={11} />
            </button>
            <button
              onClick={() => handleMove(idx, "up")}
              disabled={idx === 0}
              style={{
                padding: "3px",
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
                opacity: idx === 0 ? 0.2 : 1,
              }}
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={() => handleMove(idx, "down")}
              disabled={idx === displayItems.length - 1}
              style={{
                padding: "3px",
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
                opacity: idx === displayItems.length - 1 ? 0.2 : 1,
              }}
            >
              <ArrowDown size={13} />
            </button>
            <button
              onClick={() => handleCopy("group", item.rules)}
              title="Copy group to clipboard"
              style={{
                padding: "3px",
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <Clipboard size={12} />
            </button>
            <button
              onClick={() => handleDuplicateGroup(item)}
              title="Duplicate group"
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <CopyPlus size={11} /> Dup
            </button>
          </div>
        </td>
        <td style={{ background: bgD }} />
      </tr>
      {!collapsedGroups[item.id] &&
        item.rules.map((t) => (
          <RuleRow
            key={t.id}
            trigger={t}
            ruleNum={ruleNumbers[t.id]}
            isGrouped
            groupBg={bg}
            borderCol={col}
            pasteMode={pasteMode}
            isSelected={selectedIds.includes(t.id)}
            isEditing={editingId === t.id}
            onToggle={toggleTrigger}
            onEdit={handleEditClick}
            onDelete={handleDeleteRule}
            onDuplicate={handleDuplicate}
            onPasteInto={handlePasteInto}
            onSelect={toggleSelection}
            onMove={null}
            meters={meters}
            triggeredRules={triggeredRules}
            actionStates={actionStates}
            vmixInputs={vmixInputs}
            multiExpanded={expandedMultiDuckIds?.has(t.id)}
            onToggleMultiExpand={() => toggleMultiDuckExpand?.(t.id)}
          />
        ))}
    </React.Fragment>
  );
}

// ─── PanelA ───────────────────────────────────────────────────────────────────
export const PanelA = React.memo(function PanelA({
  vmixConnected,
  meters = {},
  triggeredRules = {},
  actionStates = {},
}) {
  const {
    triggers,
    loading,
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
  } = useTriggers();
  const [vmixInputs, setVmixInputs] = useState([]);
  const [expandedMultiDuckIds, setExpandedMultiDuckIds] = useState(() => new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...DEFAULT_RULE_FORM });
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedData, setCopiedData] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: "",
    color: "#20D9FF",
    isEditing: false,
    editGroupId: null,
  });
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [ruleFilter, setRuleFilter] = useState("all");
  const [vmixInputFilter, setVmixInputFilter] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const [quickSelectValue, setQuickSelectValue] = useState("");
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const prefs = useAppPreferences();
  const undoHistory = useUndoHistory();
  const showConfirm = (opts) => setConfirmModal({ isOpen: true, ...opts });
  const hideConfirm = () => setConfirmModal((p) => ({ ...p, isOpen: false }));

  const toggleGroupCollapse = (gid) =>
    setCollapsedGroups((p) => ({ ...p, [gid]: !p[gid] }));
  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setIsCreating(false);
    setEditForm({ ...DEFAULT_RULE_FORM });
  };

  useEffect(() => {
    if (vmixConnected)
      api.getVmixInputs().then(setVmixInputs).catch(console.error);
  }, [vmixConnected]);

  // Refresh fire counts when rules trigger live
  useEffect(() => {
    if (!Object.keys(triggeredRules).length) return;
    const t = setTimeout(() => fetchTriggers(), 600);
    return () => clearTimeout(t);
  }, [triggeredRules, fetchTriggers]);

  // ── Memoized display items & rule numbers ─────────────────────────────────
  const { displayItems, ruleNumbers } = useMemo(() => {
    const filteredTriggers = triggers.filter(
      (t) =>
        ruleMatchesSearch(t, searchQuery) &&
        ruleMatchesFilter(
          t,
          ruleFilter,
          ruleFilter === "vmix_input" ? vmixInputFilter : null,
        ),
    );

    const items = [];
    let curGid = null,
      curRules = [];
    filteredTriggers.forEach((t) => {
      if (t.group_id) {
        if (curGid !== t.group_id) {
          if (curGid)
            items.push({
              type: "group",
              id: curGid,
              rules: curRules,
              name: curRules[0].group_name,
              color: curRules[0].group_color,
            });
          curGid = t.group_id;
          curRules = [t];
        } else curRules.push(t);
      } else {
        if (curGid) {
          items.push({
            type: "group",
            id: curGid,
            rules: curRules,
            name: curRules[0].group_name,
            color: curRules[0].group_color,
          });
          curGid = null;
          curRules = [];
        }
        items.push({ type: "rule", id: t.id, rule: t });
      }
    });
    if (curGid)
      items.push({
        type: "group",
        id: curGid,
        rules: curRules,
        name: curRules[0].group_name,
        color: curRules[0].group_color,
      });

    let c = 0;
    const nums = {};
    items.forEach((item) => {
      if (item.type === "group")
        item.rules.forEach((r) => {
          nums[r.id] = ++c;
        });
      else nums[item.rule.id] = ++c;
    });
    return { displayItems: items, ruleNumbers: nums };
  }, [triggers, searchQuery, ruleFilter, vmixInputFilter]);

  // ── Detect same-group selection ───────────────────────────────────────────
  const selectedGroupInfo = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const sel = triggers.filter((t) => selectedIds.includes(t.id));
    if (sel.length === 0) return null;
    const gid = sel[0].group_id;
    if (!gid || !sel.every((t) => t.group_id === gid)) return null;
    return { id: gid, name: sel[0].group_name, color: sel[0].group_color };
  }, [selectedIds, triggers]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEditClick = (t) => {
    setEditingId(t.id);
    const members = Array.isArray(t.duck_members)
      ? t.duck_members
      : typeof t.duck_members === "string"
        ? (() => {
            try {
              return JSON.parse(t.duck_members);
            } catch {
              return [];
            }
          })()
        : [];
    setEditForm({ ...t, duck_members: members, is_multi_duck: !!t.is_multi_duck });
    setIsCreating(false);
    setEditorOpen(true);
  };

  const toggleMultiDuckExpand = (id) => {
    setExpandedMultiDuckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({ ...DEFAULT_RULE_FORM });
    setEditorOpen(true);
  };
  const buildPayload = (form) => {
    const p = { ...form };
    ["id", "created_at", "updated_at", "fire_count", "last_fired_at"].forEach(
      (k) => delete p[k],
    );
    return normalizeMultiDuckPayload(p);
  };

  const pushReorderUndo = (label, orderBefore) => {
    undoHistory.push({
      label,
      undo: async () =>
        reorderTriggers(orderBefore.map((id, i) => ({ id, sort_order: i }))),
    });
  };

  const restoreDeletedRules = async (deletedRules, orderBefore) => {
    const created = await bulkCreate(deletedRules.map((r) => buildPayload(r)));
    const idMap = Object.fromEntries(
      deletedRules.map((old, i) => [old.id, created[i].id]),
    );
    const newOrder = orderBefore.map((id) => idMap[id] || id);
    await reorderTriggers(newOrder.map((id, i) => ({ id, sort_order: i })));
  };

  const handleUndoRequest = () => {
    if (undoHistory.canUndo) setUndoConfirmOpen(true);
  };

  const performUndo = async () => {
    setUndoConfirmOpen(false);
    const openRuleId = editorOpen ? editingId : null;
    try {
      const label = await undoHistory.executeUndo();
      if (!label) {
        toast.error("Nothing to undo");
        return;
      }
      await fetchTriggers();
      if (openRuleId) {
        const fresh = await api.getTriggers();
        const restored = fresh.find((t) => t.id === openRuleId);
        if (restored) setEditForm({ ...restored });
      }
      toast.success(`Undid: ${label}`);
    } catch (e) {
      toast.error(e.message || "Undo failed");
      await fetchTriggers();
    }
  };

  const wrappedToggleTrigger = async (id) => {
    const before = triggers.find((t) => t.id === id);
    if (!before) return;
    await toggleTrigger(id);
    undoHistory.push({
      label: `${before.is_active ? "Disable" : "Enable"} "${before.name}"`,
      undo: async () => bulkToggle([id], before.is_active),
    });
  };

  const handleSave = async () => {
    if (!editForm.name?.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload(editForm);
      if (isCreating) {
        const mo =
          triggers.length > 0
            ? Math.max(...triggers.map((t) => t.sort_order))
            : 0;
        const created = await addTrigger({ ...payload, sort_order: mo + 1 });
        undoHistory.push({
          label: `Create rule "${created.name}"`,
          undo: async () => deleteTrigger(created.id),
        });
        toast.success("Rule created");
      } else {
        const ruleId = editingId;
        const before = snapshotRule(triggers.find((t) => t.id === ruleId));
        const restorePayload = buildRestorePayload(before);
        if (!before || !restorePayload)
          throw new Error("Could not snapshot rule before save");
        await updateTrigger(ruleId, payload);
        undoHistory.push({
          label: `Edit rule "${before.name}"`,
          undo: async () => updateTrigger(ruleId, restorePayload),
        });
        toast.success("Rule saved");
      }
      closeEditor();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };
  const handleChange = (field, value) =>
    setEditForm((p) => ({ ...p, [field]: value }));

  const handleDuplicate = async (trigger) => {
    try {
      const copy = await duplicateTrigger(trigger.id);
      undoHistory.push({
        label: `Duplicate "${trigger.name}"`,
        undo: async () => deleteTrigger(copy.id),
      });
      toast.success(`Duplicated as "${copy.name}"`);
    } catch (e) {
      toast.error(e.message || "Duplicate failed");
    }
  };

  const handleBulkDuplicate = async () => {
    if (selectedIds.length !== 1) return;
    const t = triggers.find((r) => r.id === selectedIds[0]);
    if (t) await handleDuplicate(t);
  };

  const handleQuickSelectStart = () => {
    setQuickSelectValue("");
    setQuickSelectOpen(true);
  };

  const handleQuickSelectCancel = () => {
    setQuickSelectOpen(false);
    setQuickSelectValue("");
  };

  const parseQuickSelectIndexes = (value) => {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) => {
        const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          let start = parseInt(rangeMatch[1], 10);
          let end = parseInt(rangeMatch[2], 10);
          if (Number.isNaN(start) || Number.isNaN(end)) return [];
          if (end < start) [start, end] = [end, start];
          return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        }
        const number = parseInt(part, 10);
        return Number.isNaN(number) ? [] : [number];
      })
      .filter((n, i, all) => n >= 1 && all.indexOf(n) === i);
  };

  const handleQuickSelectConfirm = () => {
    const indexes = parseQuickSelectIndexes(quickSelectValue);
    if (indexes.length === 0) {
      toast.error("Enter a valid rule number or range (e.g. 1,3,5-7)");
      return;
    }
    const selectedRuleIds = indexes
      .map((index) => {
        const key = Object.keys(ruleNumbers).find(
          (id) => ruleNumbers[id] === index,
        );
        return key != null
          ? Number.isNaN(Number(key))
            ? key
            : Number(key)
          : null;
      })
      .filter((id) => id != null);

    if (selectedRuleIds.length !== indexes.length) {
      const missing = indexes.filter(
        (index) => !selectedRuleIds.some((id) => ruleNumbers[id] === index),
      );
      toast.error(
        `Rule${missing.length > 1 ? "s" : ""} ${missing.join(", ")} not found`,
      );
      return;
    }

    setSelectedIds(selectedRuleIds);
    setQuickSelectOpen(false);
    toast.success(
      `Selected rule${selectedRuleIds.length > 1 ? "s" : ""} ${indexes.join(", ")}`,
    );
  };

  const handleQuickSelectKey = (key) => {
    if (!quickSelectOpen) return;
    if (key === "Backspace") {
      setQuickSelectValue((v) => v.slice(0, -1));
      return;
    }
    if (/^[0-9]$/.test(key) || key === "," || key === "-") {
      setQuickSelectValue((v) => `${v}${key}`);
      return;
    }
    if (key === "Enter") {
      handleQuickSelectConfirm();
      return;
    }
    if (key === "Escape") {
      handleQuickSelectCancel();
    }
  };

  const handleDuplicateGroup = async (groupItem) => {
    const rules =
      groupItem?.rules ||
      triggers.filter((t) => t.group_id === selectedGroupInfo?.id);
    if (!rules?.length) return;
    try {
      const gid = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
      const groupNames = triggers.map((t) => t.group_name).filter(Boolean);
      const baseGroup = groupItem?.name || selectedGroupInfo?.name || "Group";
      const newGroupName = nextCopyName(baseGroup, groupNames);
      const ruleNames = triggers.map((t) => t.name);
      const mo =
        triggers.length > 0
          ? Math.max(...triggers.map((t) => t.sort_order))
          : 0;
      const color =
        groupItem?.color || selectedGroupInfo?.color || rules[0].group_color;
      const created = await bulkCreate(
        rules.map((r, i) => {
          const p = buildPayload({ ...r });
          p.name = nextCopyName(r.name, ruleNames);
          p.group_id = gid;
          p.group_name = newGroupName;
          p.group_color = color;
          p.sort_order = mo + 1 + i;
          return p;
        }),
      );
      const createdIds = created.map((c) => c.id);
      undoHistory.push({
        label: `Duplicate group "${baseGroup}"`,
        undo: async () => bulkDelete(createdIds),
      });
      toast.success(`Duplicated group "${newGroupName}"`);
    } catch (e) {
      toast.error(e.message || "Group duplicate failed");
    }
  };

  const toggleSelection = (id) =>
    setSelectedIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const handleSelectAll = () => {
    if (selectedIds.length === triggers.length && triggers.length > 0)
      setSelectedIds([]);
    else setSelectedIds(triggers.map((t) => t.id));
  };
  const toggleGroupSelection = (rules) => {
    const allSel = rules.every((r) => selectedIds.includes(r.id));
    if (allSel)
      setSelectedIds((p) => p.filter((id) => !rules.find((r) => r.id === id)));
    else {
      const n = [...selectedIds];
      rules.forEach((r) => {
        if (!n.includes(r.id)) n.push(r.id);
      });
      setSelectedIds(n);
    }
  };

  const handleBulkDelete = () =>
    showConfirm({
      title: "Delete Selected",
      message: `Permanently delete ${selectedIds.length} trigger rule${selectedIds.length > 1 ? "s" : ""}? This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.length} Rules`,
      danger: true,
      onConfirm: async () => {
        const ids = [...selectedIds];
        const deleted = triggers
          .filter((t) => ids.includes(t.id))
          .map(snapshotRule);
        const orderBefore = snapshotOrderIds(triggers);
        await bulkDelete(ids);
        setSelectedIds([]);
        undoHistory.push({
          label: `Delete ${deleted.length} rule(s)`,
          undo: async () => restoreDeletedRules(deleted, orderBefore),
        });
      },
    });

  const handleBulkToggle = async (state) => {
    const ids = [...selectedIds];
    const beforeStates = triggers
      .filter((t) => ids.includes(t.id))
      .map((t) => ({ id: t.id, is_active: t.is_active }));
    await bulkToggle(ids, state);
    undoHistory.push({
      label: `Toggle ${ids.length} rule(s)`,
      undo: async () => {
        const activeIds = beforeStates
          .filter((b) => b.is_active)
          .map((b) => b.id);
        const inactiveIds = beforeStates
          .filter((b) => !b.is_active)
          .map((b) => b.id);
        if (activeIds.length) await bulkToggle(activeIds, true);
        if (inactiveIds.length) await bulkToggle(inactiveIds, false);
      },
    });
  };

  const openGroupModal = (editData = null) => {
    if (editData)
      setGroupForm({
        name: editData.name || "",
        color: editData.color || "#3b82f6",
        isEditing: true,
        editGroupId: editData.id,
      });
    else
      setGroupForm({
        name: "",
        color: "#3b82f6",
        isEditing: false,
        editGroupId: null,
      });
    setShowGroupModal(true);
  };

  const handleGroupSave = async () => {
    if (!groupForm.name.trim()) return;
    try {
      if (groupForm.isEditing && groupForm.editGroupId) {
        const groupRuleIds = triggers
          .filter((t) => t.group_id === groupForm.editGroupId)
          .map((t) => t.id);
        const before = triggers
          .filter((t) => groupRuleIds.includes(t.id))
          .map((t) => ({
            id: t.id,
            group_id: t.group_id,
            group_name: t.group_name,
            group_color: t.group_color,
          }));
        await bulkGroup(
          groupRuleIds,
          groupForm.name.trim(),
          groupForm.color,
          groupForm.editGroupId,
        );
        undoHistory.push({
          label: `Edit group "${groupForm.name.trim()}"`,
          undo: async () =>
            bulkGroup(
              groupRuleIds,
              before[0]?.group_name || "",
              before[0]?.group_color || "",
              groupForm.editGroupId,
            ),
        });
        toast.success("Group updated");
      } else {
        const ids = [...selectedIds];
        const orderBefore = snapshotOrderIds(triggers);
        await bulkGroup(ids, groupForm.name.trim(), groupForm.color);

        // Reorder so the grouped rules become consecutive, keeping their relative order.
        const sorted = [...triggers].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        const selectedSet = new Set(ids);
        const selectedSorted = sorted.filter((s) => selectedSet.has(s.id));
        const remaining = sorted.filter((s) => !selectedSet.has(s.id));
        const minIdx = Math.min(
          ...sorted.map((s, i) => (selectedSet.has(s.id) ? i : sorted.length)),
        );
        const newOrderList = [
          ...remaining.slice(0, minIdx),
          ...selectedSorted,
          ...remaining.slice(minIdx),
        ];
        const upd = newOrderList.map((r, i) => ({ id: r.id, sort_order: i }));
        await reorderTriggers(upd);

        undoHistory.push({
          label: `Create group "${groupForm.name.trim()}"`,
          undo: async () => {
            await bulkGroup(ids, "", "");
            await reorderTriggers(
              orderBefore.map((id, i) => ({ id, sort_order: i })),
            );
          },
        });
        toast.success("Group created");
      }
      setShowGroupModal(false);
      setSelectedIds([]);
    } catch (e) {
      toast.error(e.message || "Group save failed");
    }
  };

  const handleMove = async (index, dir) => {
    const orderBefore = snapshotOrderIds(triggers);
    const ni = [...displayItems];
    if (dir === "up" && index > 0)
      [ni[index - 1], ni[index]] = [ni[index], ni[index - 1]];
    else if (dir === "down" && index < ni.length - 1)
      [ni[index], ni[index + 1]] = [ni[index + 1], ni[index]];
    else return;
    let o = 0;
    const upd = [];
    ni.forEach((item) => {
      if (item.type === "group")
        item.rules.forEach((r) => upd.push({ id: r.id, sort_order: o++ }));
      else upd.push({ id: item.rule.id, sort_order: o++ });
    });
    await reorderTriggers(upd);
    pushReorderUndo("Reorder rules", orderBefore);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayItems.findIndex(
      (i) =>
        (i.type === "group" ? "g-" + i.id : "r-" + i.rule.id) === active.id,
    );
    const newIndex = displayItems.findIndex(
      (i) => (i.type === "group" ? "g-" + i.id : "r-" + i.rule.id) === over.id,
    );
    if (oldIndex !== -1 && newIndex !== -1) {
      const orderBefore = snapshotOrderIds(triggers);
      const ni = arrayMove(displayItems, oldIndex, newIndex);
      let o = 0;
      const upd = [];
      ni.forEach((item) => {
        if (item.type === "group")
          item.rules.forEach((r) => upd.push({ id: r.id, sort_order: o++ }));
        else upd.push({ id: item.rule.id, sort_order: o++ });
      });
      await reorderTriggers(upd);
      pushReorderUndo("Reorder rules", orderBefore);
    }
  };

  const handleCopy = (type, data) => {
    const copied =
      Array.isArray(data) ? data.map((item) => snapshotRule(item)) : snapshotRule(data);
    const anchor =
      type === "rule"
        ? copied
        : lastRuleByOrder(Array.isArray(copied) ? copied : [copied]);
    setCopiedData({ type, data: copied, fromId: anchor?.id ?? null });
    const label =
      type === "group"
        ? "Group"
        : type === "rules"
          ? `${data.length} rules`
          : "Rule";
    toast.success(`${label} copied — paste into a row or use Paste New`);
  };

  const insertRulesAfter = async (payloads, afterRuleId) => {
    const sorted = [...triggers].sort((a, b) => a.sort_order - b.sort_order);
    let insertIdx = sorted.length;
    if (afterRuleId != null) {
      const i = sorted.findIndex((t) => t.id === afterRuleId);
      if (i >= 0) insertIdx = i + 1;
    }
    const created = await bulkCreate(payloads);
    const order = [
      ...sorted.slice(0, insertIdx).map((t) => t.id),
      ...created.map((r) => r.id),
      ...sorted.slice(insertIdx).map((t) => t.id),
    ];
    await reorderTriggers(order.map((id, i) => ({ id, sort_order: i })));
    return created;
  };

  const PASTE_FIELDS = [
    "listen_source",
    "trigger_event",
    "vmix_input_number",
    "vmix_input_name",
    "threshold",
    "release_threshold",
    "silence_timeout_ms",
    "time_threshold",
    "is_multi_duck",
    "duck_members",
    "action_target",
    "yamaha_command",
    "yamaha_channel",
    "yamaha_mix",
    "vmix_function",
    "vmix_target_input",
    "parameter_value",
    "delay_ms",
  ];

  const pasteSettingsOnto = async (src, tgt) => {
    const tgtId = tgt.id;
    const before = snapshotRule(triggers.find((t) => t.id === tgtId));
    const restorePayload = buildRestorePayload(before);
    const patch = {};
    PASTE_FIELDS.forEach((f) => {
      patch[f] = src[f];
    });
    await updateTrigger(tgtId, normalizeMultiDuckPayload(patch));
    return { tgtId, restorePayload, name: tgt.name };
  };

  const handlePasteInto = async (tgt) => {
    if (!copiedData || copiedData.type !== "rule") return;
    const undo = await pasteSettingsOnto(copiedData.data, tgt);
    undoHistory.push({
      label: `Paste into "${undo.name}"`,
      undo: async () => updateTrigger(undo.tgtId, undo.restorePayload),
    });
    toast.success(`Settings pasted into "${undo.name}"`);
  };

  const handleFabPasteInto = async () => {
    if (!copiedData) return;
    if (copiedData.type === "rule") {
      if (selectedIds.length !== 1) {
        toast.error("Select exactly 1 rule to paste into");
        return;
      }
      const tgt = triggers.find((r) => r.id === selectedIds[0]);
      if (tgt) await handlePasteInto(tgt);
      return;
    }
    if (copiedData.type === "rules") {
      const n = copiedData.data.length;
      if (selectedIds.length !== n) {
        toast.error(
          `Select exactly ${n} rule${n === 1 ? "" : "s"} to paste into (${selectedIds.length} selected)`,
        );
        return;
      }
      const sources = [...copiedData.data].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      const targets = triggers
        .filter((t) => selectedIds.includes(t.id))
        .sort((a, b) => a.sort_order - b.sort_order);
      const undos = [];
      for (let i = 0; i < sources.length; i++) {
        undos.push(await pasteSettingsOnto(sources[i], targets[i]));
      }
      undoHistory.push({
        label: `Paste into ${undos.length} rules`,
        undo: async () => {
          for (const u of undos) await updateTrigger(u.tgtId, u.restorePayload);
        },
      });
      toast.success(`Settings pasted into ${undos.length} rules`);
      return;
    }
    if (copiedData.type === "group") {
      if (!selectedGroupInfo) {
        toast.error("Select a full target group to paste into");
        return;
      }
      const targetRules = triggers
        .filter(
          (t) =>
            selectedIds.includes(t.id) && t.group_id === selectedGroupInfo.id,
        )
        .sort((a, b) => a.sort_order - b.sort_order);
      const sources = [...copiedData.data].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      if (targetRules.length !== sources.length) {
        toast.error(
          `Select the full target group with exactly ${sources.length} rule${sources.length === 1 ? "" : "s"}`,
        );
        return;
      }
      const undos = [];
      for (let i = 0; i < sources.length; i++) {
        undos.push(await pasteSettingsOnto(sources[i], targetRules[i]));
      }
      undoHistory.push({
        label: `Paste group into ${undos.length} rules`,
        undo: async () => {
          for (const u of undos) await updateTrigger(u.tgtId, u.restorePayload);
        },
      });
      toast.success(`Group settings pasted into target group`);
      return;
    }
    toast.error("Paste into works with copied rule(s) only");
  };

  const handleFabCopy = () => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length === 1) {
      const t = triggers.find((r) => r.id === selectedIds[0]);
      if (t) handleCopy("rule", t);
      return;
    }
    if (selectedGroupInfo) {
      const groupRules = triggers.filter(
        (t) => t.group_id === selectedGroupInfo.id,
      );
      if (groupRules.every((r) => selectedIds.includes(r.id))) {
        handleCopy("group", groupRules);
        return;
      }
    }
    handleCopy(
      "rules",
      triggers.filter((t) => selectedIds.includes(t.id)),
    );
  };

  const handlePasteNew = async () => {
    if (!copiedData) return;
    const afterId = copiedData.fromId;
    const orderBefore = snapshotOrderIds(triggers);
    try {
      let created = [];
      if (copiedData.type === "rule") {
        const r = buildPayload({ ...copiedData.data });
        r.name = nextCopyName(
          copiedData.data.name,
          triggers.map((t) => t.name),
        );
        created = await insertRulesAfter([r], afterId);
        toast.success("Rule pasted below source");
      } else if (copiedData.type === "rules") {
        const names = triggers.map((t) => t.name);
        created = await insertRulesAfter(
          copiedData.data.map((src) => {
            const nr = buildPayload({ ...src });
            nr.name = nextCopyName(src.name, names);
            names.push(nr.name);
            return nr;
          }),
          afterId,
        );
        toast.success(`${copiedData.data.length} rules pasted below source`);
      } else {
        const gid =
          crypto.randomUUID?.() || Math.random().toString(36).slice(2);
        const groupNames = triggers.map((t) => t.group_name).filter(Boolean);
        const newGroupName = nextCopyName(
          copiedData.data[0]?.group_name || "Group",
          groupNames,
        );
        const names = triggers.map((t) => t.name);
        created = await insertRulesAfter(
          copiedData.data.map((src) => {
            const nr = buildPayload({ ...src });
            nr.group_id = gid;
            nr.group_name = newGroupName;
            nr.group_color = src.group_color;
            nr.name = nextCopyName(src.name, names);
            names.push(nr.name);
            return nr;
          }),
          afterId,
        );
        toast.success("Group pasted below source");
      }
      const createdIds = created.map((c) => c.id);
      const orderBeforePaste = orderBefore;
      undoHistory.push({
        label: "Paste new rule(s)",
        undo: async () => {
          await bulkDelete(createdIds);
          await reorderTriggers(
            orderBeforePaste.map((id, i) => ({ id, sort_order: i })),
          );
        },
      });
    } catch (e) {
      toast.error(e.message || "Paste failed");
    }
  };

  const handleUngroup = (rules) =>
    showConfirm({
      title: "Dissolve Group",
      message: `Remove these ${rules.length} rules from their group? Rules stay — only the group is removed.`,
      confirmLabel: "Ungroup",
      danger: false,
      onConfirm: async () => {
        const ids = rules.map((r) => r.id);
        const before = rules.map(snapshotRule);
        await bulkGroup(ids, "", "");
        undoHistory.push({
          label: "Dissolve group",
          undo: async () => {
            const gid = before[0]?.group_id;
            if (gid)
              await bulkGroup(
                ids,
                before[0].group_name,
                before[0].group_color,
                gid,
              );
          },
        });
      },
    });

  const handleDeleteRule = (trigger) =>
    showConfirm({
      title: "Delete Rule",
      message: `Delete "${trigger.name}"? This cannot be undone.`,
      confirmLabel: "Delete Rule",
      danger: true,
      onConfirm: async () => {
        const rule = snapshotRule(trigger);
        const orderBefore = snapshotOrderIds(triggers);
        await deleteTrigger(trigger.id);
        undoHistory.push({
          label: `Delete "${rule.name}"`,
          undo: async () => restoreDeletedRules([rule], orderBefore),
        });
      },
    });
  const handleExport = () => {
    const a = document.createElement("a");
    a.href =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(triggers));
    a.download = "bridge_rules.json";
    a.click();
  };
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rules = JSON.parse(ev.target.result);
        const mo =
          triggers.length > 0
            ? Math.max(...triggers.map((t) => t.sort_order))
            : 0;
        const created = await bulkCreate(
          rules.map((r, i) => {
            const nr = { ...r };
            delete nr.id;
            delete nr.created_at;
            delete nr.updated_at;
            nr.sort_order = mo + 1 + i;
            return nr;
          }),
        );
        const createdIds = created.map((c) => c.id);
        undoHistory.push({
          label: `Import ${created.length} rule(s)`,
          undo: async () => bulkDelete(createdIds),
        });
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const selectedRules = triggers.filter((t) => selectedIds.includes(t.id));
  const allSelectedActive =
    selectedRules.length > 0 && selectedRules.every((t) => t.is_active);
  const hasGroupedSelection = selectedRules.some((t) => t.group_id);
  const fullGroupSelected =
    selectedGroupInfo &&
    triggers
      .filter((t) => t.group_id === selectedGroupInfo.id)
      .every((r) => selectedIds.includes(r.id));
  const pasteMode = copiedData?.type === "rule";
  const targetGroupMatch =
    copiedData?.type === "group" &&
    selectedGroupInfo &&
    triggers.filter(
      (t) => selectedIds.includes(t.id) && t.group_id === selectedGroupInfo.id,
    ).length === copiedData.data.length;
  const canPasteInto =
    copiedData &&
    ((copiedData.type === "rule" && selectedIds.length === 1) ||
      (copiedData.type === "rules" &&
        selectedIds.length === copiedData.data.length) ||
      targetGroupMatch);

  const keyboardRef = useRef({});
  keyboardRef.current = {
    blocked:
      confirmModal.isOpen || showGroupModal || shortcutsOpen || undoConfirmOpen,
    editorOpen,
    quickSelectOpen,
    quickSelectValue,
    selectedIds,
    copiedData,
    allSelectedActive,
    triggers,
    prefs,
    handleCreateNew,
    handleSave,
    closeEditor,
    handleQuickSelectStart,
    handleQuickSelectKey,
    handleQuickSelectConfirm,
    handleQuickSelectCancel,
    setSelectedIds,
    setCopiedData,
    setShortcutsOpen,
    searchInputRef,
    handleSelectAll,
    handleBulkDelete,
    handleBulkDuplicate,
    handleFabCopy,
    handlePasteNew,
    handleFabPasteInto,
    handleBulkToggle,
    openGroupModal,
    handleEditClick,
    handleUndoRequest,
  };

  useEffect(() => {
    const handler = (e) => {
      const ctx = keyboardRef.current;
      if (ctx.blocked) return;
      const tag = e.target?.tagName?.toLowerCase();
      const isInput =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        e.target?.isContentEditable;

      const matched = ctx.prefs.findMatch(e);
      if (matched && ctx.prefs.shouldBlockBrowser(e, isInput)) {
        blockBrowserShortcut(e);
      }

      if (ctx.prefs.matchShortcut(e, "shortcutsHelp") && !isInput) {
        ctx.setShortcutsOpen(true);
        return;
      }
      if (ctx.quickSelectOpen) {
        ctx.handleQuickSelectKey(e.key);
        blockBrowserShortcut(e);
        return;
      }
      if (
        isInput &&
        !ctx.prefs.matchShortcut(e, "saveRule") &&
        !ctx.prefs.matchShortcut(e, "closePanel") &&
        !ctx.prefs.matchShortcut(e, "undo")
      )
        return;

      if (ctx.prefs.matchShortcut(e, "newRule") && !ctx.editorOpen)
        ctx.handleCreateNew();
      else if (
        ctx.prefs.matchShortcut(e, "selectByNumber") &&
        !ctx.editorOpen &&
        !isInput
      )
        ctx.handleQuickSelectStart();
      else if (ctx.prefs.matchShortcut(e, "saveRule") && ctx.editorOpen)
        ctx.handleSave();
      else if (ctx.prefs.matchShortcut(e, "closePanel")) {
        if (ctx.copiedData) {
          ctx.setCopiedData(null);
          toast.info("Clipboard cleared");
        } else if (ctx.editorOpen) ctx.closeEditor();
        else if (ctx.selectedIds.length) ctx.setSelectedIds([]);
        else ctx.setShortcutsOpen(false);
      } else if (
        ctx.prefs.matchShortcut(e, "clearClipboard") &&
        ctx.copiedData
      ) {
        ctx.setCopiedData(null);
        toast.info("Clipboard cleared");
      } else if (ctx.prefs.matchShortcut(e, "focusSearch") && !isInput)
        ctx.searchInputRef.current?.focus();
      else if (ctx.prefs.matchShortcut(e, "selectAll") && !isInput)
        ctx.handleSelectAll();
      else if (
        ctx.prefs.matchShortcut(e, "clearSelection") &&
        ctx.selectedIds.length &&
        !isInput
      )
        ctx.setSelectedIds([]);
      else if (
        ctx.prefs.matchShortcut(e, "duplicate") &&
        ctx.selectedIds.length === 1 &&
        !isInput
      )
        ctx.handleBulkDuplicate();
      else if (
        ctx.prefs.matchShortcut(e, "copyRule") &&
        ctx.selectedIds.length &&
        !isInput
      )
        ctx.handleFabCopy();
      else if (
        ctx.prefs.matchShortcut(e, "pasteRule") &&
        ctx.copiedData &&
        !isInput
      )
        ctx.handlePasteNew();
      else if (
        ctx.prefs.matchShortcut(e, "pasteInto") &&
        ctx.copiedData &&
        !isInput
      )
        ctx.handleFabPasteInto();
      else if (
        ctx.prefs.matchShortcut(e, "togglePower") &&
        ctx.selectedIds.length &&
        !isInput
      )
        ctx.handleBulkToggle(!ctx.allSelectedActive);
      else if (
        ctx.prefs.matchShortcut(e, "groupRules") &&
        ctx.selectedIds.length >= 2 &&
        !isInput
      )
        ctx.openGroupModal(null);
      else if (
        ctx.prefs.matchShortcut(e, "deleteSelected") &&
        ctx.selectedIds.length &&
        !isInput
      )
        ctx.handleBulkDelete();
      else if (
        ctx.prefs.matchShortcut(e, "editRule") &&
        ctx.selectedIds.length === 1 &&
        !ctx.editorOpen &&
        !isInput
      ) {
        const t = ctx.triggers.find((r) => r.id === ctx.selectedIds[0]);
        if (t) ctx.handleEditClick(t);
      } else if (ctx.prefs.matchShortcut(e, "undo")) ctx.handleUndoRequest();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  if (loading && triggers.length === 0)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid rgba(34,211,238,0.4)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ color: "#475569", fontSize: 13 }}>Loading rules…</p>
        </div>
      </div>
    );

  return (
    <>
      <ConfirmModal {...confirmModal} onCancel={hideConfirm} />

      {undoConfirmOpen && undoHistory.peek && (
        <ConfirmModal
          isOpen
          title="Undo Last Action"
          message={`Are you sure you want to undo "${undoHistory.peek.label}"? This will revert the last change you made.`}
          confirmLabel="Yes, Undo"
          danger={false}
          onConfirm={performUndo}
          onCancel={() => setUndoConfirmOpen(false)}
        />
      )}

      <FloatingActionBar
        count={selectedIds.length}
        allActive={allSelectedActive}
        onTogglePower={() => handleBulkToggle(!allSelectedActive)}
        onDelete={handleBulkDelete}
        onDuplicate={handleBulkDuplicate}
        onCopy={handleFabCopy}
        onPaste={handlePasteNew}
        onPasteInto={handleFabPasteInto}
        hasClipboard={!!copiedData}
        canPaste={!!copiedData}
        canPasteInto={canPasteInto}
        onGroup={() => openGroupModal(null)}
        onEditGroup={() => openGroupModal(selectedGroupInfo)}
        onUngroup={() => {
          const ids = [...selectedIds];
          const before = triggers
            .filter((t) => ids.includes(t.id))
            .map(snapshotRule);
          showConfirm({
            title: "Dissolve Group",
            message: "Remove selected rules from their group?",
            confirmLabel: "Ungroup",
            danger: false,
            onConfirm: async () => {
              await bulkGroup(ids, "", "");
              setSelectedIds([]);
              toast.success("Group dissolved");
              undoHistory.push({
                label: "Dissolve group",
                undo: async () => {
                  const gid = before[0]?.group_id;
                  if (gid)
                    await bulkGroup(
                      ids,
                      before[0].group_name,
                      before[0].group_color,
                      gid,
                    );
                },
              });
            },
          });
        }}
        onDuplicateGroup={
          fullGroupSelected ? () => handleDuplicateGroup() : undefined
        }
        showDuplicateGroup={!!fullGroupSelected}
        onDismiss={() => setSelectedIds([])}
        showEditGroup={!!selectedGroupInfo}
        showUngroup={hasGroupedSelection}
        groupDisabled={selectedIds.length < 2}
      />

      {quickSelectOpen && (
        <div
          onClick={handleQuickSelectCancel}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 250,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: "20px",
              padding: "28px",
              width: "360px",
              textAlign: "center",
              boxShadow: "0 16px 60px rgba(0,0,0,0.45)",
            }}
          >
            <h3 style={{ color: "#e2e8f0", marginBottom: "10px" }}>
              Select rule by number
            </h3>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "13px",
                marginBottom: "18px",
              }}
            >
              Enter one or more rule numbers. Use commas or ranges like{" "}
              <span style={{ color: "#cbd5e1" }}>1,3,5-7</span>.
            </p>
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  background: "#111827",
                  border: "1px solid rgba(148,163,184,0.12)",
                  borderRadius: "12px",
                  padding: "16px",
                  color: "#38bdf8",
                  fontSize: "22px",
                  fontFamily: "monospace",
                }}
              >
                {quickSelectValue || "..."}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <button
                onClick={handleQuickSelectCancel}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  color: "#94a3b8",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleQuickSelectConfirm}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "#22c55e",
                  color: "white",
                  border: "1px solid rgba(34,197,94,0.4)",
                  cursor: "pointer",
                }}
              >
                Select
              </button>
            </div>
            <p
              style={{ color: "#94a3b8", fontSize: "12px", marginTop: "14px" }}
            >
              Esc to cancel, Backspace to edit.
            </p>
          </div>
        </div>
      )}

      <ShortcutsPanel
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={prefs.shortcuts}
        onUpdate={prefs.updateShortcut}
        onReset={prefs.resetShortcuts}
        showFieldHints={prefs.showFieldHints}
        onToggleHints={prefs.setShowFieldHints}
      />

      <QuickPresetsPanel
        isOpen={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        presets={prefs.presets}
        onAdd={(label, form) => {
          const id = prefs.addPreset(label, form);
          undoHistory.push({
            label: `Add preset "${label}"`,
            undo: async () => prefs.removePreset(id),
          });
          toast.success(`Preset "${label}" added`);
        }}
        onUpdate={(id, updates) => {
          const before = prefs.presets.find((p) => p.id === id);
          if (!before) return;
          prefs.updatePreset(id, updates);
          undoHistory.push({
            label: `Edit preset "${updates.label || before.label}"`,
            undo: async () =>
              prefs.updatePreset(id, {
                label: before.label,
                form: before.form,
              }),
          });
          toast.success("Preset updated");
        }}
        onRemove={(id) => {
          const before = prefs.presets.find((p) => p.id === id);
          if (!before) return;
          prefs.removePreset(id);
          undoHistory.push({
            label: `Remove preset "${before.label}"`,
            undo: async () => prefs.addPreset(before.label, before.form),
          });
          toast.success("Preset removed");
        }}
      />

      <RuleEditorDrawer
        isOpen={editorOpen}
        isNew={isCreating}
        form={editForm}
        onChange={handleChange}
        onSave={handleSave}
        onClose={closeEditor}
        vmixInputs={vmixInputs}
        copiedData={copiedData}
        saving={saving}
        showFieldHints={prefs.showFieldHints}
        meters={meters}
        presets={prefs.presets}
        onSavePreset={(label, form) => {
          const id = prefs.saveCurrentAsPreset(label, form || editForm);
          undoHistory.push({
            label: `Save preset "${label}"`,
            undo: async () => prefs.removePreset(id),
          });
          toast.success(`Preset "${label}" saved`);
        }}
        onUpdatePreset={(id, updates) => {
          prefs.updatePreset(id, updates);
          toast.success("Preset updated");
        }}
        onRemovePreset={(id) => {
          prefs.removePreset(id);
          toast.success("Preset removed");
        }}
      />

      <GroupModal
        isOpen={showGroupModal}
        form={{ name: groupForm.name, color: groupForm.color }}
        onChange={(f) =>
          setGroupForm((p) => ({ ...p, name: f.name, color: f.color }))
        }
        onSave={handleGroupSave}
        onClose={() => setShowGroupModal(false)}
        ruleCount={selectedIds.length}
        isEditing={groupForm.isEditing}
      />

      <div
        className="glass-panel"
        style={{
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background:
              "linear-gradient(to right, rgba(21,27,39,0.6), rgba(16,21,31,0.4))",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#20D9FF",
                }}
              >
                Automation Rules
              </div>
              <div
                style={{ fontSize: "11px", color: "#5A6278", marginTop: "2px" }}
              >
                {triggers.length} rule{triggers.length !== 1 ? "s" : ""}{" "}
                configured
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "6px",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
                paddingLeft: "16px",
              }}
            >
              <button
                onClick={handleExport}
                title="Export rules to JSON"
                style={{
                  padding: "6px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => fileInputRef.current.click()}
                title="Import rules from JSON"
                style={{
                  padding: "6px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <Upload size={14} />
              </button>
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleImport}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {copiedData && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.2)",
                  color: "#22d3ee",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <Clipboard size={12} />{" "}
                {copiedData.type === "group"
                  ? "Group"
                  : copiedData.type === "rules"
                    ? `${copiedData.data.length} rules`
                    : "Rule"}{" "}
                ready
                <button
                  onClick={() => setCopiedData(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <button
              onClick={handleUndoRequest}
              disabled={!undoHistory.canUndo}
              title={
                undoHistory.peek
                  ? `Undo: ${undoHistory.peek.label}`
                  : "Nothing to undo"
              }
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                background: undoHistory.canUndo
                  ? "rgba(139,147,168,0.12)"
                  : "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: undoHistory.canUndo ? "#D8DCE6" : "#475569",
                fontSize: "12px",
                fontWeight: 600,
                cursor: undoHistory.canUndo ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                opacity: undoHistory.canUndo ? 1 : 0.5,
              }}
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              onClick={() => setPresetsOpen(true)}
              title="Manage Quick Start presets"
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                background: "rgba(246,180,75,0.08)",
                border: "1px solid rgba(246,180,75,0.2)",
                color: "#F6B44B",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Zap size={14} /> Presets
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              title="Keyboard shortcuts"
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Keyboard size={14} /> Shortcuts
            </button>
            <button
              onClick={handleSelectAll}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <CheckSquare size={14} />{" "}
              {selectedIds.length === triggers.length && triggers.length > 0
                ? "Deselect All"
                : "Select All"}
            </button>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search id, name, event, command…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "6px 10px 6px 30px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "white",
                  fontSize: "12px",
                  width: "240px",
                }}
              />
            </div>
            <button
              onClick={handleCreateNew}
              disabled={editorOpen}
              className="hover-lift"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background:
                  "linear-gradient(135deg, rgba(32,217,255,0.9), rgba(32,217,255,0.65))",
                color: "#070A0F",
                fontWeight: 900,
                fontSize: "12px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 4px 20px rgba(32,217,255,0.25)",
                opacity: editorOpen ? 0.4 : 1,
              }}
            >
              <Plus size={14} /> New Rule
            </button>
          </div>
        </div>

        {copiedData && (
          <div
            style={{
              padding: "6px 20px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#F6B44B",
              background: "rgba(246,180,75,0.06)",
              borderBottom: "1px solid rgba(246,180,75,0.12)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <Clipboard size={12} />
            {copiedData.type === "rule" && (
              <>
                Rule ready — click the clipboard icon on a row to paste into it,
                or use <strong>Paste New</strong> / <strong>Paste Into</strong>{" "}
                in the action bar
              </>
            )}
            {copiedData.type === "rules" && (
              <>
                {copiedData.data.length} rules ready — select exactly{" "}
                <strong>{copiedData.data.length}</strong> rule
                {copiedData.data.length === 1 ? "" : "s"} and use{" "}
                <strong>Paste Into</strong>, or <strong>Paste New</strong> to
                insert below source
              </>
            )}
            {copiedData.type === "group" && (
              <>
                Group ready — use <strong>Paste New</strong> in the action bar
                to duplicate the group below source
              </>
            )}
            <button
              onClick={() => setCopiedData(null)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "#8B93A8",
                cursor: "pointer",
                fontSize: "11px",
              }}
              title="Esc or Ctrl+Shift+X"
            >
              Clear
            </button>
          </div>
        )}

        <div
          style={{
            padding: "8px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {RULE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRuleFilter(f.id)}
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                background:
                  ruleFilter === f.id
                    ? "rgba(32,217,255,0.15)"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${ruleFilter === f.id ? "rgba(32,217,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: ruleFilter === f.id ? "#20D9FF" : "#8B93A8",
              }}
            >
              {f.label}
            </button>
          ))}
          {ruleFilter === "vmix_input" && (
            <select
              value={vmixInputFilter}
              onChange={(e) => setVmixInputFilter(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#D8DCE6",
                fontSize: "11px",
              }}
            >
              <option value="">Select input…</option>
              {vmixInputs.map((inp) => (
                <option key={inp.number} value={String(inp.number)}>
                  {inp.number}: {inp.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "36px" }} />
                <col style={{ width: "min(220px, 22%)" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "52px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "88px" }} />
                <col style={{ width: "48px" }} />
              </colgroup>
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "linear-gradient(to right, #10151F, #151B27)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <tr>
                  <th style={{ padding: "10px 8px" }} />
                  <th style={{ padding: "10px 12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Hash size={10} style={{ color: "#334155" }} />
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 900,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#475569",
                        }}
                      >
                        Rule Name
                      </span>
                    </div>
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      background: "rgba(34,211,238,0.03)",
                      borderLeft: "1px solid rgba(34,211,238,0.1)",
                      borderRight: "1px solid rgba(34,211,238,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          width: "3px",
                          height: "14px",
                          borderRadius: "2px",
                          background: "linear-gradient(#3b82f6,#06b6d4)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 900,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#60a5fa",
                        }}
                      >
                        Event
                      </span>
                      <span style={{ fontSize: "10px", color: "#334155" }}>
                        — Listen To
                      </span>
                    </div>
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      background: "rgba(57,229,140,0.03)",
                      borderRight: "1px solid rgba(57,229,140,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          width: "3px",
                          height: "14px",
                          borderRadius: "2px",
                          background: "linear-gradient(#39E58C,#20D9FF)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 900,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#39E58C",
                        }}
                      >
                        Command
                      </span>
                    </div>
                  </th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#5A6278",
                      }}
                    >
                      Fires
                    </span>
                  </th>
                  <th style={{ padding: "10px 8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#5A6278",
                      }}
                    >
                      Last
                    </span>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#5A6278",
                      }}
                    >
                      ···
                    </span>
                  </th>
                  <th style={{ padding: "10px 6px", textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#5A6278",
                      }}
                    >
                      On
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <SortableContext
                  items={displayItems.map((i) =>
                    i.type === "group" ? "g-" + i.id : "r-" + i.rule.id,
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  {displayItems.map((item, idx) => {
                    if (item.type === "group") {
                      return (
                        <SortableGroupWrapper
                          key={"g-" + item.id}
                          id={"g-" + item.id}
                          item={item}
                          idx={idx}
                          selectedIds={selectedIds}
                          editingId={editingId}
                          ruleNumbers={ruleNumbers}
                          toggleGroupSelection={toggleGroupSelection}
                          openGroupModal={openGroupModal}
                          handleUngroup={handleUngroup}
                          handleMove={handleMove}
                          handleCopy={handleCopy}
                          handleDuplicateGroup={handleDuplicateGroup}
                          toggleTrigger={wrappedToggleTrigger}
                          handleEditClick={handleEditClick}
                          handleDeleteRule={handleDeleteRule}
                          handleDuplicate={handleDuplicate}
                          handlePasteInto={handlePasteInto}
                          toggleSelection={toggleSelection}
                          displayItems={displayItems}
                          meters={meters}
                          triggeredRules={triggeredRules}
                          actionStates={actionStates}
                          collapsedGroups={collapsedGroups}
                          toggleGroupCollapse={toggleGroupCollapse}
                          vmixInputs={vmixInputs}
                          pasteMode={pasteMode}
                          expandedMultiDuckIds={expandedMultiDuckIds}
                          toggleMultiDuckExpand={toggleMultiDuckExpand}
                        />
                    );
                    }
                    return (
                      <SortableRuleWrapper
                        key={"r-" + item.rule.id}
                        id={"r-" + item.rule.id}
                        item={item}
                        idx={idx}
                        editingId={editingId}
                        ruleNumbers={ruleNumbers}
                        selectedIds={selectedIds}
                        toggleTrigger={wrappedToggleTrigger}
                        handleEditClick={handleEditClick}
                        handleDeleteRule={handleDeleteRule}
                        handleDuplicate={handleDuplicate}
                        handlePasteInto={handlePasteInto}
                        toggleSelection={toggleSelection}
                        handleMove={handleMove}
                        displayItems={displayItems}
                        meters={meters}
                        triggeredRules={triggeredRules}
                        actionStates={actionStates}
                        vmixInputs={vmixInputs}
                        pasteMode={pasteMode}
                        expandedMultiDuckIds={expandedMultiDuckIds}
                        toggleMultiDuckExpand={toggleMultiDuckExpand}
                      />
                    );
                  })}
                </SortableContext>

                {triggers.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ padding: "60px 20px", textAlign: "center" }}
                    >
                      <Layers
                        size={32}
                        style={{ color: "#1e2a3a", margin: "0 auto 10px" }}
                      />
                      <p
                        style={{
                          color: "#334155",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        No trigger rules yet
                      </p>
                      <p
                        style={{
                          color: "#1e2a3a",
                          fontSize: "12px",
                          marginTop: "4px",
                        }}
                      >
                        Click{" "}
                        <strong style={{ color: "#22d3ee" }}>New Rule</strong>{" "}
                        to automate your first action
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>
    </>
  );
});

// ─── RuleRow — Isolated memo component ───────────────────────────────────────
const ListenBadge = React.memo(({ rule }) => {
  const isYamaha = rule.listen_source === "yamaha";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "1px 7px",
        borderRadius: "999px",
        fontSize: "9px",
        fontWeight: 900,
        letterSpacing: "0.08em",
        background: isYamaha
          ? "rgba(246,180,75,0.12)"
          : "rgba(32,217,255,0.12)",
        color: isYamaha ? "#F6B44B" : "#20D9FF",
        border: `1px solid ${isYamaha ? "rgba(246,180,75,0.25)" : "rgba(32,217,255,0.25)"}`,
      }}
    >
      {isYamaha ? (
        <>
          <Mic size={9} /> YAMAHA
        </>
      ) : (
        <>
          <Video size={9} /> VMIX
        </>
      )}
    </span>
  );
});

const CommandBadge = React.memo(({ rule }) => {
  const isVmix = rule.action_target === "vmix";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "1px 7px",
        borderRadius: "999px",
        fontSize: "9px",
        fontWeight: 900,
        letterSpacing: "0.08em",
        background: isVmix ? "rgba(32,217,255,0.12)" : "rgba(57,229,140,0.12)",
        color: isVmix ? "#20D9FF" : "#39E58C",
        border: `1px solid ${isVmix ? "rgba(32,217,255,0.25)" : "rgba(57,229,140,0.25)"}`,
      }}
    >
      {isVmix ? (
        <>
          <MonitorSpeaker size={9} /> VMIX
        </>
      ) : (
        <>
          <Speaker size={9} /> YAMAHA
        </>
      )}
    </span>
  );
});

function actionStateKey(ruleId, member, idx) {
  return `${ruleId}:${idx ?? member.monitor_channel}`;
}

function actionStateStyle(status) {
  switch (status) {
    case "applying":
      return { label: "Applying", color: "#20D9FF", bg: "rgba(32,217,255,0.1)" };
    case "applied":
      return { label: "Applied", color: "#39E58C", bg: "rgba(57,229,140,0.1)" };
    case "restoring":
      return { label: "Restoring", color: "#F6B44B", bg: "rgba(246,180,75,0.1)" };
    case "restored":
      return { label: "Restored", color: "#8B93A8", bg: "rgba(139,147,168,0.1)" };
    case "held":
      return { label: "Held", color: "#F6B44B", bg: "rgba(246,180,75,0.1)" };
    case "error":
      return { label: "Error", color: "#ff5c7a", bg: "rgba(255,92,122,0.1)" };
    default:
      return { label: "Ready", color: "#5A6278", bg: "rgba(90,98,120,0.08)" };
  }
}

const RuleRow = React.memo(function RuleRow({
  trigger,
  ruleNum,
  isGrouped,
  groupBg,
  borderCol,
  isSelected,
  isEditing,
  pasteMode,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onPasteInto,
  onSelect,
  onMove,
  isFirst,
  isLast,
  triggeredRules = {},
  actionStates = {},
  meters = {},
  vmixInputs = [],
  multiExpanded = false,
  onToggleMultiExpand,
  style = {},
  setNodeRef,
  attributes,
  listeners,
}) {
  const [flash, setFlash] = useState(false);
  const triggerTime = triggeredRules[trigger.id];
  const listen = formatListenDetail(trigger, vmixInputs);
  const command = formatCommandDetail(trigger);

  useEffect(() => {
    if (triggerTime) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(t);
    }
  }, [triggerTime]);

  const cellBg = isGrouped ? groupBg : "transparent";
  const leftBdr = isGrouped ? { borderLeft: `3px solid ${borderCol}` } : {};
  const rowStyle = flash
    ? {
        background: "rgba(32,217,255,0.12)",
        transition: "background 0.05s",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }
    : {
        background: cellBg,
        transition: "background 0.5s, opacity 0.3s",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        opacity: trigger.is_active ? 1 : 0.55,
      };

  const meterKey =
    trigger.listen_source === "yamaha" && !trigger.is_multi_duck
      ? trigger.vmix_input_number
      : trigger.yamaha_channel || trigger.vmix_input_number;
  const meterVal = meters[meterKey];

  const duckMembers = (() => {
    if (!trigger.is_multi_duck) return [];
    if (Array.isArray(trigger.duck_members)) return trigger.duck_members;
    if (typeof trigger.duck_members === "string") {
      try {
        return JSON.parse(trigger.duck_members);
      } catch {
        return [];
      }
    }
    return [];
  })();
  const getMemberActionState = (member, idx) =>
    actionStates[actionStateKey(trigger.id, member, idx)] ||
    actionStates[`${trigger.id}:${member.monitor_channel}`] ||
    null;

  const actionsList = (() => {
    if (!trigger.is_multi_action) return [];
    if (Array.isArray(trigger.actions)) return trigger.actions;
    if (typeof trigger.actions === "string") {
      try {
        return JSON.parse(trigger.actions);
      } catch {
        return [];
      }
    }
    return [];
  })();
  const getActionState = (idx) =>
    actionStates[`${trigger.id}:action:${idx}`] || null;

  return (
    <tr
      ref={setNodeRef}
      style={{ ...rowStyle, ...style }}
      className="group"
      onMouseEnter={(e) => {
        if (!flash)
          e.currentTarget.style.background = isGrouped
            ? groupBg
            : "rgba(255,255,255,0.02)";
      }}
      onMouseLeave={(e) => {
        if (!flash) e.currentTarget.style.background = cellBg || "transparent";
      }}
    >
      <td style={{ padding: "8px", ...leftBdr, background: cellBg }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {listeners && (
            <div
              {...attributes}
              {...listeners}
              style={{ cursor: "grab", color: "#5A6278" }}
            >
              <GripVertical size={14} />
            </div>
          )}
          <button
            onClick={() => onSelect(trigger.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#5A6278",
              lineHeight: 1,
            }}
          >
            {isSelected ? (
              <CheckSquare size={14} style={{ color: "#20D9FF" }} />
            ) : (
              <Square size={14} />
            )}
          </button>
        </div>
      </td>
      <td style={{ padding: "8px 12px", background: cellBg }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <button
            type="button"
            className={`rule-expand-btn ${isEditing ? "rule-expand-btn--open" : ""}`}
            onClick={() => onEdit(trigger)}
            title="Expand rule editor"
          >
            <motion.span
              animate={{ rotate: isEditing ? 90 : 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{ display: "flex" }}
            >
              <ChevronRight size={14} />
            </motion.span>
          </button>
          <RuleNum n={ruleNum} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "13px",
                color: "#D8DCE6",
                lineHeight: 1.2,
              }}
            >
              {trigger.name}
            </div>
            {trigger.is_multi_duck && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMultiExpand?.();
                }}
                title="Expand mic channels"
                style={{
                  marginTop: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "10px",
                  color: "#39E58C",
                  background: "rgba(57,229,140,0.08)",
                  border: "1px solid rgba(57,229,140,0.2)",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
              >
                <ChevronRight
                  size={12}
                  style={{
                    transform: multiExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                />
                {duckMembers.length} mic{duckMembers.length === 1 ? "" : "s"}
              </button>
            )}
            {trigger.is_multi_action && actionsList.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMultiExpand?.();
                }}
                title="Expand actions"
                style={{
                  marginTop: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "10px",
                  color: "#20D9FF",
                  background: "rgba(32,217,255,0.08)",
                  border: "1px solid rgba(32,217,255,0.2)",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
              >
                <ChevronRight
                  size={12}
                  style={{
                    transform: multiExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                />
                {actionsList.length} action{actionsList.length === 1 ? "" : "s"}
              </button>
            )}
            <div
              style={{
                fontSize: "10px",
                color: "#5A6278",
                marginTop: "2px",
                fontFamily: "monospace",
              }}
            >
              #{trigger.id}
            </div>
            {trigger.group_id && (
              <div
                style={{
                  fontSize: "10px",
                  color: listen.badgeColor,
                  marginTop: "1px",
                }}
              >
                {trigger.group_name}
              </div>
            )}
          </div>
        </div>
      </td>
      <td
        style={{
          padding: "8px 14px",
          background: isGrouped
            ? `color-mix(in srgb, ${groupBg} 70%, rgba(32,217,255,0.03))`
            : "rgba(32,217,255,0.02)",
          borderLeft: "1px solid rgba(32,217,255,0.06)",
        }}
      >
        <div style={{ marginBottom: "4px" }}>
          <ListenBadge rule={trigger} />
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#D8DCE6",
            lineHeight: 1.3,
          }}
          title={listen.tertiary}
        >
          {listen.primary}
        </div>
        <div style={{ fontSize: "11px", color: "#8B93A8", marginTop: "2px" }}>
          {listen.secondary}
        </div>
        {trigger.is_multi_duck && multiExpanded && duckMembers.length > 0 && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {duckMembers.map((m, i) => {
              const lvl = meters[m.monitor_channel];
              return (
                <div
                  key={`${m.monitor_channel}-${i}`}
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#39E58C", fontWeight: 700 }}>
                    <span>Mic Ch {m.monitor_channel}</span>
                    <span style={{ color: "#6B7280", fontWeight: 500 }}>
                      {lvl != null ? `${(lvl / 100).toFixed(1)} dB` : "No signal"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "3px",
                      background: "rgba(0,0,0,0.35)",
                      borderRadius: "2px",
                      overflow: "hidden",
                      marginTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${meterLevelToWidth(lvl)}%`,
                        background: meterLevelToColor(lvl, m.threshold),
                        transition: "width 0.1s linear",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {trigger.listen_source === "yamaha" && !trigger.is_multi_duck && (
          <div
            style={{
              width: "100%",
              height: "3px",
              background: "rgba(0,0,0,0.3)",
              borderRadius: "2px",
              overflow: "hidden",
              marginTop: "6px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${meterLevelToWidth(meterVal)}%`,
                background: meterLevelToColor(meterVal, trigger.threshold ?? -4000),
                transition: "width 0.1s linear",
              }}
            />
          </div>
        )}
      </td>
      <td
        style={{
          padding: "8px 14px",
          background: isGrouped
            ? `color-mix(in srgb, ${groupBg} 70%, rgba(57,229,140,0.03))`
            : "rgba(57,229,140,0.02)",
          borderRight: "1px solid rgba(57,229,140,0.06)",
        }}
      >
        <div style={{ marginBottom: "4px" }}>
          <CommandBadge rule={trigger} />
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#D8DCE6",
            lineHeight: 1.3,
          }}
          title={command.tertiary}
        >
          {command.primary}
        </div>
        <div style={{ fontSize: "11px", color: "#8B93A8", marginTop: "2px" }}>
          {command.secondary}
        </div>
        {trigger.is_multi_duck && multiExpanded && duckMembers.length > 0 && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {duckMembers.map((m, i) => {
              const state = getMemberActionState(m, i);
              const status = actionStateStyle(state?.status);
              const isVmix = m.action_target === "vmix";
              return (
                <div
                  key={`cmd-${m.monitor_channel}-${i}`}
                  style={{
                    padding: "5px 6px",
                    borderRadius: "6px",
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        minWidth: 0,
                        color: isVmix ? "#20D9FF" : "#39E58C",
                        fontSize: "10px",
                        fontWeight: 800,
                      }}
                    >
                      {isVmix ? <MonitorSpeaker size={10} /> : <Speaker size={10} />}
                      <span style={{ whiteSpace: "nowrap" }}>Mic Ch {m.monitor_channel}</span>
                    </span>
                    <span
                      style={{
                        color: status.color,
                        background: status.bg,
                        border: `1px solid ${status.color}33`,
                        borderRadius: "999px",
                        padding: "1px 6px",
                        fontSize: "9px",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div
                    title={formatMemberAction(m)}
                    style={{
                      marginTop: "3px",
                      color: "#8B93A8",
                      fontSize: "10px",
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatMemberAction(m)}
                  </div>
                  {state?.restored_value != null && (
                    <div style={{ marginTop: "2px", color: "#5A6278", fontSize: "9px", fontFamily: "monospace" }}>
                      restored {String(state.restored_value)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {trigger.is_multi_action && multiExpanded && actionsList.length > 0 && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {actionsList.map((act, i) => {
              const state = getActionState(i);
              const status = actionStateStyle(state?.status);
              const isVmix = act.action_target === "vmix";
              const cmdLabel = isVmix
                ? (VMIX_FN_LABELS[act.vmix_function] || act.vmix_function || "vMix")
                : (YAMAHA_CMD_LABELS[act.yamaha_command] || act.yamaha_command || "Yamaha");
              const detail = isVmix
                ? `${act.vmix_target_input ? `Input ${act.vmix_target_input} \u2192 ` : ""}${act.parameter_value}`
                : `Ch ${act.yamaha_channel || "?"}${act.yamaha_mix ? ` Mix ${act.yamaha_mix}` : ""} \u2192 ${act.parameter_value}`;
              return (
                <div
                  key={`action-${i}`}
                  style={{
                    padding: "5px 6px",
                    borderRadius: "6px",
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        minWidth: 0,
                        color: isVmix ? "#20D9FF" : "#39E58C",
                        fontSize: "10px",
                        fontWeight: 800,
                      }}
                    >
                      {isVmix ? <MonitorSpeaker size={10} /> : <Speaker size={10} />}
                      <span style={{ whiteSpace: "nowrap" }}>Action {i + 1}</span>
                    </span>
                    <span
                      style={{
                        color: status.color,
                        background: status.bg,
                        border: `1px solid ${status.color}33`,
                        borderRadius: "999px",
                        padding: "1px 6px",
                        fontSize: "9px",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div
                    title={`${cmdLabel} \u2014 ${detail}`}
                    style={{
                      marginTop: "3px",
                      color: "#8B93A8",
                      fontSize: "10px",
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cmdLabel} \u2014 {detail}
                  </div>
                  {act.delay_ms > 0 && (
                    <div style={{ marginTop: "2px", color: "#5A6278", fontSize: "9px", fontFamily: "monospace" }}>
                      delay +{act.delay_ms}ms
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {trigger.delay_ms > 0 && (
          <span
            style={{
              fontSize: "10px",
              color: "#5A6278",
              marginTop: "4px",
              display: "block",
            }}
          >
            Delay +{trigger.delay_ms}ms
          </span>
        )}
      </td>
      <td
        style={{ padding: "8px 6px", textAlign: "center", background: cellBg }}
      >
        <span
          style={{
            fontSize: "12px",
            fontFamily: "monospace",
            fontWeight: 700,
            color: (trigger.fire_count || 0) > 0 ? "#20D9FF" : "#5A6278",
          }}
        >
          {trigger.fire_count || 0}
        </span>
      </td>
      <td style={{ padding: "8px 8px", background: cellBg }}>
        <span
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#8B93A8",
          }}
        >
          {formatLastFired(trigger.last_fired_at)}
        </span>
      </td>
      <td
        style={{ padding: "8px 12px", textAlign: "right", background: cellBg }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "1px",
            transition: "opacity 0.15s",
          }}
          className="opacity-0 group-hover:opacity-100"
        >
          {onMove && (
            <>
              <button
                onClick={() => onMove("up")}
                disabled={isFirst}
                style={{
                  padding: "4px",
                  background: "none",
                  border: "none",
                  color: "#334155",
                  cursor: "pointer",
                  opacity: isFirst ? 0.15 : 1,
                }}
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={() => onMove("down")}
                disabled={isLast}
                style={{
                  padding: "4px",
                  background: "none",
                  border: "none",
                  color: "#334155",
                  cursor: "pointer",
                  opacity: isLast ? 0.15 : 1,
                }}
              >
                <ArrowDown size={13} />
              </button>
            </>
          )}
          {pasteMode && onPasteInto && (
            <button
              onClick={() => onPasteInto(trigger)}
              title="Paste settings into this rule"
              style={{
                padding: "4px",
                background: "none",
                border: "none",
                color: "#F6B44B",
                cursor: "pointer",
              }}
            >
              <Clipboard size={13} />
            </button>
          )}
          <button
            onClick={() => onDuplicate(trigger)}
            title="Duplicate"
            style={{
              padding: "4px",
              background: "none",
              border: "none",
              color: "#5A6278",
              cursor: "pointer",
            }}
          >
            <CopyPlus size={12} />
          </button>
          <button
            onClick={() => onDelete(trigger)}
            title="Delete rule"
            style={{
              padding: "4px",
              background: "none",
              border: "none",
              color: "#5A6278",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#FF5C7A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#5A6278")}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
      <td
        style={{ padding: "8px 6px", textAlign: "center", background: cellBg }}
      >
        <ActivationToggle
          active={trigger.is_active}
          onChange={() => onToggle(trigger.id)}
        />
      </td>
    </tr>
  );
});
