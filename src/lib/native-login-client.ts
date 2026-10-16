/**
 * App side of signing in through the system browser (server side: src/lib/native-login.ts).
 * The verifier stays in the app; only its SHA-256 goes to the browser.
 */

const VERIFIER_KEY = "sweptmind-native-login-verifier";
const HANDLED_KEY = "sweptmind-native-login-handled";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A new verifier (kept in the app) and its challenge (sent to the browser). */
export async function createNativeLoginChallenge(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function storeVerifier(verifier: string): void {
  try {
    localStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    // Storage unavailable — the sign-in can't be completed, the app shows an error
  }
}

export function readVerifier(): string | null {
  try {
    return localStorage.getItem(VERIFIER_KEY);
  } catch {
    return null;
  }
}

export function clearVerifier(): void {
  try {
    localStorage.removeItem(VERIFIER_KEY);
  } catch {
    // ignore
  }
}

/**
 * The code from a com.sweptmind.app://auth?code=… link, once — the launch link is reported
 * again whenever the login page mounts, and a used code must not be retried in a loop.
 */
export function takeNativeLoginCode(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "com.sweptmind.app:" || parsed.host !== "auth") return null;
  const code = parsed.searchParams.get("code");
  if (!code) return null;
  try {
    if (sessionStorage.getItem(HANDLED_KEY) === code) return null;
    sessionStorage.setItem(HANDLED_KEY, code);
  } catch {
    // Without storage the guard is off; a failed code just shows an error
  }
  return code;
}
