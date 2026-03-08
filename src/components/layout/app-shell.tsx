"use client";

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { Panel, Group, Separator, useDefaultLayout } from "react-resizable-panels";
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

function DesktopLayout({ children }: { children: ReactNode }) {
  const layoutProps = useDefaultLayout({
    id: "sidebar-layout",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  return (
    <Group
      orientation="horizontal"
      defaultLayout={layoutProps.defaultLayout ?? { sidebar: 22, main: 78 }}
      onLayoutChanged={layoutProps.onLayoutChanged}
    >
      <Panel id="sidebar" minSize={14} maxSize={30}>
        <Sidebar />
      </Panel>
      <Separator className="hover:bg-primary/10 active:bg-primary/20 w-1.5 cursor-col-resize transition-colors">
        <div className="bg-border mx-auto h-8 w-0.5 rounded-full" />
      </Separator>
      <Panel id="main" minSize={50}>
        <div className="flex flex-1 flex-col overflow-hidden h-full">
          <OfflineIndicator />
          <main className="flex flex-1 overflow-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </Panel>
    </Group>
  );
}

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
                <DesktopLayout>{children}</DesktopLayout>
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
