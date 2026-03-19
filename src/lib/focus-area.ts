type FocusArea = "tasks" | "sidebar" | "steps";

let current: FocusArea = "tasks";
const listeners = new Set<() => void>();
let onTasksFocused: (() => void) | null = null;
let onStepsFocused: (() => boolean) | null = null;

export function setFocusArea(area: FocusArea) {
  if (current === area) return;
  // Don't switch to steps if no provider mounted or no steps available
  if (area === "steps") {
    if (!onStepsFocused || !onStepsFocused()) return;
  }
  const prev = current;
  current = area;
  listeners.forEach((l) => l());
  // Focus first task only when coming from sidebar (not from steps)
  if (area === "tasks" && onTasksFocused && prev === "sidebar") {
    onTasksFocused();
  }
}

export function getFocusArea(): FocusArea {
  return current;
}

export function subscribeFocusArea(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerTasksFocusCallback(cb: () => void) {
  onTasksFocused = cb;
  return () => {
    onTasksFocused = null;
  };
}

export function registerStepsFocusCallback(cb: () => boolean) {
  onStepsFocused = cb;
  return () => {
    onStepsFocused = null;
  };
}
