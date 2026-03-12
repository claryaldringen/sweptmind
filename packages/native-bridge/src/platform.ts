import type { Platform } from "./types";

export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  if ("electronAPI" in window) return "electron";

  const win = window as unknown as Record<string, unknown>;
  const cap = win.Capacitor as
    | { isNativePlatform?: () => boolean; getPlatform?: () => string }
    | undefined;
  if (cap?.isNativePlatform?.()) {
    const platform = cap.getPlatform?.();
    if (platform === "ios" || platform === "android") return platform;
  }

  return "web";
}
