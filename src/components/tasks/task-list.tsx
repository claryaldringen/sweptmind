"use client";

import { useState, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskItem } from "./task-item";
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";
import { useTranslations } from "@/lib/i18n";
import { useDepartureAnimation } from "@/hooks/use-departure-animation";
import { useTaskAnalysis } from "@/hooks/use-task-analysis";

const GET_ME = gql`
  query GetMeForAnalysis {
    me {
      id
      isPremium
    }
  }
`;

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

interface TaskListProps {
  tasks: Task[];
  showListName?: boolean;
  showCompleted?: boolean;
}

export function TaskList({ tasks, showListName = false, showCompleted = true }: TaskListProps) {
  const { t } = useTranslations();
  const { data: meData } = useQuery<{ me: { id: string; isPremium: boolean } | null }>(GET_ME);
  const isPremium = meData?.me?.isPremium ?? false;
  const analyzingIds = useTaskAnalysis(tasks, isPremium);
  const {
    futureTasks,
    completedTasks,
    departingIds,
    activeWithDeparting,
    listRef,
    futureSectionRef,
  } = useDepartureAnimation(tasks);
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const [futureOpen, setFutureOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <TaskSelectionProvider taskIds={taskIds}>
      <div ref={listRef} className="flex-1 overflow-auto">
        <ul className="space-y-0.5">
          {activeWithDeparting.map((task) =>
            departingIds.has(task.id) ? (
              <li key={task.id} data-departing={task.id} className="animate-fly-to-future">
                <TaskItem task={task} showListName={showListName} analyzingTaskIds={analyzingIds} />
              </li>
            ) : (
              <li key={task.id}>
                <TaskItem task={task} showListName={showListName} analyzingTaskIds={analyzingIds} />
              </li>
            ),
          )}
        </ul>
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
                    <TaskItem
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
                    <TaskItem
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
