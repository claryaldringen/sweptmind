"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface TaskActionsProps {
  createdLabel: string;
  onDelete: () => void;
  onClose?: () => void;
  deleteConfirmTitle: string;
  deleteConfirmDesc: string;
  deleteConfirmCancel: string;
  deleteConfirmAction: string;
}

export function TaskActions({
  createdLabel,
  onDelete,
  onClose,
  deleteConfirmTitle,
  deleteConfirmDesc,
  deleteConfirmCancel,
  deleteConfirmAction,
}: TaskActionsProps) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <div className="flex items-center gap-2">
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <span className="text-muted-foreground text-xs">{createdLabel}</span>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Trash2 className="text-muted-foreground h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{deleteConfirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              {deleteConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
