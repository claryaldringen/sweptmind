"use client";

import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TaskDndProvider } from "@/components/providers/task-dnd-provider";
import { ListsProvider } from "@/components/providers/lists-provider";
import { NearbyProvider } from "@/components/providers/nearby-provider";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { useMediaQuery } from "@/hooks/use-media-query";
import { OfflineIndicator } from "@/components/layout/offline-indicator";

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
  const close = useCallback(() => setSidebarOpen(false), []);
  const open = useCallback(() => setSidebarOpen(true), []);

  return (
    <TaskDndProvider>
      <ListsProvider>
        <NearbyProvider>
          <SidebarContext.Provider value={{ close, open, isDesktop }}>
            <div className="flex h-dvh overflow-hidden">
              {isDesktop ? (
                <>
                  <Sidebar />
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <OfflineIndicator />
                    <main className="flex flex-1 overflow-hidden">
                      <ErrorBoundary>{children}</ErrorBoundary>
                    </main>
                  </div>
                </>
              ) : sidebarOpen ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <OfflineIndicator />
                  <Sidebar />
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <OfflineIndicator />
                  <main className="flex flex-1 overflow-hidden">
                    <ErrorBoundary>{children}</ErrorBoundary>
                  </main>
                </div>
              )}
            </div>
          </SidebarContext.Provider>
        </NearbyProvider>
      </ListsProvider>
    </TaskDndProvider>
  );
}
