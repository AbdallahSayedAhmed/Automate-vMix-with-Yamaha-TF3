import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Trash2, Power, PowerOff, Save, X, Edit2, Copy, ArrowUp, ArrowDown,
  Download, Upload, CheckSquare, Square, Layers, Clipboard, Mic, Video,
  Speaker, MonitorSpeaker, AlertTriangle, Unlink, Info, Hash, Pencil, Search, GripVertical
} from 'lucide-react';
import { useTriggers } from '../hooks/useTriggers';
import { api } from '../services/api';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Static description maps (module-level, never re-created) ─────────────────
const VMIX_EVENT_INFO = {
  TransitionIn:  'Fires when this input goes LIVE (Program output). Use to apply audio changes the instant a scene cuts on-air.',
  TransitionOut: 'Fires when this input leaves LIVE. Use to restore or mute levels as a scene cuts off-air.',
  InputPreview:  'Fires when this input is placed in PREVIEW (next-up slot). Great for pre-loading audio before the cut.',
  OverlayIn:     'Fires when an overlay layer (lower-third, logo) activates. Use to duck music for an announcement.',
  OverlayOut:    'Fires when an overlay layer is deactivated. Use to restore audio after the overlay disappears.',
  AudioOn:       'Fires when an input\'s audio is un-muted. Detected via the vMix XML API poller.',
  AudioOff:      'Fires when an input\'s audio is muted. Detected via the vMix XML API poller.',
  VideoPlay:     'Fires when a video clip starts playing. Use to auto-duck music while the video rolls.',
  VideoPause:    'Fires when a video clip pauses or finishes. Use to restore music after the video ends.',
  TimeRemaining: 'Fires when a playing video reaches a specific time remaining (e.g. 1 minute before finish).',
};

const VMIX_EVENT_LABELS = {
  TransitionIn: 'TransitionIn — Goes LIVE', TransitionOut: 'TransitionOut — Leaves LIVE',
  InputPreview: 'InputPreview — Enters PREVIEW', OverlayIn: 'OverlayIn — Overlay ON',
  OverlayOut: 'OverlayOut — Overlay OFF', AudioOn: 'AudioOn — Audio Unmuted',
  AudioOff: 'AudioOff — Audio Muted', VideoPlay: 'VideoPlay — Video Starts',
  VideoPause: 'VideoPause — Video Pauses', TimeRemaining: 'TimeRemaining — Time Before Finish',
};

const YAMAHA_CMD_INFO = {
  'InCh/Fader/Level':    'Sets the volume fader level of an input channel. Value: integer dB units (0 = 0dB/Unity, -32768 = silent). Ch = channel 1–40.',
  'InCh/Fader/On':       'Mutes or un-mutes an input channel. Value: 1 = Active (sound on), 0 = Muted (silent). Ch = channel number.',
  'InCh/Fader/Smooth':   'Smoothly fades a channel level. Value format: START,END,DURATION_MS — e.g. "0,-2000,2000" fades 0dB→-20dB in 2 seconds.',
  'Mix/Fader/Level':     'Sets the master output level of an Aux/Mix bus. Mix = bus number 1–20.',
  'Mix/Fader/On':        'Mutes or un-mutes an Aux/Mix bus output. Value: 1 = Active, 0 = Muted. Mix = bus number.',
  'Matrix/Fader/Level':  'Sets the level of a Matrix output (overflow room, lobby, translation feed). Ch = matrix output number (1-4 on TF series).',
  'Matrix/Fader/On':     'Mutes or un-mutes a Matrix output. Value: 1 = Active, 0 = Muted. Ch = matrix number (1-4).',
  'DCA/Fader/Level':     'Sets the level of a DCA group — controls ALL channels assigned to it simultaneously. Ch = DCA 1–8.',
  'DCA/Fader/On':        'Mutes or un-mutes an entire DCA group at once. Replace 10 individual mute rules with 1 DCA rule.',
  'St/Fader/Level':      'Sets the main Stereo Master output fader level. Ch should be 1.',
  'St/Fader/On':         'Mutes or un-mutes the Stereo Master output. Value: 1 = Active, 0 = Muted.',
  'InCh/ToMix/Level':    'Sets the send level from a channel into an Aux bus. Ch = input channel, Mix = aux bus number.',
  'InCh/ToMix/On':       'Enables or disables a channel\'s send into an Aux bus. Value: 1 = send active, 0 = send off.',
  'InCh/ToFX/Level':     'Sets the send level from a channel to an FX processor. Mix = FX number (1 or 2 on TF series).',
  'InCh/ToFX/On':        'Enables or disables a channel\'s send to an FX processor. Mix = FX number (1 or 2).',
  'FXRTN/Fader/Level':   'Sets the fader level of an FX Return. Ch = 1 for FX1, Ch = 2 for FX2.',
  'FXRTN/Fader/On':      'Mutes or un-mutes an FX Return channel. Ch = 1 for FX1, Ch = 2 for FX2.',
  'USB/Record/Start':    'Starts recording to USB. Mix = the Aux bus number to record. Mixer ignores this if no USB is connected.',
  'USB/Play/Start':      'Starts playback from a USB drive (intro music, hold music). Plays from Track 1 or the last selected track.',
  'USB/Play/Stop':       'Stops USB audio playback.',
  'ssrecall_ex':         'Recalls a saved scene/snapshot from the mixer\'s memory. Ch = scene number. Instant mix recall for different segments.',
};

const YAMAHA_CMD_LABELS = {
  'InCh/Fader/Level': 'Input Channel — Fader Level', 'InCh/Fader/On': 'Input Channel — Mute On/Off',
  'InCh/Fader/Smooth': 'Input Channel — Smooth Fade',
  'Mix/Fader/Level': 'Aux/Mix Bus — Master Level', 'Mix/Fader/On': 'Aux/Mix Bus — Mute On/Off',
  'Matrix/Fader/Level': 'Matrix Output — Level', 'Matrix/Fader/On': 'Matrix Output — Mute On/Off',
  'DCA/Fader/Level': 'DCA Group — Level', 'DCA/Fader/On': 'DCA Group — Mute On/Off',
  'St/Fader/Level': 'Stereo Master — Level', 'St/Fader/On': 'Stereo Master — Mute On/Off',
  'InCh/ToMix/Level': 'Channel → Aux Send Level', 'InCh/ToMix/On': 'Channel → Aux Send On/Off',
  'InCh/ToFX/Level': 'Channel → FX Send Level', 'InCh/ToFX/On': 'Channel → FX Send On/Off',
  'FXRTN/Fader/Level': 'FX Return — Level', 'FXRTN/Fader/On': 'FX Return — Mute On/Off',
  'USB/Record/Start': 'USB Recorder — Start', 'USB/Play/Start': 'USB Player — Start Playback',
  'USB/Play/Stop': 'USB Player — Stop Playback', 'ssrecall_ex': 'Scene Recall — Load Preset',
};

