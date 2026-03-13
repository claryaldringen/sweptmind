import { builder } from "../builder";
import { SubscriptionRef } from "./refs";

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
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price:
              args.plan === "yearly"
                ? process.env.STRIPE_PRICE_YEARLY_ID!
                : process.env.STRIPE_PRICE_MONTHLY_ID!,
            quantity: 1,
          },
        ],
        metadata: { userId: ctx.userId! },
        success_url: `${process.env.AUTH_URL}/settings?checkout=success`,
        cancel_url: `${process.env.AUTH_URL}/settings?checkout=cancel`,
        automatic_tax: { enabled: true },
      });

      return session.url;
    },
  }),
);

// Mutation: create Stripe customer portal session
builder.mutationField("createCustomerPortalSession", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      const sub = await ctx.services.subscription.getSubscription(ctx.userId!);
      if (!sub?.stripeCustomerId) {
        throw new Error("No Stripe subscription found");
      }

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${process.env.AUTH_URL}/settings`,
      });

      return session.url;
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
      const amount = args.plan === "yearly" ? 490 : 49;
      const accountNumber = process.env.FIO_ACCOUNT_NUMBER!;
      const userId = ctx.userId!;

      // SPAYD format
      const spayd = [
        "SPD*1.0",
        `ACC:${accountNumber}`,
        `AM:${amount}.00`,
        "CC:CZK",
        `X-VS:${userId.replace(/-/g, "").slice(0, 10)}`,
        "MSG:SweptMind Premium",
      ].join("*");

      const QRCode = (await import("qrcode")).default;
      return QRCode.toDataURL(spayd);
    },
  }),
);
