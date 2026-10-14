import type { PluginListenerHandle } from "@capacitor/core";

/** Subscribes via an async Capacitor addListener and returns a synchronous unsubscribe. */
export function listen(subscribe: () => Promise<PluginListenerHandle>): () => void {
  let removed = false;
  let handle: PluginListenerHandle | null = null;
  subscribe().then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    void handle?.remove();
  };
}
