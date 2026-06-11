import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  ClipboardPaste,
  Layers,
} from "lucide-react";
import { ActivationToggle } from "./ActivationToggle";
import {
  DEFAULT_DUCK_GROUP_FORM,
  DEFAULT_DUCK_MEMBER,
  DEFAULT_DUCK_ACTION,
  MEMBER_COPY_FIELDS,
  MEMBER_FIELD_LABELS,
  YAMAHA_CMD_LABELS,
  VMIX_FN_LABELS,
  yamahaCmdNeedsMix,
  yamahaCmdNeedsChannel,
  meterLevelToWidth,
  meterLevelToColor,
} from "../constants/duckGroupConfig";

const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#D8DCE6",
  borderRadius: "6px",
  padding: "6px 8px",
  fontSize: "12px",
  width: "100%",
  boxSizing: "border-box",
};

const btnSm = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#8B93A8",
  borderRadius: "6px",
  padding: "4px 8px",
  fontSize: "10px",
  cursor: "pointer",
};

function Field({ label, children, hint }) {
  return (
    <div className="mb-2">
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#5A6278" }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: "#6B7280" }}>{hint}</p>}
    </div>
  );
}

function CopyBtn({ onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{ ...btnSm, padding: "2px 5px" }}>
      <Copy size={10} />
    </button>
  );
}

function PasteBtn({ onClick, title, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ ...btnSm, padding: "2px 5px", opacity: disabled ? 0.35 : 1 }}
    >
      <ClipboardPaste size={10} />
    </button>
  );
}

