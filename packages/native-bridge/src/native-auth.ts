import { getPlatform } from "./platform";

/** Running inside the iOS/Android app (a WebView), not in a browser. */
export function isNativeApp(): boolean {
  const platform = getPlatform();
  return platform === "android" || platform === "ios";
}

/** Opens a page in the system browser (Custom Tabs / Safari View) — e.g. for OAuth. */
export async function openInSystemBrowser(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/** Closes the system browser opened above where the platform allows it (iOS). */
export async function closeSystemBrowser(): Promise<void> {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // Not supported on Android — the app coming to the front covers the browser
  }
}

/**
 * Calls `handler` with links that open the app (custom scheme), including the one it was
 * launched with when the OS had to restart it. Returns an unsubscribe function.
 */
export async function onAppUrlOpen(handler: (url: string) => void): Promise<() => void> {
  const { App } = await import("@capacitor/app");
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) handler(launch.url);
  const listener = await App.addListener("appUrlOpen", (event) => handler(event.url));
  return () => {
    listener.remove();
  };
}
