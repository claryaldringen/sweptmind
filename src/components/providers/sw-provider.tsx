"use client";

import { useEffect } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function SwProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/serwist/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] registered, scope:", reg.scope);

        // Periodically check for updates
        const timer = setInterval(() => {
          reg.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL_MS);

        return () => clearInterval(timer);
      })
      .catch((err) => console.error("[SW] registration failed:", err));
  }, []);

  return null;
}
