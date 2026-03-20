import type { LocationPort } from "../../ports/location.port";
import type { Position, GeofenceConfig, GeofenceEvent, GeofenceRegistration, TrackingConfig } from "../../types";

export class WebLocationAdapter implements LocationPort {
  private watchId: number | null = null;

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "geolocation" in navigator;
  }

  getCurrentPosition(): Promise<Position> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(new Error(err.message)),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
      );
    });
  }

  async startBackgroundTracking(_config: TrackingConfig): Promise<void> {
    // Web cannot do true background tracking — no-op
  }

  async stopBackgroundTracking(): Promise<void> {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async addGeofence(_fence: GeofenceConfig): Promise<void> {
    throw new Error("Geofencing not supported on web");
  }

  async removeGeofence(_id: string): Promise<void> {
    throw new Error("Geofencing not supported on web");
  }

  onGeofenceEvent(_cb: (event: GeofenceEvent) => void): () => void {
    return () => {};
  }

  async requestAlwaysPermission(): Promise<"always" | "whenInUse" | "denied"> {
    return "denied";
  }

  async getPermissionStatus(): Promise<"always" | "whenInUse" | "denied" | "notDetermined"> {
    return "denied";
  }

  async syncGeofences(_fences: GeofenceRegistration[]): Promise<void> {
    // Geofencing not supported on web — no-op
  }

  async removeAllGeofences(): Promise<void> {
    // Geofencing not supported on web — no-op
  }
}
