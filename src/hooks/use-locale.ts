"use client";

import { useCallback, useSyncExternalStore } from "react";
import { matchLocale, resolveLocale, type Locale } from "@/lib/i18n/locales";

const STORAGE_KEY = "sweptmind-locale";
const COOKIE_KEY = "sweptmind-locale";

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return matchLocale(navigator.languages ?? [navigator.language]) ?? "en";
}

function getSnapshot(): Locale {
  if (typeof window === "undefined") return "cs";
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — fall back to the browser's language
  }
  return resolveLocale(stored, detectLocale());
}

function getServerSnapshot(): Locale {
  return "cs";
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setLocaleValue(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
  document.cookie = `${COOKIE_KEY}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  document.documentElement.lang = locale;
  listeners.forEach((cb) => cb());
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLocale = useCallback((l: Locale) => setLocaleValue(l), []);

  return { locale, setLocale } as const;
}
