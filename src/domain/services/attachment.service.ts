import type { TaskAttachment, CreateAttachmentInput } from "../entities/task-attachment";
import type { IAttachmentRepository } from "../repositories/attachment.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { SubscriptionService } from "./subscription.service";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_STORAGE = 1024 * 1024 * 1024; // 1 GB

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/msword",
  "application/vnd.openxmlformats",
  "application/vnd.ms-",
  "application/zip",
  "application/x-zip",
  "application/gzip",
  "video/",
  "audio/",
];

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType === prefix || mimeType.startsWith(prefix));
}

export class AttachmentService {
  constructor(
    private readonly attachmentRepo: IAttachmentRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private async verifyTaskOwnership(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");
  }

  async getByTaskId(taskId: string, userId: string): Promise<TaskAttachment[]> {
    await this.verifyTaskOwnership(taskId, userId);
    return this.attachmentRepo.findByTaskId(taskId);
  }

  async validateUpload(
    userId: string,
    taskId: string,
    fileSize: number,
    mimeType: string,
  ): Promise<void> {
    await this.verifyTaskOwnership(taskId, userId);

    if (!(await this.subscriptionService.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    if (!isAllowedMimeType(mimeType)) {
      throw new Error("File type not allowed");
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 10 MB");
    }

    const totalSize = await this.attachmentRepo.getTotalSizeByUser(userId);
    if (totalSize + fileSize > MAX_TOTAL_STORAGE) {
      throw new Error("Storage limit exceeded");
    }
  }

  async upload(userId: string, input: CreateAttachmentInput): Promise<TaskAttachment> {
    // Validation should have been done via validateUpload() before blob upload.
    // We still do a lightweight ownership check here for safety.
    await this.verifyTaskOwnership(input.taskId, userId);

    return this.attachmentRepo.create(input);
  }

  /**
   * Register an attachment that was already uploaded directly to Vercel Blob
   * from the client. Verifies task ownership, premium status, then creates
   * the DB record.
   */
  async createRecord(userId: string, input: CreateAttachmentInput): Promise<TaskAttachment> {
    await this.verifyTaskOwnership(input.taskId, userId);

    if (!(await this.subscriptionService.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    return this.attachmentRepo.create(input);
  }

  async download(attachmentId: string, userId: string): Promise<string> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    await this.verifyTaskOwnership(attachment.taskId, userId);

    if (!(await this.subscriptionService.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    return attachment.blobUrl;
  }

  async getAttachmentBlobUrl(attachmentId: string, userId: string): Promise<string> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");
    await this.verifyTaskOwnership(attachment.taskId, userId);
    return attachment.blobUrl;
  }

  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    await this.verifyTaskOwnership(attachment.taskId, userId);

    if (!(await this.subscriptionService.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    await this.attachmentRepo.delete(attachmentId);
  }
}
