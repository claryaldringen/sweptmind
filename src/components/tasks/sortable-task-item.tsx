"use client";

import { useSortable } from "@dnd-kit/sortable";
import { useDndContext } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TaskItem } from "./task-item";
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  list?: { id: string; name: string } | null;
  steps?: { id: string; isCompleted: boolean }[];
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
  dependentTaskCount?: number;
  aiAnalysis?: {
    isActionable: boolean;
    suggestion: string | null;
    analyzedTitle: string;
  } | null;
}

interface SortableTaskItemProps {
  task: Task;
  showListName?: boolean;
  analyzingTaskIds?: Set<string>;
}

export function SortableTaskItem({ task, showListName, analyzingTaskIds }: SortableTaskItemProps) {
  const taskSelection = useTaskSelectionOptional();
  const isSelected = taskSelection?.selectedIds.has(task.id) ?? false;
  const selectedCount = isSelected ? (taskSelection?.selectedIds.size ?? 1) : 1;
  const selectedIds = isSelected ? [...(taskSelection?.selectedIds ?? [])] : [task.id];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", title: task.title, selectedCount, selectedIds },
  });

  const { active } = useDndContext();
  const isDraggedElsewhere = active != null && String(active.id) !== task.id && isSelected;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isDraggedElsewhere ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskItem task={task} showListName={showListName} analyzingTaskIds={analyzingTaskIds} />
    </div>
  );
}
