"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskItem } from "./task-item";
import { useTranslations } from "@/lib/i18n";
import { useDepartureAnimation } from "@/hooks/use-departure-animation";

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  list?: { id: string; name: string } | null;
  steps?: { id: string; isCompleted: boolean }[];
}

interface TaskListProps {
  tasks: Task[];
  showListName?: boolean;
  showCompleted?: boolean;
}

export function TaskList({ tasks, showListName = false, showCompleted = true }: TaskListProps) {
  const { t } = useTranslations();
  const {
    futureTasks,
    completedTasks,
    departingIds,
    activeWithDeparting,
    listRef,
    futureSectionRef,
  } = useDepartureAnimation(tasks);
  const [futureOpen, setFutureOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <div ref={listRef} className="flex-1 overflow-auto">
      <ul className="space-y-0.5">
        {activeWithDeparting.map((task) =>
          departingIds.has(task.id) ? (
            <li key={task.id} data-departing={task.id} className="animate-fly-to-future">
              <TaskItem task={task} showListName={showListName} />
            </li>
          ) : (
            <li key={task.id}>
              <TaskItem task={task} showListName={showListName} />
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
                  <TaskItem task={task} showListName={showListName} />
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
                  <TaskItem task={task} showListName={showListName} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
