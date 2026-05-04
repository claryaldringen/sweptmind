"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

const listeners = new Set<() => void>();
let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityHandler: (() => void) | null = null;
let currentToday = "";

function notify() {
  const next = getToday();
  if (next === currentToday) return;
  currentToday = next;
  for (const l of listeners) l();
}

function scheduleMidnight() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1,
  );
  const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
  midnightTimer = setTimeout(() => {
    notify();
    scheduleMidnight();
  }, delay);
}

function subscribe(callback: () => void) {
  if (listeners.size === 0) {
    currentToday = getToday();
    scheduleMidnight();
    // visibilitychange covers tab switching; focus + pageshow cover laptop
    // resume from sleep where the tab was already foreground (the actual
    // overnight-stale-date scenario) and bfcache restore on mobile Safari.
    visibilityHandler = () => {
      if (document.visibilityState === "visible") notify();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("focus", visibilityHandler);
    window.addEventListener("pageshow", visibilityHandler);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      if (midnightTimer) {
        clearTimeout(midnightTimer);
        midnightTimer = null;
      }
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
        window.removeEventListener("focus", visibilityHandler);
        window.removeEventListener("pageshow", visibilityHandler);
        visibilityHandler = null;
      }
    }
  };
}

function getSnapshot(): string {
  if (!currentToday) currentToday = getToday();
  return currentToday;
}

function getServerSnapshot(): string {
  return getToday();
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
