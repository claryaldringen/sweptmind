import { builder } from "../builder";
import { SubscriptionRef } from "./refs";
import type { BankPaymentVerificationResult } from "@/domain/services/payment.service";

const BankPaymentVerificationRef = builder.objectRef<BankPaymentVerificationResult>(
  "BankPaymentVerification",
);

BankPaymentVerificationRef.implement({
  fields: (t) => ({
    found: t.exposeBoolean("found"),
    nextCheckAvailableAt: t.exposeString("nextCheckAvailableAt"),
  }),
});

export const SubscriptionType = SubscriptionRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    status: t.exposeString("status"),
    plan: t.exposeString("plan"),
    paymentMethod: t.exposeString("paymentMethod"),
    currentPeriodEnd: t.field({
      type: "String",
      resolve: (sub) => sub.currentPeriodEnd.toISOString(),
    }),
    createdAt: t.field({
      type: "String",
      resolve: (sub) => sub.createdAt.toISOString(),
    }),
  }),
});

// Query: get current subscription
builder.queryField("subscription", (t) =>
  t.field({
    type: SubscriptionRef,
    nullable: true,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.subscription.getSubscription(ctx.userId!);
    },
  }),
);

// Mutation: create Stripe checkout session
builder.mutationField("createCheckoutSession", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      plan: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const plan = args.plan === "yearly" ? "yearly" : "monthly";
      return ctx.services.payment.createCheckoutSession(ctx.userId!, plan, process.env.AUTH_URL!);
    },
  }),
);

// Mutation: create Stripe customer portal session
builder.mutationField("createCustomerPortalSession", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.payment.createCustomerPortalSession(ctx.userId!, process.env.AUTH_URL!);
    },
  }),
);

// Mutation: generate bank transfer QR data
builder.mutationField("generateBankTransferQR", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      plan: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const plan = args.plan === "yearly" ? "yearly" : "monthly";
      return ctx.services.payment.generateBankTransferQR(
        ctx.userId!,
        plan,
        process.env.FIO_ACCOUNT_NUMBER!,
      );
    },
  }),
);

// Mutation: verify bank payment via FIO API
builder.mutationField("verifyBankPayment", (t) =>
  t.field({
    type: BankPaymentVerificationRef,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.payment.verifyBankPayment(ctx.userId!);
    },
  }),
);