const VMIX_FN_INFO = {
  SetVolume:       'Sets the volume of a specific vMix input. Requires "Target Input #". Value: 0 (silent) to 100 (max).',
  SetMasterVolume: 'Sets the Master output volume in vMix. Affects all outputs. Value: 0–100.',
  SetBusAVolume:   'Sets vMix Bus A volume (typically headphone/monitor mix). Value: 0–100.',
  SetBusBVolume:   'Sets vMix Bus B volume. Value: 0–100.', SetBusCVolume: 'Sets vMix Bus C volume. Value: 0–100.',
  SetBusDVolume:   'Sets vMix Bus D volume. Value: 0–100.', SetBusEVolume: 'Sets vMix Bus E volume. Value: 0–100.',
  SetBusFVolume:   'Sets vMix Bus F volume. Value: 0–100.', SetBusGVolume: 'Sets vMix Bus G volume. Value: 0–100.',
};

const LISTEN_SOURCES = {
  vMixActive: 'vMix Video Playing (Active)',
  vMixInactive: 'vMix Video Stopped (Inactive)',
  vMixVolume: 'vMix Input Volume Change',
  vMixMasterVolume: 'vMix Master Volume Change',
  vMixTimeRemaining: 'vMix Video Time Remaining',
  YamahaMeter: 'Yamaha Fader Threshold',
};

const VMIX_FN_LABELS = {
  SetVolume: 'SetVolume — Specific Input', SetMasterVolume: 'SetMasterVolume — Master Output',
  SetBusAVolume: 'SetBusAVolume — Bus A', SetBusBVolume: 'SetBusBVolume — Bus B',
  SetBusCVolume: 'SetBusCVolume — Bus C', SetBusDVolume: 'SetBusDVolume — Bus D',
  SetBusEVolume: 'SetBusEVolume — Bus E', SetBusFVolume: 'SetBusFVolume — Bus F',
  SetBusGVolume: 'SetBusGVolume — Bus G',
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const n = parseInt((hex || '#3b82f6').replace('#', ''), 16) || 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const IS  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' };
const LBL = { color: '#475569', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' };

// ─── Tooltip ──────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [visible, setVisible] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const ref = React.useRef(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    setVisible(true);
  };

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)}
        style={{ display: 'inline-flex', cursor: 'help', flexShrink: 0 }}>
        {children}
      </span>
      {visible && (
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translateX(-50%)',
          zIndex: 9999,
          maxWidth: '300px',
          background: 'linear-gradient(135deg, #1e2d45, #131c2e)',
          border: '1px solid rgba(34,211,238,0.25)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '12px',
          lineHeight: '1.6',
          color: '#cbd5e1',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.1)',
          pointerEvents: 'none',
          animation: 'tooltipIn 0.15s ease',
        }}>
          <div style={{
            position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 8, background: '#1e2d45', border: '1px solid rgba(34,211,238,0.25)',
            borderRight: 'none', borderBottom: 'none', rotate: '45deg'
          }} />
          {text}
        </div>
      )}
    </>
  );
}

