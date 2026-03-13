import type { TaskAttachment, CreateAttachmentInput } from "../entities/task-attachment";
import type { IAttachmentRepository } from "../repositories/attachment.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_STORAGE = 1024 * 1024 * 1024; // 1 GB

export class AttachmentService {
  constructor(
    private readonly attachmentRepo: IAttachmentRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
  ) {}

  private async isPremium(userId: string): Promise<boolean> {
    const sub = await this.subscriptionRepo.findActiveByUser(userId);
    if (!sub) return false;
    return sub.currentPeriodEnd > new Date();
  }

  private async verifyTaskOwnership(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");
  }

  async getByTaskId(taskId: string, userId: string): Promise<TaskAttachment[]> {
    await this.verifyTaskOwnership(taskId, userId);
    return this.attachmentRepo.findByTaskId(taskId);
  }

  async upload(userId: string, input: CreateAttachmentInput): Promise<TaskAttachment> {
    await this.verifyTaskOwnership(input.taskId, userId);

    if (!(await this.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    if (input.fileSize > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 10 MB");
    }

    const totalSize = await this.attachmentRepo.getTotalSizeByUser(userId);
    if (totalSize + input.fileSize > MAX_TOTAL_STORAGE) {
      throw new Error("Storage limit exceeded");
    }

    return this.attachmentRepo.create(input);
  }

  async download(attachmentId: string, userId: string): Promise<string> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    await this.verifyTaskOwnership(attachment.taskId, userId);

    if (!(await this.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    return attachment.blobUrl;
  }

  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    await this.verifyTaskOwnership(attachment.taskId, userId);

    if (!(await this.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    await this.attachmentRepo.delete(attachmentId);
  }
}
