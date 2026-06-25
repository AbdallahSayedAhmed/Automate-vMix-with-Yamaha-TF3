import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CopyPlus,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useDuckGroups } from "../hooks/useDuckGroups";
import {
  DuckGroupEditorDrawer,
  DEFAULT_DUCK_GROUP_FORM,
} from "./DuckGroupEditorDrawer";
import { ActivationToggle } from "./ActivationToggle";
import { meterLevelToWidth, meterLevelToColor } from "../constants/duckGroupConfig";

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-xl p-5 max-w-sm" style={{ background: "#151B27", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 className="text-sm font-bold mb-2" style={{ color: "#D8DCE6" }}>{title}</h3>
        <p className="text-xs mb-4" style={{ color: "#8B93A8" }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg" style={{ color: "#8B93A8" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded-lg font-bold"
            style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function DuckGroupsSection({ meters = {}, collapsed: defaultCollapsed = false }) {
  const {
    duckGroups,
    loading,
    addDuckGroup,
    updateDuckGroup,
    deleteDuckGroup,
    toggleDuckGroup,
    duplicateDuckGroup,
  } = useDuckGroups();

  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(DEFAULT_DUCK_GROUP_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openCreate = () => {
    setEditingId(null);
    setEditForm({
      ...DEFAULT_DUCK_GROUP_FORM,
      members: [{ ...DEFAULT_DUCK_GROUP_FORM.members[0] }],
    });
    setEditorOpen(true);
  };

  const openEdit = (group) => {
    setEditingId(group.id);
    setEditForm({
      name: group.name,
      is_active: group.is_active,
      silence_timeout_ms: group.silence_timeout_ms,
      sort_order: group.sort_order,
      members: group.members.map((m) => ({
        monitor_channel: m.monitor_channel,
        threshold: m.threshold,
        release_threshold: m.release_threshold,
        attack_ms: m.attack_ms,
        release_ms: m.release_ms,
        sort_order: m.sort_order,
        actions: m.actions.map((a) => ({ ...a })),
      })),
    });
    setEditorOpen(true);
  };

  const handleChange = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingId) {
        await updateDuckGroup(editingId, payload);
        toast.success("Duck group updated");
      } else {
        await addDuckGroup(payload);
        toast.success("Duck group created");
      }
      setEditorOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDuckGroup(deleteTarget);
      toast.success("Duck group deleted");
    } catch (err) {
      toast.error(err.message);
    }
    setDeleteTarget(null);
  };

  return (
    <div
      className="mb-3 rounded-xl overflow-hidden"
      style={{
        background: "rgba(57,229,140,0.03)",
        border: "1px solid rgba(57,229,140,0.12)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
        onClick={() => setSectionOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {sectionOpen ? <ChevronDown size={16} style={{ color: "#39E58C" }} /> : <ChevronRight size={16} style={{ color: "#39E58C" }} />}
          <Layers size={16} style={{ color: "#39E58C" }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#39E58C" }}>
            Auto Duck Groups
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(57,229,140,0.12)", color: "#39E58C" }}>
            {duckGroups.length}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCreate();
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
          style={{
            background: "rgba(57,229,140,0.12)",
            border: "1px solid rgba(57,229,140,0.25)",
            color: "#39E58C",
          }}
        >
          <Plus size={12} /> New Duck Group
        </button>
      </div>

      {sectionOpen && (
        <div className="px-4 pb-3">
          {loading && duckGroups.length === 0 && (
            <p className="text-xs py-2" style={{ color: "#6B7280" }}>Loading…</p>
          )}
          {!loading && duckGroups.length === 0 && (
            <p className="text-xs py-2" style={{ color: "#6B7280" }}>
              No duck groups yet. Add one to monitor multiple mics and duck targets without conflicts.
            </p>
          )}
          {duckGroups.map((group) => {
            const isExp = expandedGroups[group.id];
            return (
              <div
                key={group.id}
                className="mb-2 rounded-lg"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((e) => ({ ...e, [group.id]: !e[group.id] }))}
                    style={{ color: "#39E58C" }}
                  >
                    {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="text-xs font-semibold flex-1" style={{ color: "#D8DCE6" }}>
                    {group.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "#6B7280" }}>
                    {group.members.length} mic{group.members.length !== 1 ? "s" : ""} · silence {group.silence_timeout_ms}ms
                  </span>
                  <ActivationToggle
                    active={group.is_active}
                    onChange={() => toggleDuckGroup(group.id).catch((e) => toast.error(e.message))}
                  />
                  <button type="button" onClick={() => openEdit(group)} style={{ color: "#8B93A8" }}>
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateDuckGroup(group.id).then(() => toast.success("Duplicated")).catch((e) => toast.error(e.message))}
                    style={{ color: "#8B93A8" }}
                  >
                    <CopyPlus size={13} />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(group.id)} style={{ color: "#f87171" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                {isExp && (
                  <div className="px-3 pb-3 space-y-2">
                    {group.members.map((m) => {
                      const level = meters[m.monitor_channel];
                      const actionSummary = m.actions
                        .map((a) =>
                          a.action_target === "yamaha"
                            ? `${a.yamaha_command.split("/").pop()} Ch${a.yamaha_channel}`
                            : a.vmix_function,
                        )
                        .join(", ");
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 text-[11px] py-1.5 px-2 rounded"
                          style={{ background: "rgba(255,255,255,0.02)" }}
                        >
                          <span className="font-mono font-bold w-8" style={{ color: "#39E58C" }}>
                            Ch{m.monitor_channel}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className="h-1.5 rounded-full overflow-hidden mb-1"
                              style={{ background: "rgba(0,0,0,0.4)" }}
                            >
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${meterLevelToWidth(level)}%`,
                                  background: meterLevelToColor(level, m.threshold),
                                }}
                              />
                            </div>
                            <span style={{ color: "#6B7280" }}>
                              thr {m.threshold} · atk {m.attack_ms}ms · rel {m.release_ms}ms → {actionSummary}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DuckGroupEditorDrawer
        isOpen={editorOpen}
        isNew={!editingId}
        form={editForm}
        onChange={handleChange}
        onSave={handleSave}
        onClose={() => setEditorOpen(false)}
        saving={saving}
        meters={meters}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Duck Group?"
        message="This removes the group and all mic/action settings."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
