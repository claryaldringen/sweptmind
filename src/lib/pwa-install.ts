import { useSyncExternalStore } from "react";

/** Chrome/Edge's install event (not in the TypeScript DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** available = the browser lets us show its install dialog right now. */
export type PwaInstallState = "unavailable" | "available" | "installed";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

// The browser fires the event once per page load, possibly before any component mounts —
// keep it here so both the banner and Settings can offer installation later
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getState(): PwaInstallState {
  if (installed) return "installed";
  return deferredPrompt ? "available" : "unavailable";
}

export function usePwaInstallState(): PwaInstallState {
  return useSyncExternalStore(subscribe, getState, () => "unavailable");
}

/** Shows the browser's install dialog; resolves to whether the user accepted. */
export async function promptPwaInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  // An install event can prompt only once
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

/** Running as the installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}
