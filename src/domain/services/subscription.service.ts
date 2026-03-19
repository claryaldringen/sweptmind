import type { Subscription } from "../entities/subscription";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";

const MONTHLY_CZK = 49;
const YEARLY_CZK = 490;

export class SubscriptionService {
  constructor(private readonly subscriptionRepo: ISubscriptionRepository) {}

  async isPremium(userId: string): Promise<boolean> {
    const sub = await this.subscriptionRepo.findActiveByUser(userId);
    if (!sub) return false;
    return sub.currentPeriodEnd > new Date();
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    return this.subscriptionRepo.findActiveByUser(userId);
  }

  async activateBankTransfer(userId: string, amountCzk: number): Promise<Subscription> {
    let plan: "monthly" | "yearly";
    if (amountCzk === MONTHLY_CZK) {
      plan = "monthly";
    } else if (amountCzk === YEARLY_CZK) {
      plan = "yearly";
    } else {
      throw new Error(`Invalid payment amount: ${amountCzk} CZK`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    return this.subscriptionRepo.create({
      userId,
      plan,
      paymentMethod: "bank_transfer",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  }

  async handleStripeSubscriptionUpdate(
    stripeSubscriptionId: string,
    status: Subscription["status"],
    periodEnd: Date,
  ): Promise<void> {
    const sub = await this.subscriptionRepo.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!sub) return;
    await this.subscriptionRepo.updateStatus(sub.id, status, periodEnd);
  }
}
