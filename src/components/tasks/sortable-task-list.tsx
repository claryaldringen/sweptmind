"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { SortableTaskItem } from "./sortable-task-item";
import { TaskItem } from "./task-item";
import { useTranslations } from "@/lib/i18n";
import { useTaskDnd } from "@/components/providers/task-dnd-provider";
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";
import { useDepartureAnimation } from "@/hooks/use-departure-animation";
import { useTaskAnalysis } from "@/hooks/use-task-analysis";
import { useIsPremium } from "@/hooks/use-is-premium";
import { useAppData } from "@/components/providers/app-data-provider";
import type { Task } from "./types";

const REORDER_TASKS = gql`
  mutation ReorderTasks($input: [ReorderTaskInput!]!) {
    reorderTasks(input: $input)
  }
`;

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
  const { isPremium, aiEnabled } = useIsPremium();
  const { allTasks, conflictingTaskIds } = useAppData();
  const analyzingIds = useTaskAnalysis(tasks, isPremium && aiEnabled, allTasks);
  const { registerTaskReorder } = useTaskDnd();
  const {
    activeTasks,
    futureTasks,
    completedTasks,
    departingIds,
    activeWithDeparting,
    listRef,
    futureSectionRef,
  } = useDepartureAnimation(tasks);

  const [orderedIds, setOrderedIds] = useState(() => activeTasks.map((t) => t.id));
  const [futureOpen, setFutureOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Keep ordered IDs in sync — but not while tasks are departing (preserve position)
  const activeIds = useMemo(() => activeWithDeparting.map((t) => t.id), [activeWithDeparting]);

  if (
    departingIds.size === 0 &&
    (orderedIds.length !== activeIds.length || orderedIds.some((id, i) => id !== activeIds[i]))
  ) {
    setOrderedIds(activeIds);
  }

  const activeTaskMap = useMemo(
    () => new Map(activeWithDeparting.map((t) => [t.id, t])),
    [activeWithDeparting],
  );
  const items = orderedIds.map((id) => activeTaskMap.get(id)).filter((t): t is Task => t != null);
  const sortableIds = orderedIds.filter((id) => !departingIds.has(id));

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const [reorderTasks] = useMutation(REORDER_TASKS);

  const handleTaskReorder = useCallback(
    (activeId: string, overId: string) => {
      const oldIndex = orderedIds.indexOf(activeId);
      const newIndex = orderedIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const newIds = arrayMove(orderedIds, oldIndex, newIndex);
      setOrderedIds(newIds);

      const input = newIds.map((id, i) => ({ id, sortOrder: i }));
      reorderTasks({
        variables: { input },
        optimisticResponse: { reorderTasks: true },
        update(cache) {
          for (const { id, sortOrder } of input) {
            cache.modify({
              id: cache.identify({ __typename: "Task", id }),
              fields: { sortOrder: () => sortOrder },
            });
          }
        },
      });
    },
    [orderedIds, reorderTasks],
  );

  useEffect(() => {
    registerTaskReorder(handleTaskReorder);
  }, [registerTaskReorder, handleTaskReorder]);

  return (
    <TaskSelectionProvider taskIds={taskIds}>
      <div ref={listRef} data-task-scroll-container className="flex-1 overflow-auto">
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-0.5">
            {items.map((task) =>
              departingIds.has(task.id) ? (
                <li key={task.id} data-departing={task.id} className="animate-fly-to-future">
                  <TaskItem
                    task={task}
                    showListName={showListName}
                    analyzingTaskIds={analyzingIds}
                  />
                </li>
              ) : (
                <li key={task.id}>
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    showListName={showListName}
                    analyzingTaskIds={analyzingIds}
                  />
                </li>
              ),
            )}
          </ul>
        </SortableContext>

        {futureTasks.length > 0 && (
          <div ref={futureSectionRef} className="mt-4">
            {(() => {
              const futureHasConflict = futureTasks.some((task) => conflictingTaskIds.has(task.id));
              return (
                <button
                  onClick={() => setFutureOpen(!futureOpen)}
                  className={`flex w-full items-center gap-1 px-4 py-2 text-xs font-medium ${futureHasConflict ? "text-red-500" : "text-muted-foreground"}`}
                >
                  {futureOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {t("tasks.future", { count: futureTasks.length })}
                  {futureHasConflict && <AlertTriangle className="h-3.5 w-3.5" />}
                </button>
              );
            })()}
            {futureOpen && (
              <ul className="space-y-0.5">
                {futureTasks.map((task) => (
                  <li key={task.id}>
                    <SortableTaskItem
                      task={task}
                      showListName={showListName}
                      analyzingTaskIds={analyzingIds}
                    />
                  </li>
                ))}
              </ul>
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
              <ul className="space-y-0.5">
                {completedTasks.map((task) => (
                  <li key={task.id}>
                    <SortableTaskItem
                      task={task}
                      showListName={showListName}
                      analyzingTaskIds={analyzingIds}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </TaskSelectionProvider>
  );
}
