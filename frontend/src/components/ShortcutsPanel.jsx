import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, RotateCcw, AlertCircle } from 'lucide-react';
import { DEFAULT_SHORTCUTS, findShortcutConflict } from '../hooks/useAppPreferences';

export function ShortcutsPanel({ isOpen, onClose, shortcuts, onUpdate, onReset, showFieldHints, onToggleHints }) {
  const [editingId, setEditingId] = useState(null);
  const [capture, setCapture] = useState('');
  const [error, setError] = useState('');

  const categories = [...new Set(Object.values(shortcuts).map((s) => s.category))];

  const startEdit = (id) => {
    setEditingId(id);
    setCapture('');
    setError('');
  };

  const handleKeyCapture = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
      parts.push(key);
      const keys = parts.join('+');
      setCapture(keys);
      const err = findShortcutConflict(shortcuts, editingId, keys);
      if (err) setError(err);
      else {
        onUpdate(editingId, keys);
        setEditingId(null);
        setCapture('');
        setError('');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4"
          style={{ background: 'rgba(7,10,15,0.8)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-sheet rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            {...(editingId ? { onKeyDown: handleKeyCapture, tabIndex: 0 } : {})}
          >
            <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Keyboard size={18} style={{ color: '#20D9FF' }} />
                <h2 className="font-bold" style={{ color: '#D8DCE6' }}>Keyboard Shortcuts</h2>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onReset} className="text-xs flex items-center gap-1 px-2 py-1 rounded" style={{ color: '#8B93A8' }}>
                  <RotateCcw size={12} /> Reset
                </button>
                <button type="button" onClick={onClose} style={{ color: '#5A6278' }}><X size={18} /></button>
              </div>
            </div>

            <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm" style={{ color: '#8B93A8' }}>Show field & command descriptions</span>
                <input type="checkbox" checked={showFieldHints} onChange={(e) => onToggleHints(e.target.checked)} className="accent-cyan-400" />
              </label>
            </div>

            {editingId && (
              <div className="px-5 py-3 shrink-0 flex items-center gap-2" style={{ background: 'rgba(32,217,255,0.08)', borderBottom: '1px solid rgba(32,217,255,0.15)' }}>
                <span className="text-sm text-live-cyan">Press new key combination…</span>
                {capture && <kbd className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>{capture}</kbd>}
                {error && <span className="text-xs flex items-center gap-1" style={{ color: '#FF5C7A' }}><AlertCircle size={12} />{error}</span>}
                <button type="button" className="ml-auto text-xs" onClick={() => setEditingId(null)} style={{ color: '#8B93A8' }}>Cancel</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#5A6278' }}>{cat}</p>
                  <div className="space-y-1">
                    {Object.values(shortcuts).filter((s) => s.category === cat).map((sc) => (
                      <div key={sc.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <span className="text-sm" style={{ color: '#D8DCE6' }}>{sc.label}</span>
                        <button
                          type="button"
                          onClick={() => startEdit(sc.id)}
                          className="text-xs font-mono px-2 py-1 rounded transition-colors"
                          style={{
                            background: editingId === sc.id ? 'rgba(32,217,255,0.2)' : 'rgba(255,255,255,0.06)',
                            color: editingId === sc.id ? '#20D9FF' : '#8B93A8',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {sc.keys.split('+').map((k) => k.toUpperCase()).join(' + ')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] py-3 shrink-0" style={{ color: '#5A6278' }}>
              Click a shortcut to rebind · Duplicates are blocked
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
