export { getPlatform } from "./platform";
export { isNativeApp, openInSystemBrowser, closeSystemBrowser, onAppUrlOpen } from "./native-auth";
export { getPushAdapter, getLocationAdapter, getContactsAdapter, resetAdapters } from "./factory";
export type { PushPort } from "./ports/push.port";
export type { LocationPort } from "./ports/location.port";
export type { ContactsPort } from "./ports/contacts.port";
export type {
  Platform,
  Position,
  PushNotification,
  PushRegistration,
  GeofenceConfig,
  GeofenceEvent,
  GeofenceRegistration,
  PushPermissionStatus,
  LocationPermissionStatus,
  LocationPermissions,
  TrackingConfig,
  Contact,
} from "./types";
