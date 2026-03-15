import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ITaskAiAnalysisRepository } from "@/domain/repositories/task-ai-analysis.repository";
import type {
  TaskAiAnalysis,
  CreateAiAnalysisInput,
  DecompositionStep,
  CallIntent,
} from "@/domain/entities/task-ai-analysis";

function toEntity(row: typeof schema.taskAiAnalyses.$inferSelect): TaskAiAnalysis {
  return {
    ...row,
    decomposition: (row.decomposition as DecompositionStep[] | null) ?? null,
    callIntent: (row.callIntent as CallIntent | null) ?? null,
  };
}

export class DrizzleTaskAiAnalysisRepository implements ITaskAiAnalysisRepository {
  constructor(private readonly db: Database) {}

  async findByTaskId(taskId: string): Promise<TaskAiAnalysis | undefined> {
    const row = await this.db.query.taskAiAnalyses.findFirst({
      where: eq(schema.taskAiAnalyses.taskId, taskId),
    });
    return row ? toEntity(row) : undefined;
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAiAnalysis>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.taskAiAnalyses.findMany({
      where: inArray(schema.taskAiAnalyses.taskId, taskIds),
    });
    const map = new Map<string, TaskAiAnalysis>();
    for (const row of rows) {
      map.set(row.taskId, toEntity(row));
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
          suggestedTitle: input.suggestedTitle,
          projectName: input.projectName,
          decomposition: input.decomposition,
          duplicateTaskId: input.duplicateTaskId,
          callIntent: input.callIntent,
          analyzedTitle: input.analyzedTitle,
          createdAt: new Date(),
        },
      })
      .returning();
    return toEntity(result);
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db.delete(schema.taskAiAnalyses).where(eq(schema.taskAiAnalyses.taskId, taskId));
  }
}
