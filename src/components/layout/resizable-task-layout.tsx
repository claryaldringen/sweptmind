"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

  // Keep panel mounted during close animation
  const prevTaskIdRef = useRef<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (taskId) {
      prevTaskIdRef.current = taskId;
      setShowPanel(true);
    } else {
      // Delay unmount until transition finishes
      const timer = setTimeout(() => setShowPanel(false), 200);
      return () => clearTimeout(timer);
    }
  }, [taskId]);

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

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden">{children}</div>
      {showPanel && (
        <>
          <ResizeHandle
            side="right"
            width={detailWidth}
            onWidthChange={handleDetailResize}
            minWidth={280}
            maxWidth={600}
          />
          <div
            className="h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
            style={{ width: taskId ? detailWidth : 0 }}
          >
            <div className="h-full" style={{ width: detailWidth }}>
              <TaskDetailPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
