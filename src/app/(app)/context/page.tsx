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
  const { nearbyLocationIds } = useNearby();
  const { allTasks, lists, tags, loading } = useAppData();

  const tasks = useMemo(() => {
    const contextListIds = new Set(
      lists
        .filter(
          (l) =>
            (deviceContext && l.deviceContext === deviceContext) ||
            (nearbyLocationIds.length > 0 &&
              l.locationId &&
              nearbyLocationIds.includes(l.locationId)),
        )
        .map((l) => l.id),
    );
    const contextTagIds = new Set(
      tags
        .filter(
          (t) =>
            (deviceContext && t.deviceContext === deviceContext) ||
            (nearbyLocationIds.length > 0 &&
              t.locationId &&
              nearbyLocationIds.includes(t.locationId)),
        )
        .map((t) => t.id),
    );

    return allTasks.filter((task) => {
      if (task.isCompleted) return false;
      if (isFutureTask(task)) return false;
      if (deviceContext && task.deviceContext === deviceContext) return true;
      if (
        nearbyLocationIds.length > 0 &&
        task.locationId &&
        nearbyLocationIds.includes(task.locationId)
      )
        return true;
      if (contextListIds.has(task.listId)) return true;
      if (task.tags?.some((t) => contextTagIds.has(t.id))) return true;
      return false;
    });
  }, [allTasks, lists, tags, deviceContext, nearbyLocationIds]);

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
