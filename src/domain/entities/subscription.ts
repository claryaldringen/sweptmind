export interface Subscription {
  id: string;
  userId: string;
  status: "active" | "canceled" | "past_due" | "expired";
  plan: "monthly" | "yearly";
  paymentMethod: "stripe" | "bank_transfer";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  userId: string;
  plan: "monthly" | "yearly";
  paymentMethod: "stripe" | "bank_transfer";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}
