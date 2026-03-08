"use client";

import { useSearchParams } from "next/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Panel, Group, Separator, useDefaultLayout } from "react-resizable-panels";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import type { ReactNode } from "react";

interface ResizableTaskLayoutProps {
  children: ReactNode;
}

export function ResizableTaskLayout({ children }: ResizableTaskLayoutProps) {
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const taskId = searchParams.get("task");

  const layoutProps = useDefaultLayout({
    id: "detail-panel-layout",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  if (!isDesktop) {
    return (
      <div className="relative flex flex-1">
        {children}
        <TaskDetailPanel />
      </div>
    );
  }

  if (!taskId) {
    return <>{children}</>;
  }

  return (
    <Group
      orientation="horizontal"
      defaultLayout={layoutProps.defaultLayout ?? { content: 65, detail: 35 }}
      onLayoutChanged={layoutProps.onLayoutChanged}
    >
      <Panel id="content" minSize={40}>
        {children}
      </Panel>
      <Separator className="hover:bg-primary/10 active:bg-primary/20 w-1.5 cursor-col-resize transition-colors">
        <div className="bg-border mx-auto h-8 w-0.5 rounded-full" />
      </Separator>
      <Panel id="detail" minSize={20} maxSize={50}>
        <TaskDetailPanel />
      </Panel>
    </Group>
  );
}
