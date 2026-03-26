import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskSharingService } from "../task-sharing.service";
import type { ISharedTaskRepository } from "../../repositories/shared-task.repository";
import type { IUserConnectionRepository } from "../../repositories/user-connection.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { IUserRepository } from "../../repositories/user.repository";
import type { INotificationSender } from "../../ports/notification-sender";
import type { Task } from "../../entities/task";
import type { SharedTask } from "../../entities/shared-task";
import type { UserConnection } from "../../entities/user-connection";
import type { List } from "../../entities/list";
import type { User } from "../../entities/user";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  userId: "user-1",
  listId: "list-1",
  locationId: null,
  locationRadius: null,
  title: "Test Task",
  notes: null,
  isCompleted: false,
  completedAt: null,
  dueDate: "2026-03-20",
  dueDateEnd: null,
  reminderAt: null,
  recurrence: null,
  deviceContext: null,
  blockedByTaskId: null,
  shareCompletionMode: null,
  shareCompletionAction: null,
  shareCompletionListId: null,
  forceCalendarSync: false,
  sortOrder: 1,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeSharedTask = (overrides: Partial<SharedTask> = {}): SharedTask => ({
  id: "shared-1",
  connectionId: "conn-1",
  sourceTaskId: "task-1",
  targetTaskId: "task-2",
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

const makeConnection = (overrides: Partial<UserConnection> = {}): UserConnection => ({
  id: "conn-1",
  userId: "user-1",
  connectedUserId: "user-2",
  targetListId: null,
  status: "active",
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

const makeList = (overrides: Partial<List> = {}): List => ({
  id: "list-default",
  userId: "user-2",
  name: "Tasks",
  isDefault: true,
  sortOrder: 1,
  groupId: null,
  locationId: null,
  locationRadius: null,
  deviceContext: null,
  icon: null,
  themeColor: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-2",
  name: "Target User",
  email: "target@example.com",
  emailVerified: null,
  image: null,
  hashedPassword: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  onboardingCompleted: true,
  calendarSyncAll: false,
  calendarSyncDateRange: false,
  calendarToken: null,
  calendarTargetListId: null,
  googleCalendarEnabled: false,
  googleCalendarDirection: null,
  googleCalendarId: null,
  googleCalendarSyncToken: null,
  googleCalendarChannelId: null,
  googleCalendarChannelExpiry: null,
  googleCalendarTargetListId: null,
  aiEnabled: false,
  llmModel: null,
  sharingDefaultListId: null,
  ...overrides,
});

function makeMocks() {
  const sharedTaskRepo: ISharedTaskRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceTask: vi.fn(),
    findByTargetTask: vi.fn(),
    findByConnection: vi.fn(),
    deleteByConnection: vi.fn(),
    delete: vi.fn(),
    findBySourceTaskIds: vi.fn().mockResolvedValue(new Map()),
    findByTargetTaskIds: vi.fn().mockResolvedValue(new Map()),
  };
  const connectionRepo: IUserConnectionRepository = {
    create: vi.fn(),
    findByUser: vi.fn(),
    findBetween: vi.fn(),
    findById: vi.fn(),
    updateTargetList: vi.fn(),
    delete: vi.fn(),
    countSharedTasks: vi.fn(),
  };
  const taskRepo: ITaskRepository = {
    findById: vi.fn(),
    findByList: vi.fn(),
    findPlanned: vi.fn(),
    findMaxSortOrder: vi.fn(),
    findMinSortOrder: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateSortOrder: vi.fn(),
    countActiveByList: vi.fn(),
    countActiveByListIds: vi.fn(),
    countVisibleByList: vi.fn(),
    countVisibleByListIds: vi.fn(),
    findByListId: vi.fn(),
    findByTagId: vi.fn(),
    findWithLocation: vi.fn(),
    findContextTasks: vi.fn(),
    findDependentTaskIds: vi.fn(),
    countDependentByTaskIds: vi.fn(),
    searchTasks: vi.fn(),
    findByUser: vi.fn(),
    findActiveByUser: vi.fn(),
    findCompletedByUser: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findByIdUnchecked: vi.fn(),
    updateUnchecked: vi.fn(),
  };
  const listRepo: IListRepository = {
    findDefault: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByUser: vi.fn(),
    findByGroup: vi.fn(),
    findMaxSortOrder: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
    deleteManyNonDefault: vi.fn(),
  };
  const userRepo: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    findByCalendarToken: vi.fn(),
    getCalendarToken: vi.fn(),
    regenerateCalendarToken: vi.fn(),
    updateCalendarSyncAll: vi.fn(),
    getCalendarSyncAll: vi.fn(),
    updateCalendarSyncDateRange: vi.fn(),
    getCalendarSyncDateRange: vi.fn(),
    updateCalendarTargetListId: vi.fn(),
    getCalendarTargetListId: vi.fn(),
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn(),
    validatePasswordResetToken: vi.fn(),
    deletePasswordResetToken: vi.fn(),
    updateAiEnabled: vi.fn(),
    updateLlmModel: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn(),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn(),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    updateGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarSettings: vi.fn(),
    findUsersWithGoogleCalendarEnabled: vi.fn(),
    findUsersWithExpiringChannels: vi.fn(),
    updateSharingDefaultList: vi.fn(),
  };
  const notificationSender: INotificationSender = {
    send: vi.fn(),
  };

  return { sharedTaskRepo, connectionRepo, taskRepo, listRepo, userRepo, notificationSender };
}

describe("TaskSharingService", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let service: TaskSharingService;

  beforeEach(() => {
    mocks = makeMocks();
    service = new TaskSharingService(
      mocks.sharedTaskRepo,
      mocks.connectionRepo,
      mocks.taskRepo,
      mocks.listRepo,
      mocks.userRepo,
      mocks.notificationSender,
    );
  });

  describe("shareTask", () => {
    it("creates a copy in target list, creates shared_task record, and sends notification", async () => {
      const task = makeTask();
      const connection = makeConnection();
      const reverseConnection = makeConnection({
        id: "conn-rev",
        userId: "user-2",
        connectedUserId: "user-1",
        targetListId: "list-target",
      });
      const targetTask = makeTask({ id: "task-2", userId: "user-2", listId: "list-target" });
      const shared = makeSharedTask();

      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.connectionRepo.findBetween).mockImplementation((a, b) => {
        if (a === "user-1" && b === "user-2") return Promise.resolve(connection);
        if (a === "user-2" && b === "user-1") return Promise.resolve(reverseConnection);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.taskRepo.findMaxSortOrder).mockResolvedValue(0);
      vi.mocked(mocks.taskRepo.create).mockResolvedValue(targetTask);
      vi.mocked(mocks.sharedTaskRepo.create).mockResolvedValue(shared);
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      const result = await service.shareTask("task-1", "user-1", "user-2");

      expect(mocks.taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(mocks.taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-2",
          title: "Test Task",
          dueDate: "2026-03-20",
        }),
      );
      expect(mocks.sharedTaskRepo.create).toHaveBeenCalledWith("conn-1", "task-1", "task-2");
      expect(mocks.notificationSender.send).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ type: "task_shared" }),
      );
      expect(result).toEqual(shared);
    });

    it("throws if no connection between users", async () => {
      const task = makeTask();
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.connectionRepo.findBetween).mockResolvedValue(undefined);

      await expect(service.shareTask("task-1", "user-1", "user-2")).rejects.toThrow(
        "Not connected with this user",
      );
    });

    it("throws if task not found", async () => {
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.shareTask("task-1", "user-1", "user-2")).rejects.toThrow(
        "Task not found",
      );
    });

    it("uses per-connection targetListId when available", async () => {
      const task = makeTask();
      const connection = makeConnection();
      const reverseConnection = makeConnection({
        id: "conn-rev",
        userId: "user-2",
        connectedUserId: "user-1",
        targetListId: "list-connection",
      });
      const targetTask = makeTask({ id: "task-2", userId: "user-2", listId: "list-connection" });

      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.connectionRepo.findBetween).mockImplementation((a, b) => {
        if (a === "user-1" && b === "user-2") return Promise.resolve(connection);
        if (a === "user-2" && b === "user-1") return Promise.resolve(reverseConnection);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.taskRepo.findMaxSortOrder).mockResolvedValue(0);
      vi.mocked(mocks.taskRepo.create).mockResolvedValue(targetTask);
      vi.mocked(mocks.sharedTaskRepo.create).mockResolvedValue(makeSharedTask());
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      await service.shareTask("task-1", "user-1", "user-2");

      expect(mocks.taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ listId: "list-connection" }),
      );
    });

    it("falls back to user sharingDefaultListId when no per-connection targetListId", async () => {
      const task = makeTask();
      const connection = makeConnection();
      const reverseConnection = makeConnection({
        id: "conn-rev",
        userId: "user-2",
        connectedUserId: "user-1",
        targetListId: null,
      });
      const user = makeUser({ sharingDefaultListId: "list-global-default" });
      const targetTask = makeTask({
        id: "task-2",
        userId: "user-2",
        listId: "list-global-default",
      });

      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.connectionRepo.findBetween).mockImplementation((a, b) => {
        if (a === "user-1" && b === "user-2") return Promise.resolve(connection);
        if (a === "user-2" && b === "user-1") return Promise.resolve(reverseConnection);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.userRepo.findById).mockResolvedValue(user);
      vi.mocked(mocks.taskRepo.findMaxSortOrder).mockResolvedValue(0);
      vi.mocked(mocks.taskRepo.create).mockResolvedValue(targetTask);
      vi.mocked(mocks.sharedTaskRepo.create).mockResolvedValue(makeSharedTask());
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      await service.shareTask("task-1", "user-1", "user-2");

      expect(mocks.taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ listId: "list-global-default" }),
      );
      expect(mocks.listRepo.findDefault).not.toHaveBeenCalled();
    });

    it("falls back to default list when no per-connection or global default", async () => {
      const task = makeTask();
      const connection = makeConnection();
      const reverseConnection = makeConnection({
        id: "conn-rev",
        userId: "user-2",
        connectedUserId: "user-1",
        targetListId: null,
      });
      const user = makeUser({ sharingDefaultListId: null });
      const defaultList = makeList({ id: "list-default" });
      const targetTask = makeTask({ id: "task-2", userId: "user-2", listId: "list-default" });

      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.connectionRepo.findBetween).mockImplementation((a, b) => {
        if (a === "user-1" && b === "user-2") return Promise.resolve(connection);
        if (a === "user-2" && b === "user-1") return Promise.resolve(reverseConnection);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.userRepo.findById).mockResolvedValue(user);
      vi.mocked(mocks.listRepo.findDefault).mockResolvedValue(defaultList);
      vi.mocked(mocks.taskRepo.findMaxSortOrder).mockResolvedValue(0);
      vi.mocked(mocks.taskRepo.create).mockResolvedValue(targetTask);
      vi.mocked(mocks.sharedTaskRepo.create).mockResolvedValue(makeSharedTask());
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      await service.shareTask("task-1", "user-1", "user-2");

      expect(mocks.listRepo.findDefault).toHaveBeenCalledWith("user-2");
      expect(mocks.taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ listId: "list-default" }),
      );
    });
  });

  describe("unshareTask", () => {
    it("deletes the shared_task record when user owns source task", async () => {
      const shared = makeSharedTask();
      const sourceTask = makeTask({ id: "task-1", userId: "user-1" });

      vi.mocked(mocks.sharedTaskRepo.findById).mockResolvedValue(shared);
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(sourceTask);
      vi.mocked(mocks.sharedTaskRepo.delete).mockResolvedValue(undefined);

      await service.unshareTask("shared-1", "user-1");

      expect(mocks.sharedTaskRepo.findById).toHaveBeenCalledWith("shared-1");
      expect(mocks.taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(mocks.sharedTaskRepo.delete).toHaveBeenCalledWith("shared-1");
    });

    it("throws if shared task not found", async () => {
      vi.mocked(mocks.sharedTaskRepo.findById).mockResolvedValue(undefined);

      await expect(service.unshareTask("shared-1", "user-1")).rejects.toThrow(
        "Shared task not found",
      );
    });

    it("throws if user does not own source task", async () => {
      const shared = makeSharedTask({ sourceTaskId: "task-1" });
      vi.mocked(mocks.sharedTaskRepo.findById).mockResolvedValue(shared);
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.unshareTask("shared-1", "other-user")).rejects.toThrow(
        "Not authorized to unshare this task",
      );

      expect(mocks.sharedTaskRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("syncSharedFields", () => {
    it("updates dueDate/dueDateEnd/recurrence on target tasks via updateUnchecked", async () => {
      const shares = [makeSharedTask()];
      const targetTask = makeTask({ id: "task-2", userId: "user-2" });

      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockResolvedValue(targetTask);
      vi.mocked(mocks.taskRepo.updateUnchecked).mockResolvedValue(targetTask);
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      await service.syncSharedFields("task-1", {
        dueDate: "2026-04-01",
        dueDateEnd: "2026-04-02",
        recurrence: "RRULE:FREQ=DAILY",
        title: "Should not sync",
      });

      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith("task-2", {
        dueDate: "2026-04-01",
        dueDateEnd: "2026-04-02",
        recurrence: "RRULE:FREQ=DAILY",
      });
      expect(mocks.notificationSender.send).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ type: "shared_field_changed" }),
      );
    });

    it("does nothing for non-synced fields (title, notes)", async () => {
      await service.syncSharedFields("task-1", { title: "New Title", notes: "Some notes" });

      expect(mocks.sharedTaskRepo.findBySourceTask).not.toHaveBeenCalled();
      expect(mocks.taskRepo.updateUnchecked).not.toHaveBeenCalled();
      expect(mocks.notificationSender.send).not.toHaveBeenCalled();
    });

    it("does nothing if no shares", async () => {
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue([]);

      await service.syncSharedFields("task-1", { dueDate: "2026-04-01" });

      expect(mocks.taskRepo.updateUnchecked).not.toHaveBeenCalled();
    });
  });

  describe("notifyOwnerAction", () => {
    it("sends owner_completed notification when action is completed", async () => {
      const shares = [makeSharedTask()];
      const targetTask = makeTask({ id: "task-2", userId: "user-2" });

      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockResolvedValue(targetTask);
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      await service.notifyOwnerAction("task-1", "completed");

      expect(mocks.notificationSender.send).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ type: "owner_completed" }),
      );
    });

    it("sends owner_deleted notification when action is deleted", async () => {
      const shares = [makeSharedTask()];
      const targetTask = makeTask({ id: "task-2", userId: "user-2" });

      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockResolvedValue(targetTask);
      vi.mocked(mocks.notificationSender.send).mockResolvedValue(undefined);

      await service.notifyOwnerAction("task-1", "deleted");

      expect(mocks.notificationSender.send).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ type: "owner_deleted" }),
      );
    });
  });

  describe("getShareInfo", () => {
    it("returns shares by source task when user owns it", async () => {
      const task = makeTask({ id: "task-1", userId: "user-1" });
      const shares = [makeSharedTask()];
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);

      const result = await service.getShareInfo("task-1", "user-1");

      expect(mocks.taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(mocks.sharedTaskRepo.findBySourceTask).toHaveBeenCalledWith("task-1");
      expect(result).toEqual(shares);
    });

    it("throws if user does not own the task", async () => {
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.getShareInfo("task-1", "other-user")).rejects.toThrow("Task not found");

      expect(mocks.sharedTaskRepo.findBySourceTask).not.toHaveBeenCalled();
    });
  });

  describe("getShareSource", () => {
    it("returns share by target task when user owns it", async () => {
      const task = makeTask({ id: "task-2", userId: "user-2" });
      const shared = makeSharedTask();
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(task);
      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(shared);

      const result = await service.getShareSource("task-2", "user-2");

      expect(mocks.taskRepo.findById).toHaveBeenCalledWith("task-2", "user-2");
      expect(mocks.sharedTaskRepo.findByTargetTask).toHaveBeenCalledWith("task-2");
      expect(result).toEqual(shared);
    });

    it("throws if user does not own the task", async () => {
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(undefined);

      await expect(service.getShareSource("task-2", "other-user")).rejects.toThrow(
        "Task not found",
      );

      expect(mocks.sharedTaskRepo.findByTargetTask).not.toHaveBeenCalled();
    });
  });

  describe("evaluateCompletionRule", () => {
    it("mode=any, action=complete — marks all non-completed copies as completed", async () => {
      const sourceTask = makeTask({
        id: "task-1",
        userId: "user-1",
        isCompleted: false,
        shareCompletionMode: "any",
        shareCompletionAction: "complete",
      });
      const targetTask = makeTask({
        id: "task-2",
        userId: "user-2",
        isCompleted: false,
      });
      const shares = [makeSharedTask({ sourceTaskId: "task-1", targetTaskId: "task-2" })];

      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockImplementation((id) => {
        if (id === "task-1") return Promise.resolve(sourceTask);
        if (id === "task-2") return Promise.resolve(targetTask);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.taskRepo.updateUnchecked).mockResolvedValue(sourceTask);

      await service.evaluateCompletionRule("task-1", "user-1");

      // Source task should be marked completed
      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({ isCompleted: true }),
      );
      // Target task should be marked completed
      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith(
        "task-2",
        expect.objectContaining({ isCompleted: true }),
      );
    });

    it("mode=all, not all completed — does nothing", async () => {
      const sourceTask = makeTask({
        id: "task-1",
        userId: "user-1",
        isCompleted: true,
        shareCompletionMode: "all",
        shareCompletionAction: "complete",
      });
      const targetTask = makeTask({
        id: "task-2",
        userId: "user-2",
        isCompleted: false,
      });
      const shares = [makeSharedTask({ sourceTaskId: "task-1", targetTaskId: "task-2" })];

      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockImplementation((id) => {
        if (id === "task-1") return Promise.resolve(sourceTask);
        if (id === "task-2") return Promise.resolve(targetTask);
        return Promise.resolve(undefined);
      });

      await service.evaluateCompletionRule("task-1", "user-1");

      expect(mocks.taskRepo.updateUnchecked).not.toHaveBeenCalled();
    });

    it("mode=all, all completed — no updates needed (all already done)", async () => {
      const sourceTask = makeTask({
        id: "task-1",
        userId: "user-1",
        isCompleted: true,
        shareCompletionMode: "all",
        shareCompletionAction: "complete",
      });
      const targetTask = makeTask({
        id: "task-2",
        userId: "user-2",
        isCompleted: true,
      });
      const shares = [makeSharedTask({ sourceTaskId: "task-1", targetTaskId: "task-2" })];

      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockImplementation((id) => {
        if (id === "task-1") return Promise.resolve(sourceTask);
        if (id === "task-2") return Promise.resolve(targetTask);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.taskRepo.updateUnchecked).mockResolvedValue(sourceTask);

      await service.evaluateCompletionRule("task-1", "user-1");

      // Source is already completed, target is already completed — no updateUnchecked calls
      expect(mocks.taskRepo.updateUnchecked).not.toHaveBeenCalled();
    });

    it("mode=any, action=move — moves source to configured list + marks targets complete", async () => {
      const sourceTask = makeTask({
        id: "task-1",
        userId: "user-1",
        isCompleted: false,
        shareCompletionMode: "any",
        shareCompletionAction: "move",
        shareCompletionListId: "list-done",
      });
      const targetTask = makeTask({
        id: "task-2",
        userId: "user-2",
        isCompleted: false,
      });
      const shares = [makeSharedTask({ sourceTaskId: "task-1", targetTaskId: "task-2" })];

      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockImplementation((id) => {
        if (id === "task-1") return Promise.resolve(sourceTask);
        if (id === "task-2") return Promise.resolve(targetTask);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.taskRepo.updateUnchecked).mockResolvedValue(sourceTask);

      await service.evaluateCompletionRule("task-1", "user-1");

      // Source task should be moved and completed
      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          listId: "list-done",
          isCompleted: true,
        }),
      );
      // Target task should be marked completed
      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith(
        "task-2",
        expect.objectContaining({ isCompleted: true }),
      );
    });

    it("no rule configured — does nothing", async () => {
      const sourceTask = makeTask({
        id: "task-1",
        userId: "user-1",
        shareCompletionMode: null,
      });
      const shares = [makeSharedTask({ sourceTaskId: "task-1", targetTaskId: "task-2" })];

      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockResolvedValue(sourceTask);

      await service.evaluateCompletionRule("task-1", "user-1");

      expect(mocks.taskRepo.updateUnchecked).not.toHaveBeenCalled();
    });

    it("called from target task — resolves source task and evaluates correctly", async () => {
      const sourceTask = makeTask({
        id: "task-1",
        userId: "user-1",
        isCompleted: false,
        shareCompletionMode: "any",
        shareCompletionAction: "complete",
      });
      const targetTask = makeTask({
        id: "task-2",
        userId: "user-2",
        isCompleted: true,
      });
      const shared = makeSharedTask({ sourceTaskId: "task-1", targetTaskId: "task-2" });
      const shares = [shared];

      // Called with target task ID — findByTargetTask returns the share
      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(shared);
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      vi.mocked(mocks.taskRepo.findByIdUnchecked).mockImplementation((id) => {
        if (id === "task-1") return Promise.resolve(sourceTask);
        if (id === "task-2") return Promise.resolve(targetTask);
        return Promise.resolve(undefined);
      });
      vi.mocked(mocks.taskRepo.updateUnchecked).mockResolvedValue(sourceTask);

      await service.evaluateCompletionRule("task-2", "user-2");

      // Should resolve source task and mark it completed
      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({ isCompleted: true }),
      );
      // Target is already completed, no update needed for it
    });
  });
});
