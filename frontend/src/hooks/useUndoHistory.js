import { useState, useCallback, useRef } from "react";

const MAX_STACK = 50;

/** @typedef {{ label: string, undo: () => Promise<void> }} UndoEntry */

export function useUndoHistory() {
  const [stack, setStack] = useState([]);
  const stackRef = useRef(/** @type {UndoEntry[]} */ ([]));

  const setStackSnapshot = useCallback((nextStack) => {
    stackRef.current = nextStack;
    setStack(nextStack);
  }, []);

  const push = useCallback(
    (entry) => {
      if (!entry?.undo) return;
      setStackSnapshot([...stackRef.current.slice(-(MAX_STACK - 1)), entry]);
    },
    [setStackSnapshot],
  );

  const executeUndo = useCallback(async () => {
    const currentStack = stackRef.current;
    if (!currentStack.length) return null;

    const entry = currentStack.at(-1);
    setStackSnapshot(currentStack.slice(0, -1));
    await entry.undo();
    return entry.label;
  }, [setStackSnapshot]);

  const clear = useCallback(() => {
    setStackSnapshot([]);
  }, [setStackSnapshot]);

  return {
    push,
    peek: stack.at(-1) ?? null,
    canUndo: stack.length > 0,
    executeUndo,
    clear,
    count: stack.length,
    version: stack.length,
  };
}
