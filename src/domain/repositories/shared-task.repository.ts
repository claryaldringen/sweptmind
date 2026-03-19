import type { SharedTask } from "../entities/shared-task";

export interface ISharedTaskRepository {
  create(connectionId: string, sourceTaskId: string, targetTaskId: string): Promise<SharedTask>;
  findById(id: string): Promise<SharedTask | undefined>;
  findBySourceTask(taskId: string): Promise<SharedTask[]>;
  findByTargetTask(taskId: string): Promise<SharedTask | undefined>;
  findByConnection(connectionId: string): Promise<SharedTask[]>;
  deleteByConnection(connectionId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
