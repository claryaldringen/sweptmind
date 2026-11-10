import { describe, it, expect } from "vitest";
import {
  buildGeofenceRegistrations,
  formatGeofenceBody,
  MAX_GEOFENCES,
  type GeofenceLocatable,
  type GeofenceLocation,
  type GeofenceTask,
} from "../geofence-registrations";

const TODAY = "2026-07-01";

const shop: GeofenceLocation = {
  id: "shop",
  name: "Obchod",
  latitude: 50,
  longitude: 14,
  radius: 0.5,
};
const office: GeofenceLocation = { ...shop, id: "office", name: "Kancelář", latitude: 49 };

function task(overrides: Partial<GeofenceTask>): GeofenceTask {
  return {
    title: "Úkol",
    listId: "inbox",
    locationId: null,
    locationRadius: null,
    isCompleted: false,
    dueDate: null,
    reminderAt: null,
    recurrence: null,
    blockedByTaskId: null,
    blockedByTaskIsCompleted: null,
    tags: [],
    ...overrides,
  };
}

function place(overrides: Partial<GeofenceLocatable>): GeofenceLocatable {
  return { id: "inbox", locationId: null, locationRadius: null, ...overrides };
}

const formatBody = (titles: string[]) => titles.join(" | ");

function build(input: {
  tasks: GeofenceTask[];
  lists?: GeofenceLocatable[];
  tags?: GeofenceLocatable[];
  locations?: GeofenceLocation[];
}) {
  return buildGeofenceRegistrations({
    lists: [place({})],
    tags: [],
    locations: [shop, office],
    today: TODAY,
    formatBody,
    ...input,
  });
}

describe("buildGeofenceRegistrations", () => {
  it("vytvoří geofence pro místo přiřazené přímo úkolu", () => {
    const regs = build({ tasks: [task({ title: "Mléko", locationId: "shop" })] });
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
        task({ title: "Ze seznamu", listId: "groceries" }),
        task({ title: "Ze štítku", tags: [{ id: "work" }] }),
      ],
      lists: [place({}), place({ id: "groceries", locationId: "shop" })],
      tags: [place({ id: "work", locationId: "office", locationRadius: 1 })],
    });
    expect(regs.map((r) => [r.identifier, r.notificationBody])).toEqual([
      ["location:shop:500", "Ze seznamu"],
      ["location:office:1000", "Ze štítku"],
    ]);
  });

  it("sloučí úkoly stejného místa a okruhu do jedné geofence", () => {
    const regs = build({
      tasks: [
        task({ title: "Mléko", locationId: "shop" }),
        task({ title: "Chléb", locationId: "shop" }),
      ],
    });
    expect(regs).toHaveLength(1);
    expect(regs[0].notificationBody).toBe("Mléko | Chléb");
  });

  it("vynechá dokončené, budoucí a blokované úkoly", () => {
    const regs = build({
      tasks: [
        task({ locationId: "shop", isCompleted: true }),
        task({ locationId: "shop", dueDate: "2026-07-10" }),
        task({ locationId: "shop", blockedByTaskId: "x", blockedByTaskIsCompleted: false }),
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
    const tasks = locations.map((loc) => task({ locationId: loc.id }));
    tasks.push(task({ locationId: "loc-94" }));

    const regs = build({ tasks, locations });
    expect(regs).toHaveLength(MAX_GEOFENCES);
    expect(regs[0].identifier).toBe("location:loc-94:500");
  });
});

describe("formatGeofenceBody", () => {
  const andMore = (shown: string, rest: number) => `${shown} +${rest}`;

  it("vypíše až tři názvy", () => {
    expect(formatGeofenceBody(["A", "B", "C"], andMore)).toBe("A, B, C");
  });

  it("zbytek nad tři názvy shrne počtem", () => {
    expect(formatGeofenceBody(["A", "B", "C", "D", "E"], andMore)).toBe("A, B, C +2");
  });
});
