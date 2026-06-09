import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Plus, Pencil, Trash2, Check, ChevronDown, Save } from 'lucide-react';
import { PresetEventCommandForm, presetFormFromDefaults } from './PresetEventCommandForm';
import { formatListenDetail, formatCommandDetail } from '../constants/ruleConfig';

function PresetSummary({ form }) {
  const listen = formatListenDetail(form);
  const cmd = formatCommandDetail(form);
  return (
    <p className="text-[10px] mt-1 leading-snug truncate" style={{ color: '#5A6278' }}>
      {listen.primary} → {cmd.primary}
    </p>
  );
}

function SlideForm({ children }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="px-3 pb-3 pt-2 rounded-b-lg" style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {children}
      </div>
    </motion.div>
  );
}

export function QuickPresetsPanel({
  isOpen,
  onClose,
  presets = [],
  onAdd,
  onUpdate,
  onRemove,
}) {
  const [newName, setNewName] = useState('');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addForm, setAddForm] = useState(() => presetFormFromDefaults());

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editForm, setEditForm] = useState(() => presetFormFromDefaults());

  const patchAddForm = (field, value) => setAddForm((p) => ({ ...p, [field]: value }));
  const patchEditForm = (field, value) => setEditForm((p) => ({ ...p, [field]: value }));

  const openAddForm = () => {
    if (!newName.trim()) return;
    setAddForm(presetFormFromDefaults({ name: newName.trim() }));
    setAddFormOpen(true);
    setEditingId(null);
  };

  const saveNewPreset = () => {
    const label = newName.trim();
    if (!label) return;
    onAdd?.(label, { ...addForm, name: label });
    setNewName('');
    setAddFormOpen(false);
    setAddForm(presetFormFromDefaults());
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.label);
    setEditForm(presetFormFromDefaults({ ...p.form, name: p.label }));
    setAddFormOpen(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    onUpdate?.(editingId, { label: editName.trim(), form: { ...editForm, name: editName.trim() } });
    cancelEdit();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[240] flex items-center justify-center p-4"
          style={{ background: 'rgba(7,10,15,0.85)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Zap size={18} style={{ color: '#F6B44B' }} />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#F6B44B' }}>Quick Start Presets</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: '#5A6278' }}>Pick event &amp; command from lists — no need to memorize paths</p>
                </div>
              </div>
              <button type="button" onClick={onClose} style={{ color: '#5A6278' }}><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-2 overflow-y-auto flex-1">
              {presets.length === 0 && !addFormOpen && (
                <p className="text-sm italic py-4 text-center" style={{ color: '#5A6278' }}>No presets yet — add one below.</p>
              )}
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: editingId === p.id ? 'rgba(32,217,255,0.04)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${editingId === p.id ? 'rgba(32,217,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 p-3">
                    {editingId === p.id ? (
                      <>
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 text-sm px-2 py-1.5 rounded outline-none min-w-0"
                          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(32,217,255,0.25)', color: '#D8DCE6' }}
                        />
                        <button type="button" onClick={saveEdit} style={{ color: '#39E58C' }} title="Save"><Check size={14} /></button>
                        <button type="button" onClick={cancelEdit} style={{ color: '#5A6278' }} title="Cancel"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold block truncate" style={{ color: '#D8DCE6' }}>{p.label}</span>
                          {p.form && <PresetSummary form={p.form} />}
                        </div>
                        <button type="button" onClick={() => startEdit(p)} style={{ color: editingId === p.id ? '#20D9FF' : '#5A6278' }} title="Edit event & command">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => onRemove?.(p.id)} style={{ color: '#FF5C7A' }} title="Remove"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                  <AnimatePresence>
                    {editingId === p.id && (
                      <SlideForm>
                        <PresetEventCommandForm form={editForm} onChange={patchEditForm} />
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="mt-2 w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                          style={{ background: 'rgba(32,217,255,0.15)', color: '#20D9FF', border: '1px solid rgba(32,217,255,0.25)' }}
                        >
                          <Save size={13} /> Save Preset
                        </button>
                      </SlideForm>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5A6278' }}>Add new preset</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openAddForm()}
                  placeholder="Preset name…"
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#D8DCE6' }}
                />
                <button
                  type="button"
                  disabled={!newName.trim()}
                  onClick={() => (addFormOpen ? saveNewPreset() : openAddForm())}
                  className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40 flex items-center gap-1"
                  style={{ background: 'rgba(246,180,75,0.2)', color: '#F6B44B', border: '1px solid rgba(246,180,75,0.3)' }}
                >
                  {addFormOpen ? <><Save size={14} /> Save</> : <><ChevronDown size={14} /> Choose Event</>}
                </button>
              </div>
              <AnimatePresence>
                {addFormOpen && (
                  <SlideForm>
                    <PresetEventCommandForm form={addForm} onChange={patchAddForm} />
                    <button
                      type="button"
                      onClick={saveNewPreset}
                      className="mt-2 w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                      style={{ background: 'rgba(246,180,75,0.2)', color: '#F6B44B', border: '1px solid rgba(246,180,75,0.35)' }}
                    >
                      <Plus size={13} /> Add Preset
                    </button>
                  </SlideForm>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
