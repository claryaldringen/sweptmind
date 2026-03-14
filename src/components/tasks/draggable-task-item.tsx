"use client";

import { useDraggable } from "@dnd-kit/core";
import { TaskItem } from "./task-item";

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

interface DraggableTaskItemProps {
  task: Task;
  showListName?: boolean;
  analyzingTaskIds?: Set<string>;
}

export function DraggableTaskItem({
  task,
  showListName,
  analyzingTaskIds,
}: DraggableTaskItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task", title: task.title },
  });

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.5 : 1 }} {...attributes} {...listeners}>
      <TaskItem task={task} showListName={showListName} analyzingTaskIds={analyzingTaskIds} />
    </div>
  );
}
