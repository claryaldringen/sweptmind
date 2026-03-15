"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";

export function useKeyboardShortcuts() {
  const router = useRouter();
  const taskSelection = useTaskSelectionOptional();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape: clear task selection
      if (e.key === "Escape" && taskSelection && taskSelection.selectedIds.size > 0) {
        e.preventDefault();
        taskSelection.clear();
        return;
      }

      // Cmd/Ctrl+A: select all tasks (only when not in input/textarea)
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && taskSelection) {
        e.preventDefault();
        taskSelection.selectAll();
        return;
      }

      // Cmd/Ctrl + number for quick navigation
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            router.push("/planned");
            break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router, taskSelection]);
}
