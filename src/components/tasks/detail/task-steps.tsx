"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  StepSelectionProvider,
  useStepSelectionOptional,
} from "@/components/providers/step-selection-provider";
import { setFocusArea, subscribeFocusArea, getFocusArea } from "@/lib/focus-area";
import { useTranslations } from "@/lib/i18n";

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
import { cn } from "@/lib/utils";

const DELETE_STEPS = gql`
  mutation DeleteSteps($ids: [String!]!) {
    deleteSteps(ids: $ids)
  }
`;

interface StepItem {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface TaskStepsProps {
  steps: StepItem[];
  onAddStep: (title: string) => Promise<void>;
  onToggleStep: (id: string) => void;
  onUpdateStepTitle: (id: string, title: string) => void;
  onDeleteStep: (id: string) => void;
  addStepLabel: string;
}

function StepRow({
  step,
  onToggleStep,
  onUpdateStepTitle,
  onDeleteStep,
}: {
  step: StepItem;
  onToggleStep: (id: string) => void;
  onUpdateStepTitle: (id: string, title: string) => void;
  onDeleteStep: (id: string) => void;
}) {
  const { t } = useTranslations();
  const stepSelection = useStepSelectionOptional();
  const isSelected = stepSelection?.selectedIds.has(step.id) ?? false;
  const focusArea = useSyncExternalStore(subscribeFocusArea, getFocusArea, getFocusArea);
  const stepsHaveFocus = focusArea === "steps";
  const isBulkMode = isSelected && (stepSelection?.selectedIds.size ?? 0) >= 2;
  const [deleteSteps] = useMutation(DELETE_STEPS);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  const handleBulkDelete = () => {
    if (!stepSelection) return;
    const ids = [...stepSelection.selectedIds];
    deleteSteps({
      variables: { ids },
      update(cache) {
        for (const id of ids) {
          cache.evict({ id: cache.identify({ __typename: "Step", id }) });
        }
        cache.gc();
      },
    });
    stepSelection.clear();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={rowRef}
          className={cn(
            "group -mx-1 flex min-w-0 items-center gap-2 rounded-md px-1",
            isSelected && stepsHaveFocus && "bg-accent",
            isSelected && !stepsHaveFocus && "bg-accent/50",
          )}
          onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
          onClick={(e) => {
            setFocusArea("steps");
            if ((e.metaKey || e.ctrlKey || e.shiftKey) && stepSelection) {
              e.preventDefault();
              stepSelection.handleClick(step.id, {
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
              });
            }
          }}
          onContextMenu={() => {
            if (!isSelected && stepSelection) {
              stepSelection.handleClick(step.id, {});
            }
          }}
        >
          <Checkbox
            checked={step.isCompleted}
            onCheckedChange={() => onToggleStep(step.id)}
            className="h-4 w-4 shrink-0 rounded-full"
          />
          <textarea
            defaultValue={step.title}
            rows={1}
            ref={(el) => {
              if (el) el.style.height = el.scrollHeight + "px";
            }}
            onInput={(e) => autoResize(e.currentTarget)}
            onBlur={(e) => {
              const newTitle = e.target.value.trim();
              if (newTitle && newTitle !== step.title) {
                onUpdateStepTitle(step.id, newTitle);
              } else {
                e.target.value = step.title;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                e.currentTarget.value = step.title;
                e.currentTarget.blur();
              }
            }}
            className={cn(
              "min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0 md:text-sm",
              step.isCompleted && "text-muted-foreground line-through",
            )}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
            onClick={() => onDeleteStep(step.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isBulkMode ? (
          <>
            <ContextMenuItem disabled className="text-muted-foreground text-xs">
              {t("bulkSelectedCount", { count: String(stepSelection!.selectedIds.size) })}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" />
              {t("bulkDeleteSteps")}
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem variant="destructive" onClick={() => onDeleteStep(step.id)}>
            <Trash2 className="h-4 w-4" />
            {t("bulkDelete")}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TaskSteps({
  steps,
  onAddStep,
  onToggleStep,
  onUpdateStepTitle,
  onDeleteStep,
  addStepLabel,
}: TaskStepsProps) {
  const [newStepTitle, setNewStepTitle] = useState("");
  const stepIds = useMemo(() => steps.map((s) => s.id), [steps]);

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    const title = newStepTitle.trim();
    if (!title) return;
    setNewStepTitle("");
    await onAddStep(title);
  }

  return (
    <StepSelectionProvider stepIds={stepIds}>
      <div className="space-y-1">
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            onToggleStep={onToggleStep}
            onUpdateStepTitle={onUpdateStepTitle}
            onDeleteStep={onDeleteStep}
          />
        ))}
        <form onSubmit={handleAddStep} className="flex items-center gap-2">
          <Plus className="text-muted-foreground h-4 w-4" />
          <Input
            value={newStepTitle}
            onChange={(e) => setNewStepTitle(e.target.value)}
            placeholder={addStepLabel}
            className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </form>
      </div>
    </StepSelectionProvider>
  );
}
