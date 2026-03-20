import type { Subscription, CreateSubscriptionInput } from "../entities/subscription";

export interface BankPaymentRecord {
  userId: string;
  amount: string;
  currency: string;
  variableSymbol: string;
  fioTransactionId: string;
  receivedAt: Date;
}

export interface ISubscriptionRepository {
  findActiveByUser(userId: string): Promise<Subscription | undefined>;
  findByStripeCustomerId(customerId: string): Promise<Subscription | undefined>;
  findByStripeSubscriptionId(subscriptionId: string): Promise<Subscription | undefined>;
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  updateStatus(id: string, status: Subscription["status"], periodEnd?: Date): Promise<Subscription>;
  updateStripeIds(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<Subscription>;
  findBankPaymentByFioId(fioTransactionId: string): Promise<{ id: string } | undefined>;
  createBankPayment(record: BankPaymentRecord): Promise<void>;
  getFioLastCallAt(): Promise<Date | null>;
  setFioLastCallAt(at: Date): Promise<void>;
}
