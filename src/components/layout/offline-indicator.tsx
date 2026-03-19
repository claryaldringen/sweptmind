"use client";

import { useSyncExternalStore } from "react";
import { WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useSyncState } from "@/lib/apollo/provider";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { t } = useTranslations();
  const { syncState, pendingCount } = useSyncState();

  if (isOnline && syncState === "idle") return null;

  if (isOnline && syncState === "syncing") {
    return (
      <div className="bg-blue-500 px-4 py-1.5 text-center text-sm font-medium text-white">
        <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
        {t("common.syncing", { count: pendingCount })}
      </div>
    );
  }

  if (isOnline && syncState === "error") {
    return (
      <div className="bg-red-500 px-4 py-1.5 text-center text-sm font-medium text-white">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        {t("common.syncError")}
      </div>
    );
  }

  return (
    <div className="bg-yellow-500 px-4 py-1.5 text-center text-sm font-medium text-white">
      <WifiOff className="mr-2 inline h-4 w-4" />
      {t("common.offline")}
      {pendingCount > 0 && ` · ${t("common.pendingChanges", { count: pendingCount })}`}
    </div>
  );
}
