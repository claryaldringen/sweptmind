import type { PushSubscription, PushPreferences } from "../entities/push-subscription";

export interface IPushSubscriptionRepository {
  /** Delete a subscription by userId + endpoint, then insert a new one. */
  upsert(
    userId: string,
    values: {
      endpoint: string;
      p256dh: string;
      auth: string;
      platform: string;
      notifyDueDate: boolean;
      notifyReminder: boolean;
    },
  ): Promise<void>;

  /** Delete a subscription by userId + endpoint. */
  deleteByEndpoint(userId: string, endpoint: string): Promise<void>;

  /** Get the first subscription for a user (preferences are shared across devices). */
  findFirstByUser(userId: string): Promise<PushSubscription | undefined>;

  /** Update preferences (notifyDueDate, notifyReminder) on all subscriptions for a user. */
  updatePreferences(userId: string, prefs: Partial<PushPreferences>): Promise<void>;

  /** Get all subscriptions for a user (across all devices). */
  findAllByUser(userId: string): Promise<PushSubscription[]>;
}
