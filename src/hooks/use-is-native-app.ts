import { useSyncExternalStore } from "react";
import { getPlatform } from "@sweptmind/native-bridge";

const noSubscribe = () => () => {};
const isNativeApp = () => getPlatform() === "android" || getPlatform() === "ios";

/**
 * The Android/iOS app — store rules forbid offering payments outside the store there,
 * so purchases and donations stay on the web. False during server rendering.
 */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(noSubscribe, isNativeApp, () => false);
}
