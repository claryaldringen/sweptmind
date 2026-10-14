export type Platform = "web" | "ios" | "android" | "electron";

export interface Position {
  latitude: number;
  longitude: number;
}

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushRegistration {
  token: string;
  platform: Platform;
}

export interface GeofenceConfig {
  id: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  name?: string;
}

export interface GeofenceEvent {
  fenceId: string;
  type: "enter" | "exit";
  position: Position;
}

export interface GeofenceRegistration {
  identifier: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  notificationTitle?: string;
  notificationBody?: string;
  /** App path opened when the notification is tapped */
  notificationUrl?: string;
}

export type PushPermissionStatus = "granted" | "denied" | "prompt";

export type LocationPermissionStatus = "always" | "whenInUse" | "denied" | "notDetermined";

export interface LocationPermissions {
  location: LocationPermissionStatus;
  /** Whether the app may post notifications (undefined where unknown, e.g. iOS) */
  notifications?: "granted" | "denied";
}

export interface TrackingConfig {
  intervalMs: number;
  distanceFilterMeters: number;
}

export interface Contact {
  name: string;
  phones: string[];
}
