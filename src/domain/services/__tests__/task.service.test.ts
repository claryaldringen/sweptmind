import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskService } from "../task.service";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { Task } from "../../entities/task";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    title: "Test task",
    notes: null,
    isCompleted: false,
    completedAt: null,

    dueDate: null,
    reminderAt: null,
    recurrence: null,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<ITaskRepository> = {}): ITaskRepository {
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
    countVisibleByList: vi.fn().mockResolvedValue(0),
    findByListId: vi.fn().mockResolvedValue([]),
    findByTagId: vi.fn().mockResolvedValue([]),
    findWithLocation: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("TaskService", () => {
  let repo: ITaskRepository;
  let service: TaskService;

  beforeEach(() => {
    repo = makeRepo();
    service = new TaskService(repo);
  });

  describe("create", () => {
    it("vypočítá sortOrder z minima - 1 (nové úkoly nahoře)", async () => {
      vi.mocked(repo.findMinSortOrder).mockResolvedValue(3);
      const created = makeTask({ sortOrder: 2 });
      vi.mocked(repo.create).mockResolvedValue(created);

      await service.create("user-1", { listId: "list-1", title: "New" });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 2 }));
    });

    it("použije sortOrder 0 pokud seznam nemá žádné úkoly", async () => {
      vi.mocked(repo.findMinSortOrder).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockResolvedValue(makeTask());

      await service.create("user-1", { listId: "list-1", title: "First" });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 0 }));
    });

    it("auto-compute reminderAt z dueDate při vytvoření", async () => {
      vi.mocked(repo.findMinSortOrder).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockResolvedValue(makeTask());

      await service.create("user-1", { listId: "list-1", title: "New", dueDate: "2026-03-07" });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: "2026-03-07", reminderAt: "2026-03-07" }),
      );
    });

    it("auto-compute reminderAt den předem z dueDate s časem při vytvoření", async () => {
      vi.mocked(repo.findMinSortOrder).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockResolvedValue(makeTask());

      await service.create("user-1", { listId: "list-1", title: "New", dueDate: "2026-03-07T14:00" });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: "2026-03-07T14:00", reminderAt: "2026-03-06" }),
      );
    });
  });

  describe("getByList", () => {
    it("vrátí všechny úkoly včetně budoucích (filtrování na klientu)", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().slice(0, 10);

      vi.mocked(repo.findByList).mockResolvedValue([
        makeTask({ id: "today", dueDate: null }),
        makeTask({ id: "future", dueDate: futureDate, isCompleted: false }),
      ]);

      const result = await service.getByList("list-1", "user-1");
      expect(result).toHaveLength(2);
    });
  });


  describe("toggleCompleted", () => {
    it("nastaví isCompleted na true a completedAt na now", async () => {
      const task = makeTask({ isCompleted: false });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ isCompleted: true }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      );
    });

    it("nastaví isCompleted na false a completedAt na null", async () => {
      const task = makeTask({ isCompleted: true, completedAt: new Date() });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ isCompleted: false }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      );
    });

    it("vyhodí chybu když úkol neexistuje", async () => {
      vi.mocked(repo.findById).mockResolvedValue(undefined);

      await expect(service.toggleCompleted("x", "user-1")).rejects.toThrow("Task not found");
    });

    it("opakující se úkol: reset + posun dueDate místo dokončení", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04",
        recurrence: "DAILY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-03-05" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          dueDate: "2026-03-05",
          completedAt: null,
        }),
      );
    });

    it("opakující se úkol: zachová čas v dueDate", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04T14:00",
        recurrence: "DAILY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-03-05T14:00" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2026-03-05T14:00",
        }),
      );
    });

    it("opakující se úkol: un-toggle (isCompleted true → false) funguje normálně", async () => {
      const task = makeTask({
        isCompleted: true,
        completedAt: new Date(),
        recurrence: "DAILY",
        dueDate: "2026-03-05",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ isCompleted: false }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      );
    });

    it("opakující se úkol bez dueDate: normální toggle", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: null,
        recurrence: "DAILY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ isCompleted: true }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      );
    });
  });


  describe("update", () => {
    it("uloží reminderAt přímo jako string", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", {
        reminderAt: "2024-06-15",
      });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          reminderAt: "2024-06-15",
        }),
      );
    });

    it("nastaví reminderAt na null když je prázdný string", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", { reminderAt: "" });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({ reminderAt: null }),
      );
    });

    it("auto-compute reminderAt při změně date-only dueDate", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", { dueDate: "2026-03-07" });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2026-03-07",
          reminderAt: "2026-03-07",
        }),
      );
    });

    it("auto-compute reminderAt den předem při dueDate s časem", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", { dueDate: "2026-03-07T14:00" });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2026-03-07T14:00",
          reminderAt: "2026-03-06",
        }),
      );
    });

    it("vymaže reminderAt když se odebere dueDate", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", { dueDate: null });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: null,
          reminderAt: null,
        }),
      );
    });

    it("explicitní reminderAt přebíjí auto-compute", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", {
        dueDate: "2026-03-10",
        reminderAt: "2026-03-05",
      });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2026-03-10",
          reminderAt: "2026-03-05",
        }),
      );
    });
  });

  describe("reorder", () => {
    it("aktualizuje sortOrder pro každou položku", async () => {
      const items = [
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1 },
      ];

      await service.reorder("user-1", items);

      expect(repo.updateSortOrder).toHaveBeenCalledTimes(2);
      expect(repo.updateSortOrder).toHaveBeenCalledWith("a", "user-1", 0);
      expect(repo.updateSortOrder).toHaveBeenCalledWith("b", "user-1", 1);
    });
  });

  describe("delegované dotazy", () => {
    it("getByList deleguje na repo", async () => {
      await service.getByList("list-1", "user-1");
      expect(repo.findByList).toHaveBeenCalledWith("list-1", "user-1");
    });


    it("getPlanned deleguje na repo", async () => {
      await service.getPlanned("user-1");
      expect(repo.findPlanned).toHaveBeenCalledWith("user-1");
    });
  });
});
