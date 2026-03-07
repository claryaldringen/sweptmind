"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, Zap } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { useDeviceContext } from "@/hooks/use-device-context";
import { useNearby } from "@/components/providers/nearby-provider";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const CONTEXT_TASKS = gql`
  query ContextTasks($deviceContext: String, $nearbyLocationIds: [String!]) {
    contextTasks(deviceContext: $deviceContext, nearbyLocationIds: $nearbyLocationIds) {
      id
      listId
      locationId
      title
      notes
      isCompleted
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
      list {
        id
        name
      }
      location {
        id
        name
        latitude
        longitude
      }
    }
  }
`;

interface ContextTask {
  id: string;
  listId: string;
  locationId: string | null;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence: string | null;
  deviceContext: string | null;
  sortOrder: number;
  createdAt: string;
  steps: { id: string; taskId: string; title: string; isCompleted: boolean; sortOrder: number }[];
  tags: { id: string; name: string; color: string }[];
  list: { id: string; name: string } | null;
  location: { id: string; name: string; latitude: number; longitude: number } | null;
}

interface ContextTasksData {
  contextTasks: ContextTask[];
}

export default function ContextPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const deviceContext = useDeviceContext();
  const { nearbyLocationIds } = useNearby();
  const { data, loading } = useQuery<ContextTasksData>(CONTEXT_TASKS, {
    variables: { deviceContext, nearbyLocationIds: nearbyLocationIds ?? [] },
  });

  const tasks = data?.contextTasks ?? [];

  return (
    <div className="relative flex flex-1">
      <div className="flex flex-1 flex-col">
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
      <TaskDetailPanel />
    </div>
  );
}
