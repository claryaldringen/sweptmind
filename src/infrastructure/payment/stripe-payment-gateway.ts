import type { IPaymentGateway, CheckoutSessionParams } from "@/domain/ports/payment-gateway";

export class StripePaymentGateway implements IPaymentGateway {
  constructor(
    private readonly secretKey: string,
    private readonly monthlyPriceId: string,
    private readonly yearlyPriceId: string,
  ) {}

  async createCheckoutSession(params: CheckoutSessionParams): Promise<string> {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(this.secretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: params.plan === "yearly" ? this.yearlyPriceId : this.monthlyPriceId,
          quantity: 1,
        },
      ],
      customer_email: params.email,
      metadata: { userId: params.userId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return session.url!;
  }

  async createCustomerPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string> {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(this.secretKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }
}
