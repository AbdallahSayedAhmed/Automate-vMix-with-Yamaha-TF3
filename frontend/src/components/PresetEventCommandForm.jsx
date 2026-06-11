import { Video, Mic, Speaker, MonitorSpeaker } from 'lucide-react';
import {
  VMIX_EVENT_LABELS, VMIX_EVENT_INFO,
  YAMAHA_CMD_LABELS, YAMAHA_CMD_INFO,
  VMIX_FN_LABELS, VMIX_FN_INFO,
  DEFAULT_RULE_FORM,
  yamahaCmdNeedsMix,
  yamahaCmdNeedsChannel,
} from '../constants/ruleConfig';
import { MultiMicDuckFields } from './MultiMicDuckFields';
import { DEFAULT_DUCK_MEMBER, parseMultiFade, formatMultiFade } from '../constants/duckGroupConfig';

const inputStyle = {
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#D8DCE6',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '12px',
  width: '100%',
  boxSizing: 'border-box',
};

const hintStyle = {
  color: '#8B93A8',
  background: 'rgba(255,255,255,0.03)',
  borderLeft: '2px solid rgba(32,217,255,0.2)',
};

function Seg({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 text-[11px] font-semibold flex-1 flex justify-center items-center"
      style={{
        background: active ? 'rgba(32,217,255,0.15)' : 'rgba(255,255,255,0.03)',
        color: active ? '#20D9FF' : '#8B93A8',
        border: `1px solid ${active ? 'rgba(32,217,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5A6278' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] mt-1.5 leading-relaxed px-2 py-1.5 rounded" style={hintStyle}>
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
  const listen = form.listen_source || 'vmix';
  const target = form.action_target || 'yamaha';
  const eventKey = form.trigger_event || 'TransitionIn';
  const yamahaCmd = form.yamaha_command || 'InCh/Fader/Level';
  const vmixFn = form.vmix_function || 'SetVolume';

  const isSmooth = yamahaCmd.endsWith("/Smooth");
  const needsMix = yamahaCmdNeedsMix(yamahaCmd);
  const needsChannel = yamahaCmdNeedsChannel(yamahaCmd);

  return (
    <div className="pt-1 space-y-6 max-h-[60vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#20D9FF' }}>
          Event — Listen To
        </p>
        <Field label="Source">
          <div className="flex rounded-lg overflow-hidden w-full">
            <Seg active={listen === 'vmix'} onClick={() => { onChange('listen_source', 'vmix'); onChange('trigger_event', 'TransitionIn'); }}>
              <span className="flex items-center gap-1"><Video size={11} /> vMix</span>
            </Seg>
            <Seg active={listen === 'yamaha'} onClick={() => { onChange('listen_source', 'yamaha'); onChange('trigger_event', 'YamahaMeter'); }}>
              <span className="flex items-center gap-1"><Mic size={11} /> Yamaha Meter</span>
            </Seg>
          </div>
        </Field>

        {listen === 'vmix' ? (
          <>
            <Field label="vMix Event" hint={VMIX_EVENT_INFO[eventKey]}>
              <select
                value={eventKey}
                onChange={(e) => onChange('trigger_event', e.target.value)}
                style={inputStyle}
              >
                {Object.entries(VMIX_EVENT_LABELS).map(([v, l]) => (
                  <option key={v} value={v} style={{ background: '#151B27' }}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="vMix Input(s) (Optional)" hint="Leave blank for ALL, or comma-separated numbers (e.g. 1,2)">
              <input
                type="text"
                placeholder="e.g. 1, 2"
                value={form.vmix_input_number || ""}
                onChange={(e) => onChange("vmix_input_number", e.target.value ? parseInt(e.target.value) || null : null)}
                style={inputStyle}
              />
            </Field>
            {eventKey === "TimeRemaining" && (
              <Field label="Time Threshold (HH:MM:SS)" hint="Trigger when video has this much time remaining.">
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
                      onChange("duck_members", [{ ...DEFAULT_DUCK_MEMBER }]);
                    }
                    if (!form.silence_timeout_ms) {
                      onChange("silence_timeout_ms", 3000);
                    }
                    const fade = parseMultiFade(form.parameter_value);
                    onChange("parameter_value", formatMultiFade(fade.attack, fade.release));
                  }}
                >
                  Multi-Mic Duck
                </Seg>
              </div>
            </Field>

            {form.is_multi_duck ? (
               <MultiMicDuckFields mode="listen" form={form} onChange={onChange} meters={{}} />
            ) : (
               <>
                 <Field label="Channel to Monitor (1–40)" hint="Yamaha input channel to monitor live meter data.">
                   <input
                     type="number"
                     min="1"
                     max="40"
                     value={form.vmix_input_number || ""}
                     onChange={(e) => onChange("vmix_input_number", parseInt(e.target.value) || null)}
                     style={inputStyle}
                   />
                 </Field>
                 <div className="grid grid-cols-3 gap-2 mt-2">
                   <Field label="Attack (Thr)" hint="Typical: -4000">
                     <input type="number" placeholder="-4000" value={form.threshold ?? ""} onChange={(e) => onChange("threshold", parseInt(e.target.value))} style={inputStyle} />
                   </Field>
                   <Field label="Release (Rel)" hint="Typical: -5000">
                     <input type="number" placeholder="-5000" value={form.release_threshold ?? ""} onChange={(e) => onChange("release_threshold", parseInt(e.target.value))} style={inputStyle} />
                   </Field>
                   <Field label="Silence (ms)" hint="e.g. 3000">
                     <input type="number" placeholder="3000" value={form.silence_timeout_ms ?? ""} onChange={(e) => onChange("silence_timeout_ms", parseInt(e.target.value))} style={inputStyle} />
                   </Field>
                 </div>
               </>
            )}
          </>
        )}
      </div>

      <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#39E58C' }}>
          Command — Action
        </p>

        {listen === 'yamaha' && form.is_multi_duck ? (
           <MultiMicDuckFields mode="command" form={form} onChange={onChange} meters={{}} />
        ) : (
           <>
            <Field label="Send To">
              <div className="flex rounded-lg overflow-hidden w-full">
                <Seg active={target === 'yamaha'} onClick={() => onChange('action_target', 'yamaha')}>
                  <span className="flex items-center gap-1"><Speaker size={11} /> Yamaha</span>
                </Seg>
                <Seg active={target === 'vmix'} onClick={() => onChange('action_target', 'vmix')}>
                  <span className="flex items-center gap-1"><MonitorSpeaker size={11} /> vMix</span>
                </Seg>
              </div>
            </Field>

            {target === 'yamaha' ? (
              <>
                <Field label="Yamaha Command">
                  <select
                    value={yamahaCmd}
                    onChange={(e) => onChange('yamaha_command', e.target.value)}
                    style={inputStyle}
                  >
                    {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => (
                      <option key={v} value={v} style={{ background: '#151B27' }}>{l}</option>
                    ))}
                  </select>
                </Field>
                
                <div className="grid grid-cols-2 gap-2">
                  {needsChannel && (
                    <Field label="Channel (Ch)">
                      <input
                        type="number"
                        value={form.yamaha_channel ?? ""}
                        onChange={(e) => onChange("yamaha_channel", parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  )}
                  {needsMix && (
                    <Field label="Mix (Mx)">
                      <input
                        type="number"
                        value={form.yamaha_mix ?? ""}
                        onChange={(e) => onChange("yamaha_mix", parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  )}
                </div>

                {isSmooth ? (
                  (() => {
                    const sp = (form.parameter_value || "").split(",");
                    const endLevel = sp.length >= 3 ? sp[1] : sp[0];
                    const duration = sp.length >= 3 ? sp[2] : sp[1];
                    const updateSmooth = (newEnd, newDur) =>
                      onChange("parameter_value", `${newEnd || ""},${newDur || ""}`);
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="End Level">
                          <input
                            type="text"
                            placeholder="-2000"
                            value={endLevel || ""}
                            onChange={(e) => updateSmooth(e.target.value, duration)}
                            style={{ ...inputStyle, fontFamily: "monospace" }}
                          />
                        </Field>
                        <Field label="Duration (ms)">
                          <input
                            type="text"
                            placeholder="2000"
                            value={duration || ""}
                            onChange={(e) => updateSmooth(endLevel, e.target.value)}
                            style={{ ...inputStyle, fontFamily: "monospace" }}
                          />
                        </Field>
                      </div>
                    );
                  })()
                ) : (
                  <Field label={yamahaCmd === "ssrecall_ex" ? "Scene Number" : "Value"}>
                    <input
                      type="text"
                      placeholder={yamahaCmd === "ssrecall_ex" ? "1" : "-1000"}
                      value={form.parameter_value ?? ""}
                      onChange={(e) => onChange("parameter_value", e.target.value)}
                      style={{ ...inputStyle, fontFamily: "monospace" }}
                    />
                  </Field>
                )}
              </>
            ) : (
              <>
                <Field label="vMix Function">
                  <select
                    value={vmixFn}
                    onChange={(e) => onChange('vmix_function', e.target.value)}
                    style={inputStyle}
                  >
                    {Object.entries(VMIX_FN_LABELS).map(([v, l]) => (
                      <option key={v} value={v} style={{ background: '#151B27' }}>{l}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Target Input">
                    <input
                      type="text"
                      placeholder="e.g. 1"
                      value={form.vmix_target_input || ""}
                      onChange={(e) => onChange("vmix_target_input", e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Value">
                    <input
                      type="text"
                      placeholder="e.g. 100"
                      value={form.parameter_value || ""}
                      onChange={(e) => onChange("parameter_value", e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </>
            )}
           </>
        )}
      </div>

      <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#8B93A8' }}>
          Settings
        </p>
        <Field label="Delay (ms)">
          <input
            type="number"
            min="0"
            value={form.delay_ms ?? 0}
            onChange={(e) => onChange("delay_ms", parseInt(e.target.value) || 0)}
            style={inputStyle}
          />
        </Field>
      </div>

    </div>
  );
}
