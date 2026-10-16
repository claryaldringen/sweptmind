import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService, EmailMismatchError } from "../account.service";
import type { IBlobStorage } from "../../ports/blob-storage";
import type { IPaymentGateway } from "../../ports/payment-gateway";
import type { IAttachmentRepository } from "../../repositories/attachment.repository";
import type { ISubscriptionRepository } from "../../repositories/subscription.repository";
import type { IUserRepository } from "../../repositories/user.repository";
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

describe("AccountService.deleteAccount", () => {
  let userRepo: Pick<IUserRepository, "findById" | "delete">;
  let subscriptionRepo: Pick<ISubscriptionRepository, "findActiveByUser">;
  let paymentGateway: Pick<IPaymentGateway, "cancelSubscription">;
  let attachmentRepo: Pick<IAttachmentRepository, "findBlobUrlsByUser">;
  let blobStorage: Pick<IBlobStorage, "delete">;
  let service: AccountService;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn().mockResolvedValue({ id: "user-1", email: "Martin@Example.com" }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    subscriptionRepo = { findActiveByUser: vi.fn().mockResolvedValue(undefined) };
    paymentGateway = { cancelSubscription: vi.fn().mockResolvedValue(undefined) };
    attachmentRepo = { findBlobUrlsByUser: vi.fn().mockResolvedValue([]) };
    blobStorage = { delete: vi.fn().mockResolvedValue(undefined) };
    service = new AccountService(
      userRepo as IUserRepository,
      subscriptionRepo as ISubscriptionRepository,
      paymentGateway as IPaymentGateway,
      attachmentRepo as IAttachmentRepository,
      blobStorage as IBlobStorage,
    );
  });

  it("deletes the user when the confirmation email matches, ignoring case and spaces", async () => {
    await service.deleteAccount("user-1", "  martin@example.COM ");

    expect(userRepo.delete).toHaveBeenCalledWith("user-1");
  });

  it("refuses a wrong confirmation email and keeps the account", async () => {
    await expect(service.deleteAccount("user-1", "someone@else.com")).rejects.toBeInstanceOf(
      EmailMismatchError,
    );
    expect(userRepo.delete).not.toHaveBeenCalled();
  });

  it("refuses an unknown user", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(undefined);

    await expect(service.deleteAccount("user-1", "martin@example.com")).rejects.toThrow(
      "User not found",
    );
  });

  it("cancels an active Stripe subscription before deleting", async () => {
    vi.mocked(subscriptionRepo.findActiveByUser).mockResolvedValue(makeSubscription());

    await service.deleteAccount("user-1", "martin@example.com");

    expect(paymentGateway.cancelSubscription).toHaveBeenCalledWith("sub_123");
    expect(vi.mocked(paymentGateway.cancelSubscription).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(userRepo.delete).mock.invocationCallOrder[0],
    );
  });

  it("keeps the account when Stripe cancellation fails", async () => {
    vi.mocked(subscriptionRepo.findActiveByUser).mockResolvedValue(makeSubscription());
    vi.mocked(paymentGateway.cancelSubscription).mockRejectedValue(new Error("Stripe down"));

    await expect(service.deleteAccount("user-1", "martin@example.com")).rejects.toThrow(
      "Stripe down",
    );
    expect(userRepo.delete).not.toHaveBeenCalled();
  });

  it("does not call Stripe for a bank transfer subscription", async () => {
    vi.mocked(subscriptionRepo.findActiveByUser).mockResolvedValue(
      makeSubscription({ paymentMethod: "bank_transfer", stripeSubscriptionId: null }),
    );

    await service.deleteAccount("user-1", "martin@example.com");

    expect(paymentGateway.cancelSubscription).not.toHaveBeenCalled();
    expect(userRepo.delete).toHaveBeenCalled();
  });

  it("deletes attachment files collected before the user, even if one of them fails", async () => {
    vi.mocked(attachmentRepo.findBlobUrlsByUser).mockResolvedValue([
      "/uploads/attachments/a.pdf",
      "/uploads/attachments/b.png",
    ]);
    vi.mocked(blobStorage.delete).mockRejectedValueOnce(new Error("EACCES"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await service.deleteAccount("user-1", "martin@example.com");

    expect(vi.mocked(attachmentRepo.findBlobUrlsByUser).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(userRepo.delete).mock.invocationCallOrder[0],
    );
    expect(blobStorage.delete).toHaveBeenCalledWith("/uploads/attachments/a.pdf");
    expect(blobStorage.delete).toHaveBeenCalledWith("/uploads/attachments/b.png");
  });
});
