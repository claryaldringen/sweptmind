import type { INotificationSender, ShareNotification } from "@/domain/ports/notification-sender";
import type { IPushSubscriptionRepository } from "@/domain/repositories/push-subscription.repository";
import type { PushDispatcher } from "./push-dispatcher";

export class PushNotificationSender implements INotificationSender {
  constructor(
    private readonly pushSubRepo: IPushSubscriptionRepository,
    private readonly dispatcher: PushDispatcher,
  ) {}

  async send(userId: string, notification: ShareNotification): Promise<void> {
    const subscriptions = await this.pushSubRepo.findAllByUser(userId);
    if (subscriptions.length === 0) return;

    await this.dispatcher.send(subscriptions, {
      title: notification.title,
      body: notification.body,
      url: notification.taskId ? `/context?task=${notification.taskId}` : "/context",
      ...(notification.taskId ? { tag: `share:${notification.taskId}` } : {}),
    });
  }
}
