import { getPlatform } from "./platform";
import type { PushPort } from "./ports/push.port";
import type { LocationPort } from "./ports/location.port";
import { WebPushAdapter } from "./adapters/web/web-push.adapter";
import { WebLocationAdapter } from "./adapters/web/web-location.adapter";

let pushInstance: PushPort | null = null;
let locationInstance: LocationPort | null = null;

export function getPushAdapter(): PushPort {
  if (pushInstance) return pushInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      // Will be replaced in Task 10 with CapacitorPushAdapter
      pushInstance = new WebPushAdapter();
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
      // Will be replaced in Task 10 with CapacitorLocationAdapter
      locationInstance = new WebLocationAdapter();
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
