import type { TaskAiAnalysis, CreateAiAnalysisInput } from "../entities/task-ai-analysis";

export interface ITaskAiAnalysisRepository {
  findByTaskId(taskId: string): Promise<TaskAiAnalysis | undefined>;
  findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAiAnalysis>>;
  upsert(input: CreateAiAnalysisInput): Promise<TaskAiAnalysis>;
  deleteByTaskId(taskId: string): Promise<void>;
}
