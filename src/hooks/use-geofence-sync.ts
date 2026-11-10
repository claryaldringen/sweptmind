"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getLocationAdapter,
  getPlatform,
  type GeofenceRegistration,
} from "@sweptmind/native-bridge";
import { useAppData } from "@/components/providers/app-data-provider";
import { useToday } from "@/hooks/use-today";
import { useTranslations } from "@/lib/i18n";
import {
  buildGeofenceRegistrations,
  formatGeofenceBody,
} from "@/domain/services/geofence-registrations";
import { useLocationRemindersEnabled } from "@/lib/native-preferences";

/** Asked by the app before it shows a notification — see the route. */
const VERIFY_PATH = "/api/location/geofences";

let syncQueue: Promise<void> = Promise.resolve();
let latestSyncId = 0;

/**
 * Native syncs replace all geofences in several async steps; run them one at a time and
 * skip superseded ones, so two quick changes can't interleave.
 */
function queueGeofenceSync(registrations: GeofenceRegistration[]): Promise<void> {
  const id = ++latestSyncId;
  const verifyUrl = new URL(VERIFY_PATH, window.location.origin).href;
  const run = syncQueue.then(() =>
    id === latestSyncId
      ? getLocationAdapter().syncGeofences(registrations, { verifyUrl })
      : undefined,
  );
  syncQueue = run.catch(() => {});
  return run;
}

/**
 * Android: keeps OS geofences in sync with places of actionable tasks while location
 * reminders are on, and removes them when off. The OS shows the notification itself,
 * even when the app is not running — after checking the place against the server, since
 * these geofences only change while the app runs.
 */
export function useGeofenceSync() {
  const { allTasks, lists, tags, locations, loading } = useAppData();
  const enabled = useLocationRemindersEnabled();
  const today = useToday();
  const { t } = useTranslations();
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (getPlatform() !== "android") return;

    let registrations: GeofenceRegistration[] = [];
    if (enabled) {
      if (loading) return;
      registrations = buildGeofenceRegistrations({
        tasks: allTasks,
        lists,
        tags,
        locations,
        today,
        formatBody: (titles) =>
          formatGeofenceBody(titles, (shown, count) =>
            t("locationReminders.andMore", { titles: shown, count }),
          ),
      });
    }

    // Disabled = sync an empty set once (removes anything left registered)
    const key = JSON.stringify(registrations);
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    queueGeofenceSync(registrations).catch((err) => {
      prevKeyRef.current = null; // retry on the next change
      console.warn("[geofence] sync failed:", err);
    });
  }, [enabled, loading, allTasks, lists, tags, locations, today, t]);
}

/** Opens the page a tapped geofence notification points to. */
export function useGeofenceNotificationTaps() {
  const router = useRouter();

  useEffect(() => {
    if (getPlatform() !== "android") return;
    return getLocationAdapter().onNotificationOpened((url) => {
      if (url.startsWith("/")) router.push(url);
    });
  }, [router]);
}
