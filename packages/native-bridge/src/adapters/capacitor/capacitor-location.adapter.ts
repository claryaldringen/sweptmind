import type { LocationPort } from "../../ports/location.port";
import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  GeofenceRegistration,
  LocationPermissions,
  TrackingConfig,
} from "../../types";
import { listen } from "./listen";

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

  async requestAlwaysPermission(): Promise<LocationPermissions> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const result = await Geofence.requestAlwaysPermission();
    return { location: result.status, notifications: result.notifications };
  }

  async getPermissionStatus(): Promise<LocationPermissions> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const result = await Geofence.getPermissionStatus();
    return { location: result.status, notifications: result.notifications };
  }

  async openAppSettings(): Promise<void> {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") return;
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    await Geofence.openAppSettings();
  }

  async syncGeofences(fences: GeofenceRegistration[]): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const { Capacitor } = await import("@capacitor/core");
    const geofences = fences.map((f) => ({
      identifier: f.identifier,
      latitude: f.latitude,
      longitude: f.longitude,
      radiusMeters: Math.max(f.radiusMeters, 200),
      notifyOnEntry: true,
      notifyOnExit: false,
      notificationTitle: f.notificationTitle,
      notificationBody: f.notificationBody,
      notificationUrl: f.notificationUrl,
    }));

    if (Capacitor.getPlatform() === "android") {
      // Atomic replace — removal can't race with the new registrations
      await Geofence.setGeofences({ geofences });
      return;
    }
    await Geofence.removeAllGeofences();
    if (geofences.length > 0) {
      await Geofence.addGeofences({ geofences });
    }
  }

  async removeAllGeofences(): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    await Geofence.removeAllGeofences();
  }

  onNotificationOpened(cb: (url: string) => void): () => void {
    return listen(async () => {
      const { Geofence } = await import("@sweptmind/capacitor-geofence");
      return Geofence.addListener("notificationOpened", (event) => cb(event.url));
    });
  }

  private async setupNativeListener(): Promise<void> {
    const { Geofence } = await import("@sweptmind/capacitor-geofence");
    const handle = await Geofence.addListener("geofenceTransition", (event) => {
      const mapped: GeofenceEvent = {
        fenceId: event.identifier,
        type: event.type,
        position: { latitude: event.latitude, longitude: event.longitude },
      };
      this.geofenceCallbacks.forEach((cb) => cb(mapped));
    });
    this.listenerRemoveFn = handle.remove;
  }

  private async teardownNativeListener(): Promise<void> {
    if (this.listenerRemoveFn) {
      await this.listenerRemoveFn();
      this.listenerRemoveFn = null;
    }
  }
}
