import { describe, it, expect, vi, beforeEach } from "vitest";
import { PushSubscriptionService } from "../push-subscription.service";
import type { IPushSubscriptionRepository } from "../../repositories/push-subscription.repository";
import type { PushSubscription } from "../../entities/push-subscription";

function makeRepo(existing?: Partial<PushSubscription>): IPushSubscriptionRepository {
  return {
    upsert: vi.fn(),
    deleteByEndpoint: vi.fn(),
    findFirstByUser: vi.fn().mockResolvedValue(existing as PushSubscription | undefined),
    updatePreferences: vi.fn(),
    findAllByUser: vi.fn().mockResolvedValue([]),
  };
}

const androidDevice = {
  endpoint: "fcm-token",
  p256dh: "_",
  auth: "_",
  platform: "android" as const,
};

describe("PushSubscriptionService", () => {
  let repo: IPushSubscriptionRepository;

  describe("subscribe", () => {
    beforeEach(() => {
      repo = makeRepo({ notifyDueDate: false, notifyReminder: true });
    });

    it("bez preferencí zachová ty, které si uživatel nastavil", async () => {
      await new PushSubscriptionService(repo).subscribe("user-1", androidDevice);
      expect(repo.upsert).toHaveBeenCalledWith("user-1", {
        ...androidDevice,
        notifyDueDate: false,
        notifyReminder: true,
      });
    });

    it("výslovně zadané preference použije", async () => {
      await new PushSubscriptionService(repo).subscribe("user-1", {
        ...androidDevice,
        notifyDueDate: true,
        notifyReminder: false,
      });
      expect(repo.upsert).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ notifyDueDate: true, notifyReminder: false }),
      );
    });

    it("první zařízení uživatele má vše zapnuté", async () => {
      repo = makeRepo(undefined);
      await new PushSubscriptionService(repo).subscribe("user-1", androidDevice);
      expect(repo.upsert).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ notifyDueDate: true, notifyReminder: true }),
      );
    });
  });

  describe("getPreferences", () => {
    it("bez odběru vrátí výchozí zapnuté preference", async () => {
      repo = makeRepo(undefined);
      expect(await new PushSubscriptionService(repo).getPreferences("user-1")).toEqual({
        notifyDueDate: true,
        notifyReminder: true,
      });
    });
  });
});
