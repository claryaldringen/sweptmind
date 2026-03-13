import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { repos, services } from "@/infrastructure/container";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getSubscriptionPeriod(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  return {
    start: item ? new Date(item.current_period_start * 1000) : new Date(),
    end: item ? new Date(item.current_period_end * 1000) : new Date(),
  };
}

function getSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails?.subscription) return null;
  return typeof subDetails.subscription === "string"
    ? subDetails.subscription
    : subDetails.subscription.id;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription || !session.customer) break;

      const stripeSubscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
      );
      const period = getSubscriptionPeriod(stripeSubscription);

      await repos.subscription.create({
        userId,
        plan:
          stripeSubscription.items.data[0]?.plan?.interval === "year"
            ? "yearly"
            : "monthly",
        paymentMethod: "stripe",
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getSubscriptionIdFromInvoice(invoice);
      if (!subscriptionId) break;

      const stripeSubscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      const period = getSubscriptionPeriod(stripeSubscription);

      await services.subscription.handleStripeSubscriptionUpdate(
        subscriptionId,
        "active",
        period.end,
      );
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.cancel_at_period_end ? "canceled" : "active";
      const period = getSubscriptionPeriod(sub);

      await services.subscription.handleStripeSubscriptionUpdate(
        sub.id,
        status,
        period.end,
      );
      break;
    }

    case "customer.subscription.deleted": {
      await services.subscription.handleStripeSubscriptionUpdate(
        (event.data.object as Stripe.Subscription).id,
        "expired",
        new Date(),
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
