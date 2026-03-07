# CalDAV Calendar Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose a CalDAV server endpoint so users can sync tasks with any calendar app (Google Calendar, Apple Calendar, Outlook, Thunderbird).

**Architecture:** Token-based CalDAV endpoint at `/api/caldav/[token]/...`. One "SweptMind Tasks" calendar per user. Domain layer handles sync mapping (Task ↔ iCal VEVENT). Default filter: only tasks with exact time in `dueDate`, toggleable in Settings.

**Tech Stack:** Next.js API routes (PROPFIND/REPORT/GET/PUT/DELETE), Drizzle ORM, Pothos GraphQL (token management), ical.js or manual iCal string building, xml2js for XML parsing.

**Design doc:** `docs/plans/2026-03-06-caldav-calendar-sync-design.md`

---

### Task 1: DB Schema — users columns + calendar_sync table

**Files:**
- Modify: `src/server/db/schema/auth.ts`
- Create: `src/server/db/schema/calendar-sync.ts`
- Modify: `src/server/db/schema/relations.ts`
- Modify: `src/server/db/schema/index.ts`

**Step 1: Add calendarSyncAll and calendarToken to users table**

In `src/server/db/schema/auth.ts`, add two columns to the `users` table:

```typescript
import { pgTable, text, timestamp, primaryKey, integer, boolean, index } from "drizzle-orm/pg-core";

// Add to users table definition, after updatedAt:
calendarSyncAll: boolean("calendar_sync_all").notNull().default(false),
calendarToken: text("calendar_token").unique(),
```

**Step 2: Create calendar_sync table**

Create `src/server/db/schema/calendar-sync.ts`:

```typescript
import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tasks } from "./tasks";

export const calendarSync = pgTable("calendar_sync", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  icalUid: text("ical_uid").notNull(),
  etag: text("etag").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("calendar_sync_user_ical_uid_idx").on(table.userId, table.icalUid),
  index("calendar_sync_task_id_idx").on(table.taskId),
]);
```

**Step 3: Add relations**

In `src/server/db/schema/relations.ts`, add:

```typescript
import { calendarSync } from "./calendar-sync";

// Add to usersRelations:
calendarSyncs: many(calendarSync),

// Add new relations block:
export const calendarSyncRelations = relations(calendarSync, ({ one }) => ({
  user: one(users, { fields: [calendarSync.userId], references: [users.id] }),
  task: one(tasks, { fields: [calendarSync.taskId], references: [tasks.id] }),
}));
```

**Step 4: Export from index**

In `src/server/db/schema/index.ts`, add:

```typescript
export * from "./calendar-sync";
```

**Step 5: Push schema to DB**

Run: `yarn db:push`
Expected: Schema changes applied (2 new columns on users, 1 new table calendar_sync).

**Step 6: Commit**

```bash
git add src/server/db/schema/
git commit -m "feat(caldav): add calendar_sync table and user columns for CalDAV sync"
```

---

### Task 2: Domain Entity — CalendarSync

**Files:**
- Create: `src/domain/entities/calendar-sync.ts`

**Step 1: Create entity**

```typescript
export interface CalendarSync {
  id: string;
  userId: string;
  taskId: string;
  icalUid: string;
  etag: string;
  lastSyncedAt: Date;
}
```

**Step 2: Commit**

```bash
git add src/domain/entities/calendar-sync.ts
git commit -m "feat(caldav): add CalendarSync domain entity"
```

---

### Task 3: Repository Interface — ICalendarSyncRepository

**Files:**
- Create: `src/domain/repositories/calendar-sync.repository.ts`

**Step 1: Define interface**

```typescript
import type { CalendarSync } from "../entities/calendar-sync";

export interface ICalendarSyncRepository {
  findByUserId(userId: string): Promise<CalendarSync[]>;
  findByTaskId(taskId: string): Promise<CalendarSync | undefined>;
  findByIcalUid(userId: string, icalUid: string): Promise<CalendarSync | undefined>;
  upsert(data: { userId: string; taskId: string; icalUid: string; etag: string }): Promise<CalendarSync>;
  updateEtag(id: string, etag: string): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
  deleteByIcalUid(userId: string, icalUid: string): Promise<void>;
}
```

**Step 2: Commit**

```bash
git add src/domain/repositories/calendar-sync.repository.ts
git commit -m "feat(caldav): add ICalendarSyncRepository interface"
```

---

### Task 4: Drizzle Repository Implementation

**Files:**
- Create: `src/infrastructure/persistence/drizzle-calendar-sync.repository.ts`

**Step 1: Implement repository**

```typescript
import { eq, and } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { CalendarSync } from "@/domain/entities/calendar-sync";
import type { ICalendarSyncRepository } from "@/domain/repositories/calendar-sync.repository";

export class DrizzleCalendarSyncRepository implements ICalendarSyncRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<CalendarSync[]> {
    return this.db.query.calendarSync.findMany({
      where: eq(schema.calendarSync.userId, userId),
    });
  }

  async findByTaskId(taskId: string): Promise<CalendarSync | undefined> {
    return this.db.query.calendarSync.findFirst({
      where: eq(schema.calendarSync.taskId, taskId),
    });
  }

  async findByIcalUid(userId: string, icalUid: string): Promise<CalendarSync | undefined> {
    return this.db.query.calendarSync.findFirst({
      where: and(
        eq(schema.calendarSync.userId, userId),
        eq(schema.calendarSync.icalUid, icalUid),
      ),
    });
  }

  async upsert(data: {
    userId: string;
    taskId: string;
    icalUid: string;
    etag: string;
  }): Promise<CalendarSync> {
    const existing = await this.findByIcalUid(data.userId, data.icalUid);
    if (existing) {
      const [updated] = await this.db
        .update(schema.calendarSync)
        .set({ taskId: data.taskId, etag: data.etag, lastSyncedAt: new Date() })
        .where(eq(schema.calendarSync.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(schema.calendarSync)
      .values(data)
      .returning();
    return created;
  }

  async updateEtag(id: string, etag: string): Promise<void> {
    await this.db
      .update(schema.calendarSync)
      .set({ etag, lastSyncedAt: new Date() })
      .where(eq(schema.calendarSync.id, id));
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db
      .delete(schema.calendarSync)
      .where(eq(schema.calendarSync.taskId, taskId));
  }

  async deleteByIcalUid(userId: string, icalUid: string): Promise<void> {
    await this.db
      .delete(schema.calendarSync)
      .where(
        and(
          eq(schema.calendarSync.userId, userId),
          eq(schema.calendarSync.icalUid, icalUid),
        ),
      );
  }
}
```

**Step 2: Commit**

```bash
git add src/infrastructure/persistence/drizzle-calendar-sync.repository.ts
git commit -m "feat(caldav): implement DrizzleCalendarSyncRepository"
```

---

### Task 5: iCal Converter — Task ↔ VEVENT (with tests)

