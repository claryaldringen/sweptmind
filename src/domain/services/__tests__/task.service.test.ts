import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskService } from "../task.service";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { IStepRepository } from "../../repositories/step.repository";
import type { Task, Step } from "../../entities/task";
import type { List } from "../../entities/list";
import type { TaskSharingService } from "../task-sharing.service";

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
    locationRadius: null,
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
    findDefault: vi.fn().mockResolvedValue(undefined),
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
    deleteManyNonDefault: vi.fn(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: "step-1",
    taskId: "task-1",
    title: "Step title",
    isCompleted: false,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeStepRepo(overrides: Partial<IStepRepository> = {}): IStepRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByTask: vi.fn().mockResolvedValue([]),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    updateSortOrder: vi.fn(),
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

    it("opakující se úkol bez dueDate: posune na další výskyt místo dokončení", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: null,
        recurrence: "DAILY",
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
          dueDate: expect.any(String),
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

  describe("TaskSharingService sync hooks", () => {
    let sharingService: TaskSharingService;
    let serviceWithSharing: TaskService;

    beforeEach(() => {
      sharingService = {
        syncSharedFields: vi.fn().mockResolvedValue(undefined),
        notifyOwnerAction: vi.fn().mockResolvedValue(undefined),
        shareTask: vi.fn(),
        unshareTask: vi.fn(),
        getShareInfo: vi.fn(),
        getShareSource: vi.fn(),
        evaluateCompletionRule: vi.fn().mockResolvedValue(undefined),
      } as unknown as TaskSharingService;

      serviceWithSharing = new TaskService(repo, null, null, undefined, sharingService);
    });

    it("update() se změnou dueDate → zavolá taskSharingService.syncSharedFields", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-05-01" }));

      await serviceWithSharing.update("task-1", "user-1", { dueDate: "2026-05-01" });

      expect(sharingService.syncSharedFields).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({ dueDate: "2026-05-01" }),
      );
    });

    it("update() se změnou title → zavolá syncSharedFields bez synced polí (žádné dueDate/dueDateEnd/recurrence)", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask({ title: "new" }));

      await serviceWithSharing.update("task-1", "user-1", { title: "new" });

      expect(sharingService.syncSharedFields).toHaveBeenCalledWith(
        "task-1",
        expect.not.objectContaining({ dueDate: expect.anything() }),
      );
    });

    it("delete() → zavolá taskSharingService.notifyOwnerAction('deleted')", async () => {
      vi.mocked(repo.delete).mockResolvedValue(undefined);

      await serviceWithSharing.delete("task-1", "user-1");

      expect(sharingService.notifyOwnerAction).toHaveBeenCalledWith("task-1", "deleted");
    });

    it("toggleCompleted() (dokončení) → zavolá taskSharingService.notifyOwnerAction('completed')", async () => {
      const task = makeTask({ isCompleted: false });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ isCompleted: true }));

      await serviceWithSharing.toggleCompleted("task-1", "user-1");

      expect(sharingService.notifyOwnerAction).toHaveBeenCalledWith("task-1", "completed");
    });
  });

  describe("importTasks", () => {
    let listRepo: IListRepository;

    beforeEach(() => {
      listRepo = makeListRepo();
      service = new TaskService(repo, listRepo);

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

  describe("convertToList", () => {
    let listRepo: IListRepository;
    let stepRepo: IStepRepository;

    beforeEach(() => {
      listRepo = makeListRepo();
      stepRepo = makeStepRepo();
      service = new TaskService(repo, listRepo, stepRepo);
    });

    it("converts task with steps into a new list", async () => {
      const task = makeTask({ id: "task-1", title: "My Task" });
      const steps = [
        makeStep({ id: "s1", taskId: "task-1", title: "Step A", sortOrder: 0 }),
        makeStep({ id: "s2", taskId: "task-1", title: "Step B", sortOrder: 1 }),
      ];
      const newList = makeList({ id: "new-list", name: "My Task", isDefault: false });

      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(stepRepo.findByTask).mockResolvedValue(steps);
      vi.mocked(listRepo.findMaxSortOrder).mockResolvedValue(2);
      vi.mocked(listRepo.create).mockResolvedValue(newList);
      vi.mocked(repo.create).mockImplementation(async (values) =>
        makeTask({ id: `new-${Math.random()}`, ...values }),
      );

      const result = await service.convertToList("task-1", "user-1");

      expect(repo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(stepRepo.findByTask).toHaveBeenCalledWith("task-1");
      expect(listRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", name: "My Task", sortOrder: 3 }),
      );
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ listId: "new-list", title: "Step A", sortOrder: 0 }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ listId: "new-list", title: "Step B", sortOrder: 1 }),
      );
      expect(repo.delete).toHaveBeenCalledWith("task-1", "user-1");
      expect(result).toEqual(newList);
    });

    it("throws if task not found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(undefined);

      await expect(service.convertToList("nonexistent", "user-1")).rejects.toThrow(
        "Task not found",
      );
    });
  });

  describe("setDependency", () => {
    it("sets blockedByTaskId on task", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeTask({ id: "task-a", blockedByTaskId: null }));
      vi.mocked(repo.update).mockResolvedValue(
        makeTask({ id: "task-a", blockedByTaskId: "task-b" }),
      );

      await service.setDependency("task-a", "user-1", "task-b");

      expect(repo.update).toHaveBeenCalledWith("task-a", "user-1", { blockedByTaskId: "task-b" });
    });

    it("removes dependency when blockedByTaskId is null", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask({ id: "task-a", blockedByTaskId: null }));

      await service.setDependency("task-a", "user-1", null);

      expect(repo.update).toHaveBeenCalledWith("task-a", "user-1", { blockedByTaskId: null });
    });

    it("throws on circular dependency (A → B → A)", async () => {
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(makeTask({ id: "task-a" }))
        .mockResolvedValueOnce(makeTask({ id: "task-b", blockedByTaskId: "task-a" }));

      await expect(service.setDependency("task-a", "user-1", "task-b")).rejects.toThrow(
        "Circular dependency",
      );
    });

    it("throws when task not found", async () => {
      vi.mocked(repo.findById).mockResolvedValue(undefined);

      await expect(service.setDependency("x", "user-1", "task-b")).rejects.toThrow(
        "Task not found",
      );
    });

    it("allows A → B when B has no dependency", async () => {
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(makeTask({ id: "task-a" }))
        .mockResolvedValueOnce(makeTask({ id: "task-b", blockedByTaskId: null }));
      vi.mocked(repo.update).mockResolvedValue(
        makeTask({ id: "task-a", blockedByTaskId: "task-b" }),
      );

      await service.setDependency("task-a", "user-1", "task-b");

      expect(repo.update).toHaveBeenCalledWith("task-a", "user-1", { blockedByTaskId: "task-b" });
    });
  });

  describe("deleteMany", () => {
    it("smaže více úkolů najednou", async () => {
      vi.mocked(repo.deleteMany).mockResolvedValue(undefined);

      const result = await service.deleteMany(["task-1", "task-2"], "user-1");

      expect(result).toBe(true);
      expect(repo.deleteMany).toHaveBeenCalledWith(["task-1", "task-2"], "user-1");
    });
  });

  describe("updateMany", () => {
    it("aktualizuje listId pro více úkolů", async () => {
      vi.mocked(repo.updateMany).mockResolvedValue(undefined);

      const result = await service.updateMany(["task-1", "task-2"], "user-1", { listId: "list-2" });

      expect(result).toBe(true);
      expect(repo.updateMany).toHaveBeenCalledWith(
        ["task-1", "task-2"],
        "user-1",
        expect.objectContaining({ listId: "list-2" }),
      );
    });

    it("nastaví reminderAt při změně dueDate", async () => {
      vi.mocked(repo.updateMany).mockResolvedValue(undefined);

      await service.updateMany(["task-1"], "user-1", { dueDate: "2026-03-20" });

      expect(repo.updateMany).toHaveBeenCalledWith(
        ["task-1"],
        "user-1",
        expect.objectContaining({
          dueDate: "2026-03-20",
          reminderAt: expect.any(String),
        }),
      );
    });
  });

  describe("dueDateEnd", () => {
    it("create passes dueDateEnd through", async () => {
      vi.mocked(repo.findMinSortOrder).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockResolvedValue(makeTask());

      await service.create("user-1", {
        listId: "list-1",
        title: "Multi-day",
        dueDate: "2026-03-21",
        dueDateEnd: "2026-03-23",
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ dueDateEnd: "2026-03-23" }),
      );
    });

    it("update passes dueDateEnd through", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", { dueDateEnd: "2026-03-23" });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({ dueDateEnd: "2026-03-23" }),
      );
    });

    it("clearing dueDate also clears dueDateEnd", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTask());

      await service.update("task-1", "user-1", { dueDate: null });

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({ dueDateEnd: null }),
      );
    });

    it("recurring task completion preserves range duration", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-21",
        dueDateEnd: "2026-03-23",
        recurrence: "WEEKLY:6",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-03-28" }));

      await service.toggleCompleted("task-1", "user-1");

      expect(repo.update).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        expect.objectContaining({
          dueDate: "2026-03-28",
          dueDateEnd: "2026-03-30",
        }),
      );
    });

    it("recurring task completion with no dueDateEnd doesn't add one", async () => {
      const task = makeTask({
        isCompleted: false,
        dueDate: "2026-03-21",
        dueDateEnd: null,
        recurrence: "WEEKLY:6",
      });
      vi.mocked(repo.findById).mockResolvedValue(task);
      vi.mocked(repo.update).mockResolvedValue(makeTask({ dueDate: "2026-03-28" }));

      await service.toggleCompleted("task-1", "user-1");

      const updateCall = vi.mocked(repo.update).mock.calls[0];
      const updateData = updateCall[2];
      expect(updateData).not.toHaveProperty("dueDateEnd");
    });
  });

  describe("setManyCompleted", () => {
    it("označí více úkolů jako dokončené", async () => {
      vi.mocked(repo.updateMany).mockResolvedValue(undefined);

      const result = await service.setManyCompleted(["task-1", "task-2"], "user-1", true);

      expect(result).toBe(true);
      expect(repo.updateMany).toHaveBeenCalledWith(
        ["task-1", "task-2"],
        "user-1",
        expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      );
    });

    it("označí více úkolů jako nedokončené", async () => {
      vi.mocked(repo.updateMany).mockResolvedValue(undefined);

      await service.setManyCompleted(["task-1"], "user-1", false);

      expect(repo.updateMany).toHaveBeenCalledWith(
        ["task-1"],
        "user-1",
        expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      );
    });
  });
});
