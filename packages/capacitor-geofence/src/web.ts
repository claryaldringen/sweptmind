import { WebPlugin } from "@capacitor/core";
import type {
  GeofencePlugin,
  GeofenceConfig,
  MonitoredGeofence,
  PermissionResult,
} from "./definitions";

export class GeofenceWeb extends WebPlugin implements GeofencePlugin {
  async setGeofences(_options: { geofences: GeofenceConfig[] }): Promise<void> {
    // Geofencing not supported on web
  }

  async addGeofences(_options: { geofences: GeofenceConfig[] }): Promise<void> {
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

  async requestAlwaysPermission(): Promise<PermissionResult> {
    return { status: "denied" };
  }

  async getPermissionStatus(): Promise<PermissionResult> {
    return { status: "denied" };
  }

  async openAppSettings(): Promise<void> {
    // No-op on web
  }
}