**Files:**
- Create: `src/server/caldav/ical-converter.ts`
- Create: `src/server/caldav/__tests__/ical-converter.test.ts`

**Step 1: Write failing tests**

Create `src/server/caldav/__tests__/ical-converter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  taskToVevent,
  veventToTaskData,
  recurrenceToRrule,
  rruleToRecurrence,
} from "../ical-converter";
import type { Task } from "@/domain/entities/task";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    title: "Test Task",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    reminderAt: null,
    recurrence: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("recurrenceToRrule", () => {
  it("converts DAILY", () => {
    expect(recurrenceToRrule("DAILY")).toBe("FREQ=DAILY");
  });

  it("converts WEEKLY with days", () => {
    expect(recurrenceToRrule("WEEKLY:1,3,5")).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("converts WEEKLY with Sunday", () => {
    expect(recurrenceToRrule("WEEKLY:0,6")).toBe("FREQ=WEEKLY;BYDAY=SU,SA");
  });

  it("converts MONTHLY", () => {
    expect(recurrenceToRrule("MONTHLY")).toBe("FREQ=MONTHLY");
  });

  it("converts YEARLY", () => {
    expect(recurrenceToRrule("YEARLY")).toBe("FREQ=YEARLY");
  });

  it("returns null for null", () => {
    expect(recurrenceToRrule(null)).toBeNull();
  });
});

describe("rruleToRecurrence", () => {
  it("converts FREQ=DAILY", () => {
    expect(rruleToRecurrence("FREQ=DAILY")).toBe("DAILY");
  });

  it("converts FREQ=WEEKLY;BYDAY=MO,WE,FR", () => {
    expect(rruleToRecurrence("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toBe("WEEKLY:1,3,5");
  });

  it("converts FREQ=MONTHLY", () => {
    expect(rruleToRecurrence("FREQ=MONTHLY")).toBe("MONTHLY");
  });

  it("converts FREQ=YEARLY", () => {
    expect(rruleToRecurrence("FREQ=YEARLY")).toBe("YEARLY");
  });

  it("handles RRULE: prefix", () => {
    expect(rruleToRecurrence("RRULE:FREQ=DAILY")).toBe("DAILY");
  });

  it("returns null for unsupported", () => {
    expect(rruleToRecurrence("FREQ=SECONDLY")).toBeNull();
  });
});

describe("taskToVevent", () => {
  it("creates VEVENT with date-only dueDate", () => {
    const task = makeTask({ dueDate: "2026-03-15" });
    const ical = taskToVevent(task, "task-1");
    expect(ical).toContain("BEGIN:VEVENT");
    expect(ical).toContain("END:VEVENT");
    expect(ical).toContain("SUMMARY:Test Task");
    expect(ical).toContain("UID:task-1");
    expect(ical).toContain("DTSTART;VALUE=DATE:20260315");
    expect(ical).toContain("DTEND;VALUE=DATE:20260316");
  });

  it("creates VEVENT with datetime dueDate", () => {
    const task = makeTask({ dueDate: "2026-03-15T14:30" });
    const ical = taskToVevent(task, "task-1");
    expect(ical).toContain("DTSTART:20260315T143000");
    expect(ical).toContain("DTEND:20260315T153000");
  });

  it("includes DESCRIPTION when notes exist", () => {
    const task = makeTask({ notes: "Some notes" });
    const ical = taskToVevent(task, "task-1");
    expect(ical).toContain("DESCRIPTION:Some notes");
  });

  it("includes STATUS COMPLETED", () => {
    const task = makeTask({ isCompleted: true });
    const ical = taskToVevent(task, "task-1");
    expect(ical).toContain("STATUS:COMPLETED");
  });

  it("includes RRULE for recurring tasks", () => {
    const task = makeTask({ dueDate: "2026-03-15", recurrence: "WEEKLY:1,3,5" });
    const ical = taskToVevent(task, "task-1");
    expect(ical).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });
});

describe("veventToTaskData", () => {
  it("parses date-only event", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:ext-1",
      "SUMMARY:External Task",
      "DTSTART;VALUE=DATE:20260315",
      "DTEND;VALUE=DATE:20260316",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data).toEqual({
      title: "External Task",
      notes: null,
      dueDate: "2026-03-15",
      isCompleted: false,
      recurrence: null,
      icalUid: "ext-1",
    });
  });

  it("parses datetime event", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:ext-2",
      "SUMMARY:Meeting",
      "DTSTART:20260315T143000",
      "DTEND:20260315T153000",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data?.dueDate).toBe("2026-03-15T14:30");
  });

  it("parses DESCRIPTION as notes", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:ext-3",
      "SUMMARY:Task",
      "DESCRIPTION:My notes",
      "DTSTART;VALUE=DATE:20260315",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data?.notes).toBe("My notes");
  });

  it("parses STATUS COMPLETED", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:ext-4",
      "SUMMARY:Done Task",
      "STATUS:COMPLETED",
      "DTSTART;VALUE=DATE:20260315",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data?.isCompleted).toBe(true);
  });

  it("parses RRULE", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:ext-5",
      "SUMMARY:Recurring",
      "DTSTART;VALUE=DATE:20260315",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data?.recurrence).toBe("WEEKLY:1,3,5");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/server/caldav/__tests__/ical-converter.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement iCal converter**

Create `src/server/caldav/ical-converter.ts`:

```typescript
import type { Task } from "@/domain/entities/task";

const DAY_MAP: Record<number, string> = {
  0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA",
};

const REVERSE_DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

export function recurrenceToRrule(recurrence: string | null): string | null {
  if (!recurrence) return null;
  if (recurrence === "DAILY") return "FREQ=DAILY";
  if (recurrence === "MONTHLY") return "FREQ=MONTHLY";
  if (recurrence === "YEARLY") return "FREQ=YEARLY";
  if (recurrence.startsWith("WEEKLY:")) {
    const days = recurrence
      .slice(7)
      .split(",")
      .map((d) => DAY_MAP[parseInt(d)])
      .filter(Boolean);
    return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
  }
  return null;
}

export function rruleToRecurrence(rrule: string): string | null {
  const rule = rrule.replace(/^RRULE:/, "");
  const parts = new Map(rule.split(";").map((p) => {
    const [k, v] = p.split("=");
    return [k, v] as [string, string];
  }));
  const freq = parts.get("FREQ");
  if (freq === "DAILY") return "DAILY";
  if (freq === "MONTHLY") return "MONTHLY";
  if (freq === "YEARLY") return "YEARLY";
  if (freq === "WEEKLY") {
    const byday = parts.get("BYDAY");
    if (!byday) return "WEEKLY:1"; // default Monday
    const days = byday
      .split(",")
      .map((d) => REVERSE_DAY_MAP[d])
      .filter((d) => d !== undefined)
      .sort((a, b) => a - b);
    return `WEEKLY:${days.join(",")}`;
  }
  return null;
}

function formatDateIcal(dateStr: string): string {
  // "2026-03-15" → "20260315"
  return dateStr.replace(/-/g, "");
}

