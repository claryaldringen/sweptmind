import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskService } from "../task.service";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { Task } from "../../entities/task";
import type { List } from "../../entities/list";

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
    deviceContext: null,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeList(overrides: Partial<List> = {}): List {
  return {
    id: "list-1",
    userId: "user-1",
    groupId: null,
    locationId: null,
    deviceContext: null,
    name: "Tasks",
    icon: null,
    themeColor: null,
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeListRepo(overrides: Partial<IListRepository> = {}): IListRepository {
  return {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findByGroup: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
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
    countActiveByListIds: vi.fn().mockResolvedValue(new Map()),
    countVisibleByList: vi.fn().mockResolvedValue(0),
    countVisibleByListIds: vi.fn().mockResolvedValue(new Map()),
    findByListId: vi.fn().mockResolvedValue([]),
    findByTagId: vi.fn().mockResolvedValue([]),
    findWithLocation: vi.fn().mockResolvedValue([]),
    findContextTasks: vi.fn().mockResolvedValue([]),
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

      await service.create("user-1", {
        listId: "list-1",
        title: "New",
        dueDate: "2026-03-07T14:00",
      });

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
      expect(repo.findByList).toHaveBeenCalledWith("list-1", "user-1", undefined);
    });

    it("getByList předává pagination opts do repo", async () => {
      await service.getByList("list-1", "user-1", { limit: 50, offset: 10 });
      expect(repo.findByList).toHaveBeenCalledWith("list-1", "user-1", { limit: 50, offset: 10 });
    });

    it("getPlanned deleguje na repo", async () => {
      await service.getPlanned("user-1");
      expect(repo.findPlanned).toHaveBeenCalledWith("user-1", undefined);
    });

    it("getPlanned předává pagination opts do repo", async () => {
      await service.getPlanned("user-1", { limit: 100, offset: 20 });
      expect(repo.findPlanned).toHaveBeenCalledWith("user-1", { limit: 100, offset: 20 });
    });
  });

  describe("delete", () => {
    it("zavolá repo.delete se správnými argumenty", async () => {
      vi.mocked(repo.delete).mockResolvedValue(undefined);

      const result = await service.delete("task-1", "user-1");

      expect(repo.delete).toHaveBeenCalledWith("task-1", "user-1");
      expect(result).toBe(true);
    });
  });

  describe("importTasks", () => {
    let listRepo: IListRepository;

    beforeEach(() => {
      listRepo = makeListRepo();
      service.setListRepo(listRepo);

      // Default: user has one default list
      vi.mocked(listRepo.findByUser).mockResolvedValue([
        makeList({ id: "default-list", name: "Tasks", isDefault: true }),
      ]);
      vi.mocked(repo.findMinSortOrder).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockImplementation(async (values) =>
        makeTask({ id: `imported-${Math.random()}`, ...values }),
      );
      vi.mocked(repo.update).mockImplementation(async (_id, _userId, data) =>
        makeTask({ ...data }),
      );
    });

    it("importuje do existujícího seznamu (case-insensitive match)", async () => {
      vi.mocked(listRepo.findByUser).mockResolvedValue([
        makeList({ id: "default-list", name: "Tasks", isDefault: true }),
        makeList({ id: "work-list", name: "Work", isDefault: false }),
      ]);

      const result = await service.importTasks("user-1", [
        { title: "Task 1", listName: "work" },
        { title: "Task 2", listName: "WORK" },
      ]);

      expect(result.importedCount).toBe(2);
      expect(result.createdLists).toEqual([]);
      expect(listRepo.create).not.toHaveBeenCalled();
      // Both tasks should be created with the Work list ID
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ listId: "work-list" }));
    });

    it("vytvoří nový seznam když žádný neexistuje", async () => {
      vi.mocked(listRepo.findMaxSortOrder).mockResolvedValue(0);
      vi.mocked(listRepo.create).mockResolvedValue(
        makeList({ id: "new-list", name: "Shopping", isDefault: false }),
      );

      const result = await service.importTasks("user-1", [
        { title: "Buy milk", listName: "Shopping" },
      ]);

      expect(result.importedCount).toBe(1);
      expect(result.createdLists).toEqual(["Shopping"]);
      expect(listRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", name: "Shopping", sortOrder: 1 }),
      );
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ listId: "new-list" }));
    });

    it("přeskočí úkoly s prázdným title", async () => {
      const result = await service.importTasks("user-1", [
        { title: "" },
        { title: "   " },
        { title: "Valid task" },
      ]);

      expect(result.importedCount).toBe(1);
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Valid task" }));
    });

    it("importuje dokončené úkoly se správným isCompleted", async () => {
      const result = await service.importTasks("user-1", [
        { title: "Done task", isCompleted: true },
      ]);

      expect(result.importedCount).toBe(1);
      expect(repo.create).toHaveBeenCalledTimes(1);
      // After create, update should be called to mark as completed
      expect(repo.update).toHaveBeenCalledWith(
        expect.any(String),
        "user-1",
        expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      );
    });

    it("vyhodí chybu když výchozí seznam neexistuje", async () => {
      vi.mocked(listRepo.findByUser).mockResolvedValue([
        makeList({ id: "list-1", name: "Custom", isDefault: false }),
      ]);

      await expect(service.importTasks("user-1", [{ title: "Test" }])).rejects.toThrow(
        "Default list not found",
      );
    });
  });

  describe("toggleCompleted — recurrence edge cases", () => {
    it("WEEKLY recurrence → posune dueDate na správný další den", async () => {
      // 2026-03-04 is Wednesday (day 3), WEEKLY:1,3,5 = Mon,Wed,Fri
      // Next after Wed(3) should be Fri(5), i.e. +2 days = 2026-03-06
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04",
        recurrence: "WEEKLY:1,3,5",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-03-06" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          dueDate: "2026-03-06",
          completedAt: null,
        }),
      );
    });

    it("WEEKLY recurrence → přetočí na příští týden když je poslední den v týdnu", async () => {
      // 2026-03-06 is Friday (day 5), WEEKLY:1,3,5 = Mon,Wed,Fri
      // No day > 5, so wrap: 7 - 5 + 1(Mon) = 3 days → 2026-03-09 (Monday)
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-06",
        recurrence: "WEEKLY:1,3,5",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-03-09" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          dueDate: "2026-03-09",
          completedAt: null,
        }),
      );
    });

    it("MONTHLY recurrence → posune dueDate o měsíc", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04",
        recurrence: "MONTHLY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-04-04" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          dueDate: "2026-04-04",
          completedAt: null,
        }),
      );
    });

    it("MONTHLY recurrence → zachová čas v dueDate", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04T10:30",
        recurrence: "MONTHLY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-04-04T10:30" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2026-04-04T10:30",
        }),
      );
    });

    it("YEARLY recurrence → posune dueDate o rok", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04",
        recurrence: "YEARLY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2027-03-04" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          dueDate: "2027-03-04",
          completedAt: null,
        }),
      );
    });

    it("YEARLY recurrence → zachová čas v dueDate", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-04T08:00",
        recurrence: "YEARLY",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2027-03-04T08:00" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2027-03-04T08:00",
        }),
      );
    });
  });

  describe("getContextTasks", () => {
    it("delegates to taskRepo.findContextTasks", async () => {
      const mockTasks = [makeTask({ id: "t1" })];
      vi.mocked(repo.findContextTasks).mockResolvedValue(mockTasks);

      const result = await service.getContextTasks("user-1", "phone", ["loc1"]);

      expect(repo.findContextTasks).toHaveBeenCalledWith("user-1", "phone", ["loc1"]);
      expect(result).toEqual(mockTasks);
    });
  });
});
