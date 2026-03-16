import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleCalendarService } from "../google-calendar.service";
import type { IUserRepository } from "../../repositories/user.repository";
import type { ICalendarSyncRepository } from "../../repositories/calendar-sync.repository";
import type { IGoogleCalendarClient } from "../../ports/google-calendar-client";
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
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn().mockResolvedValue(null),
    validatePasswordResetToken: vi.fn().mockResolvedValue(null),
    deletePasswordResetToken: vi.fn(),
    updateLlmConfig: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn().mockResolvedValue(true),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn().mockResolvedValue("both"),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    getGoogleCalendarSettings: vi.fn().mockResolvedValue({ ...defaultSettings }),
    findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GoogleCalendarService", () => {
  let userRepo: IUserRepository;
  let syncRepo: ICalendarSyncRepository;
  let gcalClient: IGoogleCalendarClient;
  let service: GoogleCalendarService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    syncRepo = makeSyncRepo();
    gcalClient = makeGcalClient();
    service = new GoogleCalendarService(userRepo, syncRepo, gcalClient);
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

      const result = await service.pullChanges("user-1");

      expect(result.items).toEqual([]);
      expect(gcalClient.listEvents).not.toHaveBeenCalled();
    });

    it("přeskočí když je direction='push'", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        direction: "push",
      });

      const result = await service.pullChanges("user-1");

      expect(result.items).toEqual([]);
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

      const result = await service.pullChanges("user-1");

      expect(gcalClient.listEvents).toHaveBeenCalledWith("user-1", "primary", undefined);
      expect(result.items).toHaveLength(1);
      expect(userRepo.updateGoogleCalendarSyncToken).toHaveBeenCalledWith("user-1", "new-token");
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
