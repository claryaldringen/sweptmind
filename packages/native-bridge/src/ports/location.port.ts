import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  GeofenceRegistration,
  LocationPermissions,
  TrackingConfig,
} from "../types";

export interface LocationPort {
  isSupported(): boolean;
  getCurrentPosition(): Promise<Position>;
  startBackgroundTracking(config: TrackingConfig): Promise<void>;
  stopBackgroundTracking(): Promise<void>;
  addGeofence(fence: GeofenceConfig): Promise<void>;
  removeGeofence(id: string): Promise<void>;
  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void;
  /** Asks for location "always" (and notifications on Android) and returns the result. */
  requestAlwaysPermission(): Promise<LocationPermissions>;
  getPermissionStatus(): Promise<LocationPermissions>;
  /** Opens the app's page in system settings (no-op where unsupported). */
  openAppSettings(): Promise<void>;
  syncGeofences(fences: GeofenceRegistration[]): Promise<void>;
  removeAllGeofences(): Promise<void>;
  /** Fires when the user taps a geofence notification; receives the app path to open. */
  onNotificationOpened(cb: (url: string) => void): () => void;
}
