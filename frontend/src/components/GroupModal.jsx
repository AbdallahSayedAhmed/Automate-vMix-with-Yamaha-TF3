import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X } from 'lucide-react';

const GROUP_COLORS = ['#20D9FF', '#39E58C', '#F6B44B', '#FF5C7A', '#A78BFA', '#FB7185'];

export function GroupModal({ isOpen, form, onChange, onSave, onClose, ruleCount = 0, isEditing = false }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(7,10,15,0.75)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-sheet rounded-2xl w-full max-w-sm p-6"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Layers size={18} style={{ color: '#20D9FF' }} />
                <h3 className="font-bold" style={{ color: '#D8DCE6' }}>
                  {isEditing ? 'Edit Group' : 'Create Group'}
                </h3>
              </div>
              <button type="button" onClick={onClose} style={{ color: '#5A6278' }}><X size={18} /></button>
            </div>

            {!isEditing && (
              <p className="text-xs mb-4" style={{ color: '#8B93A8' }}>
                Grouping {ruleCount} rule{ruleCount !== 1 ? 's' : ''} for easier bulk control during the show.
              </p>
            )}

            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#5A6278' }}>
              Group Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="e.g. Worship Set, Video Segment…"
              autoFocus
              className="w-full rounded-lg px-3 py-2.5 text-sm mb-4 outline-none"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#D8DCE6',
              }}
              onKeyDown={(e) => e.key === 'Enter' && form.name.trim() && onSave()}
            />

            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5A6278' }}>
              Color
            </label>
            <div className="flex gap-2 mb-6 flex-wrap">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    boxShadow: form.color === c ? `0 0 0 2px #070A0F, 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => onChange({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-0"
              />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ color: '#8B93A8' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!form.name.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40"
                style={{ background: 'rgba(32,217,255,0.9)', color: '#070A0F' }}
              >
                {isEditing ? 'Save' : 'Create Group'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
