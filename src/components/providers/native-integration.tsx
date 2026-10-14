"use client";

import { useClientSettingsSync } from "@/hooks/use-client-settings-sync";
import { useNativePush } from "@/hooks/use-native-push";
import { useGeofenceSync, useGeofenceNotificationTaps } from "@/hooks/use-geofence-sync";

/** Background integrations of the signed-in app: notifications and location reminders. */
export function NativeIntegration() {
  useClientSettingsSync();
  useNativePush();
  useGeofenceSync();
  useGeofenceNotificationTaps();
  return null;
}
