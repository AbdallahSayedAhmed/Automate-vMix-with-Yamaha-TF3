import { useState, useCallback, useRef } from 'react';

const MAX_STACK = 50;

/** @typedef {{ label: string, undo: () => Promise<void> }} UndoEntry */

export function useUndoHistory() {
  const stackRef = useRef(/** @type {UndoEntry[]} */ ([]));
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const push = useCallback((entry) => {
    if (!entry?.undo) return;
    stackRef.current = [...stackRef.current.slice(-(MAX_STACK - 1)), entry];
    bump();
  }, []);

  const peek = stackRef.current.at(-1) ?? null;
  const canUndo = stackRef.current.length > 0;

  const executeUndo = useCallback(async () => {
    const stack = stackRef.current;
    if (!stack.length) return null;
    const entry = stack[stack.length - 1];
    stackRef.current = stack.slice(0, -1);
    bump();
    await entry.undo();
    return entry.label;
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    bump();
  }, []);

  return { push, peek, canUndo, executeUndo, clear, count: stackRef.current.length, version };
};
