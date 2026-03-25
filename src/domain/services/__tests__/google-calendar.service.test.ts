import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleCalendarService } from "../google-calendar.service";
import type { IUserRepository } from "../../repositories/user.repository";
import type { ICalendarSyncRepository } from "../../repositories/calendar-sync.repository";
import type { IGoogleCalendarClient } from "../../ports/google-calendar-client";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { Task } from "../../entities/task";
import type { CalendarSync } from "../../entities/calendar-sync";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

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
    dueDate: "2025-06-15T10:00:00.000Z",
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
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeSyncEntry(overrides: Partial<CalendarSync> = {}): CalendarSync {
  return {
    id: "sync-1",
    userId: "user-1",
    taskId: "task-1",
    icalUid: "sweptmind-task-1",
    etag: '"1234"',
    googleCalendarEventId: null,
    lastSyncedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

const defaultSettings = {
  enabled: true,
  direction: "both",
  calendarId: "primary",
  syncToken: null,
  channelId: null,
  channelExpiry: null,
  targetListId: "list-1",
  syncAll: false,
  syncDateRange: false,
};

function makeUserRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    findByCalendarToken: vi.fn(),
    getCalendarToken: vi.fn().mockResolvedValue("token"),
    regenerateCalendarToken: vi.fn().mockResolvedValue("new-token"),
    updateCalendarSyncAll: vi.fn(),
    getCalendarSyncAll: vi.fn().mockResolvedValue(false),
    updateCalendarSyncDateRange: vi.fn(),
    getCalendarSyncDateRange: vi.fn().mockResolvedValue(false),
    updateCalendarTargetListId: vi.fn(),
    getCalendarTargetListId: vi.fn().mockResolvedValue(null),
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn().mockResolvedValue(null),
    validatePasswordResetToken: vi.fn().mockResolvedValue(null),
    deletePasswordResetToken: vi.fn(),
    updateAiEnabled: vi.fn(),
    updateLlmModel: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn().mockResolvedValue(true),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn().mockResolvedValue("both"),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    updateGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarTargetListId: vi.fn().mockResolvedValue(null),
    getGoogleCalendarSettings: vi.fn().mockResolvedValue({ ...defaultSettings }),
    findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
    updateSharingDefaultList: vi.fn(),
    ...overrides,
  };
}

function makeSyncRepo(overrides: Partial<ICalendarSyncRepository> = {}): ICalendarSyncRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByTaskId: vi.fn().mockResolvedValue(undefined),
    findByIcalUid: vi.fn().mockResolvedValue(undefined),
    findByGoogleEventId: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(makeSyncEntry()),
    updateEtag: vi.fn(),
    updateGoogleEventId: vi.fn(),
    deleteByTaskId: vi.fn(),
    deleteByIcalUid: vi.fn(),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  };
}

