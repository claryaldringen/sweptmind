"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { ApolloNextAppProvider } from "@apollo/client-integration-nextjs";
import { makeClient, cacheRestored } from "./client";
import { syncManager, type SyncState } from "./sync-manager";

interface SyncContextType {
  syncState: SyncState;
  pendingCount: number;
}

const SyncContext = createContext<SyncContextType>({
  syncState: "idle",
  pendingCount: 0,
});

export const useSyncState = () => useContext(SyncContext);

function CacheGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    cacheRestored.then(() => setReady(true));
  }, []);

  if (!ready) return null;
  return children;
}

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    return syncManager.subscribe((state, count) => {
      setSyncState(state);
      setPendingCount(count);
    });
  }, []);

  return (
    <SyncContext.Provider value={{ syncState, pendingCount }}>
      <ApolloNextAppProvider makeClient={makeClient}>
        <CacheGate>{children}</CacheGate>
      </ApolloNextAppProvider>
    </SyncContext.Provider>
  );
}
