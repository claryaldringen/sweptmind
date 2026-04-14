import { eq, desc } from "drizzle-orm";
import type { Database } from "@/server/db";
import { apiTokens } from "@/server/db/schema";
import type { IApiTokenRepository } from "@/domain/repositories/api-token.repository";
import type { ApiToken, CreateApiTokenInput } from "@/domain/entities/api-token";

export class DrizzleApiTokenRepository implements IApiTokenRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateApiTokenInput): Promise<ApiToken> {
    const [token] = await this.db.insert(apiTokens).values(input).returning();
    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<ApiToken | undefined> {
    const [token] = await this.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);
    return token;
  }

  async findByUserId(userId: string): Promise<ApiToken[]> {
    return this.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .orderBy(desc(apiTokens.createdAt));
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(apiTokens).where(eq(apiTokens.id, id));
  }
}