function formatDateTimeIcal(dateStr: string): string {
  // "2026-03-15T14:30" → "20260315T143000"
  const [date, time] = dateStr.split("T");
  return `${date.replace(/-/g, "")}T${time.replace(/:/g, "")}00`;
}

function addOneDay(dateStr: string): string {
  // "20260315" → "20260316"
  const d = new Date(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8)),
  );
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addOneHour(dtStr: string): string {
  // "20260315T143000" → "20260315T153000"
  const date = dtStr.slice(0, 8);
  const h = parseInt(dtStr.slice(9, 11));
  const m = dtStr.slice(11, 13);
  const s = dtStr.slice(13, 15);
  const newH = String(h + 1).padStart(2, "0");
  return `${date}T${newH}${m}${s}`;
}

function escapeIcalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function taskToVevent(task: Task, icalUid: string): string {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${icalUid}`);
  lines.push(`SUMMARY:${escapeIcalText(task.title)}`);

  if (task.notes) {
    lines.push(`DESCRIPTION:${escapeIcalText(task.notes)}`);
  }

  if (task.dueDate) {
    const hasTime = task.dueDate.includes("T");
    if (hasTime) {
      const dt = formatDateTimeIcal(task.dueDate);
      lines.push(`DTSTART:${dt}`);
      lines.push(`DTEND:${addOneHour(dt)}`);
    } else {
      const d = formatDateIcal(task.dueDate);
      lines.push(`DTSTART;VALUE=DATE:${d}`);
      lines.push(`DTEND;VALUE=DATE:${addOneDay(d)}`);
    }
  }

  lines.push(`STATUS:${task.isCompleted ? "COMPLETED" : "NEEDS-ACTION"}`);

  if (task.recurrence) {
    const rrule = recurrenceToRrule(task.recurrence);
    if (rrule) lines.push(`RRULE:${rrule}`);
  }

  const created = task.createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const modified = task.updatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  lines.push(`CREATED:${created}`);
  lines.push(`LAST-MODIFIED:${modified}`);
  lines.push(`DTSTAMP:${modified}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

export interface VeventTaskData {
  title: string;
  notes: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  recurrence: string | null;
  icalUid: string;
}

function getIcalProperty(lines: string[], prop: string): string | null {
  for (const line of lines) {
    if (line.startsWith(prop + ":") || line.startsWith(prop + ";")) {
      const colonIdx = line.indexOf(":");
      return colonIdx >= 0 ? line.slice(colonIdx + 1) : null;
    }
  }
  return null;
}

function parseIcalDate(dtstart: string, raw: string): string {
  // raw line: "DTSTART;VALUE=DATE:20260315" or "DTSTART:20260315T143000"
  if (dtstart.length === 8) {
    // Date only: 20260315 → 2026-03-15
    return `${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`;
  }
  // DateTime: 20260315T143000 → 2026-03-15T14:30
  const date = `${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`;
  const time = `${dtstart.slice(9, 11)}:${dtstart.slice(11, 13)}`;
  return `${date}T${time}`;
}

function unescapeIcalText(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

export function veventToTaskData(ical: string): VeventTaskData | null {
  const lines = ical.split(/\r?\n/);
  const uid = getIcalProperty(lines, "UID");
  const summary = getIcalProperty(lines, "SUMMARY");
  if (!uid || !summary) return null;

  const dtstart = getIcalProperty(lines, "DTSTART");
  const description = getIcalProperty(lines, "DESCRIPTION");
  const status = getIcalProperty(lines, "STATUS");
  const rrule = getIcalProperty(lines, "RRULE");

  return {
    title: unescapeIcalText(summary),
    notes: description ? unescapeIcalText(description) : null,
    dueDate: dtstart ? parseIcalDate(dtstart, "") : null,
    isCompleted: status?.toUpperCase() === "COMPLETED",
    recurrence: rrule ? rruleToRecurrence(rrule) : null,
    icalUid: uid,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/server/caldav/__tests__/ical-converter.test.ts`
Expected: All 17 tests PASS.

**Step 5: Commit**

```bash
git add src/server/caldav/
git commit -m "feat(caldav): implement iCal converter with Task ↔ VEVENT mapping"
```

---

### Task 6: XML Builder — CalDAV multistatus responses

**Files:**
- Create: `src/server/caldav/xml-builder.ts`
- Create: `src/server/caldav/__tests__/xml-builder.test.ts`

**Step 1: Write failing tests**

Create `src/server/caldav/__tests__/xml-builder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildMultistatus,
  buildPropfindResponse,
  buildCalendarMultigetResponse,
} from "../xml-builder";

describe("buildPropfindResponse", () => {
  it("builds principal discovery response", () => {
    const xml = buildPropfindResponse("/api/caldav/tok123/", {
      displayname: "SweptMind",
      "current-user-principal": "/api/caldav/tok123/principal/",
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<d:multistatus");
    expect(xml).toContain("<d:displayname>SweptMind</d:displayname>");
    expect(xml).toContain("/api/caldav/tok123/principal/");
  });

  it("builds calendar-home-set response", () => {
    const xml = buildPropfindResponse("/api/caldav/tok123/principal/", {
      "calendar-home-set": "/api/caldav/tok123/calendars/",
    });
    expect(xml).toContain("calendar-home-set");
    expect(xml).toContain("/api/caldav/tok123/calendars/");
  });
});

describe("buildCalendarMultigetResponse", () => {
  it("builds response with multiple events", () => {
    const items = [
      { href: "/api/caldav/tok/calendars/tasks/uid1.ics", etag: '"etag1"', calendarData: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:uid1\r\nEND:VEVENT\r\nEND:VCALENDAR" },
      { href: "/api/caldav/tok/calendars/tasks/uid2.ics", etag: '"etag2"', calendarData: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:uid2\r\nEND:VEVENT\r\nEND:VCALENDAR" },
    ];
    const xml = buildCalendarMultigetResponse(items);
    expect(xml).toContain("uid1.ics");
    expect(xml).toContain("uid2.ics");
    expect(xml).toContain('"etag1"');
    expect(xml).toContain('"etag2"');
  });
});

describe("buildMultistatus", () => {
  it("builds list of hrefs with etags", () => {
    const items = [
      { href: "/api/caldav/tok/calendars/tasks/uid1.ics", etag: '"e1"' },
    ];
    const xml = buildMultistatus(items);
    expect(xml).toContain("uid1.ics");
    expect(xml).toContain('"e1"');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/server/caldav/__tests__/xml-builder.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement XML builder**

Create `src/server/caldav/xml-builder.ts`:

```typescript
const DAV_NS = "DAV:";
const CALDAV_NS = "urn:ietf:params:xml:ns:caldav";
const CS_NS = "http://calendarserver.org/ns/";

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPropfindResponse(
  href: string,
  props: Record<string, string>,
): string {
  const propLines: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    switch (key) {
      case "displayname":
        propLines.push(`<d:displayname>${escapeXml(value)}</d:displayname>`);
        break;
      case "current-user-principal":
        propLines.push(`<d:current-user-principal><d:href>${escapeXml(value)}</d:href></d:current-user-principal>`);
        break;
      case "calendar-home-set":
        propLines.push(`<cal:calendar-home-set><d:href>${escapeXml(value)}</d:href></cal:calendar-home-set>`);
        break;
      case "resourcetype-calendar":
        propLines.push(`<d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>`);
        break;
      case "getctag":
        propLines.push(`<cs:getctag>${escapeXml(value)}</cs:getctag>`);
        break;
      case "supported-calendar-component-set":
        propLines.push(`<cal:supported-calendar-component-set><cal:comp name="VEVENT"/></cal:supported-calendar-component-set>`);
        break;
      default:
        propLines.push(`<d:${key}>${escapeXml(value)}</d:${key}>`);
    }
  }

  return `${xmlHeader()}
<d:multistatus xmlns:d="${DAV_NS}" xmlns:cal="${CALDAV_NS}" xmlns:cs="${CS_NS}">
  <d:response>
    <d:href>${escapeXml(href)}</d:href>
    <d:propstat>
      <d:prop>
        ${propLines.join("\n        ")}
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
}

export function buildMultistatus(
  items: { href: string; etag: string }[],
): string {
  const responses = items
    .map(
      (item) => `  <d:response>
    <d:href>${escapeXml(item.href)}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>${escapeXml(item.etag)}</d:getetag>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`,
    )
    .join("\n");

  return `${xmlHeader()}
<d:multistatus xmlns:d="${DAV_NS}" xmlns:cal="${CALDAV_NS}">
${responses}
</d:multistatus>`;
}

export function buildCalendarMultigetResponse(
  items: { href: string; etag: string; calendarData: string }[],
): string {
  const responses = items
    .map(
      (item) => `  <d:response>
    <d:href>${escapeXml(item.href)}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>${escapeXml(item.etag)}</d:getetag>
        <cal:calendar-data>${escapeXml(item.calendarData)}</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`,
    )
    .join("\n");

  return `${xmlHeader()}
<d:multistatus xmlns:d="${DAV_NS}" xmlns:cal="${CALDAV_NS}">
${responses}
</d:multistatus>`;
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/server/caldav/__tests__/xml-builder.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/server/caldav/
git commit -m "feat(caldav): implement XML builder for CalDAV multistatus responses"
```

---

### Task 7: CalendarService — Business logic (with tests)

**Files:**
- Create: `src/domain/services/calendar.service.ts`
- Create: `src/domain/services/__tests__/calendar.service.test.ts`

**Step 1: Write failing tests**

Create `src/domain/services/__tests__/calendar.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalendarService } from "../calendar.service";
import type { ICalendarSyncRepository } from "@/domain/repositories/calendar-sync.repository";
import type { ITaskRepository } from "@/domain/repositories/task.repository";
import type { Task } from "@/domain/entities/task";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    title: "Test Task",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    reminderAt: null,
    recurrence: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeSyncRepo(overrides: Partial<ICalendarSyncRepository> = {}): ICalendarSyncRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByTaskId: vi.fn().mockResolvedValue(undefined),
    findByIcalUid: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue({ id: "sync-1", userId: "user-1", taskId: "task-1", icalUid: "uid-1", etag: "etag-1", lastSyncedAt: new Date() }),
    updateEtag: vi.fn().mockResolvedValue(undefined),
    deleteByTaskId: vi.fn().mockResolvedValue(undefined),
    deleteByIcalUid: vi.fn().mockResolvedValue(undefined),
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
    create: vi.fn().mockImplementation(async (values) => ({ ...makeTask(), ...values })),
    update: vi.fn().mockImplementation(async (_id, _uid, data) => ({ ...makeTask(), ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    updateSortOrder: vi.fn().mockResolvedValue(undefined),
    countActiveByList: vi.fn().mockResolvedValue(0),
    countActiveByListIds: vi.fn().mockResolvedValue(new Map()),
    countVisibleByList: vi.fn().mockResolvedValue(0),
    countVisibleByListIds: vi.fn().mockResolvedValue(new Map()),
    findByListId: vi.fn().mockResolvedValue([]),
    findByTagId: vi.fn().mockResolvedValue([]),
    findWithLocation: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("CalendarService", () => {
  let syncRepo: ICalendarSyncRepository;
  let taskRepo: ITaskRepository;
  let service: CalendarService;

  beforeEach(() => {
    syncRepo = makeSyncRepo();
    taskRepo = makeTaskRepo();
    service = new CalendarService(syncRepo, taskRepo);
  });

  describe("getSyncableTasks", () => {
    it("returns only tasks with datetime dueDate when syncAll=false", async () => {
      const tasks = [
        makeTask({ id: "1", dueDate: "2026-03-15T14:30" }),
        makeTask({ id: "2", dueDate: "2026-03-15" }),
        makeTask({ id: "3", dueDate: null }),
      ];
      vi.mocked(taskRepo.findPlanned).mockResolvedValue(tasks);

      const result = await service.getSyncableTasks("user-1", false);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("returns all tasks with dueDate when syncAll=true", async () => {
      const tasks = [
        makeTask({ id: "1", dueDate: "2026-03-15T14:30" }),
        makeTask({ id: "2", dueDate: "2026-03-15" }),
        makeTask({ id: "3", dueDate: null }),
      ];
      vi.mocked(taskRepo.findPlanned).mockResolvedValue(tasks);

      const result = await service.getSyncableTasks("user-1", true);
      expect(result).toHaveLength(2);
    });
  });

  describe("upsertFromIcal", () => {
    it("creates new task when icalUid not found", async () => {
      const result = await service.upsertFromIcal("user-1", "list-1", {
        title: "New Event",
        notes: null,
        dueDate: "2026-03-15T14:30",
        isCompleted: false,
        recurrence: null,
        icalUid: "ext-uid-1",
      });

      expect(taskRepo.create).toHaveBeenCalled();
      expect(syncRepo.upsert).toHaveBeenCalled();
    });

    it("updates existing task when icalUid found", async () => {
      vi.mocked(syncRepo.findByIcalUid).mockResolvedValue({
        id: "sync-1",
        userId: "user-1",
        taskId: "task-1",
        icalUid: "ext-uid-1",
        etag: "old-etag",
        lastSyncedAt: new Date(),
      });

      await service.upsertFromIcal("user-1", "list-1", {
        title: "Updated Event",
        notes: null,
        dueDate: "2026-03-15T14:30",
        isCompleted: false,
        recurrence: null,
        icalUid: "ext-uid-1",
      });

      expect(taskRepo.update).toHaveBeenCalledWith("task-1", "user-1", expect.objectContaining({ title: "Updated Event" }));
    });
  });

  describe("deleteFromIcal", () => {
    it("deletes task and sync entry", async () => {
      vi.mocked(syncRepo.findByIcalUid).mockResolvedValue({
        id: "sync-1",
        userId: "user-1",
        taskId: "task-1",
        icalUid: "ext-uid-1",
        etag: "etag",
        lastSyncedAt: new Date(),
      });

      await service.deleteFromIcal("user-1", "ext-uid-1");

      expect(taskRepo.delete).toHaveBeenCalledWith("task-1", "user-1");
      expect(syncRepo.deleteByIcalUid).toHaveBeenCalledWith("user-1", "ext-uid-1");
    });

    it("does nothing when icalUid not found", async () => {
      await service.deleteFromIcal("user-1", "unknown");
      expect(taskRepo.delete).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/calendar.service.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement CalendarService**

Create `src/domain/services/calendar.service.ts`:

```typescript
import type { Task } from "../entities/task";
import type { CalendarSync } from "../entities/calendar-sync";
import type { ICalendarSyncRepository } from "../repositories/calendar-sync.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { VeventTaskData } from "@/server/caldav/ical-converter";
import { computeDefaultReminder } from "./task-visibility";

export class CalendarService {
  constructor(
    private readonly syncRepo: ICalendarSyncRepository,
    private readonly taskRepo: ITaskRepository,
  ) {}

  async getSyncableTasks(userId: string, syncAll: boolean): Promise<Task[]> {
    const tasks = await this.taskRepo.findPlanned(userId);
    if (syncAll) {
      return tasks.filter((t) => t.dueDate != null);
    }
    // Default: only tasks with exact time
    return tasks.filter((t) => t.dueDate != null && t.dueDate.includes("T"));
  }

  async getSyncEntry(taskId: string): Promise<CalendarSync | undefined> {
    return this.syncRepo.findByTaskId(taskId);
  }

  async getSyncEntryByIcalUid(userId: string, icalUid: string): Promise<CalendarSync | undefined> {
    return this.syncRepo.findByIcalUid(userId, icalUid);
  }

  async upsertFromIcal(
    userId: string,
    defaultListId: string,
    data: VeventTaskData,
  ): Promise<{ task: Task; syncEntry: CalendarSync }> {
    const existing = await this.syncRepo.findByIcalUid(userId, data.icalUid);

    let task: Task;
    if (existing) {
      // Update existing task
      task = await this.taskRepo.update(existing.taskId, userId, {
        title: data.title,
        notes: data.notes,
        dueDate: data.dueDate,
        reminderAt: computeDefaultReminder(data.dueDate),
        recurrence: data.recurrence,
        isCompleted: data.isCompleted,
        completedAt: data.isCompleted ? new Date() : null,
      });
    } else {
      // Create new task
      const minSort = await this.taskRepo.findMinSortOrder(defaultListId);
      task = await this.taskRepo.create({
        userId,
        listId: defaultListId,
        title: data.title,
        notes: data.notes,
        dueDate: data.dueDate,
        reminderAt: computeDefaultReminder(data.dueDate),
        recurrence: data.recurrence,
        sortOrder: (minSort ?? 1) - 1,
      });

      if (data.isCompleted) {
        task = await this.taskRepo.update(task.id, userId, {
          isCompleted: true,
          completedAt: new Date(),
        });
      }
    }

    const etag = `"${task.updatedAt.getTime()}"`;
    const syncEntry = await this.syncRepo.upsert({
      userId,
      taskId: task.id,
      icalUid: data.icalUid,
      etag,
    });

    return { task, syncEntry };
  }

  async deleteFromIcal(userId: string, icalUid: string): Promise<void> {
    const syncEntry = await this.syncRepo.findByIcalUid(userId, icalUid);
    if (!syncEntry) return;

    await this.taskRepo.delete(syncEntry.taskId, userId);
    await this.syncRepo.deleteByIcalUid(userId, icalUid);
  }

  async updateEtag(taskId: string, etag: string): Promise<void> {
    const syncEntry = await this.syncRepo.findByTaskId(taskId);
    if (syncEntry) {
      await this.syncRepo.updateEtag(syncEntry.id, etag);
    }
  }

  generateEtag(task: Task): string {
    return `"${task.updatedAt.getTime()}"`;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/calendar.service.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/domain/services/calendar.service.ts src/domain/services/__tests__/calendar.service.test.ts
git commit -m "feat(caldav): implement CalendarService with sync logic"
```

---

### Task 8: User Repository — Token management

**Files:**
- Modify: `src/domain/repositories/user.repository.ts` (add token methods)
- Modify: `src/infrastructure/persistence/drizzle-user.repository.ts` (implement)

**Step 1: Add token methods to IUserRepository**

In `src/domain/repositories/user.repository.ts`, add:

```typescript
findByCalendarToken(token: string): Promise<User | undefined>;
getCalendarToken(userId: string): Promise<string>;
regenerateCalendarToken(userId: string): Promise<string>;
updateCalendarSyncAll(userId: string, syncAll: boolean): Promise<void>;
getCalendarSyncAll(userId: string): Promise<boolean>;
```

**Step 2: Implement in DrizzleUserRepository**

In `src/infrastructure/persistence/drizzle-user.repository.ts`, implement the new methods:

```typescript
async findByCalendarToken(token: string): Promise<User | undefined> {
  return this.db.query.users.findFirst({
    where: eq(schema.users.calendarToken, token),
  });
}

async getCalendarToken(userId: string): Promise<string> {
  const user = await this.db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  if (user?.calendarToken) return user.calendarToken;
  // Generate new token
  const token = crypto.randomUUID();
  await this.db
    .update(schema.users)
    .set({ calendarToken: token })
    .where(eq(schema.users.id, userId));
  return token;
}

async regenerateCalendarToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await this.db
    .update(schema.users)
    .set({ calendarToken: token })
    .where(eq(schema.users.id, userId));
  return token;
}

async updateCalendarSyncAll(userId: string, syncAll: boolean): Promise<void> {
  await this.db
    .update(schema.users)
    .set({ calendarSyncAll: syncAll })
    .where(eq(schema.users.id, userId));
}

async getCalendarSyncAll(userId: string): Promise<boolean> {
  const user = await this.db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { calendarSyncAll: true },
  });
  return user?.calendarSyncAll ?? false;
}
```

**Step 3: Commit**

```bash
git add src/domain/repositories/user.repository.ts src/infrastructure/persistence/drizzle-user.repository.ts
git commit -m "feat(caldav): add calendar token management to user repository"
```

---

### Task 9: Wire up DI container

**Files:**
- Modify: `src/infrastructure/container.ts`

**Step 1: Add CalendarSyncRepository and CalendarService**

```typescript
import { DrizzleCalendarSyncRepository } from "./persistence/drizzle-calendar-sync.repository";
import { CalendarService } from "@/domain/services/calendar.service";

// After existing repos:
const calendarSyncRepo = new DrizzleCalendarSyncRepository(db);

// After existing services:
const calendarService = new CalendarService(calendarSyncRepo, taskRepo);

// Add to repos export:
export const repos = { ..., calendarSync: calendarSyncRepo };

// Add to services export:
export const services = { ..., calendar: calendarService };
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/infrastructure/container.ts
git commit -m "feat(caldav): wire CalendarService into DI container"
```

---

### Task 10: CalDAV Request Handler

**Files:**
- Create: `src/server/caldav/caldav-handler.ts`

**Step 1: Implement CalDAV handler**

This module processes CalDAV requests and delegates to CalendarService. It handles PROPFIND discovery, REPORT queries, GET/PUT/DELETE on individual .ics resources.

Create `src/server/caldav/caldav-handler.ts`:

```typescript
import type { CalendarService } from "@/domain/services/calendar.service";
import type { IUserRepository } from "@/domain/repositories/user.repository";
import type { IListRepository } from "@/domain/repositories/list.repository";
import { taskToVevent, veventToTaskData } from "./ical-converter";
import {
  buildPropfindResponse,
  buildMultistatus,
  buildCalendarMultigetResponse,
} from "./xml-builder";

interface CalDavUser {
  id: string;
  calendarSyncAll: boolean;
}

export class CalDavHandler {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly userRepo: IUserRepository,
    private readonly listRepo: IListRepository,
  ) {}

  async authenticate(token: string): Promise<CalDavUser | null> {
    const user = await this.userRepo.findByCalendarToken(token);
    if (!user) return null;
    const syncAll = await this.userRepo.getCalendarSyncAll(user.id);
    return { id: user.id, calendarSyncAll: syncAll };
  }

  async handlePropfind(
    token: string,
    path: string,
  ): Promise<{ status: number; body: string }> {
    const base = `/api/caldav/${token}`;

    // Root / principal discovery
    if (path === "/" || path === "") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/`, {
          displayname: "SweptMind",
          "current-user-principal": `${base}/principal/`,
        }),
      };
    }

    // Principal → calendar-home-set
    if (path === "/principal/" || path === "/principal") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/principal/`, {
          "calendar-home-set": `${base}/calendars/`,
        }),
      };
    }

    // Calendar home → list of calendars
    if (path === "/calendars/" || path === "/calendars") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/calendars/`, {
          displayname: "Calendars",
        }),
      };
    }

    // The calendar itself
    if (path === "/calendars/tasks/" || path === "/calendars/tasks") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/calendars/tasks/`, {
          displayname: "SweptMind Tasks",
          "resourcetype-calendar": "true",
          "supported-calendar-component-set": "VEVENT",
          getctag: `"${Date.now()}"`,
        }),
      };
    }

    return { status: 404, body: "Not Found" };
  }

  async handleReport(
    token: string,
    user: CalDavUser,
    body: string,
  ): Promise<{ status: number; body: string }> {
    const base = `/api/caldav/${token}`;
    const tasks = await this.calendarService.getSyncableTasks(
      user.id,
      user.calendarSyncAll,
    );

    // Check if it's a calendar-multiget (requests specific hrefs)
    const isMultiget = body.includes("calendar-multiget");

    if (isMultiget) {
      // Extract requested hrefs
      const hrefRegex = /<d:href>([^<]+)<\/d:href>/gi;
      const requestedHrefs: string[] = [];
      let match;
      while ((match = hrefRegex.exec(body)) !== null) {
        requestedHrefs.push(match[1]);
      }

      const items: { href: string; etag: string; calendarData: string }[] = [];
      for (const task of tasks) {
        const syncEntry = await this.calendarService.getSyncEntry(task.id);
        const icalUid = syncEntry?.icalUid ?? task.id;
        const href = `${base}/calendars/tasks/${icalUid}.ics`;
        if (requestedHrefs.length > 0 && !requestedHrefs.includes(href)) continue;

        const vevent = taskToVevent(task, icalUid);
        const calendarData = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SweptMind//CalDAV//EN\r\n${vevent}\r\nEND:VCALENDAR`;
        const etag = this.calendarService.generateEtag(task);
        items.push({ href, etag, calendarData });
      }

      return { status: 207, body: buildCalendarMultigetResponse(items) };
    }

    // calendar-query: return hrefs + etags only
    const items: { href: string; etag: string }[] = [];
    for (const task of tasks) {
      const syncEntry = await this.calendarService.getSyncEntry(task.id);
      const icalUid = syncEntry?.icalUid ?? task.id;
      items.push({
        href: `${base}/calendars/tasks/${icalUid}.ics`,
        etag: this.calendarService.generateEtag(task),
      });
    }

    return { status: 207, body: buildMultistatus(items) };
  }

  async handleGet(
    token: string,
    user: CalDavUser,
    icalUid: string,
  ): Promise<{ status: number; body: string; etag?: string }> {
    // Try sync entry first
    const syncEntry = await this.calendarService.getSyncEntryByIcalUid(user.id, icalUid);
    const taskId = syncEntry?.taskId ?? icalUid;

    // Try to find task by taskId (for tasks created in app, icalUid = task.id)
    const tasks = await this.calendarService.getSyncableTasks(user.id, user.calendarSyncAll);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { status: 404, body: "Not Found" };

    const uid = syncEntry?.icalUid ?? task.id;
    const vevent = taskToVevent(task, uid);
    const calendarData = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SweptMind//CalDAV//EN\r\n${vevent}\r\nEND:VCALENDAR`;
    const etag = this.calendarService.generateEtag(task);

    return { status: 200, body: calendarData, etag };
  }

  async handlePut(
    token: string,
    user: CalDavUser,
    icalUid: string,
    body: string,
    ifMatch?: string | null,
  ): Promise<{ status: number; body: string; etag?: string }> {
    const data = veventToTaskData(body);
    if (!data) return { status: 400, body: "Invalid iCal data" };

    // Find default list for this user
    const lists = await this.listRepo.findByUser(user.id);
    const defaultList = lists.find((l) => l.isDefault);
    if (!defaultList) return { status: 500, body: "No default list" };

    // ETag conflict detection
    if (ifMatch) {
      const existing = await this.calendarService.getSyncEntryByIcalUid(user.id, data.icalUid);
      if (existing && existing.etag !== ifMatch) {
        return { status: 412, body: "Precondition Failed" };
      }
    }

    const { task } = await this.calendarService.upsertFromIcal(
      user.id,
      defaultList.id,
      data,
    );
    const etag = this.calendarService.generateEtag(task);

    return { status: 201, body: "", etag };
  }

  async handleDelete(
    user: CalDavUser,
    icalUid: string,
  ): Promise<{ status: number; body: string }> {
    await this.calendarService.deleteFromIcal(user.id, icalUid);
    return { status: 204, body: "" };
  }
}
```

**Step 2: Commit**

```bash
git add src/server/caldav/caldav-handler.ts
git commit -m "feat(caldav): implement CalDAV request handler"
```

---

### Task 11: API Routes

**Files:**
- Create: `src/app/api/caldav/[token]/route.ts`
- Create: `src/app/api/caldav/[token]/[...path]/route.ts`

**Step 1: Create root CalDAV route (PROPFIND on root)**

Create `src/app/api/caldav/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { CalDavHandler } from "@/server/caldav/caldav-handler";
import { services, repos } from "@/infrastructure/container";

const handler = new CalDavHandler(services.calendar, repos.user, repos.list);

export async function PROPFIND(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const result = await handler.handlePropfind(token, "/");
  return new NextResponse(result.body, {
    status: result.status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      DAV: "1, calendar-access",
    },
  });
}

// Some CalDAV clients send OPTIONS first
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: "OPTIONS, PROPFIND, REPORT, GET, PUT, DELETE",
      DAV: "1, calendar-access",
    },
  });
}
```

**Step 2: Create path-based CalDAV route**

Create `src/app/api/caldav/[token]/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { CalDavHandler } from "@/server/caldav/caldav-handler";
import { services, repos } from "@/infrastructure/container";

const handler = new CalDavHandler(services.calendar, repos.user, repos.list);

function xmlResponse(body: string, status: number, extra?: Record<string, string>) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      DAV: "1, calendar-access",
      ...extra,
    },
  });
}

function icsResponse(body: string, status: number, etag?: string) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      ...(etag ? { ETag: etag } : {}),
    },
  });
}

