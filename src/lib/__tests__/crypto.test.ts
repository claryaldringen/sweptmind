import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hashToken, encrypt, decrypt } from "../crypto";

describe("hashToken", () => {
  it("returns consistent hash for the same input", () => {
    const hash1 = hashToken("my-secret-token");
    const hash2 = hashToken("my-secret-token");
    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different input", () => {
    const hash1 = hashToken("token-a");
    const hash2 = hashToken("token-b");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a hex string (64 characters for SHA-256)", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles empty string input", () => {
    const hash = hashToken("");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("encrypt / decrypt", () => {
  const originalEnv = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-for-encryption-tests";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AUTH_SECRET = originalEnv;
    } else {
      delete process.env.AUTH_SECRET;
    }
  });

  it("encrypts and decrypts a string back to original", () => {
    const plaintext = "sk-my-super-secret-api-key-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for each call (random IV)", () => {
    const plaintext = "same-input";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
    // But both decrypt to the same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it("encrypted format is iv:authTag:ciphertext (hex parts)", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    // Ciphertext is hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  it("handles unicode and special characters", () => {
    const plaintext = "klíč-s-háčky-čžšřďťň-🔑";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("throws on invalid encrypted format", () => {
    expect(() => decrypt("not-valid-format")).toThrow("Invalid encrypted format");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // Tamper with ciphertext
    parts[2] = "00" + parts[2].slice(2);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws when AUTH_SECRET is missing", () => {
    delete process.env.AUTH_SECRET;
    expect(() => encrypt("test")).toThrow("AUTH_SECRET environment variable is required");
    expect(() => decrypt("aa:bb:cc")).toThrow("AUTH_SECRET environment variable is required");
  });

  it("decryption fails with different AUTH_SECRET", () => {
    const encrypted = encrypt("my-key");
    process.env.AUTH_SECRET = "different-secret";
    expect(() => decrypt(encrypted)).toThrow();
  });
});
