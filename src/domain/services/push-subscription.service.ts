import type { IPushSubscriptionRepository } from "../repositories/push-subscription.repository";
import type {
  PushPlatform,
  SubscribeInput,
  PushPreferences,
} from "../entities/push-subscription";

const VALID_PLATFORMS: PushPlatform[] = ["web", "ios", "android"];

export class PushSubscriptionService {
  constructor(private readonly pushSubRepo: IPushSubscriptionRepository) {}

  async subscribe(userId: string, input: SubscribeInput): Promise<void> {
    await this.pushSubRepo.upsert(userId, {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      platform: input.platform,
      notifyDueDate: input.notifyDueDate,
      notifyReminder: input.notifyReminder,
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.pushSubRepo.deleteByEndpoint(userId, endpoint);
  }

  async getPreferences(userId: string): Promise<PushPreferences> {
    const sub = await this.pushSubRepo.findFirstByUser(userId);
    return {
      notifyDueDate: sub?.notifyDueDate ?? true,
      notifyReminder: sub?.notifyReminder ?? true,
    };
  }

  async updatePreferences(userId: string, prefs: Partial<PushPreferences>): Promise<void> {
    await this.pushSubRepo.updatePreferences(userId, prefs);
  }

  static isValidPlatform(p: unknown): p is PushPlatform {
    return typeof p === "string" && VALID_PLATFORMS.includes(p as PushPlatform);
  }
}
