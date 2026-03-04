"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { CalendarDays } from "lucide-react";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { useTranslations } from "@/lib/i18n";

const PLANNED_TASKS = gql`
  query PlannedTasks {
    plannedTasks {
      id
      listId
      locationId
      title
      notes
      isCompleted
      dueDate
      reminderAt
      recurrence
      sortOrder
      createdAt
      steps {
        id
        taskId
        title
        isCompleted
        sortOrder
      }
      tags {
        id
        name
        color
      }
      location {
        id
        name
        latitude
        longitude
      }
      list {
        id
        name
      }
    }
  }
`;

interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface PlannedTask {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  sortOrder: number;
  createdAt: string;
  steps: Step[];
  list: { id: string; name: string } | null;
}

interface PlannedTasksData {
  plannedTasks: PlannedTask[];
}

export default function PlannedPage() {
  const { t } = useTranslations();
  const { data, loading } = useQuery<PlannedTasksData>(PLANNED_TASKS);
  const tasks = data?.plannedTasks ?? [];

  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col">
        <div className="px-6 pt-8 pb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarDays className="h-7 w-7 text-green-500" />
            {t("pages.planned")}
          </h1>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : (
          <TaskList tasks={tasks} showListName />
        )}
      </div>
      <TaskDetailPanel />
    </div>
  );
}
