"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSelectionBehavior, type SelectionBehavior } from "@/hooks/use-selection-behavior";

const TaskSelectionContext = createContext<SelectionBehavior | null>(null);

export function TaskSelectionProvider({
  taskIds,
  children,
}: {
  taskIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(taskIds);

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
