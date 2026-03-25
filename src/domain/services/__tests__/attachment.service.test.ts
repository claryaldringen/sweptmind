import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttachmentService } from "../attachment.service";
import { SubscriptionService } from "../subscription.service";
import type { IAttachmentRepository } from "../../repositories/attachment.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IBlobStorage } from "../../ports/blob-storage";
import type { TaskAttachment } from "../../entities/task-attachment";
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
    dueDateEnd: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    blockedByTaskId: null,
    shareCompletionMode: null,
    shareCompletionAction: null,
    shareCompletionListId: null,
    forceCalendarSync: false,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeAttachmentRepo(overrides: Partial<IAttachmentRepository> = {}): IAttachmentRepository {
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
    countDependentByTaskIds: vi.fn().mockResolvedValue(new Map()),
    searchTasks: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findActiveByUser: vi.fn().mockResolvedValue([]),
    findCompletedByUser: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findByIdUnchecked: vi.fn(),
    updateUnchecked: vi.fn(),
    ...overrides,
  };
}

function makeSubscriptionService(isPremium = true): SubscriptionService {
  const svc = {
    isPremium: vi.fn().mockResolvedValue(isPremium),
    getSubscription: vi.fn().mockResolvedValue(undefined),
    activateBankTransfer: vi.fn(),
    handleStripeSubscriptionUpdate: vi.fn(),
  } as unknown as SubscriptionService;
  return svc;
}

function makeBlobStorage(): IBlobStorage {
  return { delete: vi.fn().mockResolvedValue(undefined) };
}

