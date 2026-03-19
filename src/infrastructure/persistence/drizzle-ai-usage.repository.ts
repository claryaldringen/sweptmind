import { eq, and, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { AiUsage } from "@/domain/entities/ai-usage";
import type { IAiUsageRepository } from "@/domain/repositories/ai-usage.repository";

export class DrizzleAiUsageRepository implements IAiUsageRepository {
  constructor(private readonly db: Database) {}

  async getByUserAndMonth(userId: string, yearMonth: string): Promise<AiUsage | undefined> {
    return this.db.query.aiUsage.findFirst({
      where: and(eq(schema.aiUsage.userId, userId), eq(schema.aiUsage.yearMonth, yearMonth)),
    });
  }

  async increment(userId: string, yearMonth: string): Promise<AiUsage> {
    const [row] = await this.db
      .insert(schema.aiUsage)
      .values({ userId, yearMonth, analysisCount: 1 })
      .onConflictDoUpdate({
        target: [schema.aiUsage.userId, schema.aiUsage.yearMonth],
        set: {
          analysisCount: sql`${schema.aiUsage.analysisCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }
}
