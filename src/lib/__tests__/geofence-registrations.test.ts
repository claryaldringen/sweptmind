import { describe, it, expect } from "vitest";
import { buildGeofenceRegistrations, MAX_GEOFENCES } from "../geofence-registrations";
import type {
  AppTask,
  ListItem,
  TagItem,
  LocationItem,
} from "@/components/providers/app-data-provider";

const TODAY = "2026-07-01";

const shop: LocationItem = {
  id: "shop",
  name: "Obchod",
  latitude: 50,
  longitude: 14,
  radius: 0.5,
  address: null,
};
const office: LocationItem = { ...shop, id: "office", name: "Kancelář", latitude: 49 };

function task(overrides: Partial<AppTask>): AppTask {
  return {
    id: "t",
    listId: "inbox",
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
    sortOrder: 0,
    createdAt: "2026-06-01",
    steps: [],
    tags: [],
    location: null,
    list: null,
    blockedByTaskId: null,
    blockedByTask: null,
    blockedByTaskIsCompleted: null,
    ...overrides,
  } as AppTask;
}

function list(overrides: Partial<ListItem>): ListItem {
  return {
    id: "inbox",
    name: "Inbox",
    icon: null,
    themeColor: null,
    isDefault: true,
    sortOrder: 0,
    groupId: null,
    locationId: null,
    locationRadius: null,
    location: null,
    deviceContext: null,
    taskCount: 0,
    visibleTaskCount: 0,
    ...overrides,
  };
}

function tag(overrides: Partial<TagItem>): TagItem {
  return {
    id: "tag",
    name: "Nákup",
    color: "blue",
    taskCount: 0,
    lastUsedAt: null,
    deviceContext: null,
    locationId: null,
    locationRadius: null,
    location: null,
    ...overrides,
  };
}

const formatBody = (titles: string[]) => titles.join(" | ");

function build(input: {
  tasks: AppTask[];
  lists?: ListItem[];
  tags?: TagItem[];
  locations?: LocationItem[];
}) {
  return buildGeofenceRegistrations({
    lists: [list({})],
    tags: [],
    locations: [shop, office],
    today: TODAY,
    formatBody,
    ...input,
  });
}

describe("buildGeofenceRegistrations", () => {
  it("vytvoří geofence pro místo přiřazené přímo úkolu", () => {
    const regs = build({ tasks: [task({ id: "a", title: "Mléko", locationId: "shop" })] });
    expect(regs).toEqual([
      {
        identifier: "location:shop:500",
        latitude: 50,
        longitude: 14,
        radiusMeters: 500,
        notificationTitle: "Obchod",
        notificationBody: "Mléko",
        notificationUrl: "/context",
      },
    ]);
  });

  it("použije okruh úkolu místo výchozího okruhu místa", () => {
    const regs = build({ tasks: [task({ locationId: "shop", locationRadius: 2 })] });
    expect(regs[0].radiusMeters).toBe(2000);
    expect(regs[0].identifier).toBe("location:shop:2000");
  });

  it("dodrží minimální okruh 200 m", () => {
    const regs = build({ tasks: [task({ locationId: "shop", locationRadius: 0.05 })] });
    expect(regs[0].radiusMeters).toBe(200);
  });

  it("zdědí místo ze seznamu i ze štítku", () => {
    const regs = build({
      tasks: [
        task({ id: "a", title: "Ze seznamu", listId: "groceries" }),
        task({ id: "b", title: "Ze štítku", tags: [{ id: "work", name: "Práce", color: "red" }] }),
      ],
      lists: [list({}), list({ id: "groceries", locationId: "shop" })],
      tags: [tag({ id: "work", locationId: "office", locationRadius: 1 })],
    });
    expect(regs.map((r) => [r.identifier, r.notificationBody])).toEqual([
      ["location:shop:500", "Ze seznamu"],
      ["location:office:1000", "Ze štítku"],
    ]);
  });

  it("sloučí úkoly stejného místa a okruhu do jedné geofence", () => {
    const regs = build({
      tasks: [
        task({ id: "a", title: "Mléko", locationId: "shop" }),
        task({ id: "b", title: "Chléb", locationId: "shop" }),
      ],
    });
    expect(regs).toHaveLength(1);
    expect(regs[0].notificationBody).toBe("Mléko | Chléb");
  });

  it("vynechá dokončené, budoucí a blokované úkoly", () => {
    const regs = build({
      tasks: [
        task({ id: "done", locationId: "shop", isCompleted: true }),
        task({ id: "future", locationId: "shop", dueDate: "2026-07-10" }),
        task({
          id: "blocked",
          locationId: "shop",
          blockedByTaskId: "x",
          blockedByTaskIsCompleted: false,
        }),
      ],
    });
    expect(regs).toEqual([]);
  });

  it("ignoruje místo, které už neexistuje", () => {
    expect(build({ tasks: [task({ locationId: "deleted" })] })).toEqual([]);
  });

  it(`omezí počet geofencí na ${MAX_GEOFENCES} a přednost dá místům s více úkoly`, () => {
    const locations = Array.from({ length: MAX_GEOFENCES + 5 }, (_, i) => ({
      ...shop,
      id: `loc-${i}`,
    }));
    const tasks = locations.map((loc, i) => task({ id: `t-${i}`, locationId: loc.id }));
    tasks.push(task({ id: "extra", locationId: "loc-94" }));

    const regs = build({ tasks, locations });
    expect(regs).toHaveLength(MAX_GEOFENCES);
    expect(regs[0].identifier).toBe("location:loc-94:500");
  });
});
