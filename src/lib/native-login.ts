import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing in to the native app through the system browser (Google refuses OAuth inside
 * an app's WebView): the app keeps a random verifier and opens /native-login with its
 * SHA-256 (the challenge); after the browser sign-in, the app gets a short-lived code
 * bound to that challenge and trades it, with the verifier, for a session. Another app
 * catching the com.sweptmind.app:// link can't use the code without the verifier.
 */

const CODE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/; // base64url SHA-256

export const NATIVE_CHALLENGE_COOKIE = "sweptmind-native-challenge";
export const NATIVE_REDIRECT_URL = "com.sweptmind.app://auth";

export function isValidChallenge(value: unknown): value is string {
  return typeof value === "string" && CHALLENGE_RE.test(value);
}

export function challengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`native-login:${payload}`).digest("base64url");
}

export function createNativeLoginCode(
  userId: string,
  challenge: string,
  secret: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, c: challenge, e: now + CODE_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** The user the code was issued for, or null when it's forged, expired or the verifier differs. */
export function verifyNativeLoginCode(
  code: string,
  verifier: string,
  secret: string,
  now = Date.now(),
): string | null {
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let data: { u?: unknown; c?: unknown; e?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data.u !== "string" || typeof data.c !== "string" || typeof data.e !== "number") {
    return null;
  }
  if (now > data.e) return null;
  if (challengeFromVerifier(verifier) !== data.c) return null;
  return data.u;
}
