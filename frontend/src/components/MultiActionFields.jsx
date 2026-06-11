import { useState } from "react";
import { Copy, ClipboardPaste, Plus, Trash2, Zap, CopyPlus } from "lucide-react";
import {
  YAMAHA_CMD_LABELS,
  VMIX_FN_LABELS,
  yamahaCmdNeedsMix,
  yamahaCmdNeedsChannel,
} from "../constants/duckGroupConfig";

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

const DEFAULT_ACTION = {
  action_target: "yamaha",
  yamaha_command: "InCh/Fader/Level",
  yamaha_channel: 1,
  yamaha_mix: 0,
  vmix_function: "SetVolume",
  vmix_target_input: null,
  parameter_value: "0",
  delay_ms: 0,
};

export function MultiActionFields({ form, onChange }) {
  const actions = form.actions?.length ? form.actions : [{ ...DEFAULT_ACTION }];
  const [rowClip, setRowClip] = useState(null);
  const [allClip, setAllClip] = useState(null);

  const setActions = (next) => onChange("actions", next);
  const onChangeAction = (idx, field, value) => {
    setActions(actions.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const addAction = () => {
    const last = actions[actions.length - 1];
    setActions([
      ...actions,
      {
        ...DEFAULT_ACTION,
        ...last,
        delay_ms: 0,
      },
    ]);
  };

  const duplicateAction = (idx) => {
    const action = { ...actions[idx] };
    const newActions = [...actions];
    newActions.splice(idx + 1, 0, action);
    setActions(newActions);
  };

  const removeAction = (idx) => {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== idx));
  };

  const commandFields = [
    "action_target",
    "yamaha_command",
    "yamaha_channel",
    "yamaha_mix",
    "vmix_function",
    "vmix_target_input",
    "parameter_value",
    "delay_ms",
  ];

  const copyRowSettings = (idx, fields) => {
    const a = actions[idx];
    setRowClip({
      fields,
      data: Object.fromEntries(fields.map((f) => [f, a[f]])),
    });
  };
  
  const pasteRowSettings = (idx, fields) => {
    if (!rowClip) return;
    const data = rowClip.data || rowClip;
    const picked = Object.fromEntries(
      fields.filter((f) => data[f] !== undefined).map((f) => [f, data[f]])
    );
    setActions(actions.map((a, i) => (i === idx ? { ...a, ...picked } : a)));
  };

  const pasteRowSettingsAll = (fields) => {
    if (!rowClip) return;
    const data = rowClip.data || rowClip;
    const picked = Object.fromEntries(
      fields.filter((f) => data[f] !== undefined).map((f) => [f, data[f]])
    );
    setActions(actions.map((a) => ({ ...a, ...picked })));
  };

  const formatActionDetail = (action) => {
    if (action.action_target === "yamaha") {
      const isLevel = action.yamaha_command?.endsWith("/Level");
      const isSmooth = action.yamaha_command?.endsWith("/Smooth");
      let val = action.parameter_value;
      if (isLevel || isSmooth) {
        val = isSmooth ? `${val.split(",")[0]} dB` : `${val} dB`;
      }
      return `${YAMAHA_CMD_LABELS[action.yamaha_command] || action.yamaha_command} → ${val}`;
    }
    return `${VMIX_FN_LABELS[action.vmix_function] || action.vmix_function} → ${action.parameter_value}`;
  };

  return (
    <div className="space-y-4">      <div className="space-y-3">
        {actions.map((action, idx) => {
          const cmd = action.yamaha_command || "InCh/Fader/Level";
          const needsChannel = yamahaCmdNeedsChannel(cmd);
          const needsMix = yamahaCmdNeedsMix(cmd);
          const isSmooth = cmd.endsWith("/Smooth");
          
          return (
            <div
              key={idx}
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(32,217,255,0.12)", color: "#20D9FF" }}
                  >
                    <Zap size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#E8ECF4" }}>
                      Action {idx + 1}
                    </div>
                    <div className="text-[10px]" style={{ color: "#6B7280" }}>
                      {formatActionDetail(action)}
                      {action.delay_ms > 0 && ` (delay ${action.delay_ms}ms)`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <ToolBtn onClick={() => copyRowSettings(idx, commandFields)} title="Copy">
                    <Copy size={11} />
                  </ToolBtn>
                  <ToolBtn onClick={() => pasteRowSettings(idx, commandFields)} disabled={!rowClip} title="Paste">
                    <ClipboardPaste size={11} />
                  </ToolBtn>
                  <ToolBtn onClick={() => pasteRowSettingsAll(commandFields)} disabled={!rowClip} title="Paste to all">
                    All
                  </ToolBtn>
                  <div className="w-[1px] h-4 bg-white/10 mx-1 self-center" />
                  <ToolBtn onClick={() => duplicateAction(idx)} title="Duplicate action below">
                    <CopyPlus size={11} />
                  </ToolBtn>
                  <button
                    type="button"
                    onClick={() => removeAction(idx)}
                    disabled={actions.length <= 1}
                    className="ml-2 p-1.5 rounded-lg"
                    style={{ color: "#f87171", opacity: actions.length <= 1 ? 0.3 : 1, background: "rgba(248,113,113,0.1)" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Target</label>
                  <select
                    value={action.action_target || "yamaha"}
                    onChange={(e) => onChangeAction(idx, "action_target", e.target.value)}
                    style={inputStyle}
                  >
                    <option value="yamaha">Yamaha TF3</option>
                    <option value="vmix">vMix</option>
                  </select>
                </div>

                {action.action_target === "yamaha" ? (
                  <div>
                    <label style={labelStyle}>Yamaha command</label>
                    <select
                      value={cmd}
                      onChange={(e) => onChangeAction(idx, "yamaha_command", e.target.value)}
                      style={inputStyle}
                    >
                      {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>vMix function</label>
                    <select
                      value={action.vmix_function || "SetVolume"}
                      onChange={(e) => onChangeAction(idx, "vmix_function", e.target.value)}
                      style={inputStyle}
                    >
                      {Object.entries(VMIX_FN_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {action.action_target === "yamaha" && needsChannel && (
                  <div>
                    <label style={labelStyle}>Channel</label>
                    <input
                      type="number"
                      value={action.yamaha_channel ?? 1}
                      onChange={(e) => onChangeAction(idx, "yamaha_channel", parseInt(e.target.value, 10) || 0)}
                      style={inputStyle}
                    />
                  </div>
                )}

                {action.action_target === "yamaha" && needsMix && (
                  <div>
                    <label style={labelStyle}>Mix / Aux</label>
                    <input
                      type="number"
                      value={action.yamaha_mix ?? 0}
                      onChange={(e) => onChangeAction(idx, "yamaha_mix", parseInt(e.target.value, 10) || 0)}
                      style={inputStyle}
                    />
                  </div>
                )}

                {action.action_target === "vmix" && action.vmix_function === "SetVolume" && (
                  <div>
                    <label style={labelStyle}>vMix input</label>
                    <input
                      type="number"
                      value={action.vmix_target_input ?? ""}
                      onChange={(e) =>
                        onChangeAction(idx, "vmix_target_input", parseInt(e.target.value, 10) || null)
                      }
                      style={inputStyle}
                    />
                  </div>
                )}

                {isSmooth ? (
                  (() => {
                    const sp = (action.parameter_value || "").split(",");
                    const endLevel = sp.length >= 3 ? sp[1] : sp[0];
                    const duration = sp.length >= 3 ? sp[2] : sp[1];
                    const updateSmooth = (newEnd, newDur) =>
                      onChangeAction(idx, "parameter_value", `${newEnd || ""},${newDur || ""}`);
                    return (
                      <>
                        <div>
                          <label style={labelStyle} title="Level to fade TO in integer dB (-2000 = -20dB)">End Level (dB)</label>
                          <input
                            type="text"
                            placeholder="-2000"
                            value={endLevel || ""}
                            onChange={(e) => updateSmooth(e.target.value, duration)}
                            style={{ ...inputStyle, fontFamily: "monospace" }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle} title="Duration of the fade in milliseconds">Duration (ms)</label>
                          <input
                            type="text"
                            placeholder="2000"
                            value={duration || ""}
                            onChange={(e) => updateSmooth(endLevel, e.target.value)}
                            style={{ ...inputStyle, fontFamily: "monospace" }}
                          />
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className={needsChannel && needsMix ? "col-span-2" : ""}>
                    <label style={labelStyle} title={cmd === "ssrecall_ex" ? "Scene Number to recall" : "For levels: integer dB (0 = Unity). For On/Off: 1 or 0."}>
                      {cmd === "ssrecall_ex" ? "Scene Number" : "Value"}
                    </label>
                    <input
                      type="text"
                      placeholder={cmd === "ssrecall_ex" ? "e.g. 1" : "e.g. -1000 or 1"}
                      value={action.parameter_value ?? "0"}
                      onChange={(e) => onChangeAction(idx, "parameter_value", e.target.value)}
                      style={{ ...inputStyle, fontFamily: "monospace" }}
                    />
                  </div>
                )}

                <div>
                    <label style={labelStyle}>Delay (ms)</label>
                    <input
                      type="number"
                      min="0"
                      value={action.delay_ms ?? 0}
                      onChange={(e) => onChangeAction(idx, "delay_ms", parseInt(e.target.value, 10) || 0)}
                      style={inputStyle}
                    />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addAction}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors"
        style={{
          background: "rgba(32,217,255,0.08)",
          border: "1px dashed rgba(32,217,255,0.3)",
          color: "#20D9FF",
        }}
      >
        <Plus size={16} /> Add action
      </button>
    </div>
  );
}
