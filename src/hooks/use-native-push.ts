"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPlatform, getPushAdapter, type PushRegistration } from "@sweptmind/native-bridge";
import { useTranslations } from "@/lib/i18n";
import { nativePreferences } from "@/lib/native-preferences";

let inFlightSave: { token: string; promise: Promise<void> } | null = null;

/** Stores the device token on the server for the signed-in user. */
export function saveNativePushRegistration(registration: PushRegistration): Promise<void> {
  // One registration fires both the register() result and the token listener
  if (inFlightSave?.token === registration.token) return inFlightSave.promise;

  const promise = (async () => {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: registration.token, platform: registration.platform }),
    });
    if (!res.ok) throw new Error(`Push subscribe failed: ${res.status}`);
    nativePreferences.setPushToken(registration.token);
  })().finally(() => {
    if (inFlightSave?.promise === promise) inFlightSave = null;
  });

  inFlightSave = { token: registration.token, promise };
  return promise;
}

/** Removes this device's subscription on the server; keeps the token if that fails (retried). */
export async function removeNativePushSubscription(): Promise<void> {
  const token = nativePreferences.getPushToken();
  if (!token) return;
  const res = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: token }),
  });
  if (!res.ok) throw new Error(`Push unsubscribe failed: ${res.status}`);
  nativePreferences.setPushToken(null);
}

/**
 * Android app: registers the device for push on every start (asks for permission once),
 * keeps a rotated token in sync with the server and opens tapped notifications.
 * iOS needs APNs/Firebase setup first, so it only has the manual toggle in Settings.
 */
export function useNativePush() {
  const router = useRouter();
  const { t } = useTranslations();
  const channelName = useRef(t("push.channelName"));

  useEffect(() => {
    if (getPlatform() !== "android") return;
    const push = getPushAdapter();

    const offToken = push.onTokenChange((registration) => {
      if (nativePreferences.isPushDisabled()) return;
      if (registration.token === nativePreferences.getPushToken()) return;
      saveNativePushRegistration(registration).catch((err) =>
        console.warn("[push] token sync failed:", err),
      );
    });

    const offOpened = push.onNotificationOpened((data) => {
      if (typeof data.url === "string" && data.url.startsWith("/")) router.push(data.url);
    });

    (async () => {
      if (nativePreferences.isPushDisabled()) {
        // Finish a switch-off that couldn't reach the server (e.g. offline)
        await removeNativePushSubscription();
        return;
      }
      if (!(await push.isConfigured())) return;

      const status = await push.getPermissionStatus();
      if (status === "denied") return;
      if (status === "prompt") {
        // Ask automatically only once; afterwards the user enables push in Settings
        if (nativePreferences.wasPushPrompted()) return;
        nativePreferences.markPushPrompted();
      }

      const registration = await push.register({ androidChannelName: channelName.current });
      await saveNativePushRegistration(registration);
    })().catch((err) => console.warn("[push] registration failed:", err));

    return () => {
      offToken();
      offOpened();
    };
  }, [router]);
}
