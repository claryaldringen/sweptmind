"use client";

import { useEffect } from "react";
import { getLocationAdapter, type Platform } from "@sweptmind/native-bridge";

/**
 * Listens for geofence transition events when the app is in the foreground.
 * Optionally reports to the server for analytics and cross-device sync.
 * Local notifications are handled natively by the OS (no need for this hook).
 */
export function useGeofenceEvents(platform: Platform) {
  useEffect(() => {
    if (platform !== "ios" && platform !== "android") return;

    const adapter = getLocationAdapter();
    const unsub = adapter.onGeofenceEvent(async (event) => {
      if (event.type === "enter") {
        try {
          await fetch("/api/location/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locationId: event.fenceId.replace("location:", ""),
              type: event.type,
              position: event.position,
            }),
          });
        } catch {
          // Offline — local notification was already shown by native code
        }
      }
    });

    return unsub;
  }, [platform]);
}
