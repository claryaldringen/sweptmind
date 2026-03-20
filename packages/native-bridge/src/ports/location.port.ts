import type { Position, GeofenceConfig, GeofenceEvent, GeofenceRegistration, TrackingConfig } from "../types";

export interface LocationPort {
  isSupported(): boolean;
  getCurrentPosition(): Promise<Position>;
  startBackgroundTracking(config: TrackingConfig): Promise<void>;
  stopBackgroundTracking(): Promise<void>;
  addGeofence(fence: GeofenceConfig): Promise<void>;
  removeGeofence(id: string): Promise<void>;
  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void;
  requestAlwaysPermission(): Promise<"always" | "whenInUse" | "denied">;
  getPermissionStatus(): Promise<"always" | "whenInUse" | "denied" | "notDetermined">;
  syncGeofences(fences: GeofenceRegistration[]): Promise<void>;
  removeAllGeofences(): Promise<void>;
}
