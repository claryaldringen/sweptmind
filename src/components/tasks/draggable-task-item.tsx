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
}

interface DraggableTaskItemProps {
  task: Task;
  showListName?: boolean;
}

export function DraggableTaskItem({ task, showListName }: DraggableTaskItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task", title: task.title },
  });

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.5 : 1 }} {...attributes} {...listeners}>
      <TaskItem task={task} showListName={showListName} />
    </div>
  );
}
