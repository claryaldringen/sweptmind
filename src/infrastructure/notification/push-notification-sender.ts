import type { INotificationSender, ShareNotification } from "@/domain/ports/notification-sender";
import type { IPushSubscriptionRepository } from "@/domain/repositories/push-subscription.repository";

export class PushNotificationSender implements INotificationSender {
  constructor(private readonly pushSubRepo: IPushSubscriptionRepository) {}

  async send(userId: string, notification: ShareNotification): Promise<void> {
    const subscriptions = await this.pushSubRepo.findAllByUser(userId);
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type,
        ...(notification.taskId ? { url: `/?task=${notification.taskId}` } : {}),
      },
    });

    // Lazy-load Firebase Admin only when native subscriptions exist
    const hasNative = subscriptions.some((s) => s.platform !== "web");
    let firebaseMessaging: Awaited<
      ReturnType<typeof import("firebase-admin/messaging").getMessaging>
    > | null = null;
    if (hasNative) {
      try {
        const { getFirebaseMessaging } = await import("@/lib/firebase-admin");
        firebaseMessaging = getFirebaseMessaging();
      } catch {
        // Firebase Admin not configured — skip native sends
      }
    }

    const hasWeb = subscriptions.some((s) => s.platform === "web");
    let webpushLib: Awaited<typeof import("web-push")> | null = null;
    if (hasWeb) {
      webpushLib = await import("web-push");
      webpushLib.setVapidDetails(
        "mailto:noreply@sweptmind.com",
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!,
      );
    }

    for (const sub of subscriptions) {
      try {
        if (sub.platform === "web" && webpushLib) {
          await webpushLib.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } else if (firebaseMessaging) {
          await firebaseMessaging.send({
            token: sub.endpoint,
            notification: { title: notification.title, body: notification.body },
            data: notification.taskId ? { url: `/?task=${notification.taskId}` } : {},
          });
        }
      } catch {
        // Silently skip failed sends — subscription may be stale
      }
    }
  }
}
