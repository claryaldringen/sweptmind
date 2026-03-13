import { eq, and } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ISubscriptionRepository } from "@/domain/repositories/subscription.repository";
import type {
  Subscription,
  CreateSubscriptionInput,
} from "@/domain/entities/subscription";

export class DrizzleSubscriptionRepository
  implements ISubscriptionRepository
{
  constructor(private readonly db: Database) {}

  async findActiveByUser(userId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, "active"),
      ),
    });
  }

  async findByStripeCustomerId(
    customerId: string,
  ): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.stripeCustomerId, customerId),
    });
  }

  async findByStripeSubscriptionId(
    subscriptionId: string,
  ): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId),
    });
  }

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const [sub] = await this.db
      .insert(schema.subscriptions)
      .values(input)
      .returning();
    return sub;
  }

  async updateStatus(
    id: string,
    status: Subscription["status"],
    periodEnd?: Date,
  ): Promise<Subscription> {
    const data: Record<string, unknown> = { status };
    if (periodEnd) data.currentPeriodEnd = periodEnd;
    const [sub] = await this.db
      .update(schema.subscriptions)
      .set(data)
      .where(eq(schema.subscriptions.id, id))
      .returning();
    return sub;
  }

  async updateStripeIds(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<Subscription> {
    const [sub] = await this.db
      .update(schema.subscriptions)
      .set({ stripeCustomerId, stripeSubscriptionId })
      .where(eq(schema.subscriptions.id, id))
      .returning();
    return sub;
  }
}
