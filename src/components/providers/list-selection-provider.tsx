"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSelectionBehavior, type SelectionBehavior } from "@/hooks/use-selection-behavior";

const ListSelectionContext = createContext<SelectionBehavior | null>(null);

export function ListSelectionProvider({
  listIds,
  children,
}: {
  listIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(listIds);

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
