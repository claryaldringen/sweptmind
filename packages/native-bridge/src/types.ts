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

export interface TrackingConfig {
  intervalMs: number;
  distanceFilterMeters: number;
}
