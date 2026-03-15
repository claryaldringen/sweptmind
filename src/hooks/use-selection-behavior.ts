import { useCallback, useRef, useState } from "react";

interface ClickModifiers {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

export interface SelectionBehavior {
  selectedIds: Set<string>;
  focusedId: string | null;
  isMultiSelect: boolean;
  handleClick: (id: string, modifiers: ClickModifiers) => void;
  clear: () => void;
  selectAll: () => void;
  removeFromSelection: (ids: string[]) => void;
  moveFocus: (direction: "up" | "down", fallbackId?: string | null) => string | null;
  extendSelection: (direction: "up" | "down", fallbackId?: string | null) => void;
}

export function useSelectionBehavior(orderedIds: string[]): SelectionBehavior {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const anchorRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (id: string, modifiers: ClickModifiers) => {
      const isMeta = modifiers.metaKey || modifiers.ctrlKey;

      if (modifiers.shiftKey) {
        const anchor = anchorRef.current ?? id;
        const anchorIdx = orderedIds.indexOf(anchor);
        const targetIdx = orderedIds.indexOf(id);
        if (anchorIdx === -1 || targetIdx === -1) return;
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        setSelectedIds(new Set(orderedIds.slice(start, end + 1)));
        if (!anchorRef.current) anchorRef.current = id;
      } else if (isMeta) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        anchorRef.current = id;
      } else {
        setSelectedIds(new Set([id]));
        anchorRef.current = id;
      }
      setFocusedId(id);
    },
    [orderedIds],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedId(null);
    anchorRef.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(orderedIds));
  }, [orderedIds]);

  const removeFromSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const moveFocus = useCallback(
    (direction: "up" | "down", fallbackId?: string | null): string | null => {
      if (orderedIds.length === 0) return null;
      const startId = focusedId ?? fallbackId;
      const currentIdx = startId ? orderedIds.indexOf(startId) : -1;
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = direction === "down" ? 0 : orderedIds.length - 1;
      } else {
        nextIdx = direction === "down" ? currentIdx + 1 : currentIdx - 1;
      }
      if (nextIdx < 0 || nextIdx >= orderedIds.length) return null;
      const nextId = orderedIds[nextIdx];
      setFocusedId(nextId);
      setSelectedIds(new Set([nextId]));
      anchorRef.current = nextId;
      return nextId;
    },
    [orderedIds, focusedId],
  );

  const extendSelection = useCallback(
    (direction: "up" | "down", fallbackId?: string | null) => {
      if (orderedIds.length === 0) return;
      const startId = focusedId ?? fallbackId;
      const currentIdx = startId ? orderedIds.indexOf(startId) : -1;
      if (currentIdx === -1) {
        moveFocus(direction, fallbackId);
        return;
      }
      const nextIdx = direction === "down" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= orderedIds.length) return;
      const nextId = orderedIds[nextIdx];
      setFocusedId(nextId);
      // Initialize anchor from current position if not set
      if (!anchorRef.current) {
        anchorRef.current = startId!;
      }
      // Select range from anchor to new focus
      const anchorIdx = orderedIds.indexOf(anchorRef.current);
      if (anchorIdx === -1) return;
      const start = Math.min(anchorIdx, nextIdx);
      const end = Math.max(anchorIdx, nextIdx);
      setSelectedIds(new Set(orderedIds.slice(start, end + 1)));
    },
    [orderedIds, focusedId, moveFocus],
  );

  return {
    selectedIds,
    focusedId,
    isMultiSelect: selectedIds.size >= 2,
    handleClick,
    clear,
    selectAll,
    removeFromSelection,
    moveFocus,
    extendSelection,
  };
}
