import type { IBlobStorage } from "../ports/blob-storage";
import type { IPaymentGateway } from "../ports/payment-gateway";
import type { IAttachmentRepository } from "../repositories/attachment.repository";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";
import type { IUserRepository } from "../repositories/user.repository";

/** The typed confirmation doesn't match the account's email. */
export class EmailMismatchError extends Error {
  constructor() {
    super("Email does not match");
    this.name = "EmailMismatchError";
  }
}

export class AccountService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly attachmentRepo: IAttachmentRepository,
    private readonly blobStorage: IBlobStorage,
  ) {}

  /**
   * Deletes the account with all its data. The user confirms by typing their email.
   * The Stripe subscription is canceled first, so a failure there leaves the account intact
   * rather than a deleted user who keeps being charged.
   */
  async deleteAccount(userId: string, confirmationEmail: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.email || normalizeEmail(confirmationEmail) !== normalizeEmail(user.email)) {
      throw new EmailMismatchError();
    }

    const subscription = await this.subscriptionRepo.findActiveByUser(userId);
    if (subscription?.stripeSubscriptionId) {
      await this.paymentGateway.cancelSubscription(subscription.stripeSubscriptionId);
    }

    // The attachment rows go with the tasks; the files have to be collected beforehand
    const blobUrls = await this.attachmentRepo.findBlobUrlsByUser(userId);
    await this.userRepo.delete(userId);

    for (const url of blobUrls) {
      await this.blobStorage.delete(url).catch((err) => {
        console.error("[account] attachment file not deleted:", url, err);
      });
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
