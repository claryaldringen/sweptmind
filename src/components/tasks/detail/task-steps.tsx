"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
import { cn } from "@/lib/utils";

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

export function TaskSteps({
  steps,
  onAddStep,
  onToggleStep,
  onUpdateStepTitle,
  onDeleteStep,
  addStepLabel,
}: TaskStepsProps) {
  const [newStepTitle, setNewStepTitle] = useState("");

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    const title = newStepTitle.trim();
    if (!title) return;
    setNewStepTitle("");
    await onAddStep(title);
  }

  return (
    <div className="space-y-1">
      {steps.map((step) => (
        <div key={step.id} className="group flex min-w-0 items-center gap-2">
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
  );
}
