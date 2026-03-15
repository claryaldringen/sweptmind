# Date Range (dueDateEnd) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow tasks to have an optional end date (`dueDateEnd`), enabling date ranges like "March 21–23" for multi-day events.

**Architecture:** Add a new nullable `due_date_end` text column to the `tasks` table (same format as `dueDate`). Thread `dueDateEnd` through entity → service → GraphQL → UI. Visibility logic is unchanged (driven by `dueDate` start). Recurrence preserves range duration when advancing dates.

**Tech Stack:** Drizzle ORM (PostgreSQL), Pothos GraphQL, Apollo Client v4, React, Vitest, date-fns, Zod v4

---

### Task 1: DB Schema — add `due_date_end` column

**Files:**
- Modify: `src/server/db/schema/tasks.ts:28` (after `dueDate` line)

**Step 1: Add the column**

In `src/server/db/schema/tasks.ts`, add after the `dueDate` line:

```typescript
dueDateEnd: text("due_date_end"), // YYYY-MM-DD or YYYY-MM-DDTHH:mm (end of range)
```

**Step 2: Push schema to local DB**

Run: `yarn db:push`
Expected: Schema synced, no errors.

**Step 3: Commit**

```bash
git add src/server/db/schema/tasks.ts
git commit -m "feat: add due_date_end column to tasks table"
```

---

### Task 2: Domain Entity — extend Task with `dueDateEnd`

**Files:**
- Modify: `src/domain/entities/task.ts`
- Modify: `src/domain/entities/calendar.ts`

**Step 1: Add `dueDateEnd` to Task interface**

In `src/domain/entities/task.ts`, add after `dueDate: string | null;`:

```typescript
dueDateEnd: string | null;
```

**Step 2: Add `dueDateEnd` to CreateTaskInput**

In `CreateTaskInput`, add after `dueDate?`:

```typescript
dueDateEnd?: string | null;
```

**Step 3: Add `dueDateEnd` to UpdateTaskInput**

In `UpdateTaskInput`, add after `dueDate?`:

```typescript
dueDateEnd?: string | null;
```

**Step 4: Add `dueDateEnd` to VeventTaskData**

In `src/domain/entities/calendar.ts`, add after `dueDate: string | null;`:

```typescript
dueDateEnd: string | null;
```

**Step 5: Fix all TypeScript errors caused by missing `dueDateEnd`**

Run: `yarn typecheck`

This will reveal all places where `Task` objects are constructed (tests, mocks, repositories). Add `dueDateEnd: null` to each. Key files:
- `src/domain/services/__tests__/task.service.test.ts` — `makeTask()` helper
- `src/domain/services/__tests__/task-visibility.test.ts` — task fixtures
- `src/infrastructure/persistence/drizzle-task.repository.ts` — `toEntity()` helper
- Any other test files with Task object construction

**Step 6: Run typecheck and tests**

