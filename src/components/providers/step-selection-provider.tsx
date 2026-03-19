"use client";

import { createContext, useContext, useEffect, useCallback, type ReactNode } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useSelectionBehavior, type SelectionBehavior } from "@/hooks/use-selection-behavior";
import { getFocusArea, setFocusArea, registerStepsFocusCallback } from "@/lib/focus-area";

const DELETE_STEPS = gql`
  mutation DeleteSteps($ids: [String!]!) {
    deleteSteps(ids: $ids)
  }
`;

const StepSelectionContext = createContext<SelectionBehavior | null>(null);

export function StepSelectionProvider({
  stepIds,
  children,
}: {
  stepIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(stepIds);
  const [deleteSteps] = useMutation(DELETE_STEPS);

  const focusFirstStep = useCallback(() => {
    if (stepIds.length === 0) return false;
    selection.moveFocus("down");
    return true;
  }, [stepIds, selection]);

  useEffect(() => {
    return registerStepsFocusCallback(focusFirstStep);
  }, [focusFirstStep]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (getFocusArea() !== "steps") return;

      // ArrowLeft: return focus to tasks
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selection.clear();
        setFocusArea("tasks");
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const direction = e.key === "ArrowDown" ? "down" : "up";
        if (e.shiftKey) {
          selection.extendSelection(direction);
        } else {
          selection.moveFocus(direction);
        }
        return;
      }

      if (e.key === "Escape" && selection.selectedIds.size > 0) {
        e.preventDefault();
        selection.clear();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selection.selectAll();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace" && selection.selectedIds.size > 0) {
        e.preventDefault();
        const ids = [...selection.selectedIds];
        deleteSteps({
          variables: { ids },
          update(cache) {
            for (const id of ids) {
              cache.evict({ id: cache.identify({ __typename: "Step", id }) });
            }
            cache.gc();
          },
        });
        selection.clear();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selection, deleteSteps]);

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
