import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Clipboard,
  Video,
  Mic,
  Speaker,
  MonitorSpeaker,
  Zap,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  VMIX_EVENT_LABELS,
  VMIX_EVENT_INFO,
  YAMAHA_CMD_LABELS,
  YAMAHA_CMD_INFO,
  VMIX_FN_LABELS,
  VMIX_FN_INFO,
  DEFAULT_RULE_FORM,
  yamahaCmdNeedsMix,
  yamahaCmdNeedsChannel,
} from "../constants/ruleConfig";
import { ActivationToggle } from "./ActivationToggle";
import { MultiMicDuckFields } from "./MultiMicDuckFields";
import { MultiActionFields } from "./MultiActionFields";
import {
  DEFAULT_DUCK_MEMBER,
  parseMultiFade,
  formatMultiFade,
} from "../constants/duckGroupConfig";

const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#D8DCE6",
  borderRadius: "8px",
  padding: "8px 10px",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
};

function Field({ label, hint, showHint, children }) {
  return (
    <div className="mb-3">
      <label
        className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "#5A6278" }}
      >
        {label}
      </label>
      {children}
      {showHint && hint && (
        <p
          className="text-[11px] mt-1.5 leading-relaxed px-2 py-1.5 rounded"
          style={{
            color: "#8B93A8",
            background: "rgba(255,255,255,0.03)",
            borderLeft: "2px solid rgba(32,217,255,0.2)",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function SegmentBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-semibold transition-all"
      style={{
        background: active ? "rgba(32,217,255,0.15)" : "rgba(255,255,255,0.03)",
        color: active ? "#20D9FF" : "#8B93A8",
        border: `1px solid ${active ? "rgba(32,217,255,0.3)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {children}
    </button>
  );
}

export function RuleEditorDrawer({
  isOpen,
  isNew,
  form,
  onChange,
  onSave,
  onClose,
  vmixInputs = [],
  copiedData,
  saving = false,
  showFieldHints = true,
  presets = [],
  onSavePreset,
  onUpdatePreset,
  onRemovePreset,
  meters = {},
}) {
  const [tab, setTab] = useState("listen");
  const [presetEdit, setPresetEdit] = useState(null);
  const [newPresetName, setNewPresetName] = useState("");
  const pasteMode = copiedData?.type === "rule";

  useEffect(() => {
    if (isOpen) setTab("listen");
  }, [isOpen, isNew]);

  const applyPreset = useCallback(
    (preset) => {
      Object.entries(preset.form).forEach(([k, v]) => onChange(k, v));
      setTab("listen");
    },
    [onChange],
  );

  const handlePasteSettings = () => {
    if (!copiedData?.data) return;
    const src = copiedData.data;
    [
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
      "is_multi_action",
      "actions",
      "action_target",
      "yamaha_command",
      "yamaha_channel",
      "yamaha_mix",
      "vmix_function",
      "vmix_target_input",
      "parameter_value",
      "delay_ms",
    ].forEach((f) => onChange(f, src[f]));
  };

  const cmd = form.yamaha_command || "";
  const isSmooth = cmd.endsWith("/Smooth");
  const needsMix = yamahaCmdNeedsMix(cmd);
  const needsChannel = yamahaCmdNeedsChannel(cmd);

  const tabs = [
    { id: "listen", label: "Listen", color: "#20D9FF" },
    { id: "command", label: "Command", color: "#39E58C" },
    { id: "settings", label: "Settings", color: "#8B93A8" },
    { id: "presets", label: "Presets", color: "#F6B44B" },
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="rule-editor-backdrop fixed inset-0"
            style={{ background: "rgba(7,10,15,0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="rule-editor-drawer fixed top-0 right-0 bottom-0 flex flex-col glass-sheet"
            style={{
              width: form.is_multi_duck
                ? "min(720px, 100vw)"
                : "min(520px, 100vw)",
              borderRadius: "16px 0 0 16px",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div
              className="rule-editor-header px-5 py-4 flex items-start justify-between gap-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: "#20D9FF" }}
                >
                  {isNew ? "New Rule" : "Edit Rule"}
                </p>
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => onChange("name", e.target.value)}
                  className="w-full bg-transparent text-lg font-bold outline-none"
                  style={{ color: "#D8DCE6" }}
                  placeholder="Rule name…"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ActivationToggle
                  active={form.is_active !== false}
                  onChange={(v) => onChange("is_active", v)}
                />
                <button
                  type="button"
                  onClick={onClose}
                  style={{ color: "#5A6278" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {isNew && presets.length > 0 && (
              <div
                className="px-5 py-3 shrink-0"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: "rgba(0,0,0,0.15)",
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  style={{ color: "#5A6278" }}
                >
                  <Zap size={11} style={{ color: "#F6B44B" }} /> Quick Start
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold hover-lift"
                      style={{
                        background: "rgba(32,217,255,0.08)",
                        border: "1px solid rgba(32,217,255,0.15)",
                        color: "#20D9FF",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex px-5 pt-3 gap-1 shrink-0 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="px-3 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap"
                  style={{
                    background:
                      tab === t.id ? "rgba(255,255,255,0.05)" : "transparent",
                    color: tab === t.id ? t.color : "#5A6278",
                    borderBottom:
                      tab === t.id
                        ? `2px solid ${t.color}`
                        : "2px solid transparent",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "listen" && (
                <div>
                  <Field
                    label="Listen Source"
                    showHint={showFieldHints}
                    hint="Choose vMix events or Yamaha live meter threshold monitoring."
                  >
                    <div className="flex rounded-lg overflow-hidden w-fit">
                      <SegmentBtn
                        active={form.listen_source === "vmix"}
                        onClick={() => {
                          onChange("listen_source", "vmix");
                          onChange("trigger_event", "TransitionIn");
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <Video size={12} /> vMix Event
                        </span>
                      </SegmentBtn>
                      <SegmentBtn
                        active={form.listen_source === "yamaha"}
                        onClick={() => {
                          onChange("listen_source", "yamaha");
                          onChange("trigger_event", "YamahaMeter");
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <Mic size={12} /> Yamaha Meter
                        </span>
                      </SegmentBtn>
                    </div>
                  </Field>

                  {form.listen_source === "vmix" ? (
                    <>
                      <Field
                        label="vMix Event"
                        hint={VMIX_EVENT_INFO[form.trigger_event]}
                        showHint={showFieldHints}
                      >
                        <select
                          value={form.trigger_event || ""}
                          onChange={(e) =>
                            onChange("trigger_event", e.target.value)
                          }
                          style={inputStyle}
                        >
                          {Object.entries(VMIX_EVENT_LABELS).map(([v, l]) => (
                            <option
                              key={v}
                              value={v}
                              style={{ background: "#151B27" }}
                            >
                              {l}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="vMix Input (Optional)"
                        hint="Leave blank to fire for ALL inputs, or select a specific input."
                        showHint={showFieldHints}
                      >
                        <select
                          value={form.vmix_input_number || ""}
                          onChange={(e) => {
                            const num = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            onChange("vmix_input_number", num);
                            const inp = vmixInputs.find(
                              (i) => i.number === num,
                            );
                            onChange("vmix_input_name", inp?.title || "");
                          }}
                          style={inputStyle}
                        >
                          <option value="" style={{ background: "#151B27" }}>
                            Any Input — fires for all
                          </option>
                          {vmixInputs.map((i) => (
                            <option
                              key={i.number}
                              value={i.number}
                              style={{ background: "#151B27" }}
                            >
                              {i.number}: {i.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {form.trigger_event === "TimeRemaining" && (
                        <Field
                          label="Time Threshold (HH:MM:SS)"
                          hint="Trigger when video has this much time remaining."
                          showHint={showFieldHints}
                        >
                          <input
                            type="text"
                            placeholder="00:01:00"
                            value={form.time_threshold || ""}
                            onChange={(e) =>
                              onChange("time_threshold", e.target.value)
                            }
                            style={{ ...inputStyle, fontFamily: "monospace" }}
                          />
                        </Field>
                      )}
                    </>
                  ) : (
                    <>
                      <Field
                        label="Duck Mode"
                        showHint={showFieldHints}
                        hint="Single channel: one mic, one command. Multi-mic: many mics in one rule, each with its own command."
                      >
                        <div className="flex rounded-lg overflow-hidden w-fit">
                          <SegmentBtn
                            active={!form.is_multi_duck}
                            onClick={() => {
                              onChange("is_multi_duck", false);
                            }}
                          >
                            Single Channel
                          </SegmentBtn>
                          <SegmentBtn
                            active={!!form.is_multi_duck}
                            onClick={() => {
                              onChange("is_multi_duck", true);
                              if (!form.duck_members?.length) {
                                onChange("duck_members", [
                                  { ...DEFAULT_DUCK_MEMBER },
                                ]);
                              }
                              if (!form.silence_timeout_ms) {
                                onChange("silence_timeout_ms", 3000);
                              }
                              const fade = parseMultiFade(form.parameter_value);
                              onChange(
                                "parameter_value",
                                formatMultiFade(fade.attack, fade.release),
                              );
                            }}
                          >
                            Multi-Mic Duck
                          </SegmentBtn>
                        </div>
                      </Field>

                      {form.is_multi_duck ? (
                        <MultiMicDuckFields
                          mode="listen"
                          form={form}
                          onChange={onChange}
                          meters={meters}
                        />
                      ) : (
                        <>
                          <Field
                            label="Channel to Monitor (1–40)"
                            hint="Yamaha input channel to monitor live meter data."
                            showHint={showFieldHints}
                          >
                            <input
                              type="number"
                              min="1"
                              max="40"
                              value={form.vmix_input_number || ""}
                              onChange={(e) =>
                                onChange(
                                  "vmix_input_number",
                                  parseInt(e.target.value) || null,
                                )
                              }
                              style={inputStyle}
                            />
                          </Field>
                          <div className="grid grid-cols-3 gap-2">
                            <Field
                              label="Attack (Thr)"
                              hint="Signal must exceed this level. Typical: -4000."
                              showHint={showFieldHints}
                            >
                              <input
                                type="number"
                                placeholder="-4000"
                                value={form.threshold ?? ""}
                                onChange={(e) =>
                                  onChange(
                                    "threshold",
                                    parseInt(e.target.value),
                                  )
                                }
                                style={inputStyle}
                              />
                            </Field>
                            <Field
                              label="Release (Rel)"
                              hint="Signal must drop below this to start silence timer. Typical: -5000."
                              showHint={showFieldHints}
                            >
                              <input
                                type="number"
                                placeholder="-5000"
                                value={form.release_threshold ?? ""}
                                onChange={(e) =>
                                  onChange(
                                    "release_threshold",
                                    parseInt(e.target.value),
                                  )
                                }
                                style={inputStyle}
                              />
                            </Field>
                            <Field
                              label="Silence (ms)"
                              hint="How long after silence before restoring. e.g. 3000."
                              showHint={showFieldHints}
                            >
                              <input
                                type="number"
                                placeholder="3000"
                                value={form.silence_timeout_ms ?? ""}
                                onChange={(e) =>
                                  onChange(
                                    "silence_timeout_ms",
                                    parseInt(e.target.value),
                                  )
                                }
                                style={inputStyle}
                              />
                            </Field>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "command" && (
                <div className="space-y-4">
                  {(form.listen_source === "vmix" ||
                    (form.listen_source === "yamaha" &&
                      !form.is_multi_duck)) && (
                    <Field
                      label="Action Mode"
                      showHint={showFieldHints}
                      hint="Switch to multi-action to execute multiple commands from a single event."
                    >
                      <div className="flex rounded-lg overflow-hidden w-fit mb-2">
                        <SegmentBtn
                          active={!form.is_multi_action}
                          onClick={() => onChange("is_multi_action", false)}
                        >
                          <span className="flex items-center gap-1.5">
                            <Zap size={12} /> Single Action
                          </span>
                        </SegmentBtn>
                        <SegmentBtn
                          active={form.is_multi_action}
                          onClick={() => {
                            onChange("is_multi_action", true);
                            if (!form.actions || form.actions.length === 0) {
                              onChange("actions", [
                                {
                                  action_target: form.action_target || "yamaha",
                                  yamaha_command:
                                    form.yamaha_command || "InCh/Fader/Level",
                                  yamaha_channel: form.yamaha_channel || 1,
                                  yamaha_mix: form.yamaha_mix || 0,
                                  vmix_function:
                                    form.vmix_function || "SetVolume",
                                  vmix_target_input:
                                    form.vmix_target_input || null,
                                  parameter_value: form.parameter_value || "0",
                                  delay_ms: form.delay_ms || 0,
                                },
                              ]);
                            }
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <Zap size={12} /> Multi-Action
                          </span>
                        </SegmentBtn>
                      </div>
                    </Field>
                  )}

                  {form.listen_source === "yamaha" && form.is_multi_duck ? (
                    <MultiMicDuckFields
                      mode="command"
                      form={form}
                      onChange={onChange}
                      meters={meters}
                    />
                  ) : form.is_multi_action && !form.is_multi_duck ? (
                    <MultiActionFields form={form} onChange={onChange} />
                  ) : (
                    <>
                      <Field
                        label="Command Target"
                        showHint={showFieldHints}
                        hint="Send the action to Yamaha TF3 mixer or back to vMix."
                      >
                        <div className="flex rounded-lg overflow-hidden w-fit">
                          <SegmentBtn
                            active={form.action_target === "yamaha"}
                            onClick={() => onChange("action_target", "yamaha")}
                          >
                            <span className="flex items-center gap-1.5">
                              <Speaker size={12} /> Yamaha
                            </span>
                          </SegmentBtn>
                          <SegmentBtn
                            active={form.action_target === "vmix"}
                            onClick={() => onChange("action_target", "vmix")}
                          >
                            <span className="flex items-center gap-1.5">
                              <MonitorSpeaker size={12} /> vMix
                            </span>
                          </SegmentBtn>
                        </div>
                      </Field>

                      {form.action_target === "yamaha" ? (
                        <>
                          <Field
                            label="Yamaha Command"
                            hint={YAMAHA_CMD_INFO[cmd]}
                            showHint={showFieldHints}
                          >
                            <select
                              value={cmd}
                              onChange={(e) => {
                                const value = e.target.value;
                                onChange("yamaha_command", value);
                                if (value === "ssrecall_ex")
                                  onChange("yamaha_channel", 0);
                              }}
                              style={inputStyle}
                            >
                              {Object.entries(YAMAHA_CMD_LABELS).map(
                                ([v, l]) => (
                                  <option
                                    key={v}
                                    value={v}
                                    style={{ background: "#151B27" }}
                                  >
                                    {l}
                                  </option>
                                ),
                              )}
                            </select>
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            {needsChannel && (
                              <Field
                                label="Channel (Ch)"
                                hint="Channel or target number (input 1–40, DCA 1–8, scene number)."
                                showHint={showFieldHints}
                              >
                                <input
                                  type="number"
                                  value={form.yamaha_channel ?? ""}
                                  onChange={(e) =>
                                    onChange(
                                      "yamaha_channel",
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                            )}
                            {needsMix && (
                              <Field
                                label="Mix (Mx)"
                                hint="Aux/Mix bus number 1–20."
                                showHint={showFieldHints}
                              >
                                <input
                                  type="number"
                                  value={form.yamaha_mix ?? ""}
                                  onChange={(e) =>
                                    onChange(
                                      "yamaha_mix",
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                            )}
                          </div>
                          {isSmooth ? (
                            (() => {
                              const sp = (form.parameter_value || "").split(
                                ",",
                              );
                              const endLevel = sp.length >= 3 ? sp[1] : sp[0];
                              const duration = sp.length >= 3 ? sp[2] : sp[1];
                              const updateSmooth = (newEnd, newDur) =>
                                onChange(
                                  "parameter_value",
                                  `${newEnd || ""},${newDur || ""}`,
                                );
                              return (
                                <div className="grid grid-cols-2 gap-2">
                                  <Field
                                    label="End Level"
                                    hint="e.g. -2000 (-20dB). Level to fade TO."
                                    showHint={showFieldHints}
                                  >
                                    <input
                                      type="text"
                                      placeholder="-2000"
                                      value={endLevel || ""}
                                      onChange={(e) =>
                                        updateSmooth(e.target.value, duration)
                                      }
                                      style={{
                                        ...inputStyle,
                                        fontFamily: "monospace",
                                      }}
                                    />
                                  </Field>
                                  <Field
                                    label="Duration (ms)"
                                    hint="e.g. 2000 (2 seconds)."
                                    showHint={showFieldHints}
                                  >
                                    <input
                                      type="text"
                                      placeholder="2000"
                                      value={duration || ""}
                                      onChange={(e) =>
                                        updateSmooth(endLevel, e.target.value)
                                      }
                                      style={{
                                        ...inputStyle,
                                        fontFamily: "monospace",
                                      }}
                                    />
                                  </Field>
                                </div>
                              );
                            })()
                          ) : (
                            <Field
                              label={
                                cmd === "ssrecall_ex" ? "Scene Number" : "Value"
                              }
                              hint={
                                cmd === "ssrecall_ex"
                                  ? "Enter the saved scene number to recall. The Yamaha channel field is ignored for this command."
                                  : "For levels: integer dB units (0 = Unity). For On/Off: 1 or 0."
                              }
                              showHint={showFieldHints}
                            >
                              <input
                                type="text"
                                placeholder={
                                  cmd === "ssrecall_ex"
                                    ? "e.g. 1"
                                    : "e.g. -1000 or 1"
                                }
                                value={form.parameter_value ?? ""}
                                onChange={(e) =>
                                  onChange("parameter_value", e.target.value)
                                }
                                style={{
                                  ...inputStyle,
                                  fontFamily: "monospace",
                                }}
                              />
                            </Field>
                          )}
                        </>
                      ) : (
                        <>
                          <Field
                            label="vMix Function"
                            hint={VMIX_FN_INFO[form.vmix_function]}
                            showHint={showFieldHints}
                          >
                            <select
                              value={form.vmix_function || ""}
                              onChange={(e) =>
                                onChange("vmix_function", e.target.value)
                              }
                              style={inputStyle}
                            >
                              {Object.entries(VMIX_FN_LABELS).map(([v, l]) => (
                                <option
                                  key={v}
                                  value={v}
                                  style={{ background: "#151B27" }}
                                >
                                  {l}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field
                              label="Target Input"
                              hint="Input number for SetVolume and similar functions."
                              showHint={showFieldHints}
                            >
                              <input
                                type="text"
                                placeholder="e.g. 1"
                                value={form.vmix_target_input || ""}
                                onChange={(e) =>
                                  onChange("vmix_target_input", e.target.value)
                                }
                                style={inputStyle}
                              />
                            </Field>
                            <Field
                              label="Value"
                              hint="Value to pass (0–100 for volume)."
                              showHint={showFieldHints}
                            >
                              <input
                                type="text"
                                placeholder="e.g. 100"
                                value={form.parameter_value || ""}
                                onChange={(e) =>
                                  onChange("parameter_value", e.target.value)
                                }
                                style={inputStyle}
                              />
                            </Field>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "settings" && (
                <div>
                  <Field
                    label="Delay (ms)"
                    hint="Wait before sending command. 0 = instant."
                    showHint={showFieldHints}
                  >
                    <input
                      type="number"
                      min="0"
                      value={form.delay_ms ?? 0}
                      onChange={(e) =>
                        onChange("delay_ms", parseInt(e.target.value) || 0)
                      }
                      style={inputStyle}
                    />
                  </Field>
                  {!isNew && form.fire_count != null && (
                    <div
                      className="rounded-lg p-3 mt-2"
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <p
                        className="text-[10px] uppercase tracking-wider font-bold mb-1"
                        style={{ color: "#5A6278" }}
                      >
                        Runtime Stats
                      </p>
                      <p className="text-sm" style={{ color: "#8B93A8" }}>
                        Fired{" "}
                        <strong style={{ color: "#20D9FF" }}>
                          {form.fire_count || 0}
                        </strong>{" "}
                        times
                        {form.last_fired_at && (
                          <>
                            {" "}
                            · Last{" "}
                            <span className="font-mono">
                              {new Date(
                                form.last_fired_at,
                              ).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                  <div
                    className="mt-4 pt-4"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: "#5A6278" }}
                    >
                      Save as Quick Start Preset
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Preset name…"
                        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        disabled={!newPresetName.trim()}
                        onClick={() => {
                          onSavePreset?.(newPresetName.trim(), form);
                          setNewPresetName("");
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                        style={{
                          background: "rgba(246,180,75,0.2)",
                          color: "#F6B44B",
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "presets" && (
                <div className="space-y-2">
                  <p className="text-xs mb-3" style={{ color: "#8B93A8" }}>
                    Manage Quick Start presets. Click to apply when creating a
                    new rule.
                  </p>
                  {presets.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 p-3 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {presetEdit === p.id ? (
                        <input
                          autoFocus
                          defaultValue={p.label}
                          onBlur={(e) => {
                            onUpdatePreset?.(p.id, { label: e.target.value });
                            setPresetEdit(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                          }}
                          className="flex-1 text-sm px-2 py-1 rounded outline-none"
                          style={inputStyle}
                        />
                      ) : (
                        <button
                          type="button"
                          className="flex-1 text-left text-sm font-semibold"
                          style={{ color: "#D8DCE6" }}
                          onClick={() => applyPreset(p)}
                        >
                          {p.label}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPresetEdit(p.id)}
                        style={{ color: "#5A6278" }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemovePreset?.(p.id)}
                        style={{ color: "#FF5C7A" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {presets.length === 0 && (
                    <p className="text-sm italic" style={{ color: "#5A6278" }}>
                      No presets yet. Save one from Settings tab.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div
              className="px-5 py-4 flex items-center gap-2 shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {pasteMode && (
                <button
                  type="button"
                  onClick={handlePasteSettings}
                  className="fab-btn"
                  style={{ borderRadius: "8px" }}
                >
                  <Clipboard size={14} /> Paste
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ color: "#8B93A8" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !form.name?.trim()}
                className="px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover-lift disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(57,229,140,0.9), rgba(57,229,140,0.7))",
                  color: "#070A0F",
                }}
              >
                <Save size={16} />
                {saving ? "Saving…" : "Save Rule"}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export { DEFAULT_RULE_FORM };
