import { index, pgEnum, pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "expired",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", ["monthly", "yearly"]);

export const paymentMethodEnum = pgEnum("payment_method", ["stripe", "bank_transfer"]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    plan: subscriptionPlanEnum("plan").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_stripe_customer_id_idx").on(table.stripeCustomerId),
    index("subscriptions_stripe_subscription_id_idx").on(table.stripeSubscriptionId),
  ],
);

export const bankPayments = pgTable(
  "bank_payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("CZK"),
    variableSymbol: text("variable_symbol").notNull(),
    fioTransactionId: text("fio_transaction_id").notNull().unique(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bank_payments_user_id_idx").on(table.userId),
    index("bank_payments_variable_symbol_idx").on(table.variableSymbol),
    index("bank_payments_fio_transaction_id_idx").on(table.fioTransactionId),
  ],
);