function makeGcalClient(overrides: Partial<IGoogleCalendarClient> = {}): IGoogleCalendarClient {
  return {
    insertEvent: vi.fn().mockResolvedValue({ id: "gcal-event-1", summary: "Test" }),
    patchEvent: vi.fn().mockResolvedValue({ id: "gcal-event-1", summary: "Test" }),
    deleteEvent: vi.fn(),
    listEvents: vi.fn().mockResolvedValue({ items: [], nextSyncToken: "token-1" }),
    watchEvents: vi.fn().mockResolvedValue({ expiration: String(Date.now() + 86400000) }),
    stopChannel: vi.fn(),
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
    create: vi.fn().mockImplementation(async (values) => ({
      ...makeTask(),
      ...values,
      id: `task-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
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

function makeListRepo(overrides: Partial<IListRepository> = {}): IListRepository {
  return {
    findDefault: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([
      {
        id: "list-1",
        name: "Tasks",
        userId: "user-1",
        isDefault: true,
        groupId: null,
        sortOrder: 0,
        createdAt: new Date(),
      },
    ]),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GoogleCalendarService", () => {
  let userRepo: IUserRepository;
  let syncRepo: ICalendarSyncRepository;
  let gcalClient: IGoogleCalendarClient;
  let taskRepo: ITaskRepository;
  let listRepo: IListRepository;
  let service: GoogleCalendarService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    syncRepo = makeSyncRepo();
    gcalClient = makeGcalClient();
    taskRepo = makeTaskRepo();
    listRepo = makeListRepo();
    service = new GoogleCalendarService(userRepo, syncRepo, gcalClient, taskRepo, listRepo);
  });

  // -------------------------------------------------------------------------
  // pushTask
  // -------------------------------------------------------------------------

  describe("pushTask", () => {
    it("přeskočí když je sync vypnutý", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        enabled: false,
      });

      await service.pushTask("user-1", makeTask());

      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
      expect(gcalClient.patchEvent).not.toHaveBeenCalled();
    });

    it("přeskočí když je direction='pull'", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        direction: "pull",
      });

      await service.pushTask("user-1", makeTask());

      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
      expect(gcalClient.patchEvent).not.toHaveBeenCalled();
    });

    it("vytvoří nový event když neexistuje sync záznam", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);
      vi.mocked(gcalClient.insertEvent).mockResolvedValue({
        id: "gcal-new",
        summary: "Test task",
        start: { dateTime: "2025-06-15T10:00:00.000Z" },
        end: { dateTime: "2025-06-15T11:00:00.000Z" },
      });

      const task = makeTask();
      await service.pushTask("user-1", task);

      expect(gcalClient.insertEvent).toHaveBeenCalledWith(
        "user-1",
        "primary",
        expect.objectContaining({ summary: "Test task" }),
      );
      expect(syncRepo.upsert).toHaveBeenCalledWith({
        userId: "user-1",
        taskId: "task-1",
        icalUid: "sweptmind-task-1",
        etag: expect.any(String),
      });
      expect(syncRepo.updateGoogleEventId).toHaveBeenCalledWith("sync-1", "gcal-new");
    });

    it("patchne existující event když sync záznam má googleCalendarEventId", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(
        makeSyncEntry({ googleCalendarEventId: "gcal-existing" }),
      );

      await service.pushTask("user-1", makeTask());

      expect(gcalClient.patchEvent).toHaveBeenCalledWith(
        "user-1",
        "primary",
        "gcal-existing",
        expect.objectContaining({ summary: "Test task" }),
      );
      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });

    it("vytvoří all-day event pro date-only dueDate", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        syncAll: true,
      });
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);

      const task = makeTask({ dueDate: "2025-06-15" });
      await service.pushTask("user-1", task);

      expect(gcalClient.insertEvent).toHaveBeenCalledWith(
        "user-1",
        "primary",
        expect.objectContaining({
          start: { date: "2025-06-15" },
          end: { date: "2025-06-16" },
        }),
      );
    });

    it("přeskočí date-only task když syncAll=false", async () => {
      const task = makeTask({ dueDate: "2025-06-15" });
      await service.pushTask("user-1", task);

      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });

    it("přeskočí date-range task když syncDateRange=false", async () => {
      const task = makeTask({ dueDate: "2025-06-15", dueDateEnd: "2025-06-17" });
      await service.pushTask("user-1", task);

      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });

    it("pushne date-range task když syncDateRange=true", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        syncDateRange: true,
      });
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);

      const task = makeTask({ dueDate: "2025-06-15", dueDateEnd: "2025-06-17" });
      await service.pushTask("user-1", task);

      expect(gcalClient.insertEvent).toHaveBeenCalled();
    });

    it("syncs date-only task when forceCalendarSync is true", async () => {
      const task = makeTask({ dueDate: "2026-03-15", forceCalendarSync: true });
      await service.pushTask("user-1", task);
      expect(gcalClient.insertEvent).toHaveBeenCalled();
    });

    it("přeskočí task bez dueDate", async () => {
      const task = makeTask({ dueDate: null });
      await service.pushTask("user-1", task);

      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // deleteTaskEvent
  // -------------------------------------------------------------------------

  describe("deleteTaskEvent", () => {
    it("smaže event a sync záznam", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(
        makeSyncEntry({ googleCalendarEventId: "gcal-to-delete" }),
      );

      await service.deleteTaskEvent("user-1", "task-1");

      expect(gcalClient.deleteEvent).toHaveBeenCalledWith("user-1", "primary", "gcal-to-delete");
      expect(syncRepo.deleteByTaskId).toHaveBeenCalledWith("task-1");
    });

    it("přeskočí když neexistuje sync záznam", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);

      await service.deleteTaskEvent("user-1", "task-1");

      expect(gcalClient.deleteEvent).not.toHaveBeenCalled();
      expect(syncRepo.deleteByTaskId).not.toHaveBeenCalled();
    });

    it("přeskočí když sync záznam nemá googleCalendarEventId", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(
        makeSyncEntry({ googleCalendarEventId: null }),
      );

      await service.deleteTaskEvent("user-1", "task-1");

      expect(gcalClient.deleteEvent).not.toHaveBeenCalled();
      expect(syncRepo.deleteByTaskId).not.toHaveBeenCalled();
    });

    it("přeskočí když je sync vypnutý", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        enabled: false,
      });

      await service.deleteTaskEvent("user-1", "task-1");

      expect(gcalClient.deleteEvent).not.toHaveBeenCalled();
    });

    it("přeskočí když je direction='pull'", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        direction: "pull",
      });

      await service.deleteTaskEvent("user-1", "task-1");

      expect(gcalClient.deleteEvent).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // pullChanges
  // -------------------------------------------------------------------------

  describe("pullChanges", () => {
    it("přeskočí když je sync vypnutý", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        enabled: false,
      });

      await service.pullChanges("user-1");

      expect(gcalClient.listEvents).not.toHaveBeenCalled();
    });

    it("přeskočí když je direction='push'", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        direction: "push",
      });

      await service.pullChanges("user-1");

      expect(gcalClient.listEvents).not.toHaveBeenCalled();
    });

    it("stáhne změny a uloží syncToken", async () => {
      vi.mocked(gcalClient.listEvents).mockResolvedValue({
        items: [
          {
            id: "ev-1",
            summary: "Meeting",
            start: { dateTime: "2025-06-15T10:00:00Z" },
            end: { dateTime: "2025-06-15T11:00:00Z" },
          },
        ],
        nextSyncToken: "new-token",
      });

      await service.pullChanges("user-1");

      expect(gcalClient.listEvents).toHaveBeenCalledWith("user-1", "primary", undefined);
      expect(userRepo.updateGoogleCalendarSyncToken).toHaveBeenCalledWith("user-1", "new-token");
      expect(taskRepo.create).toHaveBeenCalled();
    });

    it("použije existující syncToken", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        syncToken: "existing-token",
      });

      await service.pullChanges("user-1");

      expect(gcalClient.listEvents).toHaveBeenCalledWith("user-1", "primary", "existing-token");
    });
  });
});
