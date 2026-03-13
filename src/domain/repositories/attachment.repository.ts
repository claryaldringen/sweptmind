import type { TaskAttachment, CreateAttachmentInput } from "../entities/task-attachment";

export interface IAttachmentRepository {
  findByTaskId(taskId: string): Promise<TaskAttachment[]>;
  findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAttachment[]>>;
  findById(id: string): Promise<TaskAttachment | undefined>;
  create(input: CreateAttachmentInput): Promise<TaskAttachment>;
  delete(id: string): Promise<void>;
  getTotalSizeByUser(userId: string): Promise<number>;
}
