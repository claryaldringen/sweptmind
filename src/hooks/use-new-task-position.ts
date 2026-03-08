"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sweptmind-new-task-position";

export type NewTaskPosition = "top" | "bottom";

function getSnapshot(): NewTaskPosition {
  if (typeof window === "undefined") return "top";
  return (localStorage.getItem(STORAGE_KEY) as NewTaskPosition) || "top";
}

function getServerSnapshot(): NewTaskPosition {
  return "top";
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setPosition(position: NewTaskPosition) {
  localStorage.setItem(STORAGE_KEY, position);
  listeners.forEach((cb) => cb());
}

export function useNewTaskPosition() {
  const position = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => {
    setPosition(position === "top" ? "bottom" : "top");
  }, [position]);

  return { position, setPosition, toggle } as const;
}
