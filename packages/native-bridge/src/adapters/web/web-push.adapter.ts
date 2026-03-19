import type { PushPort } from "../../ports/push.port";
import type { PushRegistration, PushNotification } from "../../types";

export class WebPushAdapter implements PushPort {
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "PushManager" in window &&
      "serviceWorker" in navigator
    );
  }

  async register(): Promise<PushRegistration> {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Push permission denied");

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    const json = sub.toJSON();
    return { token: json.endpoint!, platform: "web" };
  }

  async unregister(): Promise<void> {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  }

  onNotification(cb: (notification: PushNotification) => void): () => void {
    // Web push notifications are handled by the service worker (sw.ts)
    void cb;
    return () => {};
  }
}
