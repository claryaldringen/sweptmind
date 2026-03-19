export interface CheckoutSessionParams {
  plan: "monthly" | "yearly";
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface IPaymentGateway {
  createCheckoutSession(params: CheckoutSessionParams): Promise<string>;
  createCustomerPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string>;
}
