"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { SortableTaskItem } from "./sortable-task-item";
import { isFutureTask } from "@/domain/services/task-visibility";
import { useTranslations } from "@/lib/i18n";
import { useTaskDnd } from "@/components/providers/task-dnd-provider";

const REORDER_TASKS = gql`
  mutation ReorderTasks($input: [ReorderTaskInput!]!) {
    reorderTasks(input: $input)
  }
`;

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  sortOrder: number;
  list?: { id: string; name: string } | null;
  steps?: { id: string; isCompleted: boolean }[];
}

interface SortableTaskListProps {
  tasks: Task[];
  showListName?: boolean;
  showCompleted?: boolean;
}

export function SortableTaskList({
  tasks,
  showListName = false,
  showCompleted = true,
}: SortableTaskListProps) {
  const { t } = useTranslations();
  const { registerTaskReorder } = useTaskDnd();
  const activeTasks = tasks.filter((t) => !t.isCompleted && !isFutureTask(t));
  const futureTasks = tasks
    .filter((t) => isFutureTask(t))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const [orderedIds, setOrderedIds] = useState(() => activeTasks.map((t) => t.id));
  const [futureOpen, setFutureOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Keep ordered IDs in sync with prop changes (new/removed tasks)
  const activeIds = activeTasks.map((t) => t.id);
  if (orderedIds.length !== activeIds.length || orderedIds.some((id, i) => id !== activeIds[i])) {
    setOrderedIds(activeIds);
  }

  // Build render list: order from orderedIds, data from activeTasks (latest from cache)
  const activeTaskMap = new Map(activeTasks.map((t) => [t.id, t]));
  const items = orderedIds
    .map((id) => activeTaskMap.get(id))
    .filter((t): t is Task => t != null);

  const [reorderTasks] = useMutation(REORDER_TASKS);

  const handleTaskReorder = useCallback(
    (activeId: string, overId: string) => {
      const oldIndex = orderedIds.indexOf(activeId);
      const newIndex = orderedIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const newIds = arrayMove(orderedIds, oldIndex, newIndex);
      setOrderedIds(newIds);

      const input = newIds.map((id, i) => ({ id, sortOrder: i }));
      reorderTasks({ variables: { input } });
    },
    [orderedIds, reorderTasks],
  );

  useEffect(() => {
    registerTaskReorder(handleTaskReorder);
  }, [registerTaskReorder, handleTaskReorder]);

  return (
    <div className="flex-1 overflow-auto">
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {items.map((task) => (
            <SortableTaskItem key={task.id} task={task} showListName={showListName} />
          ))}
        </div>
      </SortableContext>

      {futureTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setFutureOpen(!futureOpen)}
            className="text-muted-foreground flex w-full items-center gap-1 px-4 py-2 text-xs font-medium"
          >
            {futureOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {t("tasks.future", { count: futureTasks.length })}
          </button>
          {futureOpen && (
            <div className="space-y-0.5">
              {futureTasks.map((task) => (
                <SortableTaskItem key={task.id} task={task} showListName={showListName} />
              ))}
            </div>
          )}
        </div>
      )}

      {showCompleted && completedTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setCompletedOpen(!completedOpen)}
            className="text-muted-foreground flex w-full items-center gap-1 px-4 py-2 text-xs font-medium"
          >
            {completedOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {t("tasks.completed", { count: completedTasks.length })}
          </button>
          {completedOpen && (
            <div className="space-y-0.5">
              {completedTasks.map((task) => (
                <SortableTaskItem key={task.id} task={task} showListName={showListName} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
