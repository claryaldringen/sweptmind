import { describe, it, expect } from "vitest";
import {
  challengeFromVerifier,
  createNativeLoginCode,
  isValidChallenge,
  verifyNativeLoginCode,
} from "../native-login";

const SECRET = "test-secret-that-is-long-enough-for-hmac";
const verifier = "app-generated-random-verifier-0123456789abcdef";
const challenge = challengeFromVerifier(verifier);
const now = Date.parse("2026-10-16T08:00:00Z");

describe("native login code", () => {
  it("challenge je base64url SHA-256", () => {
    expect(isValidChallenge(challenge)).toBe(true);
    expect(isValidChallenge("short")).toBe(false);
    expect(isValidChallenge(`${challenge}=`)).toBe(false);
  });

  it("platný kód se správným tajemstvím aplikace vrátí uživatele", () => {
    const code = createNativeLoginCode("user-1", challenge, SECRET, now);
    expect(verifyNativeLoginCode(code, verifier, SECRET, now + 60_000)).toBe("user-1");
  });

  it("bez správného tajemství aplikace kód nefunguje", () => {
    const code = createNativeLoginCode("user-1", challenge, SECRET, now);
    expect(verifyNativeLoginCode(code, "someone-elses-verifier", SECRET, now)).toBeNull();
  });

  it("prošlý, podvržený nebo poškozený kód odmítne", () => {
    const code = createNativeLoginCode("user-1", challenge, SECRET, now);
    expect(verifyNativeLoginCode(code, verifier, SECRET, now + 5 * 60_000 + 1)).toBeNull();
    expect(verifyNativeLoginCode(code, verifier, "another-secret", now)).toBeNull();

    const [payload, signature] = code.split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: "admin", c: challenge, e: now + 60_000 }),
    ).toString("base64url");
    expect(verifyNativeLoginCode(`${forged}.${signature}`, verifier, SECRET, now)).toBeNull();
    expect(verifyNativeLoginCode(payload, verifier, SECRET, now)).toBeNull();
    expect(verifyNativeLoginCode(`${code}.x`, verifier, SECRET, now)).toBeNull();
  });
});
