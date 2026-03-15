"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DraggableTaskItem } from "@/components/tasks/draggable-task-item";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { useTranslations } from "@/lib/i18n";
import { useAppData, type AppTask } from "@/components/providers/app-data-provider";
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";

type GroupKey = "overdue" | "today" | "tomorrow" | "thisWeek" | "later";

/** Returns the effective date for grouping: dueDate takes priority, then reminderAt. */
function getEffectiveDate(task: AppTask): string | null {
  return task.dueDate?.split("T")[0] ?? task.reminderAt?.split("T")[0] ?? null;
}

function getGroupKey(
  task: AppTask,
  todayStr: string,
  tomorrowStr: string,
  endOfWeekStr: string,
): GroupKey {
  const due = getEffectiveDate(task);
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
  return format(end, "yyyy-MM-dd");
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
  const { allTasks, loading } = useAppData();

  // Compute date strings outside useMemo so they update when the day changes
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = format(tomorrowDate, "yyyy-MM-dd");
  const endOfWeekStr = getEndOfWeek(now);

  const groups = useMemo(() => {
    const plannedTasks = allTasks.filter((t) => t.dueDate != null || t.reminderAt != null);

    const visible = plannedTasks.filter((t) => !t.isCompleted);

    const grouped = new Map<GroupKey, AppTask[]>();
    for (const key of GROUP_ORDER) {
      grouped.set(key, []);
    }

    for (const task of visible) {
      const key = getGroupKey(task, todayStr, tomorrowStr, endOfWeekStr);
      grouped.get(key)!.push(task);
    }

    // Sort tasks within each group by effective date, then sortOrder
    for (const [, items] of grouped) {
      items.sort((a, b) => {
        const dateA = getEffectiveDate(a) ?? "";
        const dateB = getEffectiveDate(b) ?? "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.sortOrder - b.sortOrder;
      });
    }

    return grouped;
  }, [allTasks, todayStr, tomorrowStr, endOfWeekStr]);

  const taskIds = useMemo(() => {
    const ids: string[] = [];
    for (const key of GROUP_ORDER) {
      for (const task of groups.get(key) ?? []) {
        ids.push(task.id);
      }
    }
    return ids;
  }, [groups]);

  const groupLabels: Record<GroupKey, string> = {
    overdue: t("planned.overdue"),
    today: t("planned.today"),
    tomorrow: t("planned.tomorrow"),
    thisWeek: t("planned.thisWeek"),
    later: t("planned.later"),
  };

  return (
    <ResizableTaskLayout>
      <div className="flex h-full flex-1 flex-col">
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
          <TaskSelectionProvider taskIds={taskIds}>
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
          </TaskSelectionProvider>
        )}
      </div>
    </ResizableTaskLayout>
  );
}
