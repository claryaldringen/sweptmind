import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Hashes a token using SHA-256.
 * Used to store password reset tokens securely — only the hash is persisted,
 * never the plaintext token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Derives a 32-byte AES key from AUTH_SECRET using SHA-256.
 */
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is required for encryption");
  }
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string produced by encrypt().
 * Expects format: iv:authTag:ciphertext (all hex-encoded).
 */
export function decrypt(encrypted: string): string {
  const key = deriveKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  const [ivHex, authTagHex, ciphertext] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