describe("AttachmentService", () => {
  let attachmentRepo: IAttachmentRepository;
  let taskRepo: ITaskRepository;
  let subscriptionService: SubscriptionService;
  let blobStorage: IBlobStorage;
  let service: AttachmentService;

  beforeEach(() => {
    attachmentRepo = makeAttachmentRepo();
    taskRepo = makeTaskRepo();
    subscriptionService = makeSubscriptionService(true);
    blobStorage = makeBlobStorage();
    service = new AttachmentService(attachmentRepo, taskRepo, subscriptionService, blobStorage);
  });

  describe("getByTaskId", () => {
    it("vrati prilohy pro libovolneho uzivatele (free i premium)", async () => {
      const attachments = [makeAttachment(), makeAttachment({ id: "att-2" })];
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(attachmentRepo.findByTaskId).mockResolvedValue(attachments);

      const result = await service.getByTaskId("task-1", "user-1");

      expect(result).toEqual(attachments);
      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(attachmentRepo.findByTaskId).toHaveBeenCalledWith("task-1");
    });

    it("vyhodi chybu pokud task nepatri uzivateli", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.getByTaskId("task-1", "other-user")).rejects.toThrow("Task not found");
    });
  });

  describe("validateUpload", () => {
    it("vyhodi chybu pokud uzivatel neni premium", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      subscriptionService = makeSubscriptionService(false);
      service = new AttachmentService(attachmentRepo, taskRepo, subscriptionService, blobStorage);

      await expect(
        service.validateUpload("user-1", "task-1", 1024, "application/pdf"),
      ).rejects.toThrow("Premium subscription required");
    });

    it("vyhodi chybu pokud soubor presahuje 10 MB", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());

      const oversizedFile = 10 * 1024 * 1024 + 1; // 10 MB + 1 byte
      await expect(
        service.validateUpload("user-1", "task-1", oversizedFile, "application/zip"),
      ).rejects.toThrow("File size exceeds 10 MB");
    });

    it("vyhodi chybu pokud celkove uloziste presahne 1 GB", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(attachmentRepo.getTotalSizeByUser).mockResolvedValue(1024 * 1024 * 1024 - 100); // 1 GB - 100 bytes

      await expect(
        service.validateUpload("user-1", "task-1", 200, "application/pdf"),
      ).rejects.toThrow("Storage limit exceeded");
    });

    it("vyhodi chybu pokud MIME typ neni povoleny", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());

      await expect(
        service.validateUpload("user-1", "task-1", 1024, "application/x-executable"),
      ).rejects.toThrow("File type not allowed");
    });

    it("projde validaci pro premium uzivatele s povolenym typem", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(attachmentRepo.getTotalSizeByUser).mockResolvedValue(0);

      await expect(
        service.validateUpload("user-1", "task-1", 1024, "image/jpeg"),
      ).resolves.toBeUndefined();
    });
  });

  describe("upload", () => {
    it("vytvori prilohu (validation uz probehla)", async () => {
      const attachment = makeAttachment();
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
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
    it("vyhodi chybu pokud uzivatel neni premium", async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(makeAttachment());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      subscriptionService = makeSubscriptionService(false);
      service = new AttachmentService(attachmentRepo, taskRepo, subscriptionService, blobStorage);

      await expect(service.download("att-1", "user-1")).rejects.toThrow(
        "Premium subscription required",
      );
    });

    it("vrati blob URL pro premium uzivatele", async () => {
      const attachment = makeAttachment({ blobUrl: "https://blob.example.com/photo.jpg" });
      vi.mocked(attachmentRepo.findById).mockResolvedValue(attachment);
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());

      const result = await service.download("att-1", "user-1");

      expect(result).toBe("https://blob.example.com/photo.jpg");
    });
  });

  describe("getAttachmentBlobUrl", () => {
    it("vrati blob URL pro vlastnika tasku", async () => {
      const attachment = makeAttachment({ blobUrl: "https://blob.example.com/photo.jpg" });
      vi.mocked(attachmentRepo.findById).mockResolvedValue(attachment);
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());

      const result = await service.getAttachmentBlobUrl("att-1", "user-1");

      expect(result).toBe("https://blob.example.com/photo.jpg");
    });

    it("vyhodi chybu pokud priloha neexistuje", async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(undefined);

      await expect(service.getAttachmentBlobUrl("att-1", "user-1")).rejects.toThrow(
        "Attachment not found",
      );
    });
  });

  describe("createRecord", () => {
    it("vytvori prilohu pro premium uzivatele", async () => {
      const attachment = makeAttachment();
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(attachmentRepo.create).mockResolvedValue(attachment);

      const input = {
        taskId: "task-1",
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        blobUrl: "https://blob.example.com/photo.jpg",
      };

      const result = await service.createRecord("user-1", input);

      expect(result).toEqual(attachment);
      expect(attachmentRepo.create).toHaveBeenCalledWith(input);
    });

    it("vyhodi chybu pokud uzivatel neni premium", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      subscriptionService = makeSubscriptionService(false);
      service = new AttachmentService(attachmentRepo, taskRepo, subscriptionService, blobStorage);

      const input = {
        taskId: "task-1",
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        blobUrl: "https://blob.example.com/photo.jpg",
      };

      await expect(service.createRecord("user-1", input)).rejects.toThrow(
        "Premium subscription required",
      );
    });

    it("vyhodi chybu pokud task nepatri uzivateli", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      const input = {
        taskId: "task-1",
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        blobUrl: "https://blob.example.com/photo.jpg",
      };

      await expect(service.createRecord("other-user", input)).rejects.toThrow("Task not found");
    });
  });

  describe("deleteAttachment", () => {
    it("vyhodi chybu pokud uzivatel neni premium", async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(makeAttachment());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      subscriptionService = makeSubscriptionService(false);
      service = new AttachmentService(attachmentRepo, taskRepo, subscriptionService, blobStorage);

      await expect(service.deleteAttachment("att-1", "user-1")).rejects.toThrow(
        "Premium subscription required",
      );
    });

    it("smaze prilohu pro premium uzivatele (blob + DB)", async () => {
      const attachment = makeAttachment({ blobUrl: "https://blob.example.com/photo.jpg" });
      vi.mocked(attachmentRepo.findById).mockResolvedValue(attachment);
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());

      await service.deleteAttachment("att-1", "user-1");

      expect(blobStorage.delete).toHaveBeenCalledWith("https://blob.example.com/photo.jpg");
      expect(attachmentRepo.delete).toHaveBeenCalledWith("att-1");
    });
  });
});
