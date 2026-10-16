// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { createNativeLoginChallenge, takeNativeLoginCode } from "../native-login-client";

describe("native login – app side", () => {
  beforeEach(() => sessionStorage.clear());

  it("challenge je SHA-256 tajemství, které ověřuje server", async () => {
    const { verifier, challenge } = await createNativeLoginChallenge();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("z odkazu aplikace vezme kód jen jednou", () => {
    const url = "com.sweptmind.app://auth?code=abc.def";
    expect(takeNativeLoginCode(url)).toBe("abc.def");
    expect(takeNativeLoginCode(url)).toBeNull();
  });

  it("jiné odkazy ignoruje", () => {
    expect(takeNativeLoginCode("https://sweptmind.com/auth?code=x")).toBeNull();
    expect(takeNativeLoginCode("com.sweptmind.app://other?code=x")).toBeNull();
    expect(takeNativeLoginCode("com.sweptmind.app://auth")).toBeNull();
    expect(takeNativeLoginCode("nonsense")).toBeNull();
  });
});
