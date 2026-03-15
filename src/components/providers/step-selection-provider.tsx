"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSelectionBehavior, type SelectionBehavior } from "@/hooks/use-selection-behavior";

const StepSelectionContext = createContext<SelectionBehavior | null>(null);

export function StepSelectionProvider({
  stepIds,
  children,
}: {
  stepIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(stepIds);

  return (
    <StepSelectionContext.Provider value={selection}>{children}</StepSelectionContext.Provider>
  );
}

export function useStepSelection(): SelectionBehavior {
  const ctx = useContext(StepSelectionContext);
  if (!ctx) throw new Error("useStepSelection must be inside StepSelectionProvider");
  return ctx;
}

export function useStepSelectionOptional(): SelectionBehavior | null {
  return useContext(StepSelectionContext);
}
