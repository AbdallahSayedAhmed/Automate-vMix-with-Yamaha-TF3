import {
  Video,
  Mic,
  Speaker,
  MonitorSpeaker,
  Plus,
  Minus,
  Settings,
  Zap,
} from "lucide-react";
import {
  VMIX_EVENT_LABELS,
  VMIX_EVENT_INFO,
  YAMAHA_CMD_LABELS,
  YAMAHA_CMD_INFO,
  VMIX_FN_LABELS,
  VMIX_FN_INFO,
  DEFAULT_RULE_FORM,
} from "../constants/ruleConfig";
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
  fontSize: "12px",
  width: "100%",
  boxSizing: "border-box",
};

const hintStyle = {
  color: "#8B93A8",
  background: "rgba(255,255,255,0.03)",
  borderLeft: "2px solid rgba(32,217,255,0.2)",
};

function Seg({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 text-[11px] font-semibold flex-1 flex justify-center items-center"
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

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label
        className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "#5A6278" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          className="text-[10px] mt-1.5 leading-relaxed px-2 py-1.5 rounded"
          style={hintStyle}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function presetFormFromDefaults(overrides = {}) {
  return { ...DEFAULT_RULE_FORM, ...overrides };
}

export function PresetEventCommandForm({ form, onChange }) {
  const listen = form.listen_source || "vmix";
  const target = form.action_target || "yamaha";
  const eventKey = form.trigger_event || "TransitionIn";
  const yamahaCmd = form.yamaha_command || "InCh/Fader/Level";
  const vmixFn = form.vmix_function || "SetVolume";

  const members = form.duck_members || [];
  const micCount = Math.max(2, members.length);

  const updateMicCount = (newCount) => {
    if (newCount < 2) newCount = 2;
    if (newCount > 16) newCount = 16;

    const nextMembers = [...members];
    // Fill if growing
    while (nextMembers.length < newCount) {
      nextMembers.push({
        ...DEFAULT_DUCK_MEMBER,
        monitor_channel: nextMembers.length + 1,
      });
    }
    // Trim if shrinking
    while (nextMembers.length > newCount) {
      nextMembers.pop();
    }
    onChange("duck_members", nextMembers);
  };

  const updateMember = (idx, field, value) => {
    const next = [...members];
    if (!next[idx]) next[idx] = { ...DEFAULT_DUCK_MEMBER };
    next[idx] = { ...next[idx], [field]: value };
    onChange("duck_members", next);
  };

  const actions = form.actions || [];
  const actionCount = Math.max(1, actions.length);

  const updateActionCount = (newCount) => {
    if (newCount < 1) newCount = 1;
    if (newCount > 16) newCount = 16;

    const nextActions = [...actions];
    while (nextActions.length < newCount) {
      nextActions.push({
        action_target: form.action_target || "yamaha",
        yamaha_command: form.yamaha_command || "InCh/Fader/Level",
        yamaha_channel: 1,
        yamaha_mix: 0,
        vmix_function: form.vmix_function || "SetVolume",
        vmix_target_input: null,
        parameter_value: "0",
        delay_ms: 0,
      });
    }
    while (nextActions.length > newCount) {
      nextActions.pop();
    }
    onChange("actions", nextActions);
  };

  const updateAction = (idx, field, value) => {
    const next = [...actions];
    if (!next[idx]) next[idx] = {};
    next[idx] = { ...next[idx], [field]: value };
    onChange("actions", next);
  };

  return (
    <div
      className="pt-1 space-y-6 max-h-[60vh] overflow-y-auto pr-2"
      style={{ scrollbarWidth: "thin" }}
    >
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-3"
          style={{ color: "#20D9FF" }}
        >
          Event — Listen To
        </p>
        <Field label="Source">
          <div className="flex rounded-lg overflow-hidden w-full">
            <Seg
              active={listen === "vmix"}
              onClick={() => {
                onChange("listen_source", "vmix");
                onChange("trigger_event", "TransitionIn");
              }}
            >
              <span className="flex items-center gap-1">
                <Video size={11} /> vMix
              </span>
            </Seg>
            <Seg
              active={listen === "yamaha"}
              onClick={() => {
                onChange("listen_source", "yamaha");
                onChange("trigger_event", "YamahaMeter");
              }}
            >
              <span className="flex items-center gap-1">
                <Mic size={11} /> Yamaha Meter
              </span>
            </Seg>
          </div>
        </Field>

        {listen === "vmix" ? (
          <>
            <Field label="vMix Event" hint={VMIX_EVENT_INFO[eventKey]}>
              <select
                value={eventKey}
                onChange={(e) => onChange("trigger_event", e.target.value)}
                style={inputStyle}
              >
                {Object.entries(VMIX_EVENT_LABELS).map(([v, l]) => (
                  <option key={v} value={v} style={{ background: "#151B27" }}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="vMix Input(s) (Optional)"
              hint="Leave blank for ALL, or comma-separated numbers (e.g. 1,2)"
            >
              <input
                type="text"
                placeholder="e.g. 1, 2"
                value={form.vmix_input_number || ""}
                onChange={(e) =>
                  onChange(
                    "vmix_input_number",
                    e.target.value ? parseInt(e.target.value) || null : null,
                  )
                }
                style={inputStyle}
              />
            </Field>
            {eventKey === "TimeRemaining" && (
              <Field
                label="Time Threshold (HH:MM:SS)"
                hint="Trigger when video has this much time remaining."
              >
                <input
                  type="text"
                  placeholder="00:01:00"
                  value={form.time_threshold || ""}
                  onChange={(e) => onChange("time_threshold", e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                />
              </Field>
            )}
          </>
        ) : (
          <>
            <Field label="Duck Mode">
              <div className="flex rounded-lg overflow-hidden w-full mb-2">
                <Seg
                  active={!form.is_multi_duck}
                  onClick={() => onChange("is_multi_duck", false)}
                >
                  Single Channel
                </Seg>
                <Seg
                  active={!!form.is_multi_duck}
                  onClick={() => {
                    onChange("is_multi_duck", true);
                    if (!form.duck_members?.length) {
                      onChange("duck_members", [
                        { ...DEFAULT_DUCK_MEMBER },
                        { ...DEFAULT_DUCK_MEMBER, monitor_channel: 2 },
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
                </Seg>
              </div>
            </Field>

            {form.is_multi_duck ? (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Silence (ms)" hint="e.g. 3000">
                    <input
                      type="number"
                      value={form.silence_timeout_ms || 3000}
                      onChange={(e) =>
                        onChange("silence_timeout_ms", parseInt(e.target.value))
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Number of Mics" hint="How many to listen to">
                    <div className="flex items-center gap-3 bg-black/30 rounded-lg p-2 border border-white/10 w-fit h-[34px]">
                      <button
                        type="button"
                        onClick={() => updateMicCount(micCount - 1)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-bold w-6 text-center text-[#20D9FF]">
                        {micCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateMicCount(micCount + 1)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                  <p className="text-[10px] font-bold text-[#8B93A8] uppercase mb-2">
                    Assign Mic Channels
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {members.slice(0, micCount).map((m, idx) => (
                      <div key={idx}>
                        <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                          Mic {idx + 1}
                        </label>
                        <input
                          type="number"
                          value={m.monitor_channel || ""}
                          onChange={(e) =>
                            updateMember(
                              idx,
                              "monitor_channel",
                              parseInt(e.target.value),
                            )
                          }
                          style={inputStyle}
                          placeholder={`Ch ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Field
                label="Channel to Monitor (1–40)"
                hint="Yamaha input channel to monitor live meter data."
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
            )}
          </>
        )}
      </div>

      <div
        className="pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-3"
          style={{ color: "#39E58C" }}
        >
          Command — Action
        </p>

        {listen === "yamaha" && form.is_multi_duck ? (
          <div className="space-y-4">
            {(() => {
              const { attack, release } = parseMultiFade(form.parameter_value);
              return (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Fade Attack (ms)">
                    <input
                      type="number"
                      value={attack}
                      onChange={(e) =>
                        onChange(
                          "parameter_value",
                          formatMultiFade(
                            parseInt(e.target.value) || 0,
                            release,
                          ),
                        )
                      }
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Fade Release (ms)">
                    <input
                      type="number"
                      value={release}
                      onChange={(e) =>
                        onChange(
                          "parameter_value",
                          formatMultiFade(
                            attack,
                            parseInt(e.target.value) || 0,
                          ),
                        )
                      }
                      style={inputStyle}
                    />
                  </Field>
                </div>
              );
            })()}

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#8B93A8] uppercase mb-1">
                Set actions for each mic
              </p>
              {members.slice(0, micCount).map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-white/5"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                >
                  <p className="text-[11px] font-bold text-[#D8DCE6] mb-2 flex items-center gap-1.5">
                    <Settings size={12} className="text-[#39E58C]" /> Action for
                    Mic {idx + 1}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                        Target
                      </label>
                      <select
                        value={m.action_target || "yamaha"}
                        onChange={(e) =>
                          updateMember(idx, "action_target", e.target.value)
                        }
                        style={inputStyle}
                      >
                        <option value="yamaha">Yamaha</option>
                        <option value="vmix">vMix</option>
                      </select>
                    </div>

                    {(m.action_target || "yamaha") === "yamaha" ? (
                      <>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Command
                          </label>
                          <select
                            value={m.yamaha_command || "InCh/Fader/Smooth"}
                            onChange={(e) =>
                              updateMember(
                                idx,
                                "yamaha_command",
                                e.target.value,
                              )
                            }
                            style={inputStyle}
                          >
                            {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => (
                              <option
                                key={v}
                                value={v}
                                style={{ background: "#151B27" }}
                              >
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Channel / Number
                          </label>
                          <input
                            type="number"
                            placeholder="Ch (e.g. 1)"
                            value={m.yamaha_channel || ""}
                            onChange={(e) =>
                              updateMember(
                                idx,
                                "yamaha_channel",
                                parseInt(e.target.value),
                              )
                            }
                            style={inputStyle}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Function
                          </label>
                          <select
                            value={m.vmix_function || "SetVolume"}
                            onChange={(e) =>
                              updateMember(idx, "vmix_function", e.target.value)
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
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Input (Optional)
                          </label>
                          <input
                            type="number"
                            placeholder="Input (e.g. 1)"
                            value={m.vmix_target_input || ""}
                            onChange={(e) =>
                              updateMember(
                                idx,
                                "vmix_target_input",
                                parseInt(e.target.value) || null,
                              )
                            }
                            style={inputStyle}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : listen === "vmix" && form.is_multi_action ? (
          <div className="space-y-4">
            <Field label="Action Mode">
              <div className="flex rounded-lg overflow-hidden w-full mb-2">
                <Seg
                  active={!form.is_multi_action}
                  onClick={() => onChange("is_multi_action", false)}
                >
                  <span className="flex items-center gap-1">
                    <Zap size={11} /> Single
                  </span>
                </Seg>
                <Seg
                  active={form.is_multi_action}
                  onClick={() => onChange("is_multi_action", true)}
                >
                  <span className="flex items-center gap-1">
                    <Zap size={11} /> Multi-Action
                  </span>
                </Seg>
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4">
              <Field
                label="Number of Actions"
                hint="How many actions to trigger"
              >
                <div className="flex items-center gap-3 bg-black/30 rounded-lg p-2 border border-white/10 w-fit h-[34px]">
                  <button
                    type="button"
                    onClick={() => updateActionCount(actionCount - 1)}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-bold w-6 text-center text-[#20D9FF]">
                    {actionCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateActionCount(actionCount + 1)}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#8B93A8] uppercase mb-1">
                Set actions as template
              </p>
              {actions.slice(0, actionCount).map((a, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-white/5"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                >
                  <p className="text-[11px] font-bold text-[#D8DCE6] mb-2 flex items-center gap-1.5">
                    <Zap size={12} className="text-[#39E58C]" /> Action{" "}
                    {idx + 1}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                        Target
                      </label>
                      <select
                        value={a.action_target || "yamaha"}
                        onChange={(e) =>
                          updateAction(idx, "action_target", e.target.value)
                        }
                        style={inputStyle}
                      >
                        <option value="yamaha">Yamaha</option>
                        <option value="vmix">vMix</option>
                      </select>
                    </div>

                    {(a.action_target || "yamaha") === "yamaha" ? (
                      <>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Command
                          </label>
                          <select
                            value={a.yamaha_command || "InCh/Fader/Smooth"}
                            onChange={(e) =>
                              updateAction(
                                idx,
                                "yamaha_command",
                                e.target.value,
                              )
                            }
                            style={inputStyle}
                          >
                            {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => (
                              <option
                                key={v}
                                value={v}
                                style={{ background: "#151B27" }}
                              >
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Channel / Number
                          </label>
                          <input
                            type="number"
                            placeholder="Ch (e.g. 1)"
                            value={a.yamaha_channel || ""}
                            onChange={(e) =>
                              updateAction(
                                idx,
                                "yamaha_channel",
                                parseInt(e.target.value),
                              )
                            }
                            style={inputStyle}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Function
                          </label>
                          <select
                            value={a.vmix_function || "SetVolume"}
                            onChange={(e) =>
                              updateAction(idx, "vmix_function", e.target.value)
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
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                            Input (Optional)
                          </label>
                          <input
                            type="number"
                            placeholder="Input (e.g. 1)"
                            value={a.vmix_target_input || ""}
                            onChange={(e) =>
                              updateAction(
                                idx,
                                "vmix_target_input",
                                parseInt(e.target.value) || null,
                              )
                            }
                            style={inputStyle}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {(listen === "vmix" ||
              (listen === "yamaha" && !form.is_multi_duck)) && (
              <Field label="Action Mode">
                <div className="flex rounded-lg overflow-hidden w-full mb-2">
                  <Seg
                    active={!form.is_multi_action}
                    onClick={() => {
                      onChange("is_multi_action", false);
                      onChange("actions", []);
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <Zap size={11} /> Single
                    </span>
                  </Seg>
                  <Seg
                    active={!!form.is_multi_action}
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
                            vmix_function: form.vmix_function || "SetVolume",
                            vmix_target_input: form.vmix_target_input || null,
                            parameter_value: form.parameter_value || "0",
                            delay_ms: form.delay_ms || 0,
                          },
                        ]);
                      }
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <Zap size={11} /> Multi-Action
                    </span>
                  </Seg>
                </div>
              </Field>
            )}

            {form.is_multi_action && !form.is_multi_duck ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#8B93A8] uppercase mb-1">
                  Actions (template)
                </p>
                <Field
                  label="Number of Actions"
                  hint="How many actions to trigger"
                >
                  <div className="flex items-center gap-3 bg-black/30 rounded-lg p-2 border border-white/10 w-fit h-[34px]">
                    <button
                      type="button"
                      onClick={() => updateActionCount(actionCount - 1)}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center text-[#20D9FF]">
                      {actionCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateActionCount(actionCount + 1)}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </Field>
                {actions.slice(0, actionCount).map((a, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-white/5"
                    style={{ background: "rgba(0,0,0,0.2)" }}
                  >
                    <p className="text-[11px] font-bold text-[#D8DCE6] mb-2 flex items-center gap-1.5">
                      <Zap size={12} className="text-[#39E58C]" /> Action{" "}
                      {idx + 1}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                          Target
                        </label>
                        <select
                          value={a.action_target || "yamaha"}
                          onChange={(e) =>
                            updateAction(idx, "action_target", e.target.value)
                          }
                          style={inputStyle}
                        >
                          <option value="yamaha">Yamaha</option>
                          <option value="vmix">vMix</option>
                        </select>
                      </div>
                      {(a.action_target || "yamaha") === "yamaha" ? (
                        <>
                          <div>
                            <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                              Command
                            </label>
                            <select
                              value={a.yamaha_command || "InCh/Fader/Level"}
                              onChange={(e) =>
                                updateAction(
                                  idx,
                                  "yamaha_command",
                                  e.target.value,
                                )
                              }
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
                          </div>
                          <div>
                            <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                              Channel
                            </label>
                            <input
                              type="number"
                              placeholder="Ch (e.g. 1)"
                              value={a.yamaha_channel || ""}
                              onChange={(e) =>
                                updateAction(
                                  idx,
                                  "yamaha_channel",
                                  parseInt(e.target.value),
                                )
                              }
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                              Value
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. -1000 or 1"
                              value={a.parameter_value || ""}
                              onChange={(e) =>
                                updateAction(
                                  idx,
                                  "parameter_value",
                                  e.target.value,
                                )
                              }
                              style={{ ...inputStyle, fontFamily: "monospace" }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                              Function
                            </label>
                            <select
                              value={a.vmix_function || "SetVolume"}
                              onChange={(e) =>
                                updateAction(
                                  idx,
                                  "vmix_function",
                                  e.target.value,
                                )
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
                          </div>
                          <div>
                            <label className="block text-[9px] text-[#5A6278] uppercase font-bold mb-1">
                              Input (Optional)
                            </label>
                            <input
                              type="number"
                              placeholder="Input (e.g. 1)"
                              value={a.vmix_target_input || ""}
                              onChange={(e) =>
                                updateAction(
                                  idx,
                                  "vmix_target_input",
                                  parseInt(e.target.value) || null,
                                )
                              }
                              style={inputStyle}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Field label="Send To">
                  <div className="flex rounded-lg overflow-hidden w-full">
                    <Seg
                      active={target === "yamaha"}
                      onClick={() => onChange("action_target", "yamaha")}
                    >
                      <span className="flex items-center gap-1">
                        <Speaker size={11} /> Yamaha
                      </span>
                    </Seg>
                    <Seg
                      active={target === "vmix"}
                      onClick={() => onChange("action_target", "vmix")}
                    >
                      <span className="flex items-center gap-1">
                        <MonitorSpeaker size={11} /> vMix
                      </span>
                    </Seg>
                  </div>
                </Field>

                {target === "yamaha" ? (
                  <Field label="Yamaha Command">
                    <select
                      value={yamahaCmd}
                      onChange={(e) =>
                        onChange("yamaha_command", e.target.value)
                      }
                      style={inputStyle}
                    >
                      {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => (
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
                ) : (
                  <Field label="vMix Function">
                    <select
                      value={vmixFn}
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
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
