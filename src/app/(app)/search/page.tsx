"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DraggableTaskItem } from "@/components/tasks/draggable-task-item";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { useTranslations } from "@/lib/i18n";
import { useAppData } from "@/components/providers/app-data-provider";
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";

export default function SearchPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const { allTasks, loading } = useAppData();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    return allTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        (task.notes && task.notes.toLowerCase().includes(q)),
    );
  }, [query, allTasks]);

  const taskIds = useMemo(() => results.map((t) => t.id), [results]);

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
            <Search className="h-7 w-7 text-blue-500" />
            {t("pages.searchResults")}
          </h1>
          {query && (
            <p className="text-muted-foreground mt-1 text-sm">
              &ldquo;{query}&rdquo; &mdash; {results.length}{" "}
              {results.length === 1 ? "result" : "results"}
            </p>
          )}
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <p className="text-muted-foreground text-sm">
              {query ? t("sidebar.noResults") : t("sidebar.searchPlaceholder")}
            </p>
          </div>
        ) : (
          <TaskSelectionProvider taskIds={taskIds}>
            <div className="flex-1 overflow-auto">
              <div className="space-y-0.5">
                {results.map((task) => (
                  <DraggableTaskItem key={task.id} task={task} showListName />
                ))}
              </div>
            </div>
          </TaskSelectionProvider>
        )}
      </div>
    </ResizableTaskLayout>
  );
}
