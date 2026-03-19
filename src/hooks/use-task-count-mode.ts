"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sweptmind-task-count-mode";

export type TaskCountMode = "all" | "visible";

function getSnapshot(): TaskCountMode {
  if (typeof window === "undefined") return "visible";
  return (localStorage.getItem(STORAGE_KEY) as TaskCountMode) || "visible";
}

function getServerSnapshot(): TaskCountMode {
  return "visible";
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setMode(mode: TaskCountMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  listeners.forEach((cb) => cb());
}

export function useTaskCountMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => {
    setMode(mode === "all" ? "visible" : "all");
  }, [mode]);

  return { mode, setMode, toggle } as const;
}
