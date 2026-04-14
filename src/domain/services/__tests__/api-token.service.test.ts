import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiTokenService } from "../api-token.service";
import type { IApiTokenRepository } from "../../repositories/api-token.repository";

function createMockRepo(): IApiTokenRepository {
  return {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    findByUserId: vi.fn(),
    updateLastUsed: vi.fn(),
    delete: vi.fn(),
  };
}

describe("ApiTokenService", () => {
  let repo: IApiTokenRepository;
  let service: ApiTokenService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new ApiTokenService(repo);
  });

  describe("createToken", () => {
    it("should return a token string starting with sm_", async () => {
      vi.mocked(repo.create).mockResolvedValue({
        id: "tok-1",
        userId: "user-1",
        tokenHash: "hashed",
        name: "My Token",
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const result = await service.createToken("user-1", "My Token");
      expect(result.rawToken).toMatch(/^sm_[a-f0-9]{64}$/);
      expect(result.token.name).toBe("My Token");
      expect(repo.create).toHaveBeenCalledWith({
        userId: "user-1",
        tokenHash: expect.any(String),
        name: "My Token",
      });
    });
  });

  describe("validateToken", () => {
    it("should return userId for valid token", async () => {
      vi.mocked(repo.create).mockResolvedValue({
        id: "tok-1",
        userId: "user-1",
        tokenHash: "hashed",
        name: "Test",
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const { rawToken } = await service.createToken("user-1", "Test");

      const hash = await service.hashToken(rawToken);
      vi.mocked(repo.findByTokenHash).mockResolvedValue({
        id: "tok-1",
        userId: "user-1",
        tokenHash: hash,
        name: "Test",
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const userId = await service.validateToken(rawToken);
      expect(userId).toBe("user-1");
      expect(repo.updateLastUsed).toHaveBeenCalledWith("tok-1");
    });

    it("should return null for invalid token", async () => {
      vi.mocked(repo.findByTokenHash).mockResolvedValue(undefined);
      const userId = await service.validateToken("sm_invalid");
      expect(userId).toBeNull();
    });
  });

  describe("listTokens", () => {
    it("should return tokens for user", async () => {
      const tokens = [
        {
          id: "tok-1",
          userId: "user-1",
          tokenHash: "h1",
          name: "Token 1",
          lastUsedAt: null,
          createdAt: new Date(),
        },
      ];
      vi.mocked(repo.findByUserId).mockResolvedValue(tokens);

      const result = await service.listTokens("user-1");
      expect(result).toEqual(tokens);
    });
  });

  describe("revokeToken", () => {
    it("should delete the token", async () => {
      await service.revokeToken("tok-1");
      expect(repo.delete).toHaveBeenCalledWith("tok-1");
    });
  });
});
