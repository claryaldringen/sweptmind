import { eq, and } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { PushSubscription } from "@/domain/entities/push-subscription";
import type { PushPreferences } from "@/domain/entities/push-subscription";
import type { IPushSubscriptionRepository } from "@/domain/repositories/push-subscription.repository";

export class DrizzlePushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(private readonly db: Database) {}

  async upsert(
    userId: string,
    values: {
      endpoint: string;
      p256dh: string;
      auth: string;
      platform: string;
      notifyDueDate: boolean;
      notifyReminder: boolean;
    },
  ): Promise<void> {
    await this.db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, userId),
          eq(schema.pushSubscriptions.endpoint, values.endpoint),
        ),
      );

    await this.db.insert(schema.pushSubscriptions).values({
      userId,
      ...values,
    });
  }

  async deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, userId),
          eq(schema.pushSubscriptions.endpoint, endpoint),
        ),
      );
  }

  async findFirstByUser(userId: string): Promise<PushSubscription | undefined> {
    return this.db.query.pushSubscriptions.findFirst({
      where: eq(schema.pushSubscriptions.userId, userId),
    });
  }

  async findAllByUser(userId: string): Promise<PushSubscription[]> {
    return this.db.query.pushSubscriptions.findMany({
      where: eq(schema.pushSubscriptions.userId, userId),
    });
  }

  async updatePreferences(userId: string, prefs: Partial<PushPreferences>): Promise<void> {
    await this.db
      .update(schema.pushSubscriptions)
      .set(prefs)
      .where(eq(schema.pushSubscriptions.userId, userId));
  }
}
