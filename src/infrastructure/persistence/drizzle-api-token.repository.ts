import { eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { IApiTokenRepository } from "@/domain/repositories/api-token.repository";
import type { ApiToken, CreateApiTokenInput } from "@/domain/entities/api-token";

export class DrizzleApiTokenRepository implements IApiTokenRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateApiTokenInput): Promise<ApiToken> {
    const [token] = await this.db.insert(schema.apiTokens).values(input).returning();
    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<ApiToken | undefined> {
    return this.db.query.apiTokens.findFirst({
      where: eq(schema.apiTokens.tokenHash, tokenHash),
    });
  }

  async findByUserId(userId: string): Promise<ApiToken[]> {
    return this.db.query.apiTokens.findMany({
      where: eq(schema.apiTokens.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db
      .update(schema.apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiTokens.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.apiTokens).where(eq(schema.apiTokens.id, id));
  }
}
