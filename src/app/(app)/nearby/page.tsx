"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, MapPin, MapPinOff } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { TaskList } from "@/components/tasks/task-list";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { useNearby } from "@/components/providers/nearby-provider";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const ALL_TASKS_WITH_LOCATION = gql`
  query AllTasksWithLocation {
    allTasksWithLocation {
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
      blockedByTaskId
      blockedByTaskIsCompleted
      dependentTaskCount
    }
  }
`;

interface NearbyTask {
  id: string;
  listId: string;
  locationId: string | null;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  sortOrder: number;
  createdAt: string;
  location: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  } | null;
  list: { id: string; name: string } | null;
  steps: { id: string; taskId: string; title: string; isCompleted: boolean; sortOrder: number }[];
  tags?: { id: string; name: string; color: string }[];
  blockedByTaskId: string | null;
  blockedByTaskIsCompleted: boolean | null;
  dependentTaskCount: number;
}

interface AllTasksWithLocationData {
  allTasksWithLocation: NearbyTask[];
}

export default function NearbyPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const { isNearby, isTracking, isApproximate, error, startTracking } = useNearby();
  const { data, loading } = useQuery<AllTasksWithLocationData>(ALL_TASKS_WITH_LOCATION);

  const allTasks = data?.allTasksWithLocation ?? [];
  const nearbyTasks = isTracking
    ? allTasks.filter(
        (task) =>
          task.location &&
          isNearby(task.location.latitude, task.location.longitude, task.location.radius),
      )
    : [];

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
