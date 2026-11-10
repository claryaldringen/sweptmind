import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LocationReminderService } from "../location-reminder.service";
import type { Task } from "../../entities/task";
import type { List } from "../../entities/list";
import type { Tag } from "../../entities/tag";
import type { Location } from "../../entities/location";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    locationRadius: null,
    title: "Úkol",
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
    forceCalendarSync: false,
    skipMissedRecurrence: false,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
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
    name: "Úkoly",
    icon: null,
    themeColor: null,
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as List;
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: "tag-1",
    userId: "user-1",
    name: "Práce",
    color: "blue",
    deviceContext: null,
    locationId: null,
    locationRadius: null,
    lastUsedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "zizkov",
    userId: "user-1",
    name: "Žižkov",
    latitude: 50.0856,
    longitude: 14.4716,
    radius: 5,
    address: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function setup(data: {
  tasks?: Task[];
  lists?: List[];
  tags?: Tag[];
  tagsByTask?: Map<string, Tag[]>;
  locations?: Location[];
  timeZone?: string | null;
}) {
  const repos = {
    task: { findActiveByUser: vi.fn().mockResolvedValue(data.tasks ?? []) },
    list: { findByUser: vi.fn().mockResolvedValue(data.lists ?? [makeList()]) },
    tag: {
      findByUser: vi.fn().mockResolvedValue(data.tags ?? []),
      findByTaskIds: vi.fn().mockResolvedValue(data.tagsByTask ?? new Map()),
    },
    location: { findByUser: vi.fn().mockResolvedValue(data.locations ?? [makeLocation()]) },
    user: { getTimeZone: vi.fn().mockResolvedValue(data.timeZone ?? "Europe/Prague") },
  };
  const service = new LocationReminderService(
    repos.task,
    repos.list,
    repos.tag,
    repos.location,
    repos.user,
  );
  return { service, repos };
}

const formatBody = (titles: string[]) => titles.join(", ");

describe("LocationReminderService.getGeofences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("vrátí místo s nesplněným úkolem", async () => {
    const { service, repos } = setup({
      tasks: [makeTask({ title: "Schůzka s Pavlem", locationId: "zizkov" })],
    });

    const geofences = await service.getGeofences("user-1", formatBody);

    expect(repos.task.findActiveByUser).toHaveBeenCalledWith("user-1");
    expect(geofences).toEqual([
      {
        identifier: "location:zizkov:5000",
        latitude: 50.0856,
        longitude: 14.4716,
        radiusMeters: 5000,
        notificationTitle: "Žižkov",
        notificationBody: "Schůzka s Pavlem",
        notificationUrl: "/context",
      },
    ]);
  });

  it("místo, kde už žádný nesplněný úkol není, nevrátí", async () => {
    const { service } = setup({ tasks: [] });
    expect(await service.getGeofences("user-1", formatBody)).toEqual([]);
  });

  it("započítá místa seznamů a štítků", async () => {
    const { service, repos } = setup({
      tasks: [
        makeTask({ id: "a", title: "Ze seznamu", listId: "errands" }),
        makeTask({ id: "b", title: "Ze štítku" }),
      ],
      lists: [makeList(), makeList({ id: "errands", locationId: "zizkov" })],
      tags: [makeTag({ id: "work", locationId: "office" })],
      tagsByTask: new Map([["b", [makeTag({ id: "work", locationId: "office" })]]]),
      locations: [makeLocation(), makeLocation({ id: "office", name: "Kancelář", radius: 1 })],
    });

    const geofences = await service.getGeofences("user-1", formatBody);

    expect(repos.tag.findByTaskIds).toHaveBeenCalledWith(["a", "b"]);
    expect(geofences.map((g) => [g.identifier, g.notificationBody])).toEqual([
      ["location:zizkov:5000", "Ze seznamu"],
      ["location:office:1000", "Ze štítku"],
    ]);
  });

  it("vynechá úkol blokovaný nesplněným úkolem, ale ne úkolem splněným", async () => {
    const { service } = setup({
      tasks: [
        makeTask({ id: "blocker", title: "Nejdřív tohle" }),
        makeTask({
          id: "blocked",
          title: "Čeká",
          locationId: "zizkov",
          blockedByTaskId: "blocker",
        }),
        makeTask({
          id: "unblocked",
          title: "Odblokovaný",
          locationId: "zizkov",
          blockedByTaskId: "done-elsewhere",
        }),
      ],
    });

    const geofences = await service.getGeofences("user-1", formatBody);

    expect(geofences.map((g) => g.notificationBody)).toEqual(["Odblokovaný"]);
  });

  it("dnešek počítá v časové zóně uživatele", async () => {
    vi.setSystemTime(new Date("2026-11-10T23:30:00Z")); // v Praze už je 11. 11.
    const tasks = [makeTask({ title: "Zítra", locationId: "zizkov", dueDate: "2026-11-11" })];

    const prague = setup({ tasks, timeZone: "Europe/Prague" });
    const newYork = setup({ tasks, timeZone: "America/New_York" });

    expect(await prague.service.getGeofences("user-1", formatBody)).toHaveLength(1);
    expect(await newYork.service.getGeofences("user-1", formatBody)).toEqual([]);
  });

  it("dá přednost dnešku z telefonu – geofence zaregistroval podle něj", async () => {
    const tasks = [makeTask({ title: "Zítra", locationId: "zizkov", dueDate: "2026-11-11" })];
    const { service } = setup({ tasks, timeZone: "Europe/Prague" }); // v Praze je 10. 11.

    expect(await service.getGeofences("user-1", formatBody, "2026-11-11")).toHaveLength(1);
  });

  it("neomezuje počet míst – telefon ověřuje i místo mimo prvních 90", async () => {
    const locations = Array.from({ length: 95 }, (_, i) => makeLocation({ id: `loc-${i}` }));
    const { service } = setup({
      tasks: locations.map((loc, i) => makeTask({ id: `t-${i}`, locationId: loc.id })),
      locations,
    });

    expect(await service.getGeofences("user-1", formatBody)).toHaveLength(95);
  });

  it("bez uložené časové zóny použije výchozí", async () => {
    const { service, repos } = setup({
      tasks: [makeTask({ locationId: "zizkov" })],
    });
    repos.user.getTimeZone.mockRejectedValue(new Error("db down"));

    expect(await service.getGeofences("user-1", formatBody)).toHaveLength(1);
  });
});
