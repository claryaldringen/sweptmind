"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSelectionBehavior, type SelectionBehavior } from "@/hooks/use-selection-behavior";
import { getFocusArea } from "@/lib/focus-area";

const ListSelectionContext = createContext<SelectionBehavior | null>(null);

export function ListSelectionProvider({
  listIds,
  onBulkDelete,
  children,
}: {
  listIds: string[];
  onBulkDelete?: (ids: string[]) => void;
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(listIds);
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (getFocusArea() !== "sidebar") return;

      // Cmd+Backspace: bulk delete selected items
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace" && selection.selectedIds.size > 0) {
        e.preventDefault();
        onBulkDelete?.([...selection.selectedIds]);
        selection.clear();
        return;
      }

      if (!e.shiftKey) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      // Find current sidebar item in the selectable IDs
      // Could be /lists/<id> or /tags/<id>
      const listMatch = pathname.match(/^\/lists\/(.+)$/);
      const tagMatch = pathname.match(/^\/tags\/(.+)$/);
      const bareId = pathname.slice(1); // "/planned" → "planned"
      const currentId = listMatch?.[1] ?? tagMatch?.[1] ?? (listIds.includes(bareId) ? bareId : null);
      if (!currentId || !listIds.includes(currentId)) return;

      e.preventDefault();

      // Initialize anchor if no selection yet
      if (selection.selectedIds.size === 0) {
        selection.handleClick(currentId, {});
      }

      const direction = e.key === "ArrowDown" ? "down" : "up";
      selection.extendSelection(direction, currentId);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selection, pathname, listIds, onBulkDelete]);

  return (
    <ListSelectionContext.Provider value={selection}>{children}</ListSelectionContext.Provider>
  );
}

export function useListSelection(): SelectionBehavior {
  const ctx = useContext(ListSelectionContext);
  if (!ctx) throw new Error("useListSelection must be inside ListSelectionProvider");
  return ctx;
}

export function useListSelectionOptional(): SelectionBehavior | null {
  return useContext(ListSelectionContext);
}
