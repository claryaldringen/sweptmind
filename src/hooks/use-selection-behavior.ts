import { useCallback, useRef, useState } from "react";

interface ClickModifiers {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

export interface SelectionBehavior {
  selectedIds: Set<string>;
  isMultiSelect: boolean;
  handleClick: (id: string, modifiers: ClickModifiers) => void;
  clear: () => void;
  selectAll: () => void;
  removeFromSelection: (ids: string[]) => void;
}

export function useSelectionBehavior(orderedIds: string[]): SelectionBehavior {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (id: string, modifiers: ClickModifiers) => {
      const isMeta = modifiers.metaKey || modifiers.ctrlKey;

      if (modifiers.shiftKey && anchorRef.current) {
        const anchorIdx = orderedIds.indexOf(anchorRef.current);
        const targetIdx = orderedIds.indexOf(id);
        if (anchorIdx === -1 || targetIdx === -1) return;
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        setSelectedIds(new Set(orderedIds.slice(start, end + 1)));
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
    },
    [orderedIds],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
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

  return {
    selectedIds,
    isMultiSelect: selectedIds.size >= 2,
    handleClick,
    clear,
    selectAll,
    removeFromSelection,
  };
}
