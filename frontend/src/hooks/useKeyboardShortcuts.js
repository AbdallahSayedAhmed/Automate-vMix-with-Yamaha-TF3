import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for fast event operation.
 * N = new rule, Esc = close editor, Ctrl+S = save, / = focus search
 */
export function useKeyboardShortcuts({ onNew, onSave, onClose, onFocusSearch, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;

      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }

      if (isInput && !(e.ctrlKey || e.metaKey)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && onNew) {
        e.preventDefault();
        onNew();
        return;
      }

      if (e.key === '/' && onFocusSearch) {
        e.preventDefault();
        onFocusSearch();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNew, onSave, onClose, onFocusSearch, enabled]);
}
