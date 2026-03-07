"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskItem } from "./task-item";
import { isFutureTask } from "@/domain/services/task-visibility";
import { useTranslations } from "@/lib/i18n";

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
  const activeTasks = tasks.filter((t) => !t.isCompleted && !isFutureTask(t));
  const futureTasks = tasks
    .filter((t) => isFutureTask(t))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const [futureOpen, setFutureOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <div className="flex-1 overflow-auto">
      <div className="space-y-0.5">
        {activeTasks.map((task) => (
          <TaskItem key={task.id} task={task} showListName={showListName} />
        ))}
      </div>
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
                <TaskItem key={task.id} task={task} showListName={showListName} />
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
                <TaskItem key={task.id} task={task} showListName={showListName} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