type Params = { params: Promise<{ token: string; path: string[] }> };

export async function PROPFIND(request: NextRequest, { params }: Params) {
  const { token, path } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const pathStr = "/" + path.join("/") + "/";
  const result = await handler.handlePropfind(token, pathStr);
  return xmlResponse(result.body, result.status);
}

export async function REPORT(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.text();
  const result = await handler.handleReport(token, user, body);
  return xmlResponse(result.body, result.status);
}

export async function GET(request: NextRequest, { params }: Params) {
  const { token, path } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Path: calendars/tasks/{uid}.ics
  const filename = path[path.length - 1];
  if (!filename?.endsWith(".ics")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const icalUid = filename.replace(".ics", "");

  const result = await handler.handleGet(token, user, icalUid);
  if (result.status !== 200) return new NextResponse(result.body, { status: result.status });
  return icsResponse(result.body, result.status, result.etag);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { token, path } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const filename = path[path.length - 1];
  if (!filename?.endsWith(".ics")) {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const icalUid = filename.replace(".ics", "");
  const body = await request.text();
  const ifMatch = request.headers.get("If-Match");

  const result = await handler.handlePut(token, user, icalUid, body, ifMatch);
  return new NextResponse(result.body || null, {
    status: result.status,
    headers: result.etag ? { ETag: result.etag } : {},
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { token, path } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const filename = path[path.length - 1];
  if (!filename?.endsWith(".ics")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const icalUid = filename.replace(".ics", "");

  const result = await handler.handleDelete(user, icalUid);
  return new NextResponse(null, { status: result.status });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: "OPTIONS, PROPFIND, REPORT, GET, PUT, DELETE",
      DAV: "1, calendar-access",
    },
  });
}
```

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/api/caldav/
git commit -m "feat(caldav): add CalDAV API routes with PROPFIND, REPORT, GET, PUT, DELETE"
```

---

### Task 12: Next.js Config — Allow PROPFIND/REPORT/DELETE methods

**Files:**
- Modify: `next.config.ts`

**Step 1: Check if custom HTTP methods need config**

Next.js App Router supports custom HTTP method handlers by exporting named functions. `PROPFIND`, `REPORT`, `DELETE`, `PUT` should work out of the box with Next.js 16 if exported as named exports from `route.ts`.

However, if Next.js does not recognize `PROPFIND` and `REPORT` as valid HTTP methods, we may need to use a catch-all handler. Check by running the dev server and testing with curl:

```bash
curl -X PROPFIND http://localhost:3006/api/caldav/test-token/ -v
```

If Next.js returns 405 Method Not Allowed, we need to handle all methods in a single exported function. In that case, modify the route files to export a single handler:

```typescript
// Alternative: catch-all handler for non-standard HTTP methods
export async function handler(request: NextRequest, context: Params) {
  switch (request.method) {
    case "PROPFIND": return handlePropfind(request, context);
    case "REPORT": return handleReport(request, context);
    // etc.
  }
}

// Export for all methods
export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
```

**Note:** This step may need adjustment based on runtime testing. Next.js 16 may or may not support PROPFIND/REPORT as named exports. If not, use the catch-all pattern above.

**Step 2: Commit if changes needed**

```bash
git add next.config.ts src/app/api/caldav/
git commit -m "fix(caldav): handle non-standard HTTP methods in CalDAV routes"
```

---

### Task 13: GraphQL Mutations — Token & Settings management

**Files:**
- Modify: `src/server/graphql/types/user.ts` (or create `src/server/graphql/types/calendar.ts`)

**Step 1: Add GraphQL mutations**

In a new file `src/server/graphql/types/calendar.ts` (or add to `user.ts`):

```typescript
import { builder } from "../builder";

builder.mutationField("getCalendarToken", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.auth.getCalendarToken(ctx.userId!);
    },
  }),
);

builder.mutationField("regenerateCalendarToken", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.auth.regenerateCalendarToken(ctx.userId!);
    },
  }),
);

builder.mutationField("updateCalendarSyncAll", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: { syncAll: t.arg.boolean({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.auth.updateCalendarSyncAll(ctx.userId!, args.syncAll);
      return args.syncAll;
    },
  }),
);

builder.queryField("calendarSyncAll", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.auth.getCalendarSyncAll(ctx.userId!);
    },
  }),
);
```

**Step 2: Import in schema.ts**

In `src/server/graphql/schema.ts`, add:

```typescript
import "./types/calendar";
```

**Step 3: Add mutations to AuthService**

In `src/domain/services/auth.service.ts`, delegate to user repository:

```typescript
async getCalendarToken(userId: string): Promise<string> {
  return this.userRepo.getCalendarToken(userId);
}

async regenerateCalendarToken(userId: string): Promise<string> {
  return this.userRepo.regenerateCalendarToken(userId);
}

async updateCalendarSyncAll(userId: string, syncAll: boolean): Promise<void> {
  return this.userRepo.updateCalendarSyncAll(userId, syncAll);
}

async getCalendarSyncAll(userId: string): Promise<boolean> {
  return this.userRepo.getCalendarSyncAll(userId);
}
```

**Step 4: Create client-side GraphQL operations**

Create `src/graphql/mutations/calendar.graphql`:

```graphql
mutation GetCalendarToken {
  getCalendarToken
}

mutation RegenerateCalendarToken {
  regenerateCalendarToken
}

mutation UpdateCalendarSyncAll($syncAll: Boolean!) {
  updateCalendarSyncAll(syncAll: $syncAll)
}
```

Create `src/graphql/queries/calendar.graphql`:

```graphql
query CalendarSyncAll {
  calendarSyncAll
}
```

**Step 5: Generate types**

Run: `yarn codegen`

**Step 6: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 7: Commit**

```bash
git add src/server/graphql/ src/domain/services/auth.service.ts src/graphql/
git commit -m "feat(caldav): add GraphQL mutations for calendar token and sync settings"
```

---

### Task 14: i18n — Calendar translations

**Files:**
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/types.ts`

**Step 1: Add translations**

In `en.ts`, add a `calendar` section:

```typescript
calendar: {
  title: "Calendar",
  caldavUrl: "CalDAV URL",
  caldavDescription: "Add this URL to your calendar app (Google Calendar, Apple Calendar, Outlook) to sync tasks.",
  copied: "Copied!",
  copy: "Copy",
  regenerateToken: "Regenerate Token",
  regenerateConfirm: "This will invalidate the current URL. Calendar apps will need the new URL. Continue?",
  syncAllLabel: "Sync all tasks with a due date",
  syncAllDescription: "Default: only tasks with an exact time. Enable to also sync date-only tasks.",
  generating: "Generating...",
},
```

In `cs.ts`:

```typescript
calendar: {
  title: "Kalendář",
  caldavUrl: "CalDAV URL",
  caldavDescription: "Přidej tuto URL do svého kalendáře (Google Calendar, Apple Calendar, Outlook) pro synchronizaci úkolů.",
  copied: "Zkopírováno!",
  copy: "Kopírovat",
  regenerateToken: "Přegenerovat token",
  regenerateConfirm: "Tím se zneplatní aktuální URL. Kalendářové aplikace budou potřebovat novou URL. Pokračovat?",
  syncAllLabel: "Synchronizovat všechny úkoly s termínem",
  syncAllDescription: "Výchozí: pouze úkoly s přesným časem. Zapnutím se budou synchronizovat i úkoly pouze s datem.",
  generating: "Generuji...",
},
```

In `types.ts`, add to `Dictionary`:

```typescript
calendar: {
  title: string;
  caldavUrl: string;
  caldavDescription: string;
  copied: string;
  copy: string;
  regenerateToken: string;
  regenerateConfirm: string;
  syncAllLabel: string;
  syncAllDescription: string;
  generating: string;
};
```

**Step 2: Commit**

```bash
git add src/lib/i18n/
git commit -m "feat(caldav): add i18n translations for calendar settings"
```

---

### Task 15: Settings UI — Calendar section

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add Calendar section to Settings**

Add imports and a new section after the existing settings. The section includes:
1. CalDAV URL display with copy button
2. Regenerate token button with confirmation
3. Sync all toggle switch

```typescript
// New imports at top:
import { Calendar, Copy, Check, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Inside the component, add state:
const [calendarToken, setCalendarToken] = useState<string | null>(null);
const [calendarTokenLoading, setCalendarTokenLoading] = useState(false);
const [copied, setCopied] = useState(false);
const [syncAll, setSyncAll] = useState(false);

// GraphQL hooks:
const [getToken] = useMutation(GET_CALENDAR_TOKEN_MUTATION);
const [regenerateToken] = useMutation(REGENERATE_CALENDAR_TOKEN_MUTATION);
const [updateSyncAll] = useMutation(UPDATE_CALENDAR_SYNC_ALL_MUTATION);
const { data: syncAllData } = useQuery(CALENDAR_SYNC_ALL_QUERY);

// Effect to load token on mount:
useEffect(() => {
  setCalendarTokenLoading(true);
  getToken().then(({ data }) => {
    if (data?.getCalendarToken) setCalendarToken(data.getCalendarToken);
  }).finally(() => setCalendarTokenLoading(false));
}, [getToken]);

// Effect to sync syncAll state:
useEffect(() => {
  if (syncAllData?.calendarSyncAll != null) {
    setSyncAll(syncAllData.calendarSyncAll);
  }
}, [syncAllData]);

// Handlers:
const caldavUrl = calendarToken
  ? `${window.location.origin}/api/caldav/${calendarToken}/calendars/tasks/`
  : "";

const handleCopy = async () => {
  await navigator.clipboard.writeText(caldavUrl);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

const handleRegenerate = async () => {
  if (!confirm(t("calendar.regenerateConfirm"))) return;
  const { data } = await regenerateToken();
  if (data?.regenerateCalendarToken) setCalendarToken(data.regenerateCalendarToken);
};

const handleSyncAllToggle = async (checked: boolean) => {
  setSyncAll(checked);
  await updateSyncAll({ variables: { syncAll: checked } });
};
```

JSX for the Calendar section (add before the closing `</div>` of `max-w-md`):

```tsx
{/* Calendar */}
<div>
  <h2 className="mb-3 text-lg font-semibold">{t("calendar.title")}</h2>

  {/* CalDAV URL */}
  <div className="space-y-2">
    <label className="text-sm font-medium">{t("calendar.caldavUrl")}</label>
    <p className="text-muted-foreground text-xs">{t("calendar.caldavDescription")}</p>
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={calendarTokenLoading ? t("calendar.generating") : caldavUrl}
        className="bg-muted flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={handleCopy}
        disabled={!calendarToken}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  </div>

  {/* Regenerate token */}
  <div className="mt-3">
    <Button variant="outline" size="sm" onClick={handleRegenerate}>
      <RefreshCw className="mr-2 h-4 w-4" />
      {t("calendar.regenerateToken")}
    </Button>
  </div>

  {/* Sync all toggle */}
  <div className="mt-4 flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-medium">{t("calendar.syncAllLabel")}</p>
      <p className="text-muted-foreground text-xs">{t("calendar.syncAllDescription")}</p>
    </div>
    <Switch checked={syncAll} onCheckedChange={handleSyncAllToggle} />
  </div>
</div>
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 3: Test visually**

Run: `yarn dev` and navigate to Settings page. Verify:
- Calendar section appears with CalDAV URL
- Copy button works
- Regenerate token button works with confirmation
- Sync toggle switches

**Step 4: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat(caldav): add Calendar section to Settings UI"
```

---

### Task 16: End-to-end verification

**Step 1: Run all checks**

```bash
yarn check
```

Expected: lint + format + typecheck + test all pass.

**Step 2: Test CalDAV discovery with curl**

```bash
# Start dev server
yarn dev

# Test PROPFIND (after getting a token from Settings)
curl -X PROPFIND http://localhost:3006/api/caldav/{token}/ \
  -H "Content-Type: application/xml" -v

# Expected: 207 Multistatus with principal URL
```

**Step 3: Test with a real calendar client**

Add the CalDAV URL to Apple Calendar or Thunderbird:
1. Go to Settings → Calendar → Copy URL
2. In calendar app, add CalDAV account with that URL
3. Verify tasks with exact time appear as events
4. Create an event in the calendar → verify it appears as a task in SweptMind
5. Edit a task in SweptMind → verify it updates in the calendar
6. Delete an event in the calendar → verify task is deleted

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(caldav): complete CalDAV calendar sync implementation"
```
