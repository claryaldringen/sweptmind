"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { SortableTaskItem } from "./sortable-task-item";
import { TaskItem } from "./task-item";
import { useTranslations } from "@/lib/i18n";
import { useTaskDnd } from "@/components/providers/task-dnd-provider";
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";
import { useDepartureAnimation } from "@/hooks/use-departure-animation";
import { useTaskAnalysis } from "@/hooks/use-task-analysis";

const GET_ME_FOR_SORTABLE = gql`
  query GetMeForSortableAnalysis {
    me {
      id
      isPremium
    }
  }
`;

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
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
  dependentTaskCount?: number;
  aiAnalysis?: {
    isActionable: boolean;
    suggestion: string | null;
    analyzedTitle: string;
  } | null;
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
  const { data: meData } = useQuery<{ me: { id: string; isPremium: boolean } | null }>(
    GET_ME_FOR_SORTABLE,
  );
  const isPremium = meData?.me?.isPremium ?? false;
  const analyzingIds = useTaskAnalysis(tasks, isPremium);
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
