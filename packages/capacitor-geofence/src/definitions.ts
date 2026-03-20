export interface GeofencePlugin {
  addGeofences(options: { geofences: GeofenceConfig[] }): Promise<void>;
  removeGeofences(options: { identifiers: string[] }): Promise<void>;
  removeAllGeofences(): Promise<void>;
  getMonitoredGeofences(): Promise<{ geofences: MonitoredGeofence[] }>;
  requestAlwaysPermission(): Promise<{ status: PermissionStatus }>;
  getPermissionStatus(): Promise<{
    status: PermissionStatus | "notDetermined";
  }>;
  addListener(
    eventName: "geofenceTransition",
    callback: (event: GeofenceTransitionEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export interface GeofenceConfig {
  identifier: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
  notificationTitle?: string;
  notificationBody?: string;
}

export interface MonitoredGeofence {
  identifier: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface GeofenceTransitionEvent {
  identifier: string;
  type: "enter" | "exit";
  latitude: number;
  longitude: number;
}

export type PermissionStatus = "always" | "whenInUse" | "denied";

import type { PluginListenerHandle } from "@capacitor/core";
