import { useSyncExternalStore } from "react";

/**
 * Per-device preferences of the native app (the server stores per-user ones).
 * Reads and writes never throw — storage can be unavailable.
 */

const PUSH_DISABLED_KEY = "sweptmind-push-disabled";
const PUSH_PROMPTED_KEY = "sweptmind-push-prompted";
const PUSH_TOKEN_KEY = "sweptmind-push-token";
const LOCATION_REMINDERS_KEY = "sweptmind-location-reminders";

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the preference just won't persist
  }
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const nativePreferences = {
  /** The user switched push off on this device (opt-out survives app restarts). */
  isPushDisabled: () => read(PUSH_DISABLED_KEY) === "1",
  setPushDisabled: (disabled: boolean) => write(PUSH_DISABLED_KEY, disabled ? "1" : null),

  /** The system permission dialog was already shown once automatically. */
  wasPushPrompted: () => read(PUSH_PROMPTED_KEY) === "1",
  markPushPrompted: () => write(PUSH_PROMPTED_KEY, "1"),

  getPushToken: () => read(PUSH_TOKEN_KEY),
  setPushToken: (token: string | null) => write(PUSH_TOKEN_KEY, token),

  /** Location reminders are opt-in (background location needs explicit consent). */
  isLocationRemindersEnabled: () => read(LOCATION_REMINDERS_KEY) === "1",
  setLocationRemindersEnabled: (enabled: boolean) =>
    write(LOCATION_REMINDERS_KEY, enabled ? "1" : null),
};

export function useLocationRemindersEnabled(): boolean {
  return useSyncExternalStore(subscribe, nativePreferences.isLocationRemindersEnabled, () => false);
}
