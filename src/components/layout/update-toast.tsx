"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

async function fetchDeployedBuildId(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return data.buildId ?? null;
  } catch {
    return null;
  }
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration().catch(() => undefined);
}

/**
 * Offers a reload once a newer build is deployed. Compares build ids with the server
 * rather than waiting for a service worker update, which the native app's WebView and
 * installed PWAs don't pick up reliably.
 */
export function UpdateToast() {
  const { t } = useTranslations();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (CLIENT_BUILD_ID === "dev" || available) return;
    let cancelled = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      const deployed = await fetchDeployedBuildId();
      if (cancelled || !deployed || deployed === "dev") return;
      const reg = await getServiceWorkerRegistration();
      if (deployed === CLIENT_BUILD_ID) {
        // The page already runs the deployed build — a waiting worker belongs to it
        reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      setAvailable(true);
      // Let the new service worker install while the banner is shown
      reg?.update().catch(() => {});
    }

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [available]);

  async function handleUpdate() {
    // Navigations are network-first, so a reload loads the new build either way;
    // activating the waiting worker just retires the old precache
    (await getServiceWorkerRegistration())?.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  if (!available) return null;

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
