import type { PushPort } from "../../ports/push.port";
import type { PushRegistration, PushNotification, Platform } from "../../types";

export class CapacitorPushAdapter implements PushPort {
  isSupported(): boolean {
    return true;
  }

  async register(): Promise<PushRegistration> {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { Capacitor } = await import("@capacitor/core");

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      throw new Error("Push permission denied");
    }

    await PushNotifications.register();

    const token = await new Promise<string>((resolve, reject) => {
      PushNotifications.addListener("registration", (t) => resolve(t.value));
      PushNotifications.addListener("registrationError", (err) =>
        reject(new Error(err.error)),
      );
    });

    return {
      token,
      platform: Capacitor.getPlatform() as Platform,
    };
  }

  async unregister(): Promise<void> {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
  }

  onNotification(cb: (notification: PushNotification) => void): () => void {
    let cleanup: (() => void) | null = null;

    import("@capacitor/push-notifications").then(({ PushNotifications }) => {
      const listener = PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          cb({
            title: notification.title ?? "",
            body: notification.body ?? "",
            data: notification.data as Record<string, string>,
          });
        },
      );

      cleanup = () => {
        listener.then((l) => l.remove());
      };
    });

    return () => {
      cleanup?.();
    };
  }
}
