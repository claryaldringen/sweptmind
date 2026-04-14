import { createHash, randomBytes } from "crypto";
import type { IApiTokenRepository } from "../repositories/api-token.repository";
import type { ApiToken } from "../entities/api-token";

export class ApiTokenService {
  constructor(private readonly repo: IApiTokenRepository) {}

  async createToken(
    userId: string,
    name: string,
  ): Promise<{ rawToken: string; token: ApiToken }> {
    const rawToken = `sm_${randomBytes(32).toString("hex")}`;
    const tokenHash = await this.hashToken(rawToken);
    const token = await this.repo.create({ userId, tokenHash, name });
    return { rawToken, token };
  }

  async validateToken(rawToken: string): Promise<string | null> {
    const tokenHash = await this.hashToken(rawToken);
    const token = await this.repo.findByTokenHash(tokenHash);
    if (!token) return null;
    await this.repo.updateLastUsed(token.id);
    return token.userId;
  }

  async hashToken(rawToken: string): Promise<string> {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  async listTokens(userId: string): Promise<ApiToken[]> {
    return this.repo.findByUserId(userId);
  }

  async revokeToken(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
