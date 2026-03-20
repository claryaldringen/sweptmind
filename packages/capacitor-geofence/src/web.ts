import { WebPlugin } from "@capacitor/core";
import type {
  GeofencePlugin,
  GeofenceConfig,
  MonitoredGeofence,
  GeofenceTransitionEvent,
  PermissionStatus,
} from "./definitions";

export class GeofenceWeb extends WebPlugin implements GeofencePlugin {
  async addGeofences(_options: {
    geofences: GeofenceConfig[];
  }): Promise<void> {
    // Geofencing not supported on web
  }

  async removeGeofences(_options: { identifiers: string[] }): Promise<void> {
    // No-op on web
  }

  async removeAllGeofences(): Promise<void> {
    // No-op on web
  }

  async getMonitoredGeofences(): Promise<{ geofences: MonitoredGeofence[] }> {
    return { geofences: [] };
  }

  async requestAlwaysPermission(): Promise<{ status: PermissionStatus }> {
    return { status: "denied" };
  }

  async getPermissionStatus(): Promise<{
    status: PermissionStatus | "notDetermined";
  }> {
    return { status: "denied" };
  }

  async addListener(
    _eventName: "geofenceTransition",
    _callback: (event: GeofenceTransitionEvent) => void,
  ): Promise<{ remove: () => Promise<void> }> {
    return { remove: async () => {} };
  }
}
