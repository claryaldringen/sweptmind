"use client";

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { TaskDndProvider } from "@/components/providers/task-dnd-provider";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import { NearbyProvider } from "@/components/providers/nearby-provider";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { useMediaQuery } from "@/hooks/use-media-query";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { UpdateToast } from "@/components/layout/update-toast";

interface SidebarContextType {
  close: () => void;
  open: () => void;
  isDesktop: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  close: () => {},
  open: () => {},
  isDesktop: true,
});
export const useSidebarContext = () => useContext(SidebarContext);

export function AppShell({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 256;
    const saved = localStorage.getItem("sweptmind-sidebar-width");
    return saved ? Number(saved) : 256;
  });
  const close = useCallback(() => setSidebarOpen(false), []);
  const open = useCallback(() => setSidebarOpen(true), []);

  const handleSidebarResize = useCallback((w: number) => {
    setSidebarWidth(w);
    localStorage.setItem("sweptmind-sidebar-width", String(w));
  }, []);

  return (
    <TaskDndProvider>
      <AppDataProvider>
        <NearbyProvider>
          <SidebarContext.Provider value={{ close, open, isDesktop }}>
            <div className="flex h-dvh overflow-hidden">
              {isDesktop ? (
                <>
                  <div className="h-full shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
                    <Sidebar />
                  </div>
                  <ResizeHandle
                    side="left"
                    width={sidebarWidth}
                    onWidthChange={handleSidebarResize}
                    minWidth={200}
                    maxWidth={400}
                  />
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <UpdateToast />
                    <OfflineIndicator />
                    <InstallPrompt />
                    <main className="flex min-w-0 flex-1 overflow-hidden">
                      <ErrorBoundary>{children}</ErrorBoundary>
                    </main>
                  </div>
                </>
              ) : sidebarOpen ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <UpdateToast />
                  <OfflineIndicator />
                  <InstallPrompt />
                  <Sidebar />
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <UpdateToast />
                  <OfflineIndicator />
                  <InstallPrompt />
                  <main className="flex flex-1 overflow-hidden">
                    <ErrorBoundary>{children}</ErrorBoundary>
                  </main>
                </div>
              )}
            </div>
          </SidebarContext.Provider>
        </NearbyProvider>
      </AppDataProvider>
    </TaskDndProvider>
  );
}
