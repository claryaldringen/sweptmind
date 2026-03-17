import { createHash } from "crypto";

/**
 * Hashes a token using SHA-256.
 * Used to store password reset tokens securely — only the hash is persisted,
 * never the plaintext token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
