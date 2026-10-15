"use client";

import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteTaskDialog } from "../delete-task-dialog";

interface TaskActionsProps {
  taskId: string;
  createdLabel: string;
  onDelete: (deleteFromCalendar: boolean) => void;
  onClose?: () => void;
}

export function TaskActions({ taskId, createdLabel, onDelete, onClose }: TaskActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <div className="flex items-center gap-2">
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <span className="text-muted-foreground text-xs">{createdLabel}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="text-muted-foreground h-4 w-4" />
      </Button>
      <DeleteTaskDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        taskIds={[taskId]}
        onConfirm={onDelete}
      />
    </div>
  );
}
