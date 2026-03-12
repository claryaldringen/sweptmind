export { getPlatform } from "./platform";
export { getPushAdapter, getLocationAdapter, resetAdapters } from "./factory";
export type { PushPort } from "./ports/push.port";
export type { LocationPort } from "./ports/location.port";
export type {
  Platform,
  Position,
  PushNotification,
  PushRegistration,
  GeofenceConfig,
  GeofenceEvent,
  TrackingConfig,
} from "./types";
