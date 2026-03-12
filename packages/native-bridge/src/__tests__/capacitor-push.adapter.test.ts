import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: vi.fn(() => "ios"),
  },
}));

import { CapacitorPushAdapter } from "../adapters/capacitor/capacitor-push.adapter";
import { PushNotifications } from "@capacitor/push-notifications";

describe("CapacitorPushAdapter", () => {
  let adapter: CapacitorPushAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorPushAdapter();
  });

  it("isSupported returns true", () => {
    expect(adapter.isSupported()).toBe(true);
  });

  it("register requests permissions and returns token", async () => {
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({
      receive: "granted",
    } as any);
    vi.mocked(PushNotifications.register).mockResolvedValue();
    vi.mocked(PushNotifications.addListener).mockImplementation(
      (event: string, cb: any) => {
        if (event === "registration") {
          setTimeout(() => cb({ value: "device-token-abc" }), 0);
        }
        return Promise.resolve({ remove: vi.fn() });
      },
    );

    const result = await adapter.register();
    expect(result.token).toBe("device-token-abc");
    expect(result.platform).toBe("ios");
  });

  it("register throws when permission denied", async () => {
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({
      receive: "denied",
    } as any);

    await expect(adapter.register()).rejects.toThrow("Push permission denied");
  });
});
