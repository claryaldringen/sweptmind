import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttachmentService } from "../attachment.service";
import type { IAttachmentRepository } from "../../repositories/attachment.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { ISubscriptionRepository } from "../../repositories/subscription.repository";
import type { TaskAttachment } from "../../entities/task-attachment";
import type { Subscription } from "../../entities/subscription";
import type { Task } from "../../entities/task";

function makeAttachment(overrides: Partial<TaskAttachment> = {}): TaskAttachment {
  return {
    id: "att-1",
    taskId: "task-1",
    fileName: "photo.jpg",
    fileSize: 1024,
    mimeType: "image/jpeg",
    blobUrl: "https://blob.example.com/photo.jpg",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  return {
    id: "sub-1",
    userId: "user-1",
    status: "active",
    plan: "monthly",
    paymentMethod: "bank_transfer",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: futureDate,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    locationRadius: null,
    title: "Test task",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    blockedByTaskId: null,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeAttachmentRepo(
  overrides: Partial<IAttachmentRepository> = {},
): IAttachmentRepository {
  return {
    findByTaskId: vi.fn().mockResolvedValue([]),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    findById: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    delete: vi.fn(),
    getTotalSizeByUser: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeTaskRepo(overrides: Partial<ITaskRepository> = {}): ITaskRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByList: vi.fn().mockResolvedValue([]),
    findPlanned: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    findMinSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateSortOrder: vi.fn(),
    countActiveByList: vi.fn().mockResolvedValue(0),
    countActiveByListIds: vi.fn().mockResolvedValue(new Map()),
    countVisibleByList: vi.fn().mockResolvedValue(0),
    countVisibleByListIds: vi.fn().mockResolvedValue(new Map()),
    findByListId: vi.fn().mockResolvedValue([]),
    findByTagId: vi.fn().mockResolvedValue([]),
    findWithLocation: vi.fn().mockResolvedValue([]),
    findContextTasks: vi.fn().mockResolvedValue([]),
    findDependentTaskIds: vi.fn().mockResolvedValue([]),
    searchTasks: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findActiveByUser: vi.fn().mockResolvedValue([]),
    findCompletedByUser: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeSubRepo(overrides: Partial<ISubscriptionRepository> = {}): ISubscriptionRepository {
  return {
    findActiveByUser: vi.fn().mockResolvedValue(undefined),
    findByStripeCustomerId: vi.fn().mockResolvedValue(undefined),
    findByStripeSubscriptionId: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateStripeIds: vi.fn(),
    ...overrides,
  };
}

describe("AttachmentService", () => {
  let attachmentRepo: IAttachmentRepository;
  let taskRepo: ITaskRepository;
  let subRepo: ISubscriptionRepository;
  let service: AttachmentService;

  beforeEach(() => {
    attachmentRepo = makeAttachmentRepo();
    taskRepo = makeTaskRepo();
    subRepo = makeSubRepo();
    service = new AttachmentService(attachmentRepo, taskRepo, subRepo);
  });

  describe("getByTaskId", () => {
    it("vrátí přílohy pro libovolného uživatele (free i premium)", async () => {
      const attachments = [makeAttachment(), makeAttachment({ id: "att-2" })];
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(attachmentRepo.findByTaskId).mockResolvedValue(attachments);

      const result = await service.getByTaskId("task-1", "user-1");

      expect(result).toEqual(attachments);
      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(attachmentRepo.findByTaskId).toHaveBeenCalledWith("task-1");
    });

    it("vyhodí chybu pokud task nepatří uživateli", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.getByTaskId("task-1", "other-user")).rejects.toThrow("Task not found");
    });
  });

  describe("upload", () => {
    it("vyhodí chybu pokud uživatel není premium", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);

      await expect(
        service.upload("user-1", {
          taskId: "task-1",
          fileName: "file.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          blobUrl: "https://blob.example.com/file.pdf",
        }),
      ).rejects.toThrow("Premium subscription required");
    });

    it("vyhodí chybu pokud soubor přesahuje 10 MB", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(makeSubscription());

      const oversizedFile = 10 * 1024 * 1024 + 1; // 10 MB + 1 byte
      await expect(
        service.upload("user-1", {
          taskId: "task-1",
          fileName: "big.zip",
          fileSize: oversizedFile,
          mimeType: "application/zip",
          blobUrl: "https://blob.example.com/big.zip",
        }),
      ).rejects.toThrow("File size exceeds 10 MB");
    });

    it("vyhodí chybu pokud celkové úložiště přesáhne 1 GB", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(makeSubscription());
      vi.mocked(attachmentRepo.getTotalSizeByUser).mockResolvedValue(1024 * 1024 * 1024 - 100); // 1 GB - 100 bytes

      await expect(
        service.upload("user-1", {
          taskId: "task-1",
          fileName: "file.pdf",
          fileSize: 200, // 200 bytes - překročí limit
          mimeType: "application/pdf",
          blobUrl: "https://blob.example.com/file.pdf",
        }),
      ).rejects.toThrow("Storage limit exceeded");
    });

    it("vytvoří přílohu pro premium uživatele v rámci limitů", async () => {
      const attachment = makeAttachment();
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(makeSubscription());
      vi.mocked(attachmentRepo.getTotalSizeByUser).mockResolvedValue(0);
      vi.mocked(attachmentRepo.create).mockResolvedValue(attachment);

      const input = {
        taskId: "task-1",
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        blobUrl: "https://blob.example.com/photo.jpg",
      };

      const result = await service.upload("user-1", input);

      expect(result).toEqual(attachment);
      expect(attachmentRepo.create).toHaveBeenCalledWith(input);
    });
  });

  describe("download", () => {
    it("vyhodí chybu pokud uživatel není premium", async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(makeAttachment());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);

      await expect(service.download("att-1", "user-1")).rejects.toThrow(
        "Premium subscription required",
      );
    });

    it("vrátí blob URL pro premium uživatele", async () => {
      const attachment = makeAttachment({ blobUrl: "https://blob.example.com/photo.jpg" });
      vi.mocked(attachmentRepo.findById).mockResolvedValue(attachment);
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(makeSubscription());

      const result = await service.download("att-1", "user-1");

      expect(result).toBe("https://blob.example.com/photo.jpg");
    });
  });

  describe("deleteAttachment", () => {
    it("vyhodí chybu pokud uživatel není premium", async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(makeAttachment());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);

      await expect(service.deleteAttachment("att-1", "user-1")).rejects.toThrow(
        "Premium subscription required",
      );
    });

    it("smaže přílohu pro premium uživatele", async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(makeAttachment());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(makeSubscription());

      await service.deleteAttachment("att-1", "user-1");

      expect(attachmentRepo.delete).toHaveBeenCalledWith("att-1");
    });
  });
});
