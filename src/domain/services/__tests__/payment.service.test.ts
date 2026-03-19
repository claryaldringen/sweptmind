import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService } from "../payment.service";
import type { IPaymentGateway } from "../../ports/payment-gateway";
import type { IQrGenerator } from "../../ports/qr-generator";
import type { ISubscriptionRepository } from "../../repositories/subscription.repository";
import type { Subscription } from "../../entities/subscription";

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    userId: "user-1",
    status: "active",
    plan: "monthly",
    paymentMethod: "stripe",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-02-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makePaymentGateway(): IPaymentGateway {
  return {
    createCheckoutSession: vi.fn().mockResolvedValue("https://checkout.stripe.com/session-1"),
    createCustomerPortalSession: vi.fn().mockResolvedValue("https://billing.stripe.com/portal-1"),
  };
}

function makeQrGenerator(): IQrGenerator {
  return {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr-data"),
  };
}

function makeSubscriptionRepo(
  overrides: Partial<ISubscriptionRepository> = {},
): ISubscriptionRepository {
  return {
    findActiveByUser: vi.fn().mockResolvedValue(undefined),
    findByStripeCustomerId: vi.fn().mockResolvedValue(undefined),
    findByStripeSubscriptionId: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateStripeIds: vi.fn(),
    ...overrides,
  };
}

describe("PaymentService", () => {
  let gateway: IPaymentGateway;
  let qr: IQrGenerator;
  let subRepo: ISubscriptionRepository;
  let service: PaymentService;

  beforeEach(() => {
    gateway = makePaymentGateway();
    qr = makeQrGenerator();
    subRepo = makeSubscriptionRepo();
    service = new PaymentService(gateway, qr, subRepo);
  });

  describe("createCheckoutSession", () => {
    it("deleguje na payment gateway s monthly planem", async () => {
      const result = await service.createCheckoutSession("user-1", "monthly", "https://app.com");

      expect(result).toBe("https://checkout.stripe.com/session-1");
      expect(gateway.createCheckoutSession).toHaveBeenCalledWith({
        plan: "monthly",
        userId: "user-1",
        successUrl: "https://app.com/settings?checkout=success",
        cancelUrl: "https://app.com/settings?checkout=cancel",
      });
    });

    it("deleguje na payment gateway s yearly planem", async () => {
      await service.createCheckoutSession("user-1", "yearly", "https://app.com");

      expect(gateway.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ plan: "yearly" }),
      );
    });
  });

  describe("createCustomerPortalSession", () => {
    it("vytvori portal session pro uzivatele se Stripe predplatnym", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(
        makeSubscription({ stripeCustomerId: "cus_123" }),
      );

      const result = await service.createCustomerPortalSession("user-1", "https://app.com");

      expect(result).toBe("https://billing.stripe.com/portal-1");
      expect(gateway.createCustomerPortalSession).toHaveBeenCalledWith(
        "cus_123",
        "https://app.com/settings",
      );
    });

    it("vyhodi chybu pokud uzivatel nema Stripe predplatne", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);

      await expect(
        service.createCustomerPortalSession("user-1", "https://app.com"),
      ).rejects.toThrow("No Stripe subscription found");
    });

    it("vyhodi chybu pokud predplatne nema stripeCustomerId", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(
        makeSubscription({ stripeCustomerId: null }),
      );

      await expect(
        service.createCustomerPortalSession("user-1", "https://app.com"),
      ).rejects.toThrow("No Stripe subscription found");
    });
  });

  describe("generateBankTransferQR", () => {
    it("generuje SPAYD QR kod pro mesicni plan", async () => {
      const result = await service.generateBankTransferQR("abc-def-123", "monthly", "CZ1234567890");

      expect(result).toBe("data:image/png;base64,qr-data");
      expect(qr.toDataURL).toHaveBeenCalledWith(
        "SPD*1.0*ACC:CZ1234567890*AM:49.00*CC:CZK*X-VS:abcdef123*MSG:SweptMind Premium",
      );
    });

    it("generuje SPAYD QR kod pro rocni plan", async () => {
      await service.generateBankTransferQR("abc-def-123", "yearly", "CZ1234567890");

      expect(qr.toDataURL).toHaveBeenCalledWith(expect.stringContaining("AM:490.00"));
    });
  });
});
