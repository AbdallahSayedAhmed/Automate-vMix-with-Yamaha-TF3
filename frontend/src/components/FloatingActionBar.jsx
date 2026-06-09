import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Power, Trash2, X, Unlink, Pencil, CopyPlus, Clipboard, ClipboardPaste } from 'lucide-react';

export function FloatingActionBar({
  count,
  allActive,
  onTogglePower,
  onDelete,
  onDuplicate,
  onCopy,
  onPaste,
  onPasteInto,
  onGroup,
  onEditGroup,
  onUngroup,
  onDuplicateGroup,
  onDismiss,
  showGroup = true,
  showEditGroup = false,
  showUngroup = false,
  showDuplicateGroup = false,
  groupDisabled = false,
  hasClipboard = false,
  canPaste = false,
  canPasteInto = false,
}) {
  return createPortal(
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          className="floating-action-bar"
          style={{ left: '50%', right: 'auto', transform: 'translateX(-50%)' }}
          initial={{ opacity: 0, y: 28, scale: 0.94, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: 20, scale: 0.94, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <span className="text-live-cyan text-xs font-bold tracking-widest px-2 whitespace-nowrap">
            {count} CHECKED
          </span>

          <div className="fab-divider" />

          {onCopy && (
            <button type="button" className="fab-btn" onClick={onCopy} title="Copy to clipboard">
              <Clipboard size={14} /> Copy
            </button>
          )}

          {onPaste && (
            <button
              type="button"
              className="fab-btn"
              onClick={onPaste}
              disabled={!canPaste}
              title="Paste as new rule (below copied rule)"
              style={hasClipboard ? { color: '#20D9FF', borderColor: 'rgba(32,217,255,0.25)' } : undefined}
            >
              <ClipboardPaste size={14} /> Paste New
            </button>
          )}

          {onPasteInto && (
            <button
              type="button"
              className="fab-btn"
              onClick={onPasteInto}
              disabled={!canPasteInto}
              title="Paste settings into selected rule(s) — count must match copied rules"
              style={canPasteInto ? { color: '#F6B44B', borderColor: 'rgba(246,180,75,0.25)' } : undefined}
            >
              <ClipboardPaste size={14} /> Paste Into
            </button>
          )}

          {showEditGroup ? (
            <button type="button" className="fab-btn" onClick={onEditGroup}>
              <Pencil size={14} /> Edit Group
            </button>
          ) : showGroup ? (
            <button type="button" className="fab-btn" onClick={onGroup} disabled={groupDisabled}>
              <Layers size={14} /> Group
            </button>
          ) : null}

          {showUngroup && (
            <button type="button" className="fab-btn" onClick={onUngroup}>
              <Unlink size={14} /> Ungroup
            </button>
          )}

          {showDuplicateGroup && onDuplicateGroup && (
            <button type="button" className="fab-btn" onClick={onDuplicateGroup}>
              <CopyPlus size={14} /> Dup Group
            </button>
          )}

          {onDuplicate && (
            <button
              type="button"
              className="fab-btn"
              onClick={onDuplicate}
              disabled={count !== 1}
              title="Duplicate selected rule"
            >
              <CopyPlus size={14} /> Duplicate
            </button>
          )}

          <button
            type="button"
            className={`fab-btn ${allActive ? 'fab-btn--power-off' : 'fab-btn--power-on'}`}
            onClick={onTogglePower}
          >
            <Power size={14} />
            {allActive ? 'Off' : 'On'}
          </button>

          <button type="button" className="fab-btn fab-btn--delete" onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </button>

          <div className="fab-divider" />

          <button type="button" className="fab-btn" onClick={onDismiss} style={{ padding: '7px 10px' }} aria-label="Clear selection">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
