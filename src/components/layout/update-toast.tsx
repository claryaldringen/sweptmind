"use client";

import { useEffect } from "react";

export function UpdateToast() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function activateWorker(worker: ServiceWorker) {
      worker.postMessage({ type: "SKIP_WAITING" });
    }

    function trackInstalling(worker: ServiceWorker) {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          activateWorker(worker);
        }
      });
    }

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        activateWorker(reg.waiting);
      }

      if (reg.installing) {
        trackInstalling(reg.installing);
      }

      reg.addEventListener("updatefound", () => {
        if (reg.installing) trackInstalling(reg.installing);
      });

      reg.update().catch(() => {});

      function handleVisibility() {
        if (document.visibilityState === "visible") {
          reg.update().catch(() => {});
        }
      }
      document.addEventListener("visibilitychange", handleVisibility);

      return () => document.removeEventListener("visibilitychange", handleVisibility);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  return null;
}
