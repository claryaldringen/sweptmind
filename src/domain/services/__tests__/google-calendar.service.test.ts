import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleCalendarService, describePullStats } from "../google-calendar.service";
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
    skipMissedRecurrence: false,
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
    delete: vi.fn(),
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
    updateClientSettings: vi.fn(),
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
    findUsersWithGoogleCalendarEnabled: vi.fn().mockResolvedValue([]),
    findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
    updateSharingDefaultList: vi.fn(),
    getTimeZone: vi.fn().mockResolvedValue(null),
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

  describe("pushTask – formát času události", () => {
    beforeEach(() => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);
      vi.mocked(gcalClient.insertEvent).mockResolvedValue({
        id: "gcal-new",
        summary: "x",
        start: { date: "2027-01-18" },
        end: { date: "2027-01-19" },
      });
    });

    function insertedEvent() {
      return vi.mocked(gcalClient.insertEvent).mock.calls[0][2];
    }

    it("pošle místní čas úkolu se sekundami a časovým pásmem uživatele (RFC3339)", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        timeZone: "Europe/Prague",
      });

      await service.pushTask("user-1", makeTask({ dueDate: "2027-01-18T12:00", dueDateEnd: null }));

      expect(insertedEvent().start).toEqual({
        dateTime: "2027-01-18T12:00:00",
        timeZone: "Europe/Prague",
      });
      expect(insertedEvent().end).toEqual({
        dateTime: "2027-01-18T13:00:00",
        timeZone: "Europe/Prague",
      });
    });

    it("bez známého pásma použije Europe/Prague", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        timeZone: null,
      });

      await service.pushTask("user-1", makeTask({ dueDate: "2026-10-27T10:45", dueDateEnd: null }));

      expect(insertedEvent().start).toEqual({
        dateTime: "2026-10-27T10:45:00",
        timeZone: "Europe/Prague",
      });
    });

    it("výchozí hodinová délka přejde přes půlnoc", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        timeZone: "America/New_York",
      });

      await service.pushTask("user-1", makeTask({ dueDate: "2026-12-31T23:30", dueDateEnd: null }));

      expect(insertedEvent().end).toEqual({
        dateTime: "2027-01-01T00:30:00",
        timeZone: "America/New_York",
      });
    });

    it("použije konec úkolu", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        timeZone: "Europe/Prague",
      });

      await service.pushTask(
        "user-1",
        makeTask({ dueDate: "2027-01-18T12:00", dueDateEnd: "2027-01-18T14:15" }),
      );

      expect(insertedEvent().end).toEqual({
        dateTime: "2027-01-18T14:15:00",
        timeZone: "Europe/Prague",
      });
    });

    it("starší čas s posunem převede na místní čas s pásmem", async () => {
      await service.pushTask(
        "user-1",
        makeTask({ dueDate: "2026-10-27T10:45:00+01:00", dueDateEnd: "2026-10-27T11:30:00+01:00" }),
      );

      expect(insertedEvent().start).toEqual({
        dateTime: "2026-10-27T10:45:00",
        timeZone: "Europe/Prague",
      });
      expect(insertedEvent().end).toEqual({
        dateTime: "2026-10-27T11:30:00",
        timeZone: "Europe/Prague",
      });
    });

    it("čas v UTC bez konce dostane hodinovou délku v místním čase", async () => {
      await service.pushTask(
        "user-1",
        makeTask({ dueDate: "2026-10-27T10:45:00Z", dueDateEnd: null }),
      );

      expect(insertedEvent().end).toEqual({
        dateTime: "2026-10-27T12:45:00",
        timeZone: "Europe/Prague",
      });
    });

    it("opakovaný úkol pošle s pravidlem opakování", async () => {
      await service.pushTask(
        "user-1",
        makeTask({ dueDate: "2026-10-19T18:00", dueDateEnd: null, recurrence: "WEEKLY:1" }),
      );

      expect(insertedEvent().recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
    });

    it("úprava události zruší opakování odebrané v aplikaci", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(
        makeSyncEntry({ googleCalendarEventId: "gcal-1" }),
      );

      await service.pushTask("user-1", makeTask({ dueDate: "2026-10-19T18:00", recurrence: null }));

      expect(vi.mocked(gcalClient.patchEvent).mock.calls[0][3].recurrence).toEqual([]);
    });
  });

  describe("findTasksInCalendar", () => {
    it("vrátí úkoly uživatele, které mají událost v kalendáři", async () => {
      vi.mocked(syncRepo.findByTaskIds).mockResolvedValue(
        new Map([
          ["a", makeSyncEntry({ taskId: "a", googleCalendarEventId: "ev-a" })],
          ["b", makeSyncEntry({ taskId: "b", googleCalendarEventId: null })],
          [
            "c",
            makeSyncEntry({ taskId: "c", userId: "someone-else", googleCalendarEventId: "ev-c" }),
          ],
        ]),
      );

      expect(await service.findTasksInCalendar("user-1", ["a", "b", "c", "d"])).toEqual(["a"]);
    });

    it("při vypnuté synchronizaci nebo jen importu nevrátí nic", async () => {
      vi.mocked(syncRepo.findByTaskIds).mockResolvedValue(
        new Map([["a", makeSyncEntry({ taskId: "a", googleCalendarEventId: "ev-a" })]]),
      );

      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        direction: "pull",
      });
      expect(await service.findTasksInCalendar("user-1", ["a"])).toEqual([]);

      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        enabled: false,
      });
      expect(await service.findTasksInCalendar("user-1", ["a"])).toEqual([]);
    });
  });

  describe("pullChanges – import událostí", () => {
    const event = (overrides: Record<string, unknown>) => ({
      id: "ev-1",
      summary: "Schůzka",
      start: { dateTime: "2026-10-20T08:00:00Z" },
      end: { dateTime: "2026-10-20T09:00:00Z" },
      ...overrides,
    });

    function pull(items: ReturnType<typeof event>[]) {
      vi.mocked(gcalClient.listEvents).mockResolvedValue({ items });
      return service.pullChanges("user-1");
    }

    it("narozeniny, svátky a upravené výskyty série neimportuje", async () => {
      const stats = await pull([
        event({ id: "b", eventType: "birthday" }),
        event({ id: "h", organizer: { email: "cs.czech#holiday@group.v.calendar.google.com" } }),
        event({ id: "x", recurringEventId: "series-1" }),
      ]);

      expect(taskRepo.create).not.toHaveBeenCalled();
      expect(stats).toMatchObject({ events: 3, created: 0, skipped: 3 });
    });

    it("dříve naimportované narozeniny smaže", async () => {
      vi.mocked(syncRepo.findByGoogleEventId).mockResolvedValue(
        makeSyncEntry({ taskId: "task-b", icalUid: "gcal-b" }),
      );

      const stats = await pull([event({ id: "b", eventType: "birthday" })]);

      expect(taskRepo.delete).toHaveBeenCalledWith("task-b", "user-1");
      expect(syncRepo.deleteByTaskId).toHaveBeenCalledWith("task-b");
      expect(stats).toMatchObject({ events: 1, deleted: 1, skipped: 0 });
    });

    it("opakovanou sérii založí jako jeden úkol s opakováním od nejbližšího výskytu", async () => {
      await pull([
        event({
          start: { date: "2024-01-08" },
          end: { date: "2024-01-09" },
          recurrence: ["RRULE:FREQ=YEARLY"],
        }),
      ]);

      expect(taskRepo.create).toHaveBeenCalledTimes(1);
      const created = vi.mocked(taskRepo.create).mock.calls[0][0];
      expect(created.recurrence).toBe("YEARLY");
      expect(created.dueDate! >= new Date().toISOString().slice(0, 10)).toBe(true);
      expect(created.dueDate!.slice(5)).toBe("01-08");
    });

    it("čas uloží v místním formátu aplikace", async () => {
      await pull([event({})]);

      const created = vi.mocked(taskRepo.create).mock.calls[0][0];
      expect(created.dueDate).toBe("2026-10-20T10:00");
      expect(created.dueDateEnd).toBeNull();
    });

    it("u existujícího úkolu zapíše jen změny a nechá ruční připomínku", async () => {
      vi.mocked(syncRepo.findByGoogleEventId).mockResolvedValue(
        makeSyncEntry({ taskId: "task-1", icalUid: "gcal-ev-1" }),
      );
      vi.mocked(taskRepo.findById).mockResolvedValue(
        makeTask({
          title: "Schůzka",
          notes: null,
          dueDate: "2026-10-20T10:00",
          dueDateEnd: null,
          reminderAt: "2026-10-01",
          recurrence: null,
        }),
      );

      await pull([
        event({
          start: { dateTime: "2026-10-21T08:00:00Z" },
          end: { dateTime: "2026-10-21T09:00:00Z" },
        }),
      ]);

      expect(taskRepo.update).toHaveBeenCalledWith("task-1", "user-1", {
        dueDate: "2026-10-21T10:00",
      });
    });

    it("úkol poslaný z aplikace se po návratu z Google nezmění", async () => {
      vi.mocked(syncRepo.findByGoogleEventId).mockResolvedValue(
        makeSyncEntry({ taskId: "task-1", icalUid: "sweptmind-task-1" }),
      );
      vi.mocked(taskRepo.findById).mockResolvedValue(
        makeTask({
          title: "Schůzka",
          notes: null,
          dueDate: "2026-10-20T10:00",
          dueDateEnd: null,
          reminderAt: "2026-10-19",
          recurrence: "WEEKLY:2",
        }),
      );

      // Pushed before recurrence was sent to Google → the event has none
      await pull([event({})]);

      expect(taskRepo.update).not.toHaveBeenCalled();
    });
  });

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
  // pushUnsyncedTasks
  // -------------------------------------------------------------------------

  describe("pushUnsyncedTasks", () => {
    it("pushes tasks matching sync scope without sync entry", async () => {
      vi.mocked(taskRepo.findByUser).mockResolvedValue([
        makeTask({ id: "t1", dueDate: "2025-06-15T10:00:00Z" }),
        makeTask({ id: "t2", dueDate: "2025-06-16T14:00:00Z" }),
      ]);
      vi.mocked(syncRepo.findByTaskIds).mockResolvedValue(new Map());
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);
      vi.mocked(gcalClient.insertEvent).mockResolvedValue({
        id: "gcal-new",
        summary: "Test",
        start: { dateTime: "2025-06-15T10:00:00Z" },
        end: { dateTime: "2025-06-15T11:00:00Z" },
      });

      const pushed = await service.pushUnsyncedTasks("user-1");

      expect(pushed).toBe(2);
      expect(gcalClient.insertEvent).toHaveBeenCalledTimes(2);
    });

    it("skips tasks that already have sync entries", async () => {
      vi.mocked(taskRepo.findByUser).mockResolvedValue([
        makeTask({ id: "t1", dueDate: "2025-06-15T10:00:00Z" }),
      ]);
      vi.mocked(syncRepo.findByTaskIds).mockResolvedValue(
        new Map([["t1", makeSyncEntry({ taskId: "t1" })]]),
      );

      const pushed = await service.pushUnsyncedTasks("user-1");

      expect(pushed).toBe(0);
      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });

    it("skips completed tasks", async () => {
      vi.mocked(taskRepo.findByUser).mockResolvedValue([
        makeTask({ id: "t1", dueDate: "2025-06-15T10:00:00Z", isCompleted: true }),
      ]);
      vi.mocked(syncRepo.findByTaskIds).mockResolvedValue(new Map());

      const pushed = await service.pushUnsyncedTasks("user-1");

      expect(pushed).toBe(0);
    });

    it("returns 0 when sync is disabled", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        enabled: false,
      });

      const pushed = await service.pushUnsyncedTasks("user-1");

      expect(pushed).toBe(0);
      expect(taskRepo.findByUser).not.toHaveBeenCalled();
    });

    it("returns 0 when direction is pull-only", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings,
        direction: "pull",
      });

      const pushed = await service.pushUnsyncedTasks("user-1");

      expect(pushed).toBe(0);
    });

    it("continues pushing when individual task fails", async () => {
      vi.mocked(taskRepo.findByUser).mockResolvedValue([
        makeTask({ id: "t1", dueDate: "2025-06-15T10:00:00Z" }),
        makeTask({ id: "t2", dueDate: "2025-06-16T10:00:00Z" }),
      ]);
      vi.mocked(syncRepo.findByTaskIds).mockResolvedValue(new Map());
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue(undefined);
      vi.mocked(gcalClient.insertEvent)
        .mockRejectedValueOnce(new Error("API error"))
        .mockResolvedValueOnce({
          id: "gcal-2",
          summary: "Test",
          start: { dateTime: "2025-06-16T10:00:00Z" },
          end: { dateTime: "2025-06-16T11:00:00Z" },
        });

      const pushed = await service.pushUnsyncedTasks("user-1");

      expect(pushed).toBe(1);
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

      expect(await service.pullChanges("user-1")).toBeNull();
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

      const stats = await service.pullChanges("user-1");

      expect(gcalClient.listEvents).toHaveBeenCalledWith("user-1", "primary", undefined);
      expect(userRepo.updateGoogleCalendarSyncToken).toHaveBeenCalledWith("user-1", "new-token");
      expect(taskRepo.create).toHaveBeenCalled();
      expect(stats).toEqual({
        events: 1,
        created: 1,
        updated: 0,
        deleted: 0,
        skipped: 0,
        fullSync: true,
      });
      expect(describePullStats(stats)).toBe(
        "1 events (full sync): 1 created, 0 updated, 0 deleted, 0 unchanged",
      );
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
