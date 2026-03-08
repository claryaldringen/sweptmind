"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import type { ReactNode } from "react";

interface ResizableTaskLayoutProps {
  children: ReactNode;
}

export function ResizableTaskLayout({ children }: ResizableTaskLayoutProps) {
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const taskId = searchParams.get("task");
  const [detailWidth, setDetailWidth] = useState(() => {
    if (typeof window === "undefined") return 400;
    const saved = localStorage.getItem("sweptmind-detail-width");
    return saved ? Number(saved) : 400;
  });

  const handleDetailResize = useCallback((w: number) => {
    setDetailWidth(w);
    localStorage.setItem("sweptmind-detail-width", String(w));
  }, []);

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
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      <ResizeHandle side="right" width={detailWidth} onWidthChange={handleDetailResize} minWidth={280} maxWidth={600} />
      <div className="h-full shrink-0 overflow-hidden" style={{ width: detailWidth }}>
        <TaskDetailPanel />
      </div>
    </div>
  );
}
