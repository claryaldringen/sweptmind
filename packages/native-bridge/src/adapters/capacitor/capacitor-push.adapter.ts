import type { PushPort } from "../../ports/push.port";
import type {
  PushRegistration,
  PushNotification,
  PushPermissionStatus,
  Platform,
} from "../../types";
import { listen } from "./listen";

interface AppInfoPlugin {
  getCapabilities(): Promise<{ pushConfigured: boolean }>;
}

/** Must match ANDROID_CHANNEL_ID in src/infrastructure/notification/push-dispatcher.ts */
export const ANDROID_PUSH_CHANNEL_ID = "reminders";
const REGISTRATION_TIMEOUT_MS = 15_000;

export class CapacitorPushAdapter implements PushPort {
  isSupported(): boolean {
    return true;
  }

  async isConfigured(): Promise<boolean> {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") return true;
    // AppInfo lives in apps/mobile/android (MainActivity); calling PushNotifications.register()
    // in a build without google-services.json would crash the app
    const appInfo = registerPlugin<AppInfoPlugin>("AppInfo");
    try {
      const { pushConfigured } = await appInfo.getCapabilities();
      return pushConfigured;
    } catch {
      return false;
    }
  }

  async getPermissionStatus(): Promise<PushPermissionStatus> {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === "granted") return "granted";
    if (receive === "denied") return "denied";
    return "prompt";
  }

  async register(options?: { androidChannelName?: string }): Promise<PushRegistration> {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { Capacitor } = await import("@capacitor/core");

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      throw new Error("Push permission denied");
    }

    const platform = Capacitor.getPlatform() as Platform;
    if (platform === "android") {
      // Idempotent; the server sends with this channel id
      await PushNotifications.createChannel({
        id: ANDROID_PUSH_CHANNEL_ID,
        name: options?.androidChannelName ?? "Reminders",
        importance: 4,
        visibility: 1,
      });
    }

    let resolveToken!: (token: string) => void;
    let rejectToken!: (error: Error) => void;
    const tokenPromise = new Promise<string>((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
    });
    const handles = await Promise.all([
      PushNotifications.addListener("registration", (t) => resolveToken(t.value)),
      PushNotifications.addListener("registrationError", (err) =>
        rejectToken(new Error(err.error)),
      ),
    ]);
    const timer = setTimeout(
      () => rejectToken(new Error("Push registration timed out")),
      REGISTRATION_TIMEOUT_MS,
    );

    try {
      await PushNotifications.register();
      return { token: await tokenPromise, platform };
    } finally {
      clearTimeout(timer);
      await Promise.all(handles.map((h) => h.remove()));
    }
  }

  async unregister(): Promise<void> {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
  }

  onNotification(cb: (notification: PushNotification) => void): () => void {
    return listen(async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      return PushNotifications.addListener("pushNotificationReceived", (notification) => {
        cb({
          title: notification.title ?? "",
          body: notification.body ?? "",
          data: notification.data as Record<string, string>,
        });
      });
    });
  }

  onTokenChange(cb: (registration: PushRegistration) => void): () => void {
    return listen(async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const { Capacitor } = await import("@capacitor/core");
      return PushNotifications.addListener("registration", (t) =>
        cb({ token: t.value, platform: Capacitor.getPlatform() as Platform }),
      );
    });
  }

  onNotificationOpened(cb: (data: Record<string, string>) => void): () => void {
    return listen(async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      return PushNotifications.addListener("pushNotificationActionPerformed", (action) =>
        cb((action.notification.data ?? {}) as Record<string, string>),
      );
    });
  }
}
