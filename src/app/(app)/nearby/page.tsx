"use client";

import { useMemo } from "react";
import { ArrowLeft, MapPin, MapPinOff } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { TaskList } from "@/components/tasks/task-list";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { useNearby } from "@/components/providers/nearby-provider";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { useAppData } from "@/components/providers/app-data-provider";

export default function NearbyPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const { isNearby, isTracking, isApproximate, error, startTracking } = useNearby();
  const { allTasks, loading } = useAppData();

  const nearbyTasks = useMemo(() => {
    if (!isTracking) return [];
    return allTasks.filter(
      (task) =>
        !task.isCompleted &&
        task.location &&
        isNearby(
          task.location.latitude,
          task.location.longitude,
          task.locationRadius ?? task.location.radius,
        ),
    );
  }, [allTasks, isTracking, isNearby]);

  const showPermissionDenied = error && !isTracking;

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
            <MapPin className="h-7 w-7 text-orange-500" />
            {t("pages.nearby")}
          </h1>
          {isTracking && (
            <p className="text-muted-foreground mt-1 text-sm">
              {isApproximate ? t("locations.approximateLocation") : t("locations.trackingActive")} ·{" "}
              {t("locations.nearbyRadius")}
            </p>
          )}
        </div>

        {showPermissionDenied ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <MapPinOff className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-center">{t("locations.permissionDenied")}</p>
            <Button onClick={startTracking}>{t("locations.enableTracking")}</Button>
          </div>
        ) : !isTracking ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <MapPin className="text-muted-foreground h-12 w-12" />
            <Button onClick={startTracking}>{t("locations.enableTracking")}</Button>
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : nearbyTasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
            <MapPin className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-center text-sm">
              {t("locations.nearbyRadius")}
            </p>
          </div>
        ) : (
          <TaskList tasks={nearbyTasks} showListName />
        )}
      </div>
    </ResizableTaskLayout>
  );
}
