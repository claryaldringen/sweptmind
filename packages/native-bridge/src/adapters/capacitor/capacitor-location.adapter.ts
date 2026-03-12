import type { LocationPort } from "../../ports/location.port";
import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  TrackingConfig,
} from "../../types";

export class CapacitorLocationAdapter implements LocationPort {
  private watcherId: string | null = null;
  private geofenceCallbacks: ((event: GeofenceEvent) => void)[] = [];
  private geofences = new Map<string, GeofenceConfig>();
  private insideFences = new Set<string>();

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

  async startBackgroundTracking(config: TrackingConfig): Promise<void> {
    const { registerPlugin } = await import("@capacitor/core");
    interface BgGeoPlugin {
      addWatcher(
        opts: Record<string, unknown>,
        cb: (
          location: { latitude: number; longitude: number } | null,
          error: unknown,
        ) => void,
      ): Promise<string>;
      removeWatcher(opts: { id: string }): Promise<void>;
    }
    const BackgroundGeolocation =
      registerPlugin<BgGeoPlugin>("BackgroundGeolocation");

    this.watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "SweptMind sleduje polohu pro upozornění na úkoly",
        backgroundTitle: "SweptMind",
        requestPermissions: true,
        stale: false,
        distanceFilter: config.distanceFilterMeters,
      },
      (location, error) => {
        if (error) {
          console.error("Background location error:", error);
          return;
        }
        if (location) {
          this.checkGeofences({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      },
    );
  }

  async stopBackgroundTracking(): Promise<void> {
    if (this.watcherId) {
      const { registerPlugin } = await import("@capacitor/core");
      interface BgGeoPlugin {
        removeWatcher(opts: { id: string }): Promise<void>;
      }
      const BackgroundGeolocation =
        registerPlugin<BgGeoPlugin>("BackgroundGeolocation");
      await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
    }
  }

  async addGeofence(fence: GeofenceConfig): Promise<void> {
    this.geofences.set(fence.id, fence);
  }

  async removeGeofence(id: string): Promise<void> {
    this.geofences.delete(id);
  }

  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void {
    this.geofenceCallbacks.push(cb);
    return () => {
      this.geofenceCallbacks = this.geofenceCallbacks.filter((c) => c !== cb);
    };
  }

  private checkGeofences(position: Position): void {
    for (const [id, fence] of this.geofences) {
      const distance = haversineKm(
        position.latitude,
        position.longitude,
        fence.latitude,
        fence.longitude,
      );
      const inside = distance <= fence.radiusKm;
      const wasInside = this.insideFences.has(id);

      if (inside && !wasInside) {
        this.insideFences.add(id);
        this.geofenceCallbacks.forEach((cb) =>
          cb({ fenceId: id, type: "enter", position }),
        );
      } else if (!inside && wasInside) {
        this.insideFences.delete(id);
        this.geofenceCallbacks.forEach((cb) =>
          cb({ fenceId: id, type: "exit", position }),
        );
      }
    }
  }
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
