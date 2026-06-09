import { Video, Mic, Speaker, MonitorSpeaker } from 'lucide-react';
import {
  VMIX_EVENT_LABELS, VMIX_EVENT_INFO,
  YAMAHA_CMD_LABELS, YAMAHA_CMD_INFO,
  VMIX_FN_LABELS, VMIX_FN_INFO,
  DEFAULT_RULE_FORM,
} from '../constants/ruleConfig';

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
      className="px-2.5 py-1.5 text-[11px] font-semibold"
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

  return (
    <div className="pt-1">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#20D9FF' }}>
        Event — Listen To
      </p>
      <Field label="Source">
        <div className="flex rounded-lg overflow-hidden w-fit">
          <Seg active={listen === 'vmix'} onClick={() => { onChange('listen_source', 'vmix'); onChange('trigger_event', 'TransitionIn'); }}>
            <span className="flex items-center gap-1"><Video size={11} /> vMix</span>
          </Seg>
          <Seg active={listen === 'yamaha'} onClick={() => { onChange('listen_source', 'yamaha'); onChange('trigger_event', 'YamahaMeter'); }}>
            <span className="flex items-center gap-1"><Mic size={11} /> Yamaha Meter</span>
          </Seg>
        </div>
      </Field>

      {listen === 'vmix' ? (
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
      ) : (
        <Field label="Yamaha Listen" hint="Preset uses Yamaha live meter threshold monitoring on a channel when applied to a new rule.">
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(246,180,75,0.08)', color: '#F6B44B', border: '1px solid rgba(246,180,75,0.2)' }}>
            Yamaha Meter — channel threshold trigger
          </div>
        </Field>
      )}

      <p className="text-[10px] font-bold uppercase tracking-wider mb-3 mt-4 pt-3" style={{ color: '#39E58C', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        Command — Action
      </p>
      <Field label="Send To">
        <div className="flex rounded-lg overflow-hidden w-fit">
          <Seg active={target === 'yamaha'} onClick={() => onChange('action_target', 'yamaha')}>
            <span className="flex items-center gap-1"><Speaker size={11} /> Yamaha</span>
          </Seg>
          <Seg active={target === 'vmix'} onClick={() => onChange('action_target', 'vmix')}>
            <span className="flex items-center gap-1"><MonitorSpeaker size={11} /> vMix</span>
          </Seg>
        </div>
      </Field>

      {target === 'yamaha' ? (
        <Field label="Yamaha Command" hint={YAMAHA_CMD_INFO[yamahaCmd]}>
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
      ) : (
        <Field label="vMix Function" hint={VMIX_FN_INFO[vmixFn]}>
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
      )}
    </div>
  );
}
