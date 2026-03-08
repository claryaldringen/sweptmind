"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DraggableTaskItem } from "@/components/tasks/draggable-task-item";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
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
      completedAt
      dueDate
      reminderAt
      recurrence
      deviceContext
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
        radius
      }
      list {
        id
        name
      }
    }
  }
`;

interface PlannedTask {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence: string | null;
  sortOrder: number;
  createdAt: string;
  steps: { id: string; taskId: string; title: string; isCompleted: boolean; sortOrder: number }[];
  tags: { id: string; name: string; color: string }[];
  location: { id: string; name: string; latitude: number; longitude: number } | null;
  list: { id: string; name: string } | null;
}

interface PlannedTasksData {
  plannedTasks: PlannedTask[];
}

type GroupKey = "overdue" | "today" | "tomorrow" | "thisWeek" | "later";

function getGroupKey(
  task: PlannedTask,
  todayStr: string,
  tomorrowStr: string,
  endOfWeekStr: string,
): GroupKey {
  const due = task.dueDate?.split("T")[0] ?? null;
  if (!due) return "later";
  if (due < todayStr) return "overdue";
  if (due === todayStr) return "today";
  if (due === tomorrowStr) return "tomorrow";
  if (due <= endOfWeekStr) return "thisWeek";
  return "later";
}

function getEndOfWeek(today: Date): string {
  const end = new Date(today);
  const dayOfWeek = end.getDay();
  // End of week = Sunday (add days to reach next Sunday)
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  end.setDate(end.getDate() + daysUntilSunday);
  return end.toISOString().slice(0, 10);
}

const GROUP_ORDER: GroupKey[] = ["overdue", "today", "tomorrow", "thisWeek", "later"];

const GROUP_COLORS: Record<GroupKey, string> = {
  overdue: "text-red-500",
  today: "text-blue-500",
  tomorrow: "text-foreground",
  thisWeek: "text-foreground",
  later: "text-muted-foreground",
};

export default function PlannedPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const { data, loading } = useQuery<PlannedTasksData>(PLANNED_TASKS);
  const groups = useMemo(() => {
    const allTasks = data?.plannedTasks ?? [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const endOfWeekStr = getEndOfWeek(now);

    const visible = allTasks.filter((t) => !t.isCompleted);

    const grouped = new Map<GroupKey, PlannedTask[]>();
    for (const key of GROUP_ORDER) {
      grouped.set(key, []);
    }

    for (const task of visible) {
      const key = getGroupKey(task, todayStr, tomorrowStr, endOfWeekStr);
      grouped.get(key)!.push(task);
    }

    // Sort tasks within each group by dueDate, then sortOrder
    for (const [, items] of grouped) {
      items.sort((a, b) => {
        const dateA = a.dueDate ?? "";
        const dateB = b.dueDate ?? "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.sortOrder - b.sortOrder;
      });
    }

    return grouped;
  }, [data?.plannedTasks]);

  const groupLabels: Record<GroupKey, string> = {
    overdue: t("planned.overdue"),
    today: t("planned.today"),
    tomorrow: t("planned.tomorrow"),
    thisWeek: t("planned.thisWeek"),
    later: t("planned.later"),
  };

  return (
    <ResizableTaskLayout>
      <div className="flex flex-1 flex-col h-full">
        <div className="px-6 pt-8 pb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {!isDesktop && (
              <Button variant="ghost" size="icon" onClick={openSidebar} className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <CalendarDays className="h-7 w-7 text-green-500" />
            {t("pages.planned")}
          </h1>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {GROUP_ORDER.map((key) => {
              const items = groups.get(key) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="mb-2">
                  <h2
                    className={`px-4 py-2 text-xs font-semibold tracking-wide uppercase ${GROUP_COLORS[key]}`}
                  >
                    {groupLabels[key]}
                  </h2>
                  <div className="space-y-0.5">
                    {items.map((task) => (
                      <DraggableTaskItem key={task.id} task={task} showListName />
                    ))}
                  </div>
                </div>
              );
            })}
            {GROUP_ORDER.every((key) => (groups.get(key) ?? []).length === 0) && (
              <div className="flex flex-1 items-center justify-center py-20">
                <p className="text-muted-foreground text-sm">{t("planned.empty")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </ResizableTaskLayout>
  );
}
