import type { IPaymentGateway } from "../ports/payment-gateway";
import type { IQrGenerator } from "../ports/qr-generator";
import type { IFioBankGateway } from "../ports/fio-bank-gateway";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";
import type { SubscriptionService } from "./subscription.service";

const PRICES_CZK = { monthly: 49, yearly: 490 } as const;
const FIO_COOLDOWN_MS = 60_000;

export interface BankPaymentVerificationResult {
  found: boolean;
  nextCheckAvailableAt: string;
}

export class PaymentService {
  constructor(
    private readonly paymentGateway: IPaymentGateway,
    private readonly qrGenerator: IQrGenerator,
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly fioBankGateway: IFioBankGateway | null,
    private readonly subscriptionService: SubscriptionService,
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

  async verifyBankPayment(userId: string): Promise<BankPaymentVerificationResult> {
    if (!this.fioBankGateway) {
      throw new Error("FIO bank gateway not configured");
    }

    const lastCallAt = await this.subscriptionRepo.getFioLastCallAt();
    const now = Date.now();

    if (lastCallAt && now - lastCallAt.getTime() < FIO_COOLDOWN_MS) {
      return {
        found: false,
        nextCheckAvailableAt: new Date(lastCallAt.getTime() + FIO_COOLDOWN_MS).toISOString(),
      };
    }

    await this.subscriptionRepo.setFioLastCallAt(new Date(now));

    const transactions = await this.fioBankGateway.getRecentTransactions();
    const variableSymbol = userId.replace(/-/g, "").slice(0, 10);

    for (const tx of transactions) {
      if (
        tx.variableSymbol !== variableSymbol ||
        (tx.amount !== PRICES_CZK.monthly && tx.amount !== PRICES_CZK.yearly)
      ) {
        continue;
      }

      const existing = await this.subscriptionRepo.findBankPaymentByFioId(tx.fioTransactionId);
      if (existing) continue;

      await this.subscriptionRepo.createBankPayment({
        userId,
        amount: String(tx.amount),
        currency: "CZK",
        variableSymbol,
        fioTransactionId: tx.fioTransactionId,
        receivedAt: new Date(tx.date),
      });

      await this.subscriptionService.activateBankTransfer(userId, tx.amount);

      return {
        found: true,
        nextCheckAvailableAt: new Date(now + FIO_COOLDOWN_MS).toISOString(),
      };
    }

    return {
      found: false,
      nextCheckAvailableAt: new Date(now + FIO_COOLDOWN_MS).toISOString(),
    };
  }
}
