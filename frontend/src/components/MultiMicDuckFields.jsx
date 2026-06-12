import { useState } from "react";
import {
  Copy,
  ClipboardPaste,
  Plus,
  Trash2,
  Speaker,
  CopyPlus,
} from "lucide-react";
import {
  DEFAULT_DUCK_MEMBER,
  DEFAULT_DUCK_ACTION,
  LISTEN_COPY_FIELDS,
  LISTEN_FIELD_LABELS,
  YAMAHA_CMD_LABELS,
  meterLevelToWidth,
  meterLevelToColor,
  parseMultiFade,
  formatMultiFade,
} from "../constants/duckGroupConfig";
import { MultiActionFields } from "./MultiActionFields";

const inputStyle = {
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E8ECF4",
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6B7280",
  marginBottom: "6px",
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

function ToolBtn({ onClick, disabled, title, children, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity"
      style={{
        background: accent ? "rgba(32,217,255,0.1)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${accent ? "rgba(32,217,255,0.22)" : "rgba(255,255,255,0.08)"}`,
        color: accent ? "#20D9FF" : "#9CA3AF",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CopyBtn({ onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ ...btnSm, padding: "2px 5px" }}
    >
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

/** mode: "listen" = mic thresholds only | "command" = per-mic actions */
export function MultiMicDuckFields({
  mode = "listen",
  form,
  onChange,
  meters = {},
}) {
  const members = form.duck_members?.length
    ? form.duck_members
    : [{ ...DEFAULT_DUCK_MEMBER }];
  const [fieldClip, setFieldClip] = useState(null);
  const [rowClip, setRowClip] = useState(null);
  const [allClip, setAllClip] = useState(null);

  const setMembers = (next) => onChange("duck_members", next);
  const onChangeMember = (idx, field, value) => {
    setMembers(
      members.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    );
  };

  const legacyActionFromMember = (member) => ({
    ...DEFAULT_DUCK_ACTION,
    action_target: member.action_target || "yamaha",
    yamaha_command: member.yamaha_command || "InCh/Fader/Smooth",
    yamaha_channel: member.yamaha_channel ?? 10,
    yamaha_mix: member.yamaha_mix ?? 0,
    vmix_function: member.vmix_function || null,
    vmix_target_input: member.vmix_target_input ?? null,
    parameter_value: member.parameter_value ?? "-2500",
    delay_ms: member.delay_ms ?? 0,
  });

  const getMemberActions = (member) =>
    Array.isArray(member.actions) && member.actions.length
      ? member.actions
      : [legacyActionFromMember(member)];

  const withPrimaryActionFields = (member, actions) => {
    const first = actions[0] || legacyActionFromMember(member);
    return {
      ...member,
      actions,
      action_target: first.action_target || "yamaha",
      yamaha_command: first.yamaha_command || "InCh/Fader/Smooth",
      yamaha_channel: first.yamaha_channel ?? 10,
      yamaha_mix: first.yamaha_mix ?? 0,
      vmix_function: first.vmix_function || null,
      vmix_target_input: first.vmix_target_input ?? null,
      parameter_value: first.parameter_value ?? "-2500",
      delay_ms: first.delay_ms ?? 0,
    };
  };

  const setMemberActions = (idx, actions) => {
    setMembers(
      members.map((m, i) =>
        i === idx ? withPrimaryActionFields(m, actions) : m,
      ),
    );
  };

  const addMember = () => {
    const last = members[members.length - 1];
    setMembers([
      ...members,
      {
        ...DEFAULT_DUCK_MEMBER,
        ...last,
        monitor_channel: Math.min((last?.monitor_channel || 1) + 1, 40),
      },
    ]);
  };

  const duplicateMember = (idx) => {
    const member = {
      ...members[idx],
      monitor_channel: Math.min((members[idx].monitor_channel || 1) + 1, 40),
    };
    const newMembers = [...members];
    newMembers.splice(idx + 1, 0, member);
    setMembers(newMembers);
  };

  const removeMember = (idx) => {
    if (members.length <= 1) return;
    setMembers(members.filter((_, i) => i !== idx));
  };

  const copyField = (field, fromIdx = 0) =>
    setFieldClip({ field, value: members[fromIdx]?.[field] });
  const pasteField = (field, toIdx) => {
    if (!fieldClip || fieldClip.field !== field) return;
    onChangeMember(toIdx, field, fieldClip.value);
  };
  const pasteFieldAll = (field) => {
    if (!fieldClip || fieldClip.field !== field) return;
    setMembers(members.map((m) => ({ ...m, [field]: fieldClip.value })));
  };

  const copyRowSettings = (idx, fields) => {
    const m = members[idx];
    setRowClip({
      fields,
      data: Object.fromEntries(fields.map((f) => [f, m[f]])),
    });
  };
  const pasteRowSettings = (idx, fields, { preserveMonitor = false } = {}) => {
    if (!rowClip) return;
    const data = rowClip.data || rowClip;
    const picked = Object.fromEntries(
      fields
        .filter(
          (f) =>
            data[f] !== undefined &&
            !(preserveMonitor && f === "monitor_channel"),
        )
        .map((f) => [f, data[f]]),
    );
    setMembers(members.map((m, i) => (i === idx ? { ...m, ...picked } : m)));
  };
  const pasteRowSettingsAll = (fields, { preserveMonitor = true } = {}) => {
    if (!rowClip) return;
    const data = rowClip.data || rowClip;
    const picked = Object.fromEntries(
      fields
        .filter(
          (f) =>
            data[f] !== undefined &&
            !(preserveMonitor && f === "monitor_channel"),
        )
        .map((f) => [f, data[f]]),
    );
    setMembers(members.map((m) => ({ ...m, ...picked })));
  };

  const listenFields = LISTEN_COPY_FIELDS;
  const commandFields = [
    "action_target",
    "yamaha_command",
    "yamaha_channel",
    "yamaha_mix",
    "vmix_function",
    "vmix_target_input",
    "parameter_value",
  ];
  const copyAllListen = () => {
    const m = members[0];
    setAllClip({
      kind: "listen",
      data: {
        silence_timeout_ms: form.silence_timeout_ms,
        threshold: m.threshold,
        release_threshold: m.release_threshold,
      },
    });
  };
  const pasteAllListen = () => {
    if (!allClip || allClip.kind !== "listen") return;
    if (allClip.data.silence_timeout_ms != null)
      onChange("silence_timeout_ms", allClip.data.silence_timeout_ms);
    setMembers(
      members.map((m) => ({
        ...m,
        threshold: allClip.data.threshold ?? m.threshold,
        release_threshold:
          allClip.data.release_threshold ?? m.release_threshold,
      })),
    );
  };

  const { attack, release } = parseMultiFade(form.parameter_value);

  if (mode === "listen") {
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(32,217,255,0.05)",
            border: "1px solid rgba(32,217,255,0.12)",
          }}
        >
          <label style={labelStyle}>
            Silence timeout (ms) — shared by all mics
          </label>
          <input
            type="number"
            value={form.silence_timeout_ms ?? 3000}
            onChange={(e) =>
              onChange("silence_timeout_ms", parseInt(e.target.value, 10) || 0)
            }
            style={{ ...inputStyle, maxWidth: "160px" }}
          />
          <p className="text-[11px] mt-2" style={{ color: "#6B7280" }}>
            How long every mic must be quiet before a target restores.
          </p>
        </div>

        <div
          className="flex flex-wrap gap-2 p-2 rounded-lg"
          style={{
            background: "rgba(32,217,255,0.06)",
            border: "1px solid rgba(32,217,255,0.15)",
          }}
        >
          <ToolBtn
            onClick={copyAllListen}
            title="Copy silence timeout and thresholds from row 1"
            accent
          >
            <Copy size={12} /> Copy all settings (row 1)
          </ToolBtn>
          <ToolBtn
            onClick={pasteAllListen}
            disabled={allClip?.kind !== "listen"}
            title="Paste to every mic row"
          >
            <ClipboardPaste size={12} /> Paste all to every channel
          </ToolBtn>
          {allClip?.kind === "listen" && (
            <span
              className="text-[10px] self-center"
              style={{ color: "#20D9FF" }}
            >
              Clipboard ready
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: "11px" }}>
            <thead>
              <tr style={{ color: "#5A6278" }}>
                {listenFields.map((field) => (
                  <th key={field} className="pb-2 pr-1">
                    <div className="flex items-center gap-1">
                      <span>{LISTEN_FIELD_LABELS[field]}</span>
                      <CopyBtn
                        onClick={() => copyField(field, 0)}
                        title={`Copy ${LISTEN_FIELD_LABELS[field]} from row 1`}
                      />
                      <PasteBtn
                        onClick={() => pasteFieldAll(field)}
                        title={`Paste ${LISTEN_FIELD_LABELS[field]} to all rows`}
                        disabled={!fieldClip || fieldClip.field !== field}
                      />
                    </div>
                  </th>
                ))}
                <th className="pb-2 pr-1">Meter</th>
                <th className="pb-2 pr-1">Row</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => {
                const level = meters[member.monitor_channel];
                const speaking =
                  level != null && level >= (member.threshold ?? -4000);
                return (
                  <tr
                    key={idx}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                      background: speaking
                        ? "rgba(34,197,94,0.04)"
                        : "transparent",
                    }}
                  >
                    {listenFields.map((field) => (
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
                                  ? parseInt(e.target.value, 10) || 1
                                  : parseInt(e.target.value, 10) || 0,
                              )
                            }
                            style={{
                              ...inputStyle,
                              minWidth: "52px",
                              padding: "6px 8px",
                              fontSize: "12px",
                            }}
                          />
                          <CopyBtn
                            onClick={() => copyField(field, idx)}
                            title={`Copy ${LISTEN_FIELD_LABELS[field]} from this row`}
                          />
                          <PasteBtn
                            onClick={() => pasteField(field, idx)}
                            title={`Paste ${LISTEN_FIELD_LABELS[field]}`}
                            disabled={!fieldClip || fieldClip.field !== field}
                          />
                        </div>
                      </td>
                    ))}
                    <td className="py-2 pr-1">
                      <div
                        className="flex flex-col gap-1"
                        style={{ minWidth: "72px" }}
                      >
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{
                            background: "rgba(0,0,0,0.45)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-100"
                            style={{
                              width: `${meterLevelToWidth(level)}%`,
                              background: meterLevelToColor(
                                level,
                                member.threshold ?? -4000,
                              ),
                            }}
                          />
                        </div>
                        <span
                          className="text-[9px] font-mono tabular-nums"
                          style={{ color: speaking ? "#22c55e" : "#6B7280" }}
                        >
                          {level != null
                            ? `${(level / 100).toFixed(1)} dB`
                            : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-1">
                      <div className="flex gap-0.5">
                        <CopyBtn
                          onClick={() => copyRowSettings(idx, listenFields)}
                          title="Copy row settings"
                        />
                        <PasteBtn
                          onClick={() => pasteRowSettings(idx, listenFields)}
                          disabled={!rowClip}
                          title="Paste row settings"
                        />
                        <button
                          type="button"
                          onClick={() => pasteRowSettingsAll(listenFields)}
                          disabled={!rowClip}
                          title="Paste row settings to all mics"
                          style={{
                            ...btnSm,
                            padding: "2px 6px",
                            opacity: rowClip ? 1 : 0.35,
                          }}
                        >
                          All
                        </button>
                        <div className="w-[1px] h-4 bg-white/10 mx-1 self-center" />
                        <button
                          type="button"
                          onClick={() => duplicateMember(idx)}
                          title="Duplicate mic below"
                          style={{ ...btnSm, padding: "2px 5px" }}
                        >
                          <CopyPlus size={10} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removeMember(idx)}
                        disabled={members.length <= 1}
                        className="p-1 rounded-lg"
                        style={{
                          color: "#f87171",
                          opacity: members.length <= 1 ? 0.3 : 1,
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addMember}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors"
          style={{
            background: "rgba(32,217,255,0.08)",
            border: "1px dashed rgba(32,217,255,0.3)",
            color: "#20D9FF",
          }}
        >
          <Plus size={16} /> Add mic channel
        </button>
      </div>
    );
  }

  // ── Command mode ──
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4 grid grid-cols-2 gap-3"
        style={{
          background: "rgba(57,229,140,0.05)",
          border: "1px solid rgba(57,229,140,0.12)",
        }}
      >
        <div>
          <label style={labelStyle}>Fade attack (ms)</label>
          <input
            type="number"
            min="0"
            value={attack}
            onChange={(e) =>
              onChange(
                "parameter_value",
                formatMultiFade(parseInt(e.target.value, 10) || 700, release),
              )
            }
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Fade release (ms)</label>
          <input
            type="number"
            min="0"
            value={release}
            onChange={(e) =>
              onChange(
                "parameter_value",
                formatMultiFade(attack, parseInt(e.target.value, 10) || 700),
              )
            }
            style={inputStyle}
          />
        </div>
        <p className="col-span-2 text-[11px]" style={{ color: "#6B7280" }}>
          Shared smooth fade timing for all mic actions. Duck level is set per
          mic below.
        </p>
      </div>

      <div className="space-y-3">
        {members.map((member, idx) => {
          const memberActions = getMemberActions(member);
          return (
            <div
              key={idx}
              className="rounded-xl p-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(32,217,255,0.12)",
                      color: "#20D9FF",
                    }}
                  >
                    <Speaker size={14} />
                  </div>
                  <div>
                    <div
                      className="text-sm font-bold"
                      style={{ color: "#E8ECF4" }}
                    >
                      Mic {member.monitor_channel || "?"} Command
                    </div>
                    <div className="text-[10px]" style={{ color: "#6B7280" }}>
                      {memberActions.length === 1
                        ? `${YAMAHA_CMD_LABELS[memberActions[0]?.yamaha_command] || memberActions[0]?.yamaha_command || "—"} → ${memberActions[0]?.parameter_value ?? ""}`
                        : `${memberActions.length} actions`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <ToolBtn
                    onClick={() => copyRowSettings(idx, commandFields)}
                    title="Copy this command"
                  >
                    <Copy size={11} />
                  </ToolBtn>
                  <ToolBtn
                    onClick={() => pasteRowSettings(idx, commandFields)}
                    disabled={!rowClip}
                    title="Paste to this mic"
                  >
                    <ClipboardPaste size={11} />
                  </ToolBtn>
                  <ToolBtn
                    onClick={() => pasteRowSettingsAll(commandFields)}
                    disabled={!rowClip}
                    title="Paste to all mics"
                  >
                    All
                  </ToolBtn>
                  <div className="w-[1px] h-4 bg-white/10 mx-1 self-center" />
                  <ToolBtn
                    onClick={() => duplicateMember(idx)}
                    title="Duplicate mic below"
                  >
                    <CopyPlus size={11} />
                  </ToolBtn>
                  <button
                    type="button"
                    onClick={() => removeMember(idx)}
                    disabled={members.length <= 1}
                    className="ml-2 p-1.5 rounded-lg"
                    style={{
                      color: "#f87171",
                      opacity: members.length <= 1 ? 0.3 : 1,
                      background: "rgba(248,113,113,0.1)",
                    }}
                    title="Remove mic"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <MultiActionFields
                form={{ actions: getMemberActions(member) }}
                onChange={(field, value) => {
                  if (field === "actions") setMemberActions(idx, value);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