function MemberActions({ member, memberIdx, onChangeMember, showHints }) {
  const updateAction = (ai, field, value) => {
    const actions = member.actions.map((a, i) => (i === ai ? { ...a, [field]: value } : a));
    onChangeMember(memberIdx, "actions", actions);
  };

  const addAction = () => {
    onChangeMember(memberIdx, "actions", [
      ...member.actions,
      { ...DEFAULT_DUCK_ACTION, sort_order: member.actions.length },
    ]);
  };

  const removeAction = (ai) => {
    if (member.actions.length <= 1) return;
    onChangeMember(
      memberIdx,
      "actions",
      member.actions.filter((_, i) => i !== ai),
    );
  };

  return (
    <div className="mt-2 pl-3 border-l-2" style={{ borderColor: "rgba(57,229,140,0.25)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase" style={{ color: "#39E58C" }}>
          Actions when this mic speaks
        </span>
        <button type="button" onClick={addAction} style={btnSm}>
          <Plus size={10} className="inline mr-1" /> Action
        </button>
      </div>
      {member.actions.map((action, ai) => {
        const cmd = action.yamaha_command || "InCh/Fader/Smooth";
        const needsMix = yamahaCmdNeedsMix(cmd);
        const needsChannel = yamahaCmdNeedsChannel(cmd);
        return (
          <div
            key={ai}
            className="mb-2 p-2 rounded-lg"
            style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px]" style={{ color: "#6B7280" }}>Action {ai + 1}</span>
              {member.actions.length > 1 && (
                <button type="button" onClick={() => removeAction(ai)} style={{ ...btnSm, color: "#f87171" }}>
                  <Trash2 size={10} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Target">
                <select
                  value={action.action_target}
                  onChange={(e) => updateAction(ai, "action_target", e.target.value)}
                  style={inputStyle}
                >
                  <option value="yamaha">Yamaha</option>
                  <option value="vmix">vMix</option>
                </select>
              </Field>
              {action.action_target === "yamaha" ? (
                <Field label="Command">
                  <select
                    value={cmd}
                    onChange={(e) => updateAction(ai, "yamaha_command", e.target.value)}
                    style={inputStyle}
                  >
                    {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="vMix Function">
                  <select
                    value={action.vmix_function || "SetVolume"}
                    onChange={(e) => updateAction(ai, "vmix_function", e.target.value)}
                    style={inputStyle}
                  >
                    {Object.entries(VMIX_FN_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
              )}
              {action.action_target === "yamaha" && needsChannel && (
                <Field label="Ch">
                  <input
                    type="number"
                    value={action.yamaha_channel ?? 1}
                    onChange={(e) => updateAction(ai, "yamaha_channel", parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </Field>
              )}
              {action.action_target === "yamaha" && needsMix && (
                <Field label="Mix">
                  <input
                    type="number"
                    value={action.yamaha_mix ?? 0}
                    onChange={(e) => updateAction(ai, "yamaha_mix", parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </Field>
              )}
              {action.action_target === "vmix" && action.vmix_function === "SetVolume" && (
                <Field label="vMix Input">
                  <input
                    type="number"
                    value={action.vmix_target_input ?? ""}
                    onChange={(e) =>
                      updateAction(ai, "vmix_target_input", parseInt(e.target.value) || null)
                    }
                    style={inputStyle}
                  />
                </Field>
              )}
              <Field label="Duck Value" hint={showHints ? "e.g. -2500 for -25dB, or 0 for mute" : null}>
                <input
                  type="text"
                  value={action.parameter_value || ""}
                  onChange={(e) => updateAction(ai, "parameter_value", e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DuckGroupEditorDrawer({
  isOpen,
  isNew,
  form,
  onChange,
  onSave,
  onClose,
  saving = false,
  meters = {},
  showFieldHints = true,
}) {
  const [expanded, setExpanded] = useState({});
  const [fieldClip, setFieldClip] = useState(null);
  const [rowClip, setRowClip] = useState(null);
  const [allClip, setAllClip] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setExpanded({});
    }
  }, [isOpen, isNew]);

  const members = form.members || [];

  const onChangeMember = (idx, field, value) => {
    const next = members.map((m, i) => (i === idx ? { ...m, [field]: value } : m));
    onChange("members", next);
  };

  const addMember = () => {
    const last = members[members.length - 1];
    const ch = last ? (last.monitor_channel || 1) + 1 : 1;
    onChange("members", [
      ...members,
      {
        ...DEFAULT_DUCK_MEMBER,
        monitor_channel: Math.min(ch, 40),
        sort_order: members.length,
        actions: last?.actions?.map((a) => ({ ...a })) || [{ ...DEFAULT_DUCK_ACTION }],
      },
    ]);
  };

  const removeMember = (idx) => {
    if (members.length <= 1) return;
    onChange(
      "members",
      members.filter((_, i) => i !== idx),
    );
  };

  const copyField = (field, fromIdx = 0) => {
    const val = members[fromIdx]?.[field];
    setFieldClip({ field, value: val });
  };

  const pasteField = (field, toIdx) => {
    if (!fieldClip || fieldClip.field !== field) return;
    onChangeMember(toIdx, field, fieldClip.value);
  };

  const pasteFieldAll = (field) => {
    if (!fieldClip || fieldClip.field !== field) return;
    onChange(
      "members",
      members.map((m) => ({ ...m, [field]: fieldClip.value })),
    );
  };

  const copyRow = (idx) => {
    const m = members[idx];
    setRowClip({
      threshold: m.threshold,
      release_threshold: m.release_threshold,
      attack_ms: m.attack_ms,
      release_ms: m.release_ms,
      actions: m.actions?.map((a) => ({ ...a })) || [],
    });
  };

  const pasteRow = (idx) => {
    if (!rowClip) return;
    onChangeMember(idx, "threshold", rowClip.threshold);
    onChangeMember(idx, "release_threshold", rowClip.release_threshold);
    onChangeMember(idx, "attack_ms", rowClip.attack_ms);
    onChangeMember(idx, "release_ms", rowClip.release_ms);
    onChangeMember(idx, "actions", rowClip.actions.map((a) => ({ ...a })));
  };

  const copyAll = (fromIdx = 0) => {
    const m = members[fromIdx];
    setAllClip({
      silence_timeout_ms: form.silence_timeout_ms,
      threshold: m?.threshold,
      release_threshold: m?.release_threshold,
      attack_ms: m?.attack_ms,
      release_ms: m?.release_ms,
      actions: m?.actions?.map((a) => ({ ...a })) || [],
    });
  };

  const pasteAllToAll = () => {
    if (!allClip) return;
    onChange("silence_timeout_ms", allClip.silence_timeout_ms);
    onChange(
      "members",
      members.map((m) => ({
        ...m,
        threshold: allClip.threshold,
        release_threshold: allClip.release_threshold,
        attack_ms: allClip.attack_ms,
        release_ms: allClip.release_ms,
        actions: allClip.actions.map((a) => ({ ...a })),
      })),
    );
  };

  const buildPayload = () => ({
    name: form.name,
    is_active: form.is_active !== false,
    silence_timeout_ms: form.silence_timeout_ms ?? 3000,
    sort_order: form.sort_order ?? 0,
    members: members.map((m, i) => ({
      monitor_channel: m.monitor_channel,
      threshold: m.threshold ?? -4000,
      release_threshold: m.release_threshold ?? -5000,
      attack_ms: m.attack_ms ?? 700,
      release_ms: m.release_ms ?? 700,
      sort_order: m.sort_order ?? i,
      actions: (m.actions || [{ ...DEFAULT_DUCK_ACTION }]).map((a, ai) => ({
        action_target: a.action_target || "yamaha",
        yamaha_command: a.yamaha_command || "InCh/Fader/Smooth",
        yamaha_channel: a.yamaha_channel ?? 10,
        yamaha_mix: a.yamaha_mix ?? 0,
        vmix_function: a.vmix_function || null,
        vmix_target_input: a.vmix_target_input ?? null,
        parameter_value: a.parameter_value || "-2500",
        sort_order: a.sort_order ?? ai,
      })),
    })),
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{
              width: "min(720px, 100vw)",
              background: "#0D1117",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2">
                <Layers size={18} style={{ color: "#39E58C" }} />
                <h2 className="text-sm font-bold" style={{ color: "#D8DCE6" }}>
                  {isNew ? "New Duck Group" : "Edit Duck Group"}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <ActivationToggle
                  active={form.is_active !== false}
                  onChange={(v) => onChange("is_active", v)}
                />
                <button type="button" onClick={onClose} style={{ color: "#6B7280" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <Field label="Group Name">
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => onChange("name", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field
                label="Silence Timeout (ms) — shared by all mics"
                hint={showFieldHints ? "How long all mics must be quiet before restore (per target)." : null}
              >
                <input
                  type="number"
                  value={form.silence_timeout_ms ?? 3000}
                  onChange={(e) => onChange("silence_timeout_ms", parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </Field>

              <div
                className="flex flex-wrap gap-2 mb-3 p-2 rounded-lg"
                style={{ background: "rgba(57,229,140,0.06)", border: "1px solid rgba(57,229,140,0.15)" }}
              >
                <button type="button" onClick={() => copyAll(0)} style={btnSm}>
                  <Copy size={11} className="inline mr-1" /> Copy All Settings (row 1)
                </button>
                <button
                  type="button"
                  onClick={pasteAllToAll}
                  disabled={!allClip}
                  style={{ ...btnSm, opacity: allClip ? 1 : 0.4 }}
                >
                  <ClipboardPaste size={11} className="inline mr-1" /> Paste All to Every Channel
                </button>
                {allClip && (
                  <span className="text-[10px] self-center" style={{ color: "#39E58C" }}>
                    Clipboard ready
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ fontSize: "11px" }}>
                  <thead>
                    <tr style={{ color: "#5A6278" }}>
                      <th className="pb-2 pr-1 w-6" />
                      {MEMBER_COPY_FIELDS.map((field) => (
                        <th key={field} className="pb-2 pr-1">
                          <div className="flex items-center gap-1">
                            <span>{MEMBER_FIELD_LABELS[field]}</span>
                            <CopyBtn onClick={() => copyField(field, 0)} title={`Copy ${field}`} />
                            <PasteBtn
                              onClick={() => pasteFieldAll(field)}
                              title={`Paste ${field} to all`}
                              disabled={!fieldClip || fieldClip.field !== field}
                            />
                          </div>
                        </th>
                      ))}
                      <th className="pb-2">Meter</th>
                      <th className="pb-2">Row</th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, idx) => {
                      const isExp = expanded[idx];
                      const level = meters[member.monitor_channel];
                      return (
                        <tr key={idx} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <td className="py-2 pr-1">
                            <button
                              type="button"
                              onClick={() => setExpanded((e) => ({ ...e, [idx]: !e[idx] }))}
                              style={{ color: "#39E58C" }}
                            >
                              {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          {MEMBER_COPY_FIELDS.map((field) => (
                            <td key={field} className="py-2 pr-1">
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  value={member[field] ?? ""}
                                  onChange={(e) =>
                                    onChangeMember(
                                      idx,
                                      field,
                                      field === "monitor_channel"
                                        ? parseInt(e.target.value) || 1
                                        : parseInt(e.target.value) ?? 0,
                                    )
                                  }
                                  style={{ ...inputStyle, minWidth: "52px" }}
                                />
                                <CopyBtn
                                  onClick={() => copyField(field, idx)}
                                  title={`Copy ${MEMBER_FIELD_LABELS[field]} from this row`}
                                />
                                <PasteBtn
                                  onClick={() => pasteField(field, idx)}
                                  disabled={!fieldClip || fieldClip.field !== field}
                                  title={`Paste ${MEMBER_FIELD_LABELS[field]}`}
                                />
                              </div>
                            </td>
                          ))}
                          <td className="py-2 pr-1">
                            <div
                              className="h-2 rounded-full overflow-hidden"
                              style={{ width: "48px", background: "rgba(0,0,0,0.4)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${meterLevelToWidth(level)}%`,
                                  background: meterLevelToColor(level, member.threshold),
                                }}
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-1">
                            <div className="flex gap-0.5">
                              <CopyBtn onClick={() => copyRow(idx)} title="Copy row settings" />
                              <PasteBtn
                                onClick={() => pasteRow(idx)}
                                disabled={!rowClip}
                                title="Paste row settings"
                              />
                            </div>
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => removeMember(idx)}
                              disabled={members.length <= 1}
                              style={{ ...btnSm, color: "#f87171", opacity: members.length <= 1 ? 0.3 : 1 }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {members.map((member, idx) =>
                expanded[idx] ? (
                  <div key={`exp-${idx}`} className="mb-3">
                    <p className="text-[10px] font-bold mb-1" style={{ color: "#39E58C" }}>
                      Ch {member.monitor_channel} — actions
                    </p>
                    <MemberActions
                      member={member}
                      memberIdx={idx}
                      onChangeMember={onChangeMember}
                      showHints={showFieldHints}
                    />
                  </div>
                ) : null,
              )}

              <button
                type="button"
                onClick={addMember}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "#39E58C" }}
              >
                <Plus size={14} /> Add Mic Channel
              </button>
            </div>

            <div
              className="shrink-0 px-5 py-4 flex gap-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <button
                type="button"
                onClick={() => onSave(buildPayload())}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold"
                style={{
                  background: "rgba(57,229,140,0.15)",
                  border: "1px solid rgba(57,229,140,0.35)",
                  color: "#39E58C",
                }}
              >
                <Save size={16} />
                {saving ? "Saving…" : "Save Duck Group"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { DEFAULT_DUCK_GROUP_FORM };
