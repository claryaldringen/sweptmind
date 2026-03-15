import { describe, it, expect, vi, beforeEach } from "vitest";
import { TagService } from "../tag.service";
import type { ITagRepository } from "../../repositories/tag.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { Tag } from "../../entities/tag";
import type { Task } from "../../entities/task";

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: "tag-1",
    userId: "user-1",
    name: "Work",
    color: "blue",
    deviceContext: null,
    locationId: null,
    locationRadius: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
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

function makeTagRepo(overrides: Partial<ITagRepository> = {}): ITagRepository {
  return {
    findByUser: vi.fn().mockResolvedValue([]),
    findByTask: vi.fn().mockResolvedValue([]),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addToTask: vi.fn(),
    removeFromTask: vi.fn(),
    countTasksByTag: vi.fn().mockResolvedValue(0),
    countTasksByTags: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  };
}

function makeTaskRepo(overrides: Partial<ITaskRepository> = {}): ITaskRepository {
  return {
    findById: vi.fn(),
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
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    ...overrides,
  };
}

describe("TagService", () => {
  let tagRepo: ITagRepository;
  let taskRepo: ITaskRepository;
  let service: TagService;

  beforeEach(() => {
    tagRepo = makeTagRepo();
    taskRepo = makeTaskRepo();
    service = new TagService(tagRepo, taskRepo);
  });

  describe("create", () => {
    it("použije výchozí barvu 'blue' když není zadána", async () => {
      const created = makeTag();
      vi.mocked(tagRepo.create).mockResolvedValue(created);

      await service.create("user-1", { name: "Work" });

      expect(tagRepo.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "Work",
        color: "blue",
        deviceContext: null,
        locationId: null,
        locationRadius: null,
      });
    });

    it("použije vlastní barvu když je zadána", async () => {
      const created = makeTag({ color: "red" });
      vi.mocked(tagRepo.create).mockResolvedValue(created);

      await service.create("user-1", { name: "Urgent", color: "red" });

      expect(tagRepo.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "Urgent",
        color: "red",
        deviceContext: null,
        locationId: null,
        locationRadius: null,
      });
    });
  });

  describe("update", () => {
    it("aktualizuje pouze name když je zadáno jen name", async () => {
      vi.mocked(tagRepo.update).mockResolvedValue(makeTag({ name: "Updated" }));

      await service.update("tag-1", "user-1", { name: "Updated" });

      expect(tagRepo.update).toHaveBeenCalledWith("tag-1", "user-1", { name: "Updated" });
    });

    it("aktualizuje pouze color když je zadáno jen color", async () => {
      vi.mocked(tagRepo.update).mockResolvedValue(makeTag({ color: "green" }));

      await service.update("tag-1", "user-1", { color: "green" });

      expect(tagRepo.update).toHaveBeenCalledWith("tag-1", "user-1", { color: "green" });
    });

    it("aktualizuje name i color když jsou obě zadány", async () => {
      vi.mocked(tagRepo.update).mockResolvedValue(makeTag({ name: "New", color: "green" }));

      await service.update("tag-1", "user-1", { name: "New", color: "green" });

      expect(tagRepo.update).toHaveBeenCalledWith("tag-1", "user-1", {
        name: "New",
        color: "green",
      });
    });

    it("nepošle žádné pole když input je prázdný", async () => {
      vi.mocked(tagRepo.update).mockResolvedValue(makeTag());

      await service.update("tag-1", "user-1", {});

      expect(tagRepo.update).toHaveBeenCalledWith("tag-1", "user-1", {});
    });
  });

  describe("delete", () => {
    it("deleguje na repo a vrátí true", async () => {
      vi.mocked(tagRepo.delete).mockResolvedValue(undefined);

      const result = await service.delete("tag-1", "user-1");

      expect(tagRepo.delete).toHaveBeenCalledWith("tag-1", "user-1");
      expect(result).toBe(true);
    });
  });

  describe("addToTask", () => {
    it("přidá tag k úkolu když oba existují", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(tagRepo.findById).mockResolvedValue(makeTag());
      vi.mocked(tagRepo.addToTask).mockResolvedValue(undefined);

      const result = await service.addToTask("task-1", "tag-1", "user-1");

      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(tagRepo.findById).toHaveBeenCalledWith("tag-1", "user-1");
      expect(tagRepo.addToTask).toHaveBeenCalledWith("task-1", "tag-1");
      expect(result).toBe(true);
    });

    it("vyhodí chybu když úkol neexistuje", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.addToTask("task-1", "tag-1", "user-1")).rejects.toThrow(
        "Task not found",
      );

      expect(tagRepo.findById).not.toHaveBeenCalled();
      expect(tagRepo.addToTask).not.toHaveBeenCalled();
    });

    it("vyhodí chybu když tag neexistuje", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(tagRepo.findById).mockResolvedValue(undefined);

      await expect(service.addToTask("task-1", "tag-1", "user-1")).rejects.toThrow("Tag not found");

      expect(tagRepo.addToTask).not.toHaveBeenCalled();
    });
  });

  describe("removeFromTask", () => {
    it("odebere tag z úkolu když úkol existuje", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(tagRepo.removeFromTask).mockResolvedValue(undefined);

      const result = await service.removeFromTask("task-1", "tag-1", "user-1");

      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(tagRepo.removeFromTask).toHaveBeenCalledWith("task-1", "tag-1");
      expect(result).toBe(true);
    });

    it("vyhodí chybu když úkol neexistuje", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.removeFromTask("task-1", "tag-1", "user-1")).rejects.toThrow(
        "Task not found",
      );

      expect(tagRepo.removeFromTask).not.toHaveBeenCalled();
    });
  });

  describe("getTasksByTag", () => {
    it("vrátí úkoly pro existující tag", async () => {
      const tasks = [makeTask({ id: "task-1" }), makeTask({ id: "task-2" })];
      vi.mocked(tagRepo.findById).mockResolvedValue(makeTag());
      vi.mocked(taskRepo.findByTagId).mockResolvedValue(tasks);

      const result = await service.getTasksByTag("tag-1", "user-1");

      expect(tagRepo.findById).toHaveBeenCalledWith("tag-1", "user-1");
      expect(taskRepo.findByTagId).toHaveBeenCalledWith("tag-1", "user-1");
      expect(result).toEqual(tasks);
    });

    it("vyhodí chybu když tag neexistuje", async () => {
      vi.mocked(tagRepo.findById).mockResolvedValue(undefined);

      await expect(service.getTasksByTag("tag-1", "user-1")).rejects.toThrow("Tag not found");

      expect(taskRepo.findByTagId).not.toHaveBeenCalled();
    });
  });

  describe("countTasksByTag", () => {
    it("deleguje na repo", async () => {
      vi.mocked(tagRepo.countTasksByTag).mockResolvedValue(5);

      const result = await service.countTasksByTag("tag-1");

      expect(tagRepo.countTasksByTag).toHaveBeenCalledWith("tag-1");
      expect(result).toBe(5);
    });
  });

  describe("delegované dotazy", () => {
    it("getByUser deleguje na repo", async () => {
      const tags = [makeTag()];
      vi.mocked(tagRepo.findByUser).mockResolvedValue(tags);

      const result = await service.getByUser("user-1");

      expect(tagRepo.findByUser).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(tags);
    });

    it("getByTask deleguje na repo", async () => {
      const tags = [makeTag()];
      vi.mocked(tagRepo.findByTask).mockResolvedValue(tags);

      const result = await service.getByTask("task-1");

      expect(tagRepo.findByTask).toHaveBeenCalledWith("task-1");
      expect(result).toEqual(tags);
    });

    it("getById deleguje na repo", async () => {
      const tag = makeTag();
      vi.mocked(tagRepo.findById).mockResolvedValue(tag);

      const result = await service.getById("tag-1", "user-1");

      expect(tagRepo.findById).toHaveBeenCalledWith("tag-1", "user-1");
      expect(result).toEqual(tag);
    });

    it("getById vrátí undefined když tag neexistuje", async () => {
      vi.mocked(tagRepo.findById).mockResolvedValue(undefined);

      const result = await service.getById("nonexistent", "user-1");

      expect(tagRepo.findById).toHaveBeenCalledWith("nonexistent", "user-1");
      expect(result).toBeUndefined();
    });
  });
});
