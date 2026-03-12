import type { Platform } from "./types";

export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  if ("electronAPI" in window) return "electron";

  const win = window as any;
  if (win.Capacitor?.isNativePlatform?.()) {
    const platform = win.Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") return platform;
  }

  return "web";
}
