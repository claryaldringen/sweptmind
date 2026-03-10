import { describe, it, expect, vi, beforeEach } from "vitest";
import { StepService } from "../step.service";
import type { IStepRepository } from "../../repositories/step.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { Step, Task } from "../../entities/task";

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: "step-1",
    taskId: "task-1",
    title: "Test step",
    isCompleted: false,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
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

function makeStepRepo(overrides: Partial<IStepRepository> = {}): IStepRepository {
  return {
    findById: vi.fn(),
    findByTask: vi.fn().mockResolvedValue([]),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
    ...overrides,
  };
}

describe("StepService", () => {
  let stepRepo: IStepRepository;
  let taskRepo: ITaskRepository;
  let service: StepService;

  beforeEach(() => {
    stepRepo = makeStepRepo();
    taskRepo = makeTaskRepo();
    service = new StepService(stepRepo, taskRepo);
  });

  describe("create", () => {
    it("ověří vlastnictví tasku a vytvoří step", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(stepRepo.findMaxSortOrder).mockResolvedValue(2);
      vi.mocked(stepRepo.create).mockResolvedValue(makeStep({ sortOrder: 3 }));

      await service.create("user-1", "task-1", "New step");

      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(stepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "task-1", title: "New step", sortOrder: 3 }),
      );
    });

    it("vyhodí chybu pokud task neexistuje nebo nepatří uživateli", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.create("user-1", "bad-task", "Step")).rejects.toThrow("Task not found");
    });

    it("vytvoří první step se sortOrder 0 pokud maxSort je undefined", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(stepRepo.findMaxSortOrder).mockResolvedValue(undefined);
      vi.mocked(stepRepo.create).mockResolvedValue(makeStep({ sortOrder: 0 }));

      await service.create("user-1", "task-1", "First step");

      expect(stepRepo.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 0 }));
    });

    it("vytvoří step s prázdným title (service nevaliduje)", async () => {
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(stepRepo.findMaxSortOrder).mockResolvedValue(undefined);
      vi.mocked(stepRepo.create).mockResolvedValue(makeStep({ title: "", sortOrder: 0 }));

      await service.create("user-1", "task-1", "");

      expect(stepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "", sortOrder: 0 }),
      );
    });
  });

  describe("toggleCompleted", () => {
    it("přepne isCompleted", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(makeStep({ isCompleted: false }));
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(stepRepo.update).mockResolvedValue(makeStep({ isCompleted: true }));

      await service.toggleCompleted("user-1", "step-1");

      expect(stepRepo.findById).toHaveBeenCalledWith("step-1");
      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(stepRepo.update).toHaveBeenCalledWith(
        "step-1",
        expect.objectContaining({ isCompleted: true }),
      );
    });

    it("vyhodí chybu pokud step neexistuje", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(undefined);

      await expect(service.toggleCompleted("user-1", "bad")).rejects.toThrow("Step not found");
    });

    it("vyhodí chybu pokud task nepatří uživateli", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(makeStep());
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.toggleCompleted("other-user", "step-1")).rejects.toThrow(
        "Step not found",
      );
    });
  });

  describe("update", () => {
    it("aktualizuje title po ověření vlastnictví", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(makeStep());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());
      vi.mocked(stepRepo.update).mockResolvedValue(makeStep({ title: "Updated" }));

      await service.update("user-1", "step-1", "Updated");

      expect(stepRepo.findById).toHaveBeenCalledWith("step-1");
      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(stepRepo.update).toHaveBeenCalledWith("step-1", { title: "Updated" });
    });

    it("vyhodí chybu pokud step neexistuje", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(undefined);

      await expect(service.update("user-1", "bad", "Updated")).rejects.toThrow("Step not found");
    });

    it("vyhodí chybu pokud task nepatří uživateli", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(makeStep());
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.update("other-user", "step-1", "Updated")).rejects.toThrow(
        "Step not found",
      );
    });
  });

  describe("delete", () => {
    it("smaže step po ověření vlastnictví", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(makeStep());
      vi.mocked(taskRepo.findById).mockResolvedValue(makeTask());

      const result = await service.delete("user-1", "step-1");

      expect(stepRepo.findById).toHaveBeenCalledWith("step-1");
      expect(taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(stepRepo.delete).toHaveBeenCalledWith("step-1");
      expect(result).toBe(true);
    });

    it("vyhodí chybu pokud step neexistuje", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(undefined);

      await expect(service.delete("user-1", "bad")).rejects.toThrow("Step not found");
    });

    it("vyhodí chybu pokud task nepatří uživateli", async () => {
      vi.mocked(stepRepo.findById).mockResolvedValue(makeStep());
      vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.delete("other-user", "step-1")).rejects.toThrow("Step not found");
    });
  });
});
