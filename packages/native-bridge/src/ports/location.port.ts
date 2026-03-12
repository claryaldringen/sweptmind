import type { Position, GeofenceConfig, GeofenceEvent, TrackingConfig } from "../types";

export interface LocationPort {
  isSupported(): boolean;
  getCurrentPosition(): Promise<Position>;
  startBackgroundTracking(config: TrackingConfig): Promise<void>;
  stopBackgroundTracking(): Promise<void>;
  addGeofence(fence: GeofenceConfig): Promise<void>;
  removeGeofence(id: string): Promise<void>;
  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void;
}
