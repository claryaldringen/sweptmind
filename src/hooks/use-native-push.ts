"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPlatform, getPushAdapter, type PushRegistration } from "@sweptmind/native-bridge";
import { useTranslations } from "@/lib/i18n";
import { nativePreferences } from "@/lib/native-preferences";

/** Stores the device token on the server for the signed-in user. */
export async function saveNativePushRegistration(registration: PushRegistration): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: registration.token, platform: registration.platform }),
  });
  if (!res.ok) throw new Error(`Push subscribe failed: ${res.status}`);
  nativePreferences.setPushToken(registration.token);
}

/**
 * Native app: registers the device for push on every start (asks for permission once),
 * keeps a rotated token in sync with the server and opens tapped notifications.
 */
export function useNativePush() {
  const router = useRouter();
  const { t } = useTranslations();
  const channelName = useRef(t("push.channelName"));

  useEffect(() => {
    const platform = getPlatform();
    if (platform !== "ios" && platform !== "android") return;
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
      if (nativePreferences.isPushDisabled()) return;
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
