"use client";

import { useEffect } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLocale } from "@/hooks/use-locale";

const UPDATE_CLIENT_SETTINGS = gql`
  mutation UpdateClientSettings($timezone: String, $locale: String) {
    updateClientSettings(timezone: $timezone, locale: $locale)
  }
`;

// During hydration useLocale briefly reports the server default — wait for the real value
const SETTLE_MS = 1500;

/**
 * Reports the device's time zone and the app language to the server, so notifications
 * go out at the user's local time and in their language.
 */
export function useClientSettingsSync() {
  const { locale } = useLocale();
  const [updateClientSettings] = useMutation(UPDATE_CLIENT_SETTINGS);

  useEffect(() => {
    const timer = setTimeout(() => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      updateClientSettings({ variables: { timezone, locale } }).catch(() => {
        // Best effort — the server falls back to Europe/Prague and Czech
      });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [locale, updateClientSettings]);
}
