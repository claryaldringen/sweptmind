"use client";

import { useEffect, useRef } from "react";
import {
  getLocationAdapter,
  type GeofenceRegistration,
  type Platform,
} from "@sweptmind/native-bridge";
import type { AppTask, LocationItem } from "@/components/providers/app-data-provider";

/**
 * Synchronizes native OS geofences with user's task locations.
 * Registers a geofence for each location that has at least one active (non-completed) task.
 * Includes notification title/body for local notifications shown by the OS
 * even when the app is not running.
 */
export function useGeofenceSync(
  locations: LocationItem[],
  allTasks: AppTask[],
  platform: Platform,
) {
  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    if (platform !== "ios" && platform !== "android") return;

    // Filter to locations that have at least one active task
    const tasksWithLocation = allTasks.filter((t) => t.locationId && !t.isCompleted);

    const activeLocationIds = new Set(tasksWithLocation.map((t) => t.locationId!));

    const activeLocations = locations.filter((loc) => activeLocationIds.has(loc.id));

    // Build registrations
    const registrations: GeofenceRegistration[] = activeLocations.map((loc) => {
      const tasks = tasksWithLocation.filter((t) => t.locationId === loc.id);
      const body = tasks.length === 1 ? tasks[0].title : `${tasks[0].title} (+${tasks.length - 1})`;

      return {
        identifier: `location:${loc.id}`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusMeters: Math.max(loc.radius * 1000, 200),
        notificationTitle: loc.name,
        notificationBody: body,
      };
    });

    // Avoid re-syncing if nothing changed (compare serialized keys)
    const key = registrations
      .map((r) => `${r.identifier}:${r.notificationBody}`)
      .sort()
      .join("|");
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    const adapter = getLocationAdapter();
    adapter.syncGeofences(registrations);
  }, [locations, allTasks, platform]);
}
