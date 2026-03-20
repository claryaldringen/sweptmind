import { eq, and } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type {
  ISubscriptionRepository,
  BankPaymentRecord,
} from "@/domain/repositories/subscription.repository";
import type { Subscription, CreateSubscriptionInput } from "@/domain/entities/subscription";

export class DrizzleSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: Database) {}

  async findActiveByUser(userId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, "active"),
      ),
    });
  }

  async findByStripeCustomerId(customerId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.stripeCustomerId, customerId),
    });
  }

  async findByStripeSubscriptionId(subscriptionId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId),
    });
  }

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const [sub] = await this.db.insert(schema.subscriptions).values(input).returning();
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

  async findBankPaymentByFioId(fioTransactionId: string): Promise<{ id: string } | undefined> {
    return this.db.query.bankPayments.findFirst({
      where: eq(schema.bankPayments.fioTransactionId, fioTransactionId),
      columns: { id: true },
    });
  }

  async createBankPayment(record: BankPaymentRecord): Promise<void> {
    await this.db.insert(schema.bankPayments).values(record);
  }

  async getFioLastCallAt(): Promise<Date | null> {
    const row = await this.db.query.fioApiCalls.findFirst({
      where: eq(schema.fioApiCalls.id, "singleton"),
    });
    return row?.lastCallAt ?? null;
  }

  async setFioLastCallAt(at: Date): Promise<void> {
    await this.db
      .insert(schema.fioApiCalls)
      .values({ id: "singleton", lastCallAt: at })
      .onConflictDoUpdate({
        target: schema.fioApiCalls.id,
        set: { lastCallAt: at },
      });
  }
}
