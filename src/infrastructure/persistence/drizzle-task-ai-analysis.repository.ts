import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ITaskAiAnalysisRepository } from "@/domain/repositories/task-ai-analysis.repository";
import type { TaskAiAnalysis, CreateAiAnalysisInput } from "@/domain/entities/task-ai-analysis";

export class DrizzleTaskAiAnalysisRepository implements ITaskAiAnalysisRepository {
  constructor(private readonly db: Database) {}

  async findByTaskId(taskId: string): Promise<TaskAiAnalysis | undefined> {
    return this.db.query.taskAiAnalyses.findFirst({
      where: eq(schema.taskAiAnalyses.taskId, taskId),
    });
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAiAnalysis>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.taskAiAnalyses.findMany({
      where: inArray(schema.taskAiAnalyses.taskId, taskIds),
    });
    const map = new Map<string, TaskAiAnalysis>();
    for (const row of rows) {
      map.set(row.taskId, row);
    }
    return map;
  }

  async upsert(input: CreateAiAnalysisInput): Promise<TaskAiAnalysis> {
    const [result] = await this.db
      .insert(schema.taskAiAnalyses)
      .values(input)
      .onConflictDoUpdate({
        target: schema.taskAiAnalyses.taskId,
        set: {
          isActionable: input.isActionable,
          suggestion: input.suggestion,
          analyzedTitle: input.analyzedTitle,
          createdAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db.delete(schema.taskAiAnalyses).where(eq(schema.taskAiAnalyses.taskId, taskId));
  }
}
