import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionService } from "../subscription.service";
import type { ISubscriptionRepository } from "../../repositories/subscription.repository";
import type { Subscription } from "../../entities/subscription";

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    userId: "user-1",
    status: "active",
    plan: "monthly",
    paymentMethod: "bank_transfer",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-12-31"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeSubRepo(overrides: Partial<ISubscriptionRepository> = {}): ISubscriptionRepository {
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

describe("SubscriptionService", () => {
  let subRepo: ISubscriptionRepository;
  let service: SubscriptionService;

  beforeEach(() => {
    subRepo = makeSubRepo();
    service = new SubscriptionService(subRepo);
  });

  describe("isPremium", () => {
    it("vrátí true pokud má uživatel aktivní předplatné s budoucím periodEnd", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(
        makeSubscription({ currentPeriodEnd: futureDate }),
      );

      const result = await service.isPremium("user-1");

      expect(result).toBe(true);
      expect(subRepo.findActiveByUser).toHaveBeenCalledWith("user-1");
    });

    it("vrátí false pokud uživatel nemá žádné předplatné", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);

      const result = await service.isPremium("user-1");

      expect(result).toBe(false);
    });

    it("vrátí false pokud období předplatného vypršelo", async () => {
      const pastDate = new Date("2020-01-01");
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(
        makeSubscription({ currentPeriodEnd: pastDate }),
      );

      const result = await service.isPremium("user-1");

      expect(result).toBe(false);
    });
  });

  describe("activateBankTransfer", () => {
    it("vytvoří měsíční předplatné pro 49 CZK", async () => {
      const created = makeSubscription({ plan: "monthly" });
      vi.mocked(subRepo.create).mockResolvedValue(created);

      const result = await service.activateBankTransfer("user-1", 49);

      expect(result).toEqual(created);
      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          plan: "monthly",
          paymentMethod: "bank_transfer",
        }),
      );

      const createArg = vi.mocked(subRepo.create).mock.calls[0][0];
      const diffMs = createArg.currentPeriodEnd.getTime() - createArg.currentPeriodStart.getTime();
      // Měsíční interval: cca 28-31 dní
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(28);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it("vytvoří roční předplatné pro 490 CZK", async () => {
      const created = makeSubscription({ plan: "yearly" });
      vi.mocked(subRepo.create).mockResolvedValue(created);

      const result = await service.activateBankTransfer("user-1", 490);

      expect(result).toEqual(created);
      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          plan: "yearly",
          paymentMethod: "bank_transfer",
        }),
      );

      const createArg = vi.mocked(subRepo.create).mock.calls[0][0];
      const diffMs = createArg.currentPeriodEnd.getTime() - createArg.currentPeriodStart.getTime();
      // Roční interval: cca 365-366 dní
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(365);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it("vyhodí chybu pro neplatnou částku", async () => {
      await expect(service.activateBankTransfer("user-1", 100)).rejects.toThrow(
        "Invalid payment amount: 100 CZK",
      );
      expect(subRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("handleStripeSubscriptionUpdate", () => {
    it("aktualizuje existující předplatné", async () => {
      const sub = makeSubscription({
        id: "sub-1",
        stripeSubscriptionId: "stripe-sub-1",
      });
      vi.mocked(subRepo.findByStripeSubscriptionId).mockResolvedValue(sub);
      vi.mocked(subRepo.updateStatus).mockResolvedValue(makeSubscription({ status: "canceled" }));

      const newPeriodEnd = new Date("2027-01-01");
      await service.handleStripeSubscriptionUpdate("stripe-sub-1", "canceled", newPeriodEnd);

      expect(subRepo.findByStripeSubscriptionId).toHaveBeenCalledWith("stripe-sub-1");
      expect(subRepo.updateStatus).toHaveBeenCalledWith("sub-1", "canceled", newPeriodEnd);
    });

    it("nic neudělá pokud předplatné neexistuje", async () => {
      vi.mocked(subRepo.findByStripeSubscriptionId).mockResolvedValue(undefined);

      const newPeriodEnd = new Date("2027-01-01");
      await service.handleStripeSubscriptionUpdate("nonexistent", "active", newPeriodEnd);

      expect(subRepo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
