// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

function installEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
}

describe("pwa-install", () => {
  // The store lives at module level — load a fresh copy per test
  let mod: typeof import("../pwa-install");
  beforeEach(async () => {
    vi.resetModules();
    mod = await import("../pwa-install");
  });

  it("bez události prohlížeče instalaci nenabízí", () => {
    const { result } = renderHook(() => mod.usePwaInstallState());
    expect(result.current).toBe("unavailable");
  });

  it("zachytí událost prohlížeče a potlačí jeho vlastní výzvu", () => {
    const { result } = renderHook(() => mod.usePwaInstallState());
    const event = installEvent("accepted");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current).toBe("available");
  });

  it("výzvu ukáže jen jednou a vrátí volbu uživatele", async () => {
    const { result } = renderHook(() => mod.usePwaInstallState());
    const event = installEvent("dismissed");
    act(() => {
      window.dispatchEvent(event);
    });

    let accepted: boolean | undefined;
    await act(async () => {
      accepted = await mod.promptPwaInstall();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(accepted).toBe(false);
    expect(result.current).toBe("unavailable");
    expect(await mod.promptPwaInstall()).toBe(false);
  });

  it("po instalaci hlásí nainstalováno", () => {
    const { result } = renderHook(() => mod.usePwaInstallState());
    act(() => {
      window.dispatchEvent(installEvent("accepted"));
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current).toBe("installed");
  });
});
