import type { PluginListenerHandle } from "@capacitor/core";

export interface GeofencePlugin {
  /** Atomically replaces all monitored geofences (Android only). */
  setGeofences(options: { geofences: GeofenceConfig[] }): Promise<void>;
  addGeofences(options: { geofences: GeofenceConfig[] }): Promise<void>;
  removeGeofences(options: { identifiers: string[] }): Promise<void>;
  removeAllGeofences(): Promise<void>;
  getMonitoredGeofences(): Promise<{ geofences: MonitoredGeofence[] }>;
  /** Requests foreground location, then background location, then notifications (Android). */
  requestAlwaysPermission(): Promise<PermissionResult>;
  getPermissionStatus(): Promise<PermissionResult>;
  /** Opens the app's system settings (Android only). */
  openAppSettings(): Promise<void>;
  addListener(
    eventName: "geofenceTransition",
    callback: (event: GeofenceTransitionEvent) => void,
  ): Promise<PluginListenerHandle>;
  /** Fired when the user taps a geofence notification (Android). */
  addListener(
    eventName: "notificationOpened",
    callback: (event: NotificationOpenedEvent) => void,
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
  /** App path opened when the notification is tapped (default /nearby). */
  notificationUrl?: string;
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

export interface NotificationOpenedEvent {
  url: string;
}

export type PermissionStatus = "always" | "whenInUse" | "denied";

export interface PermissionResult {
  status: PermissionStatus | "notDetermined";
  /** Whether the app may post notifications (Android; absent on iOS). */
  notifications?: "granted" | "denied";
}
