import type { Messaging } from "firebase-admin/messaging";
import type { PushSubscription } from "@/domain/entities/push-subscription";
import type { IPushSubscriptionRepository } from "@/domain/repositories/push-subscription.repository";

export interface PushMessage {
  title: string;
  body: string;
  /** App path opened when the notification is tapped */
  url: string;
  /** Notifications with the same tag replace each other */
  tag?: string;
}

/** Android notification channel created by the app (src/hooks/use-native-push.ts) */
export const ANDROID_CHANNEL_ID = "reminders";

const GONE_FCM_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Delivers a message to web (VAPID) and native (FCM/APNs via Firebase Admin) subscriptions
 * and removes subscriptions the push service reports as gone.
 */
export class PushDispatcher {
  private webpush: typeof import("web-push") | null = null;
  private messaging: Messaging | null = null;

  constructor(private readonly pushSubRepo: IPushSubscriptionRepository) {}

  /** Returns the number of subscriptions the message was delivered to. */
  async send(subscriptions: PushSubscription[], message: PushMessage): Promise<number> {
    let delivered = 0;
    for (const sub of subscriptions) {
      try {
        if (sub.platform === "web") await this.sendWeb(sub, message);
        else await this.sendNative(sub, message);
        delivered++;
      } catch (error) {
        if (isGone(error)) {
          await this.pushSubRepo.deleteByEndpoint(sub.userId, sub.endpoint);
        } else {
          console.error(`[push] ${sub.platform} delivery failed:`, describeError(error));
        }
      }
    }
    return delivered;
  }

  private async sendWeb(sub: PushSubscription, message: PushMessage): Promise<void> {
    const webpush = await this.getWebPush();
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(message),
    );
  }

  private async sendNative(sub: PushSubscription, message: PushMessage): Promise<void> {
    const messaging = await this.getMessaging();
    await messaging.send({
      token: sub.endpoint,
      notification: { title: message.title, body: message.body },
      data: { url: message.url },
      android: {
        priority: "high",
        notification: {
          channelId: ANDROID_CHANNEL_ID,
          ...(message.tag ? { tag: message.tag } : {}),
        },
      },
    });
  }

  private async getWebPush() {
    if (!this.webpush) {
      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        throw new Error("VAPID keys not configured");
      }
      const webpush = await import("web-push");
      webpush.setVapidDetails(
        "mailto:noreply@sweptmind.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );
      this.webpush = webpush;
    }
    return this.webpush;
  }

  private async getMessaging(): Promise<Messaging> {
    if (!this.messaging) {
      // Throws when FIREBASE_SERVICE_ACCOUNT is missing — logged per failed delivery
      const { getFirebaseMessaging } = await import("@/lib/firebase-admin");
      this.messaging = getFirebaseMessaging();
    }
    return this.messaging;
  }
}

function isGone(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { statusCode?: unknown; code?: unknown };
  if (err.statusCode === 404 || err.statusCode === 410) return true;
  return typeof err.code === "string" && GONE_FCM_CODES.has(err.code);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
