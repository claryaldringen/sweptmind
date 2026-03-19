"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export function UpdateToast() {
  const { t } = useTranslations();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function trackInstalling(worker: ServiceWorker) {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    }

    navigator.serviceWorker.ready.then((reg) => {
      // Check if there's already a waiting worker
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
      }

      // Check if a SW is currently being installed (updatefound already fired)
      if (reg.installing) {
        trackInstalling(reg.installing);
      }

      // Listen for new workers entering waiting state
      reg.addEventListener("updatefound", () => {
        if (reg.installing) trackInstalling(reg.installing);
      });

      // Force an update check now
      reg.update().catch(() => {});

      // Check for updates whenever the app returns to foreground
      function handleVisibility() {
        if (document.visibilityState === "visible") {
          reg.update().catch(() => {});
        }
      }
      document.addEventListener("visibilitychange", handleVisibility);

      return () => document.removeEventListener("visibilitychange", handleVisibility);
    });

    // Reload when the new SW takes over
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, [waitingWorker]);

  if (!waitingWorker) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-1.5 text-center text-sm font-medium">
      <RefreshCw className="mr-2 inline h-4 w-4" />
      {t("pwa.updateAvailable")}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleUpdate}
        className="ml-3 h-6 px-2 text-xs"
      >
        {t("pwa.updateAction")}
      </Button>
    </div>
  );
}
