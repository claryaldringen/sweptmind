import { getPlatform } from "./platform";
import type { PushPort } from "./ports/push.port";
import type { LocationPort } from "./ports/location.port";
import { WebPushAdapter } from "./adapters/web/web-push.adapter";
import { WebLocationAdapter } from "./adapters/web/web-location.adapter";
import { CapacitorPushAdapter } from "./adapters/capacitor/capacitor-push.adapter";
import { CapacitorLocationAdapter } from "./adapters/capacitor/capacitor-location.adapter";

let pushInstance: PushPort | null = null;
let locationInstance: LocationPort | null = null;

export function getPushAdapter(): PushPort {
  if (pushInstance) return pushInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      pushInstance = new CapacitorPushAdapter();
      return pushInstance;
    case "electron":
    default:
      pushInstance = new WebPushAdapter();
      return pushInstance;
  }
}

export function getLocationAdapter(): LocationPort {
  if (locationInstance) return locationInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      locationInstance = new CapacitorLocationAdapter();
      return locationInstance;
    default:
      locationInstance = new WebLocationAdapter();
      return locationInstance;
  }
}

export function resetAdapters(): void {
  pushInstance = null;
  locationInstance = null;
}
