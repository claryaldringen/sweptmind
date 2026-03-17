"use client";

import { createContext, useContext, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { useSelectionBehavior, type SelectionBehavior } from "@/hooks/use-selection-behavior";
import { getFocusArea, setFocusArea, registerTasksFocusCallback } from "@/lib/focus-area";
import { DELETE_TASKS } from "@/graphql/shared/task-mutations";

const TaskSelectionContext = createContext<SelectionBehavior | null>(null);

export function TaskSelectionProvider({
  taskIds,
  children,
}: {
  taskIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(taskIds);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deleteTasks] = useMutation(DELETE_TASKS);

  // When sidebar sends focus to tasks (ArrowRight), focus the first task
  const focusFirstTask = useCallback(() => {
    if (taskIds.length === 0) return;
    const focusedId = selection.moveFocus("down");
    if (!focusedId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", focusedId);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [taskIds, selection, router, searchParams]);

  useEffect(() => {
    return registerTasksFocusCallback(focusFirstTask);
  }, [focusFirstTask]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // ArrowLeft: return focus to sidebar
      if (e.key === "ArrowLeft" && getFocusArea() === "tasks") {
        e.preventDefault();
        selection.clear();
        setFocusArea("sidebar");
        return;
      }

      // ArrowRight: focus steps in detail panel (if open with steps)
      if (e.key === "ArrowRight" && getFocusArea() === "tasks") {
        e.preventDefault();
        setFocusArea("steps");
        return;
      }

      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && getFocusArea() === "tasks") {
        e.preventDefault();
        const direction = e.key === "ArrowDown" ? "down" : "up";
        if (e.shiftKey) {
          selection.extendSelection(direction);
          // Close detail panel on multi-select
          const params = new URLSearchParams(searchParams.toString());
          if (params.has("task")) {
            params.delete("task");
            router.replace(`?${params.toString()}`, { scroll: false });
          }
        } else {
          const nextId = selection.moveFocus(direction, searchParams.get("task"));
          if (nextId) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("task", nextId);
            router.replace(`?${params.toString()}`, { scroll: false });
          }
        }
        return;
      }

      if (e.key === "Escape" && getFocusArea() === "tasks" && selection.selectedIds.size > 0) {
        e.preventDefault();
        selection.clear();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a" && getFocusArea() === "tasks") {
        e.preventDefault();
        selection.selectAll();
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Backspace" &&
        getFocusArea() === "tasks" &&
        selection.selectedIds.size > 0
      ) {
        e.preventDefault();
        const ids = [...selection.selectedIds];
        deleteTasks({
          variables: { ids },
          update(cache) {
            for (const id of ids) {
              cache.evict({ id: cache.identify({ __typename: "Task", id }) });
            }
            cache.gc();
          },
        });
        selection.clear();
        const params = new URLSearchParams(searchParams.toString());
        if (params.has("task")) {
          params.delete("task");
          router.replace(`?${params.toString()}`, { scroll: false });
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selection, router, searchParams, deleteTasks]);

  return (
    <TaskSelectionContext.Provider value={selection}>{children}</TaskSelectionContext.Provider>
  );
}

export function useTaskSelection(): SelectionBehavior {
  const ctx = useContext(TaskSelectionContext);
  if (!ctx) throw new Error("useTaskSelection must be inside TaskSelectionProvider");
  return ctx;
}

export function useTaskSelectionOptional(): SelectionBehavior | null {
  return useContext(TaskSelectionContext);
}