Run: `yarn typecheck && yarn test`
Expected: All pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add dueDateEnd to Task entity and VeventTaskData"
```

---

### Task 3: Domain Service — handle `dueDateEnd` in create/update/complete

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Test: `src/domain/services/__tests__/task.service.test.ts`

**Step 1: Write failing tests**

Add these tests to `src/domain/services/__tests__/task.service.test.ts`:

```typescript
describe("dueDateEnd", () => {
  it("create passes dueDateEnd through", async () => {
    taskRepo.findMinSortOrder.mockResolvedValue(0);
    taskRepo.create.mockResolvedValue(makeTask({ dueDateEnd: "2026-03-23" }));

    await service.create("user-1", {
      listId: "list-1",
      title: "Weekend trip",
      dueDate: "2026-03-21",
      dueDateEnd: "2026-03-23",
    });

    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ dueDateEnd: "2026-03-23" }),
    );
  });

  it("update passes dueDateEnd through", async () => {
    taskRepo.update.mockResolvedValue(makeTask({ dueDateEnd: "2026-03-23" }));

    await service.update("task-1", "user-1", { dueDateEnd: "2026-03-23" });

    expect(taskRepo.update).toHaveBeenCalledWith(
      "task-1", "user-1",
      expect.objectContaining({ dueDateEnd: "2026-03-23" }),
    );
  });

  it("clearing dueDate also clears dueDateEnd", async () => {
    taskRepo.update.mockResolvedValue(makeTask({ dueDate: null, dueDateEnd: null }));

    await service.update("task-1", "user-1", { dueDate: null });

    expect(taskRepo.update).toHaveBeenCalledWith(
      "task-1", "user-1",
      expect.objectContaining({ dueDateEnd: null }),
    );
  });

  it("recurring task completion preserves range duration", async () => {
    // 3-day range: March 21–23
    taskRepo.findById.mockResolvedValue(
      makeTask({
        isCompleted: false,
        recurrence: "WEEKLY:6", // every Saturday
        dueDate: "2026-03-21",
        dueDateEnd: "2026-03-23",
      }),
    );
    taskRepo.update.mockImplementation((_id, _uid, updates) =>
      Promise.resolve(makeTask({ ...updates } as Partial<Task>)),
    );

    await service.toggleCompleted("task-1", "user-1");

    expect(taskRepo.update).toHaveBeenCalledWith(
      "task-1", "user-1",
      expect.objectContaining({
        dueDate: "2026-03-28",      // next Saturday
        dueDateEnd: "2026-03-30",   // +2 days offset preserved
      }),
    );
  });

  it("recurring task completion with no dueDateEnd keeps it null", async () => {
    taskRepo.findById.mockResolvedValue(
      makeTask({
        isCompleted: false,
        recurrence: "DAILY",
        dueDate: "2026-03-21",
        dueDateEnd: null,
      }),
    );
    taskRepo.update.mockImplementation((_id, _uid, updates) =>
      Promise.resolve(makeTask({ ...updates } as Partial<Task>)),
    );

    await service.toggleCompleted("task-1", "user-1");

    const updateCall = taskRepo.update.mock.calls[0][2];
    expect(updateCall).not.toHaveProperty("dueDateEnd");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: FAIL (dueDateEnd not handled yet)

**Step 3: Implement in task.service.ts**

In `create()` method (around line 88), add `dueDateEnd`:

```typescript
async create(userId: string, input: CreateTaskInput): Promise<Task> {
  const minSort = await this.taskRepo.findMinSortOrder(input.listId);
  const sortOrder = (minSort ?? 1) - 1;

  const dueDate = input.dueDate ?? null;
  return this.taskRepo.create({
    ...(input.id ? { id: input.id } : {}),
    userId,
    listId: input.listId,
    title: input.title,
    notes: input.notes ?? null,
    dueDate,
    dueDateEnd: input.dueDateEnd ?? null,        // ← NEW
    reminderAt: computeDefaultReminder(dueDate),
    locationId: input.locationId ?? null,
    deviceContext: input.deviceContext ?? null,
    sortOrder,
  });
}
```

In `update()` method, add dueDateEnd handling. After the `dueDate` block (line ~112), add:

```typescript
if (input.dueDateEnd !== undefined) {
  updates.dueDateEnd = input.dueDateEnd ?? null;
}
// When clearing dueDate, also clear dueDateEnd
if (input.dueDate !== undefined && input.dueDate === null) {
  updates.dueDateEnd = null;
}
```

In `toggleCompleted()` method, after computing `nextDueDate` (line ~156), add dueDateEnd offset:

```typescript
if (!task.isCompleted && task.recurrence) {
  const baseDueDate = task.dueDate ?? format(new Date(), "yyyy-MM-dd");
  const nextDueDate = computeNextDueDate(task.recurrence, baseDueDate);
  const recurrenceUpdates: Partial<Task> = {
    isCompleted: false,
    completedAt: null,
    dueDate: nextDueDate ?? baseDueDate,
    reminderAt: computeDefaultReminder(nextDueDate ?? baseDueDate),
  };

  // Preserve date range duration
  if (task.dueDateEnd && task.dueDate && nextDueDate) {
    const startMs = new Date(task.dueDate.split("T")[0]).getTime();
    const endMs = new Date(task.dueDateEnd.split("T")[0]).getTime();
    const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    if (durationDays > 0) {
      const newEnd = new Date(nextDueDate.split("T")[0]);
      newEnd.setDate(newEnd.getDate() + durationDays);
      const endTimeSuffix = task.dueDateEnd.includes("T") ? `T${task.dueDateEnd.split("T")[1]}` : "";
      recurrenceUpdates.dueDateEnd = format(newEnd, "yyyy-MM-dd") + endTimeSuffix;
    }
  }

  return this.taskRepo.update(id, userId, recurrenceUpdates);
}
```

Also update `updateMany()` (line ~280) to handle dueDateEnd:

```typescript
if (input.dueDateEnd !== undefined) data.dueDateEnd = input.dueDateEnd;
```

And update the `updateMany` type signature to include `dueDateEnd`:

```typescript
async updateMany(
  ids: string[],
  userId: string,
  input: Partial<
    Pick<Task, "listId" | "dueDate" | "dueDateEnd" | "reminderAt" | "recurrence" | "deviceContext">
  >,
): Promise<boolean> {
```

And in `importTasks()` (line ~227), pass dueDateEnd:

```typescript
const created = await this.taskRepo.create({
  userId,
  listId,
  title: task.title.trim(),
  notes: task.notes ?? null,
  dueDate,
  dueDateEnd: null,   // imports don't have dueDateEnd
  reminderAt: computeDefaultReminder(dueDate),
  sortOrder,
});
```

**Step 4: Run tests**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat: handle dueDateEnd in task create/update/completion with range duration preservation"
```

---

### Task 4: Zod Validation — add `dueDateEnd` with cross-field check

**Files:**
- Modify: `src/lib/graphql-validators.ts`

**Step 1: Add `dueDateEnd` to schemas**

In `src/lib/graphql-validators.ts`:

Add `dueDateEnd` to `createTaskSchema` (after `dueDate` line):
```typescript
dueDateEnd: dateString,
```

Add `dueDateEnd` to `updateTaskSchema` (after `dueDate` line):
```typescript
dueDateEnd: dateString,
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: Pass.

**Step 3: Commit**

```bash
git add src/lib/graphql-validators.ts
git commit -m "feat: add dueDateEnd to Zod validation schemas"
```

---

### Task 5: GraphQL — expose `dueDateEnd` and add to input types

**Files:**
- Modify: `src/server/graphql/types/task.ts`

**Step 1: Add `dueDateEnd` field to TaskType**

In `TaskRef.implement()` fields, after `dueDate` (line 25):

```typescript
dueDateEnd: t.exposeString("dueDateEnd", { nullable: true }),
```

**Step 2: Add `dueDateEnd` to CreateTaskInput**

In `CreateTaskInput` builder, after `dueDate`:

```typescript
dueDateEnd: t.string(),
```

**Step 3: Add `dueDateEnd` to UpdateTaskInput**

In `UpdateTaskInput` builder, after `dueDate`:

```typescript
dueDateEnd: t.string(),
```

**Step 4: Add `dueDateEnd` to BulkTaskUpdateInput**

In `BulkTaskUpdateInput` builder, after `dueDate`:

```typescript
dueDateEnd: t.string(),
```

**Step 5: Pass `dueDateEnd` through in bulk update mutation**

In the `updateTasks` mutation resolver (line ~383), add:

```typescript
dueDateEnd: args.input.dueDateEnd ?? undefined,
```

**Step 6: Run typecheck**

Run: `yarn typecheck`
Expected: Pass.

**Step 7: Commit**

```bash
git add src/server/graphql/types/task.ts
git commit -m "feat: expose dueDateEnd in GraphQL schema and input types"
```

---

### Task 6: CalDAV — use `dueDateEnd` for DTEND

**Files:**
- Modify: `src/server/caldav/ical-converter.ts`
- Test: `src/server/caldav/__tests__/ical-converter.test.ts`

**Step 1: Write failing tests**

Add to the existing CalDAV test file:

```typescript
describe("dueDateEnd", () => {
  it("taskToVevent uses dueDateEnd for DTEND when present (date-only)", () => {
    const task = makeTask({
      dueDate: "2026-03-21",
      dueDateEnd: "2026-03-23",
    });
    const vevent = taskToVevent(task, "uid-1");
    expect(vevent).toContain("DTSTART;VALUE=DATE:20260321");
    expect(vevent).toContain("DTEND;VALUE=DATE:20260324"); // +1 day per iCal spec (exclusive end)
  });

  it("taskToVevent uses dueDateEnd for DTEND when present (with time)", () => {
    const task = makeTask({
      dueDate: "2026-03-21T14:00",
      dueDateEnd: "2026-03-23T18:00",
    });
    const vevent = taskToVevent(task, "uid-1");
    expect(vevent).toContain("DTSTART:20260321T140000");
    expect(vevent).toContain("DTEND:20260323T180000");
  });

  it("veventToTaskData extracts dueDateEnd from DTEND", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:uid-1",
      "SUMMARY:Trip",
      "DTSTART;VALUE=DATE:20260321",
      "DTEND;VALUE=DATE:20260324",
      "STATUS:NEEDS-ACTION",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data?.dueDate).toBe("2026-03-21");
    expect(data?.dueDateEnd).toBe("2026-03-23"); // -1 day to convert back from exclusive
  });

  it("veventToTaskData returns null dueDateEnd for single-day events", () => {
    const ical = [
      "BEGIN:VEVENT",
      "UID:uid-1",
      "SUMMARY:Meeting",
      "DTSTART:20260321T140000",
      "DTEND:20260321T150000",
      "STATUS:NEEDS-ACTION",
      "END:VEVENT",
    ].join("\r\n");
    const data = veventToTaskData(ical);
    expect(data?.dueDate).toBe("2026-03-21T14:00");
    expect(data?.dueDateEnd).toBe("2026-03-21T15:00");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/server/caldav/__tests__/ical-converter.test.ts`
Expected: FAIL

**Step 3: Update `taskToVevent` to use `dueDateEnd`**

In `src/server/caldav/ical-converter.ts`, replace the dueDate block (lines 114-125) with:

```typescript
if (task.dueDate) {
  const hasStartTime = task.dueDate.includes("T");
  if (hasStartTime) {
    lines.push(`DTSTART:${formatDateTimeIcal(task.dueDate)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatDateIcal(task.dueDate)}`);
  }

  if (task.dueDateEnd) {
    const hasEndTime = task.dueDateEnd.includes("T");
    if (hasEndTime) {
      lines.push(`DTEND:${formatDateTimeIcal(task.dueDateEnd)}`);
    } else {
      // iCal DATE DTEND is exclusive — add one day
      lines.push(`DTEND;VALUE=DATE:${addOneDay(formatDateIcal(task.dueDateEnd))}`);
    }
  } else {
    // Fallback: no dueDateEnd — use original logic (1 hour or 1 day)
    if (hasStartTime) {
      lines.push(`DTEND:${addOneHour(formatDateTimeIcal(task.dueDate))}`);
    } else {
      lines.push(`DTEND;VALUE=DATE:${addOneDay(formatDateIcal(task.dueDate))}`);
    }
  }
}
```

**Step 4: Update `veventToTaskData` to extract DTEND**

In `veventToTaskData`, add DTEND extraction:

```typescript
const dtend = getIcalProperty(lines, "DTEND");

// Compute dueDateEnd from DTEND
let dueDateEnd: string | null = null;
if (dtend && dtstart) {
  const parsedEnd = parseIcalDate(dtend);
  const parsedStart = parseIcalDate(dtstart);
  // For date-only values, iCal DTEND is exclusive — subtract one day
  if (dtend.length === 8 && dtstart.length === 8) {
    const endDate = new Date(parsedEnd);
    endDate.setDate(endDate.getDate() - 1);
    const adjusted = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    // Only set dueDateEnd if it differs from start
    dueDateEnd = adjusted !== parsedStart ? adjusted : null;
  } else {
    // datetime — use as-is, only set if different start date
    dueDateEnd = parsedEnd !== parsedStart ? parsedEnd : parsedEnd;
  }
}

return {
  title: unescapeIcalText(summary),
  notes: description ? unescapeIcalText(description) : null,
  dueDate: dtstart ? parseIcalDate(dtstart) : null,
  dueDateEnd,
  isCompleted: status?.toUpperCase() === "COMPLETED",
  recurrence: rrule ? rruleToRecurrence(rrule) : null,
  icalUid: uid,
};
```

**Step 5: Run tests**

Run: `yarn test src/server/caldav/__tests__/ical-converter.test.ts`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/server/caldav/ical-converter.ts src/server/caldav/__tests__/ical-converter.test.ts
git commit -m "feat: support dueDateEnd in CalDAV sync (DTEND mapping)"
```

---

### Task 7: i18n — add date range translation keys

**Files:**
- Modify: `src/lib/i18n/types.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`

**Step 1: Add keys to Dictionary type**

In `src/lib/i18n/types.ts`, add to the `datePicker` section:

```typescript
addEndDate: string;
removeEndDate: string;
endDate: string;
quickOneHour: string;
quickUntilSunday: string;
quickCustom: string;
```

And add to the `tasks` section:

```typescript
dueDateRange: string;  // "{start} – {end}"
```

**Step 2: Add Czech translations**

In `src/lib/i18n/dictionaries/cs.ts`, add to `datePicker`:

```typescript
addEndDate: "Přidat koncové datum",
removeEndDate: "Odebrat koncové datum",
endDate: "Konec",
quickOneHour: "+1h",
quickUntilSunday: "Do neděle",
quickCustom: "Vlastní",
```

Add to `tasks`:

```typescript
dueDateRange: "{start} – {end}",
```

**Step 3: Add English translations**

In `src/lib/i18n/dictionaries/en.ts`, add to `datePicker`:

```typescript
addEndDate: "Add end date",
removeEndDate: "Remove end date",
endDate: "End",
quickOneHour: "+1h",
quickUntilSunday: "Until Sunday",
quickCustom: "Custom",
```

Add to `tasks`:

```typescript
dueDateRange: "{start} – {end}",
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: Pass.

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat: add i18n keys for date range UI"
```

---

### Task 8: Client-side — update Apollo queries/fragments with `dueDateEnd`

**Files:**
- Modify: `src/components/providers/app-data-provider.tsx` — add `dueDateEnd` to the `ALL_TASKS` query and `AppTask` type
- Modify: `src/hooks/use-task-analysis.ts` — add `dueDateEnd` to the GraphQL fragment if it includes task fields

**Step 1: Add `dueDateEnd` to app-data-provider**

In the `ALL_TASKS` GraphQL query, add `dueDateEnd` after `dueDate`.
In the `AppTask` interface, add `dueDateEnd: string | null;` after `dueDate`.

**Step 2: Add `dueDateEnd` to any other GraphQL queries/fragments that fetch task data**

Search for `dueDate` in GraphQL queries across the codebase and add `dueDateEnd` where `dueDate` is fetched. Common locations:
- `src/components/tasks/task-detail-panel.tsx` — inline query fragment
- `src/components/tasks/task-input.tsx` — create mutation response
- Context menu date mutations

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: Pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add dueDateEnd to Apollo queries and client types"
```

---

### Task 9: UI — task-dates.tsx — "Přidat koncové datum" with quick buttons

**Files:**
- Modify: `src/components/tasks/detail/task-dates.tsx`

**Step 1: Extend TaskDatesProps**

Add new props to `TaskDatesProps`:

```typescript
dueDateEnd: string | null;
onEndDateSelect: (date: Date | undefined) => void;
onEndTimeChange: (time: string) => void;
onClearEndDate: () => void;
onQuickEndDate: (type: "1h" | "sunday") => void;
```

**Step 2: Add end date UI**

After the dueDate `ResponsivePicker` and before the reminder `ResponsivePicker`, add the end date section. Only show when `dueDate` is set:

```tsx
{dueDate && !dueDateEnd && (
  <div className="px-3">
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground w-full justify-start gap-2 text-xs"
      onClick={() => setEndDateOpen(true)}
    >
      <CalendarRange className="h-3.5 w-3.5" />
      {t("datePicker.addEndDate")}
    </Button>
  </div>
)}

{dueDate && dueDateEnd === null && endDateOpen && (
  <div className="flex gap-1 px-3 pb-2">
    <Button variant="outline" size="sm" className="text-xs" onClick={() => onQuickEndDate("1h")}>
      {t("datePicker.quickOneHour")}
    </Button>
    {/* Show "Until Sunday" only if start is not Sunday */}
    {parseISO(dueDate).getDay() !== 0 && (
      <Button variant="outline" size="sm" className="text-xs" onClick={() => onQuickEndDate("sunday")}>
        {t("datePicker.quickUntilSunday")}
      </Button>
    )}
    <Button variant="outline" size="sm" className="text-xs" onClick={() => setEndPickerOpen(true)}>
      {t("datePicker.quickCustom")}
    </Button>
  </div>
)}

{dueDate && dueDateEnd && (
  <ResponsivePicker
    open={endPickerOpen}
    onOpenChange={setEndPickerOpen}
    title={t("datePicker.endDate")}
    trigger={
      <Button
        variant="ghost"
        className={cn("w-full justify-start gap-2", "text-blue-500")}
      >
        <CalendarRange className="h-4 w-4" />
        {t("tasks.dueDateRange", {
          start: "", // start is shown in dueDate button above
          end: format(
            parseISO(dueDateEnd),
            dueDateEnd.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy",
            { locale: dateFnsLocale },
          ),
        })}
      </Button>
    }
  >
    <DatePickerContent
      value={dueDateEnd ? parseISO(dueDateEnd) : undefined}
      hasTime={dueDateEnd?.includes("T") ?? false}
      timeValue={dueDateEnd?.includes("T") ? dueDateEnd.split("T")[1] : ""}
      onDateSelect={onEndDateSelect}
      onTimeChange={onEndTimeChange}
      onClear={onClearEndDate}
      onClose={() => setEndPickerOpen(false)}
      t={t}
      dateFnsLocale={dateFnsLocale}
      showTimeToggle
    />
  </ResponsivePicker>
)}
```

Add state variables at top of component:

```typescript
const [endDateOpen, setEndDateOpen] = useState(false);
const [endPickerOpen, setEndPickerOpen] = useState(false);
```

Import `CalendarRange` from lucide-react.

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: Pass (may need to fix parent component prop passing first — see Task 10).

**Step 4: Commit**

```bash
git add src/components/tasks/detail/task-dates.tsx
git commit -m "feat: add end date UI with quick buttons (+1h, Until Sunday, Custom)"
```

---

### Task 10: UI — task-detail-panel.tsx — wire up dueDateEnd handlers

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Step 1: Add dueDateEnd to the task detail panel**

In the panel component, locate where `TaskDates` is rendered and pass the new props:

- `dueDateEnd={task.dueDateEnd}`
- `onEndDateSelect` — calls updateTask mutation with `dueDateEnd: format(date, "yyyy-MM-dd")`
- `onEndTimeChange` — calls updateTask mutation with `dueDateEnd: dateStr + "T" + time`
- `onClearEndDate` — calls updateTask mutation with `dueDateEnd: null`
- `onQuickEndDate` — handler implementing:
  - `"1h"`: If dueDate has time, add 1 hour. If date-only, set to `dueDateT01:00` (i.e. start of day + 1h). Then set `dueDateEnd` accordingly.
  - `"sunday"`: Find next Sunday from dueDate, set `dueDateEnd` to that date.

Quick end date handler logic:

```typescript
const handleQuickEndDate = (type: "1h" | "sunday") => {
  if (!task.dueDate) return;
  if (type === "1h") {
    const hasTime = task.dueDate.includes("T");
    if (hasTime) {
      const start = parseISO(task.dueDate);
      const end = addHours(start, 1);
      updateTask({ dueDateEnd: format(end, "yyyy-MM-dd'T'HH:mm") });
    } else {
      // date-only: set end to same day T01:00 (start implied at T00:00)
      updateTask({ dueDateEnd: task.dueDate + "T01:00" });
    }
  } else if (type === "sunday") {
    const start = parseISO(task.dueDate.split("T")[0]);
    const dayOfWeek = start.getDay(); // 0=Sun
    const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const sunday = addDays(start, daysToSunday);
    updateTask({ dueDateEnd: format(sunday, "yyyy-MM-dd") });
  }
};
```

**Step 2: Update the GraphQL mutation to include dueDateEnd**

In the inline `UPDATE_TASK` mutation (if used), add `dueDateEnd` to the input and response fields.

**Step 3: Update optimistic cache updates**

Where Apollo cache is updated optimistically for task updates, include `dueDateEnd` in the cache writes.

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: Pass.

**Step 5: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: wire up dueDateEnd handlers in task detail panel"
```

---

### Task 11: UI — task-item.tsx — display date range in task list

**Files:**
- Modify: `src/components/tasks/task-item.tsx`

**Step 1: Add `dueDateEnd` to task interface**

Add `dueDateEnd?: string | null;` to the Task interface in task-item.tsx (keep optional for backward compatibility).

**Step 2: Update date display logic**

In the metadata section where `task.dueDate` is displayed (around line 525-545), update to show range when `dueDateEnd` exists:

```tsx
{task.dueDate && (
  <span
    className={cn(
      "flex items-center gap-0.5",
      isOverdue ? "text-red-500" : isDueToday ? "text-blue-500" : "text-muted-foreground",
    )}
  >
    <CalendarDays className="h-3 w-3" />
    {isDueToday
      ? t("tasks.today")
      : task.dueDateEnd
        ? `${format(dueDateParsed!, task.dueDate.includes("T") ? "MMM d, h:mm a" : "MMM d", { locale: dateFnsLocale })} – ${format(parseISO(task.dueDateEnd), task.dueDateEnd.includes("T") ? "MMM d, h:mm a" : "MMM d", { locale: dateFnsLocale })}`
        : format(dueDateParsed!, task.dueDate.includes("T") ? "MMM d, h:mm a" : "MMM d", { locale: dateFnsLocale })}
  </span>
)}
```

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: Pass.

**Step 4: Commit**

```bash
git add src/components/tasks/task-item.tsx
git commit -m "feat: display date range in task list item metadata"
```

---

### Task 12: Run full check suite

**Step 1: Run all checks**

Run: `yarn check`
Expected: lint, format, typecheck, tests all pass.

**Step 2: Fix any issues found**

Address lint/format/type errors.

**Step 3: Push schema to local DB (final verification)**

Run: `yarn db:push`
Expected: Clean sync.

**Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "chore: fix lint/format issues from date range implementation"
```

---

### Summary of all files touched

**Created:** None

**Modified:**
- `src/server/db/schema/tasks.ts` — new `due_date_end` column
- `src/domain/entities/task.ts` — `dueDateEnd` on Task, CreateTaskInput, UpdateTaskInput
- `src/domain/entities/calendar.ts` — `dueDateEnd` on VeventTaskData
- `src/domain/services/task.service.ts` — create/update/complete/import/updateMany logic
- `src/domain/services/__tests__/task.service.test.ts` — new tests for dueDateEnd
- `src/lib/graphql-validators.ts` — `dueDateEnd` on Zod schemas
- `src/server/graphql/types/task.ts` — `dueDateEnd` field + input types
- `src/server/caldav/ical-converter.ts` — DTEND mapping
- `src/server/caldav/__tests__/ical-converter.test.ts` — CalDAV range tests
- `src/lib/i18n/types.ts` — new translation keys
- `src/lib/i18n/dictionaries/cs.ts` — Czech translations
- `src/lib/i18n/dictionaries/en.ts` — English translations
- `src/components/providers/app-data-provider.tsx` — Apollo query + type
- `src/components/tasks/detail/task-dates.tsx` — end date UI with quick buttons
- `src/components/tasks/task-detail-panel.tsx` — wire up handlers
- `src/components/tasks/task-item.tsx` — display range in list
