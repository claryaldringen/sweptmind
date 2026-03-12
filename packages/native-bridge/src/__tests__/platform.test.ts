import { describe, it, expect, afterEach } from "vitest";
import { getPlatform } from "../platform";

describe("getPlatform", () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("returns 'web' on server (no window)", () => {
    delete (globalThis as any).window;
    expect(getPlatform()).toBe("web");
  });

  it("returns 'web' when no native runtime detected", () => {
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(getPlatform()).toBe("web");
  });

  it("returns 'electron' when electronAPI is present", () => {
    Object.defineProperty(globalThis, "window", {
      value: { electronAPI: {} },
      writable: true,
      configurable: true,
    });
    expect(getPlatform()).toBe("electron");
  });

  it("returns 'ios' when Capacitor reports ios", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        Capacitor: {
          isNativePlatform: () => true,
          getPlatform: () => "ios",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(getPlatform()).toBe("ios");
  });

  it("returns 'android' when Capacitor reports android", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        Capacitor: {
          isNativePlatform: () => true,
          getPlatform: () => "android",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(getPlatform()).toBe("android");
  });
});
