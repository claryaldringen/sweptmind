import type { LocationPort } from "../../ports/location.port";
import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  GeofenceRegistration,
  TrackingConfig,
} from "../../types";

export class CapacitorLocationAdapter implements LocationPort {
  private geofenceCallbacks: ((event: GeofenceEvent) => void)[] = [];
  private listenerRemoveFn: (() => Promise<void>) | null = null;

  isSupported(): boolean {
    return true;
  }

  async getCurrentPosition(): Promise<Position> {
    const { Geolocation } = await import("@capacitor/geolocation");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  }

  async startBackgroundTracking(_config: TrackingConfig): Promise<void> {
    // No-op — native geofencing handles background monitoring via OS APIs.
    // Continuous GPS tracking is not needed and would drain battery.
  }

  async stopBackgroundTracking(): Promise<void> {
    // No-op — see startBackgroundTracking
  }

  async addGeofence(fence: GeofenceConfig): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    await Geofence.addGeofences({
      geofences: [
        {
          identifier: fence.id,
          latitude: fence.latitude,
          longitude: fence.longitude,
          radiusMeters: Math.max(fence.radiusKm * 1000, 200),
          notifyOnEntry: true,
          notifyOnExit: false,
          notificationTitle: fence.name ?? undefined,
        },
      ],
    });
  }

  async removeGeofence(id: string): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    await Geofence.removeGeofences({ identifiers: [id] });
  }

  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void {
    this.geofenceCallbacks.push(cb);

    // Set up native listener if this is the first callback
    if (this.geofenceCallbacks.length === 1) {
      this.setupNativeListener();
    }

    return () => {
      this.geofenceCallbacks = this.geofenceCallbacks.filter((c) => c !== cb);
      if (this.geofenceCallbacks.length === 0) {
        this.teardownNativeListener();
      }
    };
  }

  async requestAlwaysPermission(): Promise<"always" | "whenInUse" | "denied"> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const result = await Geofence.requestAlwaysPermission();
    return result.status;
  }

  async getPermissionStatus(): Promise<
    "always" | "whenInUse" | "denied" | "notDetermined"
  > {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const result = await Geofence.getPermissionStatus();
    return result.status;
  }

  async syncGeofences(fences: GeofenceRegistration[]): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    await Geofence.removeAllGeofences();
    if (fences.length > 0) {
      await Geofence.addGeofences({
        geofences: fences.map((f) => ({
          identifier: f.identifier,
          latitude: f.latitude,
          longitude: f.longitude,
          radiusMeters: Math.max(f.radiusMeters, 200),
          notifyOnEntry: true,
          notifyOnExit: false,
          notificationTitle: f.notificationTitle,
          notificationBody: f.notificationBody,
        })),
      });
    }
  }

  async removeAllGeofences(): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    await Geofence.removeAllGeofences();
  }

  private async setupNativeListener(): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const handle = await Geofence.addListener(
      "geofenceTransition",
      (event) => {
        const mapped: GeofenceEvent = {
          fenceId: event.identifier,
          type: event.type,
          position: { latitude: event.latitude, longitude: event.longitude },
        };
        this.geofenceCallbacks.forEach((cb) => cb(mapped));
      },
    );
    this.listenerRemoveFn = handle.remove;
  }

  private async teardownNativeListener(): Promise<void> {
    if (this.listenerRemoveFn) {
      await this.listenerRemoveFn();
      this.listenerRemoveFn = null;
    }
  }
}