function Field({ label, info, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <span style={LBL}>{label}</span>
        {info && (
          <Tooltip text={info}>
            <Info size={10} style={{ color: '#475569' }} />
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

const SourceBadge = React.memo(({ source }) => source === 'yamaha' ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
    <Mic size={9} /> YAMAHA METER
  </span>
) : (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
    <Video size={9} /> VMIX EVENT
  </span>
));

const TargetBadge = React.memo(({ target }) => target === 'vmix' ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
    <MonitorSpeaker size={9} /> SPEAK VMIX
  </span>
) : (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
    <Speaker size={9} /> SPEAK YAMAHA
  </span>
));

const RuleNum = React.memo(({ n }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '6px', fontSize: '11px', fontWeight: 900, flexShrink: 0, background: 'rgba(148,163,184,0.08)', color: '#475569', border: '1px solid rgba(148,163,184,0.1)' }}>
    {n}
  </span>
));

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    if (isOpen) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onCancel]);
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onCancel}>
      <div style={{ background: 'linear-gradient(145deg,#1e2535,#16202e)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', width: '380px', boxShadow: '0 0 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: danger ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', border: danger ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)' }}>
            <AlertTriangle size={26} style={{ color: danger ? '#f87171' : '#fbbf24' }} />
          </div>
        </div>
        <h3 style={{ textAlign: 'center', fontWeight: 900, fontSize: '16px', color: 'white', marginBottom: '8px' }}>{title}</h3>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '20px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onConfirm(); onCancel(); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: danger ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'linear-gradient(135deg,#f59e0b,#b45309)', color: 'white', fontWeight: 900, cursor: 'pointer', boxShadow: danger ? '0 4px 24px rgba(239,68,68,0.3)' : '0 4px 24px rgba(245,158,11,0.3)' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Wrapper ─────────────────────────────────────────────────────────
function SortableRuleWrapper({ id, item, idx, editingId, editForm, vmixInputs, copiedData, pasteMode, handleChange, handleSave, handleCancelEdit, ruleNumbers, selectedIds, toggleTrigger, handleEditClick, handleDeleteRule, handleCopy, handlePasteInto, toggleSelection, handleMove, displayItems, meters, triggeredRules }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  if (editingId === item.rule.id) {
    return <EditRow key={item.rule.id} editForm={editForm} isNew={false} vmixInputs={vmixInputs} copiedData={copiedData} pasteMode={pasteMode} onChange={handleChange} onSave={handleSave} onCancel={handleCancelEdit} style={style} setNodeRef={setNodeRef} attributes={attributes} listeners={listeners} />;
  }
  
  return <RuleRow key={item.rule.id} trigger={item.rule} ruleNum={ruleNumbers[item.rule.id]} isGrouped={false} pasteMode={pasteMode} isSelected={selectedIds.includes(item.rule.id)} onToggle={toggleTrigger} onEdit={handleEditClick} onDelete={handleDeleteRule} onCopy={handleCopy} onPasteInto={handlePasteInto} onSelect={toggleSelection} onMove={(dir) => handleMove(idx, dir)} isFirst={idx === 0} isLast={idx === displayItems.length - 1} meters={meters} triggeredRules={triggeredRules} style={style} setNodeRef={setNodeRef} attributes={attributes} listeners={listeners} />;
}

function SortableGroupWrapper({ id, item, idx, selectedIds, editingId, editForm, vmixInputs, copiedData, pasteMode, handleChange, handleSave, handleCancelEdit, ruleNumbers, toggleGroupSelection, openGroupModal, handleUngroup, handleMove, handleCopy, toggleTrigger, handleEditClick, handleDeleteRule, handlePasteInto, toggleSelection, displayItems, meters, triggeredRules }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const gSel = item.rules.every(r => selectedIds.includes(r.id));
  const bg   = hexToRgba(item.color, 0.07);
  const bgD  = hexToRgba(item.color, 0.13);
  const col  = item.color || '#3b82f6';

  return (
    <React.Fragment key={'g-' + item.id}>
      <tr ref={setNodeRef} style={{ background: bgD, borderTop: `2px solid ${col}`, ...style }}>
        <td style={{ padding: '8px 8px', borderLeft: `3px solid ${col}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#64748b' }}>
              <GripVertical size={14} />
            </div>
            <button onClick={() => toggleGroupSelection(item.rules)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', lineHeight: 1 }}>
              {gSel ? <CheckSquare size={14} style={{ color: '#22d3ee' }} /> : <Square size={14} />}
            </button>
          </div>
        </td>
        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 8px ${col}`, margin: '0 auto' }} />
        </td>
        <td colSpan={3} style={{ padding: '8px 12px', background: bgD }}>
          <span style={{ fontWeight: 900, fontSize: '13px', color: col }}>{item.name}</span>
          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#475569' }}>({item.rules.length} rules)</span>
        </td>
        <td style={{ background: bgD }} />
        <td style={{ padding: '8px 8px', background: bgD, textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
            <button onClick={() => openGroupModal({ id: item.id, name: item.name, color: item.color })} title="Edit group name/color" style={{ padding: '3px 8px', borderRadius: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Pencil size={11} /> Edit
            </button>
            <button onClick={() => handleUngroup(item.rules)} title="Dissolve group" style={{ padding: '3px 8px', borderRadius: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Unlink size={11} />
            </button>
            <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0} style={{ padding: '3px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', opacity: idx === 0 ? 0.2 : 1 }}><ArrowUp size={13} /></button>
            <button onClick={() => handleMove(idx, 'down')} disabled={idx === displayItems.length - 1} style={{ padding: '3px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', opacity: idx === displayItems.length - 1 ? 0.2 : 1 }}><ArrowDown size={13} /></button>
            <button onClick={() => handleCopy('group', item.rules)} title="Copy group" style={{ padding: '3px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><Copy size={12} /></button>
          </div>
        </td>
      </tr>
      {item.rules.map(t => editingId === t.id
        ? <EditRow key={t.id} editForm={editForm} isNew={false} vmixInputs={vmixInputs} copiedData={copiedData} pasteMode={pasteMode} onChange={handleChange} onSave={handleSave} onCancel={handleCancelEdit} groupStyle={{ background: bg, borderLeft: `3px solid ${col}` }} />
        : <RuleRow key={t.id} trigger={t} ruleNum={ruleNumbers[t.id]} isGrouped groupBg={bg} borderCol={col} isSelected={selectedIds.includes(t.id)} pasteMode={pasteMode} onToggle={toggleTrigger} onEdit={handleEditClick} onDelete={handleDeleteRule} onCopy={handleCopy} onPasteInto={handlePasteInto} onSelect={toggleSelection} onMove={null} meters={meters} triggeredRules={triggeredRules} />
      )}
    </React.Fragment>
  );
}

// ─── PanelA ───────────────────────────────────────────────────────────────────
export const PanelA = React.memo(function PanelA({ vmixConnected, meters = {}, triggeredRules = {} }) {
  const { triggers, loading, addTrigger, updateTrigger, deleteTrigger, toggleTrigger, reorderTriggers, bulkGroup, bulkDelete, bulkToggle, bulkCreate } = useTriggers();
  const [vmixInputs, setVmixInputs]   = useState([]);
  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [isCreating, setIsCreating]   = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedData, setCopiedData]   = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm]     = useState({ name: '', color: '#3b82f6', isEditing: false, editGroupId: null });
  const fileInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [searchQuery, setSearchQuery] = useState('');
  const showConfirm = opts => setConfirmModal({ isOpen: true, ...opts });
  const hideConfirm = () => setConfirmModal(p => ({ ...p, isOpen: false }));

  useEffect(() => {
    if (vmixConnected) api.getVmixInputs().then(setVmixInputs).catch(console.error);
  }, [vmixConnected]);

  // ── Memoized display items & rule numbers ─────────────────────────────────
  const { displayItems, ruleNumbers } = useMemo(() => {
    const filteredTriggers = triggers.filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.group_name && t.group_name.toLowerCase().includes(q)) ||
        t.listen_source.toLowerCase().includes(q) ||
        t.trigger_event.toLowerCase().includes(q) ||
        t.action_target.toLowerCase().includes(q) ||
        t.yamaha_command.toLowerCase().includes(q) ||
        (t.vmix_function && t.vmix_function.toLowerCase().includes(q)) ||
        (t.vmix_input_number && t.vmix_input_number.toString().includes(q))
      );
    });

    const items = [];
    let curGid = null, curRules = [];
    filteredTriggers.forEach(t => {
      if (t.group_id) {
        if (curGid !== t.group_id) {
          if (curGid) items.push({ type: 'group', id: curGid, rules: curRules, name: curRules[0].group_name, color: curRules[0].group_color });
          curGid = t.group_id; curRules = [t];
        } else curRules.push(t);
      } else {
        if (curGid) { items.push({ type: 'group', id: curGid, rules: curRules, name: curRules[0].group_name, color: curRules[0].group_color }); curGid = null; curRules = []; }
        items.push({ type: 'rule', id: t.id, rule: t });
      }
    });
    if (curGid) items.push({ type: 'group', id: curGid, rules: curRules, name: curRules[0].group_name, color: curRules[0].group_color });

    let c = 0;
    const nums = {};
    items.forEach(item => {
      if (item.type === 'group') item.rules.forEach(r => { nums[r.id] = ++c; });
      else nums[item.rule.id] = ++c;
    });
    return { displayItems: items, ruleNumbers: nums };
  }, [triggers, searchQuery]);

  // ── Detect same-group selection ───────────────────────────────────────────
  const selectedGroupInfo = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const sel = triggers.filter(t => selectedIds.includes(t.id));
    if (sel.length === 0) return null;
    const gid = sel[0].group_id;
    if (!gid || !sel.every(t => t.group_id === gid)) return null;
    return { id: gid, name: sel[0].group_name, color: sel[0].group_color };
  }, [selectedIds, triggers]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEditClick = t => { setEditingId(t.id); setEditForm({ ...t }); setIsCreating(false); };
  const handleCancelEdit = () => { setEditingId(null); setEditForm({}); setIsCreating(false); };
  const handleSave = async () => {
    if (isCreating) { const mo = triggers.length > 0 ? Math.max(...triggers.map(t => t.sort_order)) : 0; await addTrigger({ ...editForm, sort_order: mo + 1 }); }
    else await updateTrigger(editingId, editForm);
    setEditingId(null); setIsCreating(false);
  };
  const handleCreateNew = () => {
    setIsCreating(true); setEditingId('new');
    setEditForm({ name: 'New Trigger', listen_source: 'vmix', trigger_event: 'TransitionIn', vmix_input_number: null, vmix_input_name: '', threshold: null, silence_timeout_ms: null, action_target: 'yamaha', yamaha_command: 'InCh/Fader/Level', yamaha_channel: 1, yamaha_mix: 0, vmix_function: 'SetVolume', vmix_target_input: null, parameter_value: '0', delay_ms: 0, is_active: true });
  };
  const handleChange = (field, value) => {
    if (field === 'vmix_input') {
      const inp = vmixInputs.find(i => i.number.toString() === value.toString());
      setEditForm(p => inp ? { ...p, vmix_input_number: inp.number, vmix_input_name: inp.title } : { ...p, vmix_input_number: null, vmix_input_name: '' });
    } else setEditForm(p => ({ ...p, [field]: value }));
  };

  const toggleSelection = id => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const handleSelectAll = () => {
    if (selectedIds.length === triggers.length && triggers.length > 0) setSelectedIds([]);
    else setSelectedIds(triggers.map(t => t.id));
  };
  const toggleGroupSelection = rules => {
    const allSel = rules.every(r => selectedIds.includes(r.id));
    if (allSel) setSelectedIds(p => p.filter(id => !rules.find(r => r.id === id)));
    else { const n = [...selectedIds]; rules.forEach(r => { if (!n.includes(r.id)) n.push(r.id); }); setSelectedIds(n); }
  };

  const handleBulkDelete = () => showConfirm({ title: 'Delete Selected', message: `Permanently delete ${selectedIds.length} trigger rule${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`, confirmLabel: `Delete ${selectedIds.length} Rules`, danger: true, onConfirm: async () => { await bulkDelete(selectedIds); setSelectedIds([]); } });
  const handleBulkToggle = state => bulkToggle(selectedIds, state);

  const openGroupModal = (editData = null) => {
    if (editData) setGroupForm({ name: editData.name || '', color: editData.color || '#3b82f6', isEditing: true, editGroupId: editData.id });
    else setGroupForm({ name: '', color: '#3b82f6', isEditing: false, editGroupId: null });
    setShowGroupModal(true);
  };

  const handleGroupSave = async () => {
    if (!groupForm.name.trim()) return;
    if (groupForm.isEditing && groupForm.editGroupId) {
      // Edit existing group: update all rules in that group
      const groupRuleIds = triggers.filter(t => t.group_id === groupForm.editGroupId).map(t => t.id);
      await bulkGroup(groupRuleIds, groupForm.name.trim(), groupForm.color, groupForm.editGroupId);
    } else {
      await bulkGroup(selectedIds, groupForm.name.trim(), groupForm.color);
    }
    setShowGroupModal(false); setSelectedIds([]);
  };

  const handleMove = async (index, dir) => {
    const ni = [...displayItems];
    if (dir === 'up' && index > 0) [ni[index-1], ni[index]] = [ni[index], ni[index-1]];
    else if (dir === 'down' && index < ni.length-1) [ni[index], ni[index+1]] = [ni[index+1], ni[index]];
    else return;
    let o = 0; const upd = [];
    ni.forEach(item => { if (item.type === 'group') item.rules.forEach(r => upd.push({ id: r.id, sort_order: o++ })); else upd.push({ id: item.rule.id, sort_order: o++ }); });
    await reorderTriggers(upd);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayItems.findIndex(i => (i.type === 'group' ? 'g-'+i.id : 'r-'+i.rule.id) === active.id);
    const newIndex = displayItems.findIndex(i => (i.type === 'group' ? 'g-'+i.id : 'r-'+i.rule.id) === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const ni = arrayMove(displayItems, oldIndex, newIndex);
      let o = 0; const upd = [];
      ni.forEach(item => { if (item.type === 'group') item.rules.forEach(r => upd.push({ id: r.id, sort_order: o++ })); else upd.push({ id: item.rule.id, sort_order: o++ }); });
      await reorderTriggers(upd);
    }
  };

  const handleCopy = (type, data) => setCopiedData({ type, data });
  const handlePasteNew = async () => {
    if (!copiedData) return;
    const mo = triggers.length > 0 ? Math.max(...triggers.map(t => t.sort_order)) : 0;
    if (copiedData.type === 'rule') { const r = { ...copiedData.data }; delete r.id; delete r.group_id; delete r.group_name; delete r.group_color; delete r.created_at; delete r.updated_at; r.sort_order = mo + 1; await bulkCreate([r]); }
    else { const gid = Math.random().toString(36).substring(7); await bulkCreate(copiedData.data.map((r, i) => { const nr = { ...r }; delete nr.id; delete nr.created_at; delete nr.updated_at; nr.group_id = gid; nr.sort_order = mo + 1 + i; return nr; })); }
  };
  const handlePasteInto = async tgt => {
    if (!copiedData || copiedData.type !== 'rule') return;
    const src = copiedData.data;
    await updateTrigger(tgt.id, { listen_source: src.listen_source, trigger_event: src.trigger_event, vmix_input_number: src.vmix_input_number, vmix_input_name: src.vmix_input_name, threshold: src.threshold, silence_timeout_ms: src.silence_timeout_ms, action_target: src.action_target, yamaha_command: src.yamaha_command, yamaha_channel: src.yamaha_channel, yamaha_mix: src.yamaha_mix, vmix_function: src.vmix_function, vmix_target_input: src.vmix_target_input, parameter_value: src.parameter_value, delay_ms: src.delay_ms });
  };
  const handleUngroup = rules => showConfirm({ title: 'Dissolve Group', message: `Remove these ${rules.length} rules from their group? Rules stay — only the group is removed.`, confirmLabel: 'Ungroup', danger: false, onConfirm: async () => { await bulkGroup(rules.map(r => r.id), '', ''); } });
  const handleDeleteRule = trigger => showConfirm({ title: 'Delete Rule', message: `Delete "${trigger.name}"? This cannot be undone.`, confirmLabel: 'Delete Rule', danger: true, onConfirm: async () => { await deleteTrigger(trigger.id); } });
  const handleExport = () => { const a = document.createElement('a'); a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(triggers)); a.download = 'bridge_rules.json'; a.click(); };
  const handleImport = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { try { const rules = JSON.parse(ev.target.result); const mo = triggers.length > 0 ? Math.max(...triggers.map(t => t.sort_order)) : 0; await bulkCreate(rules.map((r, i) => { const nr = { ...r }; delete nr.id; delete nr.created_at; delete nr.updated_at; nr.sort_order = mo + 1 + i; return nr; })); } catch { alert('Invalid JSON file'); } };
    reader.readAsText(file); e.target.value = null;
  };

  if (loading && triggers.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}><div style={{ width: 32, height: 32, border: '2px solid rgba(34,211,238,0.4)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} /><p style={{ color: '#475569', fontSize: 13 }}>Loading rules…</p></div>
    </div>
  );

  const pasteMode = copiedData?.type === 'rule';

  // ── CSS class strings (static, no re-creation) ──────────────────────────
  const inSel = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', width: '100%' };

  return (
    <>
      <ConfirmModal {...confirmModal} onCancel={hideConfirm} />

      <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>

        {/* ── Header ── */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #131b2e, #0d1526)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22d3ee' }}>Trigger Rules</div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{triggers.length} rule{triggers.length !== 1 ? 's' : ''} · vMix ↔ Yamaha TF3</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '16px' }}>
              <button onClick={handleExport} title="Export rules to JSON" style={{ padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer' }}><Download size={14} /></button>
              <button onClick={() => fileInputRef.current.click()} title="Import rules from JSON" style={{ padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer' }}><Upload size={14} /></button>
              <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {copiedData && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee', fontSize: '12px', fontWeight: 700 }}>
                  <Clipboard size={12} /> {copiedData.type === 'group' ? 'Group' : 'Rule'} copied
                  <button onClick={() => setCopiedData(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={11} /></button>
                </div>
                <button onClick={handlePasteNew} style={{ padding: '5px 12px', borderRadius: '8px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clipboard size={12} /> Paste as New
                </button>
              </>
            )}
            <button onClick={handleSelectAll} style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckSquare size={14} /> {selectedIds.length === triggers.length && triggers.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Search rules..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '6px 10px 6px 30px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '12px', width: '180px' }}
              />
            </div>
            <button onClick={handleCreateNew} disabled={isCreating || editingId !== null}
              style={{ padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg,#06b6d4,#0e7490)', color: 'white', fontWeight: 900, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 20px rgba(6,182,212,0.25)', opacity: (isCreating || editingId !== null) ? 0.4 : 1 }}>
              <Plus size={14} /> New Rule
            </button>
          </div>
        </div>

        {/* ── Selection toolbar ── */}
        {selectedIds.length > 0 && (
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(34,211,238,0.1)', background: 'rgba(34,211,238,0.03)', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.08em', color: '#22d3ee' }}>{selectedIds.length} SELECTED</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {selectedGroupInfo ? (
                <button onClick={() => openGroupModal(selectedGroupInfo)}
                  style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Pencil size={12} /> Edit Group
                </button>
              ) : (
                <button onClick={() => openGroupModal(null)} disabled={selectedIds.length < 2}
                  style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: selectedIds.length < 2 ? 0.3 : 1 }}>
                  <Layers size={12} /> Group
                </button>
              )}
              {triggers.filter(t => selectedIds.includes(t.id)).some(t => t.group_id) && (
                <button onClick={async () => { await bulkGroup(selectedIds, '', ''); setSelectedIds([]); }}
                  style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Unlink size={12} /> Ungroup
                </button>
              )}
              <button onClick={() => handleBulkToggle(true)}
                style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Power size={12} /> Activate
              </button>
              <button onClick={() => handleBulkToggle(false)}
                style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <PowerOff size={12} /> Deactivate
              </button>
              <button onClick={handleBulkDelete}
                style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}

        {pasteMode && (
          <div style={{ padding: '6px 20px', fontSize: '12px', fontWeight: 600, color: '#22d3ee', background: 'rgba(34,211,238,0.04)', borderBottom: '1px solid rgba(34,211,238,0.1)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Clipboard size={12} /> Paste mode — hover a rule row and click ⎘ to paste settings onto it
          </div>
        )}

        {/* ── Group / Edit-group modal ── */}
        {showGroupModal && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div style={{ background: 'linear-gradient(145deg,#1a2235,#131c2e)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', width: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: '16px' }}>
                {groupForm.isEditing ? 'Edit Group' : 'Create Group'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field label="Group Name" info="A descriptive label for this group of related rules.">
                  <input type="text" value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Worship Set, Video Segments…" style={inSel} />
                </Field>
                <Field label="Group Color" info="Color used to visually identify this group in the table.">
                  <input type="color" value={groupForm.color} onChange={e => setGroupForm(p => ({ ...p, color: e.target.value }))}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer' }} />
                </Field>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  <button onClick={() => setShowGroupModal(false)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleGroupSave} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'linear-gradient(135deg,#06b6d4,#0e7490)', color: 'white', fontWeight: 900, cursor: 'pointer' }}>
                    {groupForm.isEditing ? 'Save Changes' : 'Create Group'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '36px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '200px' }} />
              <col />
              <col />
              <col style={{ width: '80px' }} />
              <col style={{ width: '120px' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(to right,#0a0f1e,#0d1626)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <tr>
                <th style={{ padding: '10px 8px' }} />
                <th style={{ padding: '10px 6px', textAlign: 'center' }}><Power size={13} style={{ color: '#334155', display: 'inline' }} /></th>
                <th style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hash size={10} style={{ color: '#334155' }} />
                    <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>Rule Name</span>
                  </div>
                </th>
                <th style={{ padding: '10px 16px', background: 'rgba(34,211,238,0.03)', borderLeft: '1px solid rgba(34,211,238,0.1)', borderRight: '1px solid rgba(34,211,238,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'linear-gradient(#3b82f6,#06b6d4)', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#60a5fa' }}>Event</span>
                    <span style={{ fontSize: '10px', color: '#334155' }}>— Listen To</span>
                  </div>
                </th>
                <th style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.03)', borderRight: '1px solid rgba(34,197,94,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'linear-gradient(#4ade80,#06b6d4)', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4ade80' }}>Command</span>
                    <span style={{ fontSize: '10px', color: '#334155' }}>— Speak To</span>
                  </div>
                </th>
                <th style={{ padding: '10px 12px' }}><span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>Delay</span></th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}><span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {isCreating && <EditRow key="new-row" editForm={editForm} isNew vmixInputs={vmixInputs} copiedData={copiedData} pasteMode={pasteMode} onChange={handleChange} onSave={handleSave} onCancel={handleCancelEdit} />}

              <SortableContext items={displayItems.map(i => i.type === 'group' ? 'g-'+i.id : 'r-'+i.rule.id)} strategy={verticalListSortingStrategy}>
                {displayItems.map((item, idx) => {
                    if (item.type === 'group') {
                      return <SortableGroupWrapper key={'g-'+item.id} id={'g-'+item.id} item={item} idx={idx} selectedIds={selectedIds} editingId={editingId} editForm={editForm} vmixInputs={vmixInputs} copiedData={copiedData} pasteMode={pasteMode} handleChange={handleChange} handleSave={handleSave} handleCancelEdit={handleCancelEdit} ruleNumbers={ruleNumbers} toggleGroupSelection={toggleGroupSelection} openGroupModal={openGroupModal} handleUngroup={handleUngroup} handleMove={handleMove} handleCopy={handleCopy} toggleTrigger={toggleTrigger} handleEditClick={handleEditClick} handleDeleteRule={handleDeleteRule} handlePasteInto={handlePasteInto} toggleSelection={toggleSelection} displayItems={displayItems} meters={meters} triggeredRules={triggeredRules} />;
                    }
                    return <SortableRuleWrapper key={'r-'+item.rule.id} id={'r-'+item.rule.id} item={item} idx={idx} editingId={editingId} editForm={editForm} vmixInputs={vmixInputs} copiedData={copiedData} pasteMode={pasteMode} handleChange={handleChange} handleSave={handleSave} handleCancelEdit={handleCancelEdit} ruleNumbers={ruleNumbers} selectedIds={selectedIds} toggleTrigger={toggleTrigger} handleEditClick={handleEditClick} handleDeleteRule={handleDeleteRule} handleCopy={handleCopy} handlePasteInto={handlePasteInto} toggleSelection={toggleSelection} handleMove={handleMove} displayItems={displayItems} meters={meters} triggeredRules={triggeredRules} />;
                  })}
                </SortableContext>

              {triggers.length === 0 && !isCreating && (
                <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Layers size={32} style={{ color: '#1e2a3a', margin: '0 auto 10px' }} />
                  <p style={{ color: '#334155', fontSize: '13px', fontWeight: 600 }}>No trigger rules yet</p>
                  <p style={{ color: '#1e2a3a', fontSize: '12px', marginTop: '4px' }}>Click <strong style={{ color: '#22d3ee' }}>New Rule</strong> to automate your first action</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
    </>
  );
});

// ─── EditField (Static Component to prevent focus loss) ─────────────────
const EditField = React.memo(({ label, info, children }) => (
  <div style={{ marginBottom: '10px' }}>
    <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
      {label}
      {info && (
        <Tooltip text={info}>
          <Info size={10} style={{ color: '#475569' }} />
        </Tooltip>
      )}
    </div>
    {children}
  </div>
));

function DebouncedInput({ value, onChange, delay = 300, ...props }) {
  const [localValue, setLocalValue] = React.useState(value ?? '');
  
  React.useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== (value ?? '')) {
        onChange(localValue);
      }
    }, delay);
    return () => clearTimeout(handler);
  }, [localValue, value, onChange, delay]);

  return <input value={localValue} onChange={e => setLocalValue(e.target.value)} {...props} />;
}

// ─── EditRow — Isolated component (prevents full panel re-render on keystrokes) ─
function EditRow({ editForm, isNew, vmixInputs, copiedData, pasteMode, onChange, onSave, onCancel, groupStyle = {}, style = {}, setNodeRef, attributes, listeners }) {
  const iS = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', borderRadius: '8px', padding: '5px 9px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
  const lS = { fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' };

  const handlePasteSettings = () => {
    if (!copiedData?.data) return;
    const src = copiedData.data;
    ['listen_source','trigger_event','vmix_input_number','vmix_input_name','threshold','silence_timeout_ms','action_target','yamaha_command','yamaha_channel','yamaha_mix','vmix_function','vmix_target_input','parameter_value','delay_ms'].forEach(f => onChange(f, src[f]));
  };

  return (
    <tr ref={setNodeRef} style={{ background: 'linear-gradient(to right,#1a2438,#131c2e)', borderBottom: '2px solid rgba(34,211,238,0.15)', ...groupStyle, ...style }}>
      <td colSpan={7} style={{ padding: '0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', borderTop: '1px solid rgba(34,211,238,0.12)' }}>

          {/* ── Col 1: Identity + Actions ── */}
          <div style={{ padding: '14px 14px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22d3ee', animation: 'pulse 2s infinite' }} />
              {isNew ? 'New Rule' : 'Edit Rule'}
            </div>
            <EditField label="Rule Name" info="A descriptive name for this rule. e.g. 'Mute Band when Video Plays'">
              <DebouncedInput type="text" value={editForm.name || ''} onChange={val => onChange('name', val)} style={iS} />
            </EditField>
            <EditField label="Delay (ms)" info="Wait this many milliseconds after the event fires before sending the command. 0 = instant. Useful for perfect sync with slow crossfades.">
              <DebouncedInput type="number" value={editForm.delay_ms ?? 0} onChange={val => onChange('delay_ms', parseInt(val) || 0)} style={iS} />
            </EditField>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {pasteMode && (
                <button onClick={handlePasteSettings} title="Paste settings from copied rule" style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}>
                  <Clipboard size={14} /> Paste
                </button>
              )}
              <button onClick={onSave} style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}>
                <Save size={14} /> Save
              </button>
              <button onClick={onCancel} style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Col 2: Listen To ── */}
          <div style={{ padding: '14px 16px', borderRight: '1px solid rgba(34,211,238,0.08)', background: 'rgba(34,211,238,0.02)' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#60a5fa', marginBottom: '10px' }}>Event — Listen To</div>

            {/* Source toggle */}
            <div style={{ marginBottom: '10px' }}>
              <div style={lS}>Listen Source</div>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', width: 'max-content' }}>
                {[
                  { val: 'vmix', icon: <Video size={11} />, label: 'vMix Event', active: { background: 'rgba(59,130,246,0.25)', color: '#60a5fa' } },
                  { val: 'yamaha', icon: <Mic size={11} />, label: 'Yamaha Meter', active: { background: 'rgba(245,158,11,0.2)', color: '#fbbf24' } },
                ].map(({ val, icon, label, active }, i) => (
                  <button key={val}
                    onClick={() => { onChange('listen_source', val); onChange('trigger_event', val === 'vmix' ? 'TransitionIn' : 'YamahaMeter'); }}
                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', border: 'none', ...(editForm.listen_source === val ? active : { background: 'rgba(255,255,255,0.03)', color: '#475569' }), ...(i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.06)' } : {}) }}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>

            {editForm.listen_source === 'vmix' ? (
              <>
                <EditField label="Event" info="The vMix action that triggers this rule.">
                  <select value={editForm.trigger_event || ''} onChange={e => onChange('trigger_event', e.target.value)} style={iS}>
                    {Object.entries(VMIX_EVENT_LABELS).map(([v, l]) => <option key={v} value={v} title={VMIX_EVENT_INFO[v]} style={{ background: '#1e293b', color: 'white' }}>{l}</option>)}
                  </select>
                  {editForm.trigger_event && <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>{VMIX_EVENT_INFO[editForm.trigger_event]}</div>}
                </EditField>
                <EditField label="vMix Input (Optional)" info="Leave blank to fire for ALL inputs, or select a specific input to only react to that one.">
                  <select value={editForm.vmix_input_number || ''} onChange={e => onChange('vmix_input_number', e.target.value)} style={iS}>
                    <option value="" style={{ background: '#1e293b', color: 'white' }}>Any Input — fires for all</option>
                    {vmixInputs.map(i => <option key={i.number} value={i.number} style={{ background: '#1e293b', color: 'white' }}>{i.number}: {i.title}</option>)}
                  </select>
                </EditField>
                {editForm.trigger_event === 'TimeRemaining' && (
                  <EditField label="Time Threshold (HH:MM:SS)" info="Trigger when the video has this much time remaining. Format: HH:MM:SS (e.g. 00:01:00 for 1 minute).">
                    <DebouncedInput type="text" placeholder="00:01:00" value={editForm.time_threshold || ''} onChange={val => onChange('time_threshold', val)} style={{ ...iS, fontFamily: 'monospace' }} />
                  </EditField>
                )}
              </>
            ) : (
              <>
                <EditField label="Channel to Monitor (1–40)" info="The input channel number on the Yamaha mixer to monitor live microphone meter data.">
                  <input type="number" min="1" max="40" placeholder="e.g. 1" value={editForm.vmix_input_number || ''} onChange={e => onChange('vmix_input_number', parseInt(e.target.value) || null)} style={iS} />
                </EditField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <EditField label="Attack (Thr)" info="Signal must exceed this level to count as 'speaking'. Typical: -4000.">
                    <input type="number" placeholder="-4000" value={editForm.threshold || ''} onChange={e => onChange('threshold', parseInt(e.target.value))} style={iS} />
                  </EditField>
                  <EditField label="Release (Rel)" info="Signal must drop below this level to start the silence timeout. Typical: -5000.">
                    <input type="number" placeholder="-5000" value={editForm.release_threshold || ''} onChange={e => onChange('release_threshold', parseInt(e.target.value))} style={iS} />
                  </EditField>
                  <EditField label="Silence (ms)" info="How long after silence before restoring volume. e.g. 3000 = 3 seconds.">
                    <input type="number" placeholder="3000" value={editForm.silence_timeout_ms || ''} onChange={e => onChange('silence_timeout_ms', parseInt(e.target.value))} style={iS} />
                  </EditField>
                </div>
              </>
            )}
          </div>

          {/* ── Col 3: Speak To ── */}
          <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.02)' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4ade80', marginBottom: '10px' }}>Command — Speak To</div>

            {/* Target toggle */}
            <div style={{ marginBottom: '10px' }}>
              <div style={lS}>Command Target</div>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', width: 'max-content' }}>
                {[
                  { val: 'yamaha', icon: <Speaker size={11} />, label: 'Yamaha', active: { background: 'rgba(34,197,94,0.2)', color: '#4ade80' } },
                  { val: 'vmix',   icon: <MonitorSpeaker size={11} />, label: 'vMix', active: { background: 'rgba(59,130,246,0.25)', color: '#60a5fa' } },
                ].map(({ val, icon, label, active }, i) => (
                  <button key={val} onClick={() => onChange('action_target', val)}
                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', border: 'none', ...(editForm.action_target === val ? active : { background: 'rgba(255,255,255,0.03)', color: '#475569' }), ...(i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.06)' } : {}) }}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>

            {editForm.action_target === 'yamaha' ? (
              <>
              {(() => {
                const cmd = editForm.yamaha_command || '';
                const isSmooth = cmd.endsWith('/Smooth');
                const needsMix = cmd.includes('/ToMix') || cmd.includes('/ToFX') || cmd.includes('Mix/Fader') || cmd.includes('USB/Record') || cmd.includes('FXRTN');
                const needsChannel = !cmd.includes('St/Fader') && !cmd.includes('Mix/Fader') && !cmd.includes('USB/Play');
                
                const smoothParts = (editForm.parameter_value || '').split(',');
                
                return (
                  <>
                    <EditField label="Yamaha Command" info="The mixer parameter to control.">
                      <select value={cmd} onChange={e => onChange('yamaha_command', e.target.value)} style={iS}>
                        {Object.entries(YAMAHA_CMD_LABELS).map(([v, l]) => <option key={v} value={v} style={{ background: '#1e293b', color: 'white' }}>{l}</option>)}
                      </select>
                      {cmd && <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>{YAMAHA_CMD_INFO[cmd]}</div>}
                    </EditField>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {needsChannel && (
                        <EditField label="Channel (Ch)" info="Channel or target number (e.g. input 1–40, DCA 1–8, scene number).">
                          <input type="number" value={editForm.yamaha_channel ?? ''} onChange={e => onChange('yamaha_channel', parseInt(e.target.value) || 0)} style={iS} />
                        </EditField>
                      )}
                      {needsMix && (
                        <EditField label="Mix (Mx)" info="Aux/Mix bus number 1–20.">
                          <input type="number" value={editForm.yamaha_mix ?? ''} onChange={e => onChange('yamaha_mix', parseInt(e.target.value) || 0)} style={iS} />
                        </EditField>
                      )}
                    </div>
                    
                    {isSmooth ? (() => {
                      const sp = (editForm.parameter_value || '').split(',');
                      const isLegacy = sp.length >= 3;
                      const endLevel = isLegacy ? sp[1] : sp[0];
                      const duration = isLegacy ? sp[2] : sp[1];
                      
                      const updateSmooth = (newEnd, newDur) => {
                        onChange('parameter_value', `${newEnd || ''},${newDur || ''}`);
                      };

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <EditField label="End Level" info="e.g. -2000 (-20dB). The level to fade TO. The start level is detected automatically.">
                            <DebouncedInput type="text" placeholder="-2000" value={endLevel || ''} onChange={val => updateSmooth(val, duration)} style={{ ...iS, fontFamily: 'monospace' }} />
                          </EditField>
                          <EditField label="Duration (ms)" info="e.g. 2000 (2s). The time it takes to complete the fade.">
                            <DebouncedInput type="text" placeholder="2000" value={duration || ''} onChange={val => updateSmooth(endLevel, val)} style={{ ...iS, fontFamily: 'monospace' }} />
                          </EditField>
                        </div>
                      );
                    })() : (
                      <EditField label="Value" info="The value to set. For levels: integer dB units (0 = Unity). For On/Off: 1 or 0.">
                        <DebouncedInput type="text" placeholder="e.g. -1000 or 1" value={editForm.parameter_value ?? ''} onChange={val => onChange('parameter_value', val)} style={{ ...iS, fontFamily: 'monospace' }} />
                      </EditField>
                    )}
                  </>
                );
              })()}
              </>
            ) : (
              <>
                <EditField label="vMix Function" info="The action to perform in vMix.">
                  <select value={editForm.vmix_function || ''} onChange={e => onChange('vmix_function', e.target.value)} style={iS}>
                    {Object.entries(VMIX_FN_LABELS).map(([v, l]) => <option key={v} value={v} style={{ background: '#1e293b', color: 'white' }}>{l}</option>)}
                  </select>
                  {editForm.vmix_function && <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>{VMIX_FN_INFO[editForm.vmix_function]}</div>}
                </EditField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <EditField label="Target Input" info="The input number to apply this function to (if applicable).">
                    <input type="text" placeholder="e.g. 1" value={editForm.vmix_target_input || ''} onChange={e => onChange('vmix_target_input', e.target.value)} style={iS} />
                  </EditField>
                  <EditField label="Value" info="The value to pass to the function (0-100 for volume).">
                    <input type="text" placeholder="e.g. 100" value={editForm.parameter_value || ''} onChange={e => onChange('parameter_value', e.target.value)} style={iS} />
                  </EditField>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── RuleRow — Isolated memo component ───────────────────────────────────────
const RuleRow = React.memo(function RuleRow({ trigger, ruleNum, isGrouped, groupBg, borderCol, isSelected, pasteMode, onToggle, onEdit, onDelete, onCopy, onPasteInto, onSelect, onMove, isFirst, isLast, triggeredRules = {}, meters = {}, style = {}, setNodeRef, attributes, listeners }) {
  const [flash, setFlash] = useState(false);
  const triggerTime = triggeredRules[trigger.id];
  
  useEffect(() => {
    if (triggerTime) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(t);
    }
  }, [triggerTime]);

  const cellBg   = isGrouped ? groupBg : 'transparent';
  const leftBdr  = isGrouped ? { borderLeft: `3px solid ${borderCol}` } : {};
  const rowStyle = flash ? { background: 'rgba(34,211,238,0.2)', transition: 'background 0.05s', borderBottom: '1px solid rgba(255,255,255,0.04)' } : { background: cellBg, transition: 'background 0.5s', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: trigger.is_active ? 1 : 0.4 };

  return (
    <tr ref={setNodeRef} style={{ ...rowStyle, ...style }} className="hover:brightness-110 group">
      <td style={{ padding: '8px', ...leftBdr, background: cellBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {listeners && (
            <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#64748b' }}>
              <GripVertical size={14} />
            </div>
          )}
          <button onClick={() => onSelect(trigger.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', lineHeight: 1 }}>
            {isSelected ? <CheckSquare size={14} style={{ color: '#22d3ee' }} /> : <Square size={14} />}
          </button>
        </div>
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'center', background: cellBg }}>
        <button onClick={() => onToggle(trigger.id)} title={trigger.is_active ? 'Click to deactivate' : 'Click to activate'}
          style={{ padding: '5px', borderRadius: '7px', background: trigger.is_active ? 'rgba(34,197,94,0.1)' : 'transparent', border: 'none', color: trigger.is_active ? '#4ade80' : '#334155', cursor: 'pointer' }}>
          {trigger.is_active ? <Power size={15} /> : <PowerOff size={15} />}
        </button>
      </td>
      <td style={{ padding: '8px 12px', background: cellBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <RuleNum n={ruleNum} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0', lineHeight: 1.2 }}>{trigger.name}</div>
            {trigger.group_id && <div style={{ fontSize: '10px', color: '#334155', marginTop: '1px' }}>{trigger.group_name}</div>}
          </div>
        </div>
      </td>
      <td style={{ padding: '8px 16px', background: isGrouped ? `color-mix(in srgb, ${groupBg} 70%, rgba(34,211,238,0.03))` : 'rgba(34,211,238,0.025)', borderLeft: '1px solid rgba(34,211,238,0.08)', borderRight: '1px solid rgba(34,211,238,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <SourceBadge source={trigger.listen_source} />
          {trigger.listen_source === 'yamaha' ? (
            <>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0' }}>Ch {trigger.vmix_input_number}</div>
              <div style={{ fontSize: '11px', color: '#475569' }}>Thr: {(trigger.threshold ?? -4000) / 100}dB · Rel: {(trigger.release_threshold ?? ((trigger.threshold ?? -4000)-1000)) / 100}dB</div>
              
              {/* Mini Audio Meter */}
              <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.max(0, Math.min(100, (((meters[trigger.vmix_input_number] || -6000) + 6000) / 7000) * 100))}%`,
                  background: (meters[trigger.vmix_input_number] || -6000) > -1000 ? '#ef4444' : (meters[trigger.vmix_input_number] || -6000) > -2000 ? '#f59e0b' : '#22c55e',
                  transition: 'width 0.1s linear, background 0.1s'
                }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0' }} title={VMIX_EVENT_INFO[trigger.trigger_event]}>{trigger.trigger_event}</div>
              <div style={{ fontSize: '11px', color: '#475569' }}>{trigger.vmix_input_number ? `Input ${trigger.vmix_input_number}` : 'Any Input'}</div>
            </>
          )}
        </div>
      </td>
      <td style={{ padding: '8px 16px', background: isGrouped ? `color-mix(in srgb, ${groupBg} 70%, rgba(34,197,94,0.03))` : 'rgba(34,197,94,0.025)', borderRight: '1px solid rgba(34,197,94,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <TargetBadge target={trigger.action_target} />
          {trigger.action_target === 'vmix' ? (
            <>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0' }} title={VMIX_FN_INFO[trigger.vmix_function]}>{trigger.vmix_function}</div>
              {trigger.vmix_function === 'SetVolume' && <div style={{ fontSize: '11px', color: '#475569' }}>Input {trigger.vmix_target_input ?? 'N/A'}</div>}
              <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', display: 'inline-block', width: 'max-content' }}>{trigger.parameter_value}</span>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={YAMAHA_CMD_INFO[trigger.yamaha_command]}>{trigger.yamaha_command}</div>
              <div style={{ fontSize: '11px', color: '#475569' }}>Ch {trigger.yamaha_channel}{trigger.yamaha_mix ? ` · Mix ${trigger.yamaha_mix}` : ''}</div>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '1px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', display: 'inline-block', width: 'max-content' }}>{trigger.parameter_value}</span>
            </>
          )}
        </div>
      </td>
      <td style={{ padding: '8px 12px', background: cellBg }}>
        {trigger.delay_ms > 0
          ? <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '5px', background: 'rgba(148,163,184,0.08)', color: '#64748b' }}>{trigger.delay_ms}ms</span>
          : <span style={{ color: '#1e2a3a' }}>—</span>}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right', background: cellBg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1px', transition: 'opacity 0.15s' }} className="opacity-0 group-hover:opacity-100">
          {onMove && (
            <>
              <button onClick={() => onMove('up')} disabled={isFirst} style={{ padding: '4px', background: 'none', border: 'none', color: '#334155', cursor: 'pointer', opacity: isFirst ? 0.15 : 1 }}><ArrowUp size={13} /></button>
              <button onClick={() => onMove('down')} disabled={isLast} style={{ padding: '4px', background: 'none', border: 'none', color: '#334155', cursor: 'pointer', opacity: isLast ? 0.15 : 1 }}><ArrowDown size={13} /></button>
            </>
          )}
          {pasteMode && <button onClick={() => onPasteInto(trigger)} title="Paste settings" style={{ padding: '4px', background: 'none', border: 'none', color: '#22d3ee', cursor: 'pointer' }}><Clipboard size={13} /></button>}
          <button onClick={() => onCopy('rule', trigger)} title="Copy rule" style={{ padding: '4px', background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}><Copy size={12} /></button>
          <button onClick={() => onEdit(trigger)} title="Edit rule" style={{ padding: '4px', background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}><Edit2 size={12} /></button>
          <button onClick={() => onDelete(trigger)} title="Delete rule" style={{ padding: '4px', background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = '#334155'}>
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
});
