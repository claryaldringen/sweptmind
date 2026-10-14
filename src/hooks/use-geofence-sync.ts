"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLocationAdapter, getPlatform } from "@sweptmind/native-bridge";
import { useAppData } from "@/components/providers/app-data-provider";
import { useToday } from "@/hooks/use-today";
import { useTranslations } from "@/lib/i18n";
import { buildGeofenceRegistrations } from "@/lib/geofence-registrations";
import { useLocationRemindersEnabled } from "@/lib/native-preferences";

const BODY_MAX_TITLES = 3;

function isNative() {
  const platform = getPlatform();
  return platform === "ios" || platform === "android";
}

/**
 * Keeps OS geofences in sync with places of actionable tasks while location reminders are on.
 * The OS shows the notification itself, even when the app is not running.
 */
export function useGeofenceSync() {
  const { allTasks, lists, tags, locations, loading } = useAppData();
  const enabled = useLocationRemindersEnabled();
  const today = useToday();
  const { t } = useTranslations();
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isNative()) return;
    if (!enabled) {
      prevKeyRef.current = null;
      return;
    }
    if (loading) return;

    const registrations = buildGeofenceRegistrations({
      tasks: allTasks,
      lists,
      tags,
      locations,
      today,
      formatBody: (titles) => {
        const shown = titles.slice(0, BODY_MAX_TITLES).join(", ");
        const rest = titles.length - BODY_MAX_TITLES;
        return rest > 0 ? t("locationReminders.andMore", { titles: shown, count: rest }) : shown;
      },
    });

    const key = JSON.stringify(registrations);
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    getLocationAdapter()
      .syncGeofences(registrations)
      .catch((err) => {
        prevKeyRef.current = null; // retry on the next change
        console.warn("[geofence] sync failed:", err);
      });
  }, [enabled, loading, allTasks, lists, tags, locations, today, t]);
}

/** Opens the page a tapped geofence notification points to. */
export function useGeofenceNotificationTaps() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;
    return getLocationAdapter().onNotificationOpened((url) => {
      if (url.startsWith("/")) router.push(url);
    });
  }, [router]);
}
