/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    createChannel: vi.fn(),
    addListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

const mockPlatform = vi.hoisted(() => ({ value: "ios" }));
const mockAppInfo = vi.hoisted(() => ({ getCapabilities: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: vi.fn(() => mockPlatform.value),
  },
  registerPlugin: vi.fn(() => mockAppInfo),
}));

import { CapacitorPushAdapter } from "../adapters/capacitor/capacitor-push.adapter";
import { PushNotifications } from "@capacitor/push-notifications";

describe("CapacitorPushAdapter", () => {
  let adapter: CapacitorPushAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorPushAdapter();
    mockPlatform.value = "ios";
  });

  function mockSuccessfulRegistration(token: string) {
    const remove = vi.fn();
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({
      receive: "granted",
    } as any);
    vi.mocked(PushNotifications.register).mockResolvedValue();
    vi.mocked(PushNotifications.addListener).mockImplementation((event: string, cb: any) => {
      if (event === "registration") setTimeout(() => cb({ value: token }), 0);
      return Promise.resolve({ remove }) as any;
    });
    return remove;
  }

  it("isSupported returns true", () => {
    expect(adapter.isSupported()).toBe(true);
  });

  it("register requests permissions and returns token", async () => {
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({
      receive: "granted",
    } as any);
    vi.mocked(PushNotifications.register).mockResolvedValue();
    vi.mocked(PushNotifications.addListener).mockImplementation((event: string, cb: any) => {
      if (event === "registration") {
        setTimeout(() => cb({ value: "device-token-abc" }), 0);
      }
      return Promise.resolve({ remove: vi.fn() });
    });

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

  it("register on Android creates the reminders channel and cleans up listeners", async () => {
    mockPlatform.value = "android";
    const remove = mockSuccessfulRegistration("android-token");

    const result = await adapter.register({ androidChannelName: "Připomínky" });

    expect(result).toEqual({ token: "android-token", platform: "android" });
    expect(PushNotifications.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "reminders", name: "Připomínky" }),
    );
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("register does not create a channel on iOS", async () => {
    mockSuccessfulRegistration("ios-token");
    await adapter.register();
    expect(PushNotifications.createChannel).not.toHaveBeenCalled();
  });

  it("getPermissionStatus maps prompt states", async () => {
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({
      receive: "prompt-with-rationale",
    } as any);
    expect(await adapter.getPermissionStatus()).toBe("prompt");

    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({ receive: "granted" } as any);
    expect(await adapter.getPermissionStatus()).toBe("granted");
  });

  it("unregister unregisters from the push service", async () => {
    await adapter.unregister();
    expect(PushNotifications.unregister).toHaveBeenCalled();
  });

  it("onNotificationOpened forwards the notification data", async () => {
    vi.mocked(PushNotifications.addListener).mockResolvedValue({ remove: vi.fn() } as any);
    const cb = vi.fn();
    adapter.onNotificationOpened(cb);

    await vi.waitFor(() => {
      expect(PushNotifications.addListener).toHaveBeenCalledWith(
        "pushNotificationActionPerformed",
        expect.any(Function),
      );
    });
    const handler = vi.mocked(PushNotifications.addListener).mock.calls[0][1] as any;
    handler({ notification: { data: { url: "/lists/1?task=2" } } });
    expect(cb).toHaveBeenCalledWith({ url: "/lists/1?task=2" });
  });

  it("isConfigured asks the native app whether Firebase is set up (Android)", async () => {
    mockPlatform.value = "android";
    mockAppInfo.getCapabilities.mockResolvedValue({ pushConfigured: false });
    expect(await adapter.isConfigured()).toBe(false);

    mockAppInfo.getCapabilities.mockResolvedValue({ pushConfigured: true });
    expect(await adapter.isConfigured()).toBe(true);
  });

  it("isConfigured is false when the native AppInfo plugin is missing", async () => {
    mockPlatform.value = "android";
    mockAppInfo.getCapabilities.mockRejectedValue(new Error("not implemented"));
    expect(await adapter.isConfigured()).toBe(false);
  });
});
