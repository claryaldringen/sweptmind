"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

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

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 px-4 py-1.5 text-center text-sm font-medium text-white">
      <WifiOff className="mr-2 inline h-4 w-4" />
      {t("common.offline")}
    </div>
  );
}
