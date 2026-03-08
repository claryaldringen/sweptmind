import type { Step } from "../entities/task";

export interface IStepRepository {
  findById(id: string): Promise<Step | undefined>;
  findByTask(taskId: string): Promise<Step[]>;
  findByTaskIds(taskIds: string[]): Promise<Map<string, Step[]>>;
  findMaxSortOrder(taskId: string): Promise<number | undefined>;
  create(values: { id?: string; taskId: string; title: string; sortOrder: number }): Promise<Step>;
  update(id: string, data: Partial<Step>): Promise<Step>;
  delete(id: string): Promise<void>;
}
