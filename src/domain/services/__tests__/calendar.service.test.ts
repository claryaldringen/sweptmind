import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalendarService } from "../calendar.service";
import type { ICalendarSyncRepository } from "@/domain/repositories/calendar-sync.repository";
import type { ITaskRepository } from "@/domain/repositories/task.repository";
import type { Task } from "@/domain/entities/task";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    title: "Test Task",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeSyncRepo(overrides: Partial<ICalendarSyncRepository> = {}): ICalendarSyncRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByTaskId: vi.fn().mockResolvedValue(undefined),
    findByIcalUid: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue({
      id: "sync-1",
      userId: "user-1",
      taskId: "task-1",
      icalUid: "uid-1",
      etag: "etag-1",
      lastSyncedAt: new Date(),
    }),
    updateEtag: vi.fn().mockResolvedValue(undefined),
    deleteByTaskId: vi.fn().mockResolvedValue(undefined),
    deleteByIcalUid: vi.fn().mockResolvedValue(undefined),
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
    create: vi.fn().mockImplementation(async (values) => ({ ...makeTask(), ...values })),
    update: vi.fn().mockImplementation(async (_id, _uid, data) => ({ ...makeTask(), ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    updateSortOrder: vi.fn().mockResolvedValue(undefined),
    countActiveByList: vi.fn().mockResolvedValue(0),
    countActiveByListIds: vi.fn().mockResolvedValue(new Map()),
    countVisibleByList: vi.fn().mockResolvedValue(0),
    countVisibleByListIds: vi.fn().mockResolvedValue(new Map()),
    findByListId: vi.fn().mockResolvedValue([]),
    findByTagId: vi.fn().mockResolvedValue([]),
    findWithLocation: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("CalendarService", () => {
  let syncRepo: ICalendarSyncRepository;
  let taskRepo: ITaskRepository;
  let service: CalendarService;

  beforeEach(() => {
    syncRepo = makeSyncRepo();
    taskRepo = makeTaskRepo();
    service = new CalendarService(syncRepo, taskRepo);
  });

  describe("getSyncableTasks", () => {
    it("returns only tasks with datetime dueDate when syncAll=false", async () => {
      const tasks = [
        makeTask({ id: "1", dueDate: "2026-03-15T14:30" }),
        makeTask({ id: "2", dueDate: "2026-03-15" }),
        makeTask({ id: "3", dueDate: null }),
      ];
      vi.mocked(taskRepo.findPlanned).mockResolvedValue(tasks);
      const result = await service.getSyncableTasks("user-1", false);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("returns all tasks with dueDate when syncAll=true", async () => {
      const tasks = [
        makeTask({ id: "1", dueDate: "2026-03-15T14:30" }),
        makeTask({ id: "2", dueDate: "2026-03-15" }),
        makeTask({ id: "3", dueDate: null }),
      ];
      vi.mocked(taskRepo.findPlanned).mockResolvedValue(tasks);
      const result = await service.getSyncableTasks("user-1", true);
      expect(result).toHaveLength(2);
    });
  });

  describe("upsertFromIcal", () => {
    it("creates new task when icalUid not found", async () => {
      await service.upsertFromIcal("user-1", "list-1", {
        title: "New Event",
        notes: null,
        dueDate: "2026-03-15T14:30",
        isCompleted: false,
        recurrence: null,
        icalUid: "ext-uid-1",
      });
      expect(taskRepo.create).toHaveBeenCalled();
      expect(syncRepo.upsert).toHaveBeenCalled();
    });

    it("updates existing task when icalUid found", async () => {
      vi.mocked(syncRepo.findByIcalUid).mockResolvedValue({
        id: "sync-1",
        userId: "user-1",
        taskId: "task-1",
        icalUid: "ext-uid-1",
        etag: "old-etag",
        lastSyncedAt: new Date(),
      });
      await service.upsertFromIcal("user-1", "list-1", {
        title: "Updated Event",
        notes: null,
        dueDate: "2026-03-15T14:30",
        isCompleted: false,
        recurrence: null,
        icalUid: "ext-uid-1",
      });
      expect(taskRepo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({ title: "Updated Event" }),
      );
    });
  });

  describe("deleteFromIcal", () => {
    it("deletes task and sync entry", async () => {
      vi.mocked(syncRepo.findByIcalUid).mockResolvedValue({
        id: "sync-1",
        userId: "user-1",
        taskId: "task-1",
        icalUid: "ext-uid-1",
        etag: "etag",
        lastSyncedAt: new Date(),
      });
      await service.deleteFromIcal("user-1", "ext-uid-1");
      expect(taskRepo.delete).toHaveBeenCalledWith("task-1", "user-1");
      expect(syncRepo.deleteByIcalUid).toHaveBeenCalledWith("user-1", "ext-uid-1");
    });

    it("does nothing when icalUid not found", async () => {
      await service.deleteFromIcal("user-1", "unknown");
      expect(taskRepo.delete).not.toHaveBeenCalled();
    });
  });
});
