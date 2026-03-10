"use client";

import { useMemo } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { useDeviceContext } from "@/hooks/use-device-context";
import { useNearby } from "@/components/providers/nearby-provider";
import { TaskList } from "@/components/tasks/task-list";
import { isFutureTask } from "@/domain/services/task-visibility";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { useAppData } from "@/components/providers/app-data-provider";

export default function ContextPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const deviceContext = useDeviceContext();
  const { isNearby } = useNearby();
  const { allTasks, lists, tags, loading } = useAppData();

  const tasks = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Helper: is this list nearby (using its own locationRadius)?
    function isListNearby(l: (typeof lists)[0]): boolean {
      if (!l.location) return false;
      return isNearby(l.location.latitude, l.location.longitude, l.locationRadius ?? l.location.radius);
    }

    // Helper: is this tag nearby (using its own locationRadius)?
    function isTagNearby(tg: (typeof tags)[0]): boolean {
      if (!tg.location) return false;
      return isNearby(tg.location.latitude, tg.location.longitude, tg.locationRadius ?? tg.location.radius);
    }

    const contextListIds = new Set(
      lists
        .filter(
          (l) =>
            (deviceContext && l.deviceContext === deviceContext) ||
            isListNearby(l),
        )
        .map((l) => l.id),
    );
    const contextTagIds = new Set(
      tags
        .filter(
          (t) =>
            (deviceContext && t.deviceContext === deviceContext) ||
            isTagNearby(t),
        )
        .map((t) => t.id),
    );

    const filtered = allTasks.filter((task) => {
      if (task.isCompleted) return false;
      if (isFutureTask(task)) return false;
      if (deviceContext && task.deviceContext === deviceContext) return true;
      if (
        task.location &&
        isNearby(task.location.latitude, task.location.longitude, task.locationRadius ?? task.location.radius)
      )
        return true;
      if (contextListIds.has(task.listId)) return true;
      if (task.tags?.some((t) => contextTagIds.has(t.id))) return true;
      return false;
    });

    // Helper: does task match nearby location (directly, via list, or via tag)?
    function hasLocation(task: (typeof filtered)[0]): boolean {
      if (
        task.location &&
        isNearby(task.location.latitude, task.location.longitude, task.locationRadius ?? task.location.radius)
      )
        return true;
      if (contextListIds.has(task.listId) && lists.find((l) => l.id === task.listId)?.locationId)
        return true;
      if (task.tags?.some((t) => contextTagIds.has(t.id) && tags.find((tg) => tg.id === t.id)?.locationId))
        return true;
      return false;
    }

    // Helper: does task match device context?
    function hasDevice(task: (typeof filtered)[0]): boolean {
      if (deviceContext && task.deviceContext === deviceContext) return true;
      if (contextListIds.has(task.listId) && lists.find((l) => l.id === task.listId)?.deviceContext === deviceContext)
        return true;
      if (task.tags?.some((t) => contextTagIds.has(t.id) && tags.find((tg) => tg.id === t.id)?.deviceContext === deviceContext))
        return true;
      return false;
    }

    // Sort priority: 0=overdue, 1=today, 2=location AND device, 3=location OR device
    function sortPriority(task: (typeof filtered)[0]): number {
      const dateStr = task.dueDate?.slice(0, 10);
      if (dateStr && dateStr < todayStr) return 0; // overdue
      if (dateStr && dateStr === todayStr) return 1; // today
      const loc = hasLocation(task);
      const dev = hasDevice(task);
      if (loc && dev) return 2; // location AND device
      return 3; // location OR device
    }

    return filtered.sort((a, b) => sortPriority(a) - sortPriority(b));
  }, [allTasks, lists, tags, deviceContext, isNearby]);

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
            <Zap className="h-7 w-7 text-yellow-500" />
            {t("context.hereAndNow")}
          </h1>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
            <Zap className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-center text-sm">{t("context.noContext")}</p>
          </div>
        ) : (
          <TaskList tasks={tasks} showListName />
        )}
      </div>
    </ResizableTaskLayout>
  );
}
