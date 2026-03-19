import type { IPaymentGateway } from "../ports/payment-gateway";
import type { IQrGenerator } from "../ports/qr-generator";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";

const PRICES_CZK = { monthly: 49, yearly: 490 } as const;

export class PaymentService {
  constructor(
    private readonly paymentGateway: IPaymentGateway,
    private readonly qrGenerator: IQrGenerator,
    private readonly subscriptionRepo: ISubscriptionRepository,
  ) {}

  async createCheckoutSession(
    userId: string,
    plan: "monthly" | "yearly",
    baseUrl: string,
  ): Promise<string> {
    return this.paymentGateway.createCheckoutSession({
      plan,
      userId,
      successUrl: `${baseUrl}/settings?checkout=success`,
      cancelUrl: `${baseUrl}/settings?checkout=cancel`,
    });
  }

  async createCustomerPortalSession(userId: string, baseUrl: string): Promise<string> {
    const sub = await this.subscriptionRepo.findActiveByUser(userId);
    if (!sub?.stripeCustomerId) {
      throw new Error("No Stripe subscription found");
    }
    return this.paymentGateway.createCustomerPortalSession(
      sub.stripeCustomerId,
      `${baseUrl}/settings`,
    );
  }

  async generateBankTransferQR(
    userId: string,
    plan: "monthly" | "yearly",
    accountNumber: string,
  ): Promise<string> {
    const amount = PRICES_CZK[plan];
    const variableSymbol = userId.replace(/-/g, "").slice(0, 10);

    const spayd = [
      "SPD*1.0",
      `ACC:${accountNumber}`,
      `AM:${amount}.00`,
      "CC:CZK",
      `X-VS:${variableSymbol}`,
      "MSG:SweptMind Premium",
    ].join("*");

    return this.qrGenerator.toDataURL(spayd);
  }
}
