# Recurring Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable tasks to repeat on regular intervals (daily, weekly, monthly, yearly) with automatic reset on completion.

**Architecture:** Custom recurrence format stored in existing `recurrence` field. Domain service handles parsing and next-date computation. `toggleCompleted` resets recurring tasks instead of completing them. UI picker in task-detail-panel.

**Tech Stack:** date-fns (already installed), Vitest for tests, Pothos/GraphQL (existing), React + shadcn/ui

---

### Task 1: Write `recurrence` domain helper + tests

**Files:**
- Create: `src/domain/services/__tests__/recurrence.test.ts`
- Create: `src/domain/services/recurrence.ts`

**Step 1: Write the failing tests**

```typescript
// src/domain/services/__tests__/recurrence.test.ts
import { describe, it, expect } from "vitest";
import { parseRecurrence, computeNextDueDate } from "../recurrence";

describe("parseRecurrence", () => {
  it("parses DAILY", () => {
    expect(parseRecurrence("DAILY")).toEqual({ type: "DAILY" });
  });

  it("parses WEEKLY with days", () => {
    expect(parseRecurrence("WEEKLY:1,3,5")).toEqual({
      type: "WEEKLY",
      days: [1, 3, 5],
    });
  });

  it("parses MONTHLY", () => {
    expect(parseRecurrence("MONTHLY")).toEqual({ type: "MONTHLY" });
  });

  it("parses YEARLY", () => {
    expect(parseRecurrence("YEARLY")).toEqual({ type: "YEARLY" });
  });

  it("returns null for invalid input", () => {
    expect(parseRecurrence("INVALID")).toBeNull();
    expect(parseRecurrence("")).toBeNull();
    expect(parseRecurrence("WEEKLY:")).toBeNull();
    expect(parseRecurrence("WEEKLY:8")).toBeNull();
  });
});

describe("computeNextDueDate", () => {
  it("DAILY: advances by 1 day", () => {
    expect(computeNextDueDate("DAILY", "2026-03-04")).toBe("2026-03-05");
  });

  it("DAILY: preserves time component", () => {
    expect(computeNextDueDate("DAILY", "2026-03-04T14:00")).toBe("2026-03-05T14:00");
  });

  it("WEEKLY: advances to next matching day", () => {
    // 2026-03-04 is Wednesday (day 3). WEEKLY:1,5 = Mon, Fri.
    // Next matching day: Friday 2026-03-06
    expect(computeNextDueDate("WEEKLY:1,5", "2026-03-04")).toBe("2026-03-06");
  });

  it("WEEKLY: wraps to next week if no more days this week", () => {
    // 2026-03-06 is Friday (day 5). WEEKLY:1,5 = Mon, Fri.
    // Next matching day: Monday 2026-03-09
    expect(computeNextDueDate("WEEKLY:1,5", "2026-03-06")).toBe("2026-03-09");
  });

  it("WEEKLY: single day wraps to same day next week", () => {
    // 2026-03-04 is Wednesday (day 3). WEEKLY:3.
    // Next: Wednesday 2026-03-11
    expect(computeNextDueDate("WEEKLY:3", "2026-03-04")).toBe("2026-03-11");
  });

  it("MONTHLY: advances by 1 month", () => {
    expect(computeNextDueDate("MONTHLY", "2026-03-15")).toBe("2026-04-15");
  });

  it("MONTHLY: handles month-end overflow (Jan 31 → Feb 28)", () => {
    expect(computeNextDueDate("MONTHLY", "2026-01-31")).toBe("2026-02-28");
  });

  it("YEARLY: advances by 1 year", () => {
    expect(computeNextDueDate("YEARLY", "2026-03-04")).toBe("2027-03-04");
  });

  it("YEARLY: handles leap year (Feb 29 → Feb 28)", () => {
    expect(computeNextDueDate("YEARLY", "2024-02-29")).toBe("2025-02-28");
  });

  it("returns null for invalid recurrence", () => {
    expect(computeNextDueDate("INVALID", "2026-03-04")).toBeNull();
  });

  it("returns null when dueDate is null-ish", () => {
    expect(computeNextDueDate("DAILY", "")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/domain/services/recurrence.ts
import { addDays, addMonths, addYears, getDay, format, parse } from "date-fns";

interface RecurrenceDaily {
  type: "DAILY";
}

interface RecurrenceWeekly {
  type: "WEEKLY";
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

interface RecurrenceMonthly {
  type: "MONTHLY";
}

interface RecurrenceYearly {
  type: "YEARLY";
}

export type Recurrence = RecurrenceDaily | RecurrenceWeekly | RecurrenceMonthly | RecurrenceYearly;

export function parseRecurrence(recurrence: string): Recurrence | null {
  if (!recurrence) return null;

  if (recurrence === "DAILY") return { type: "DAILY" };
  if (recurrence === "MONTHLY") return { type: "MONTHLY" };
  if (recurrence === "YEARLY") return { type: "YEARLY" };

  if (recurrence.startsWith("WEEKLY:")) {
    const daysStr = recurrence.slice(7);
    if (!daysStr) return null;
    const days = daysStr.split(",").map(Number);
    if (days.some((d) => isNaN(d) || d < 0 || d > 6)) return null;
    if (days.length === 0) return null;
    return { type: "WEEKLY", days: days.sort((a, b) => a - b) };
  }

  return null;
}

export function computeNextDueDate(
  recurrence: string,
  currentDueDate: string,
): string | null {
  if (!currentDueDate) return null;

  const parsed = parseRecurrence(recurrence);
  if (!parsed) return null;

  const hasTime = currentDueDate.includes("T");
  const dateStr = hasTime ? currentDueDate.split("T")[0] : currentDueDate;
  const timeSuffix = hasTime ? `T${currentDueDate.split("T")[1]}` : "";

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  let next: Date;

  switch (parsed.type) {
    case "DAILY":
      next = addDays(date, 1);
      break;

    case "WEEKLY": {
      const currentDay = getDay(date); // 0=Sun
      // Find next matching day after today
      const sorted = parsed.days;
      const laterThisWeek = sorted.find((d) => d > currentDay);
      if (laterThisWeek !== undefined) {
        const diff = laterThisWeek - currentDay;
        next = addDays(date, diff);
      } else {
        // Wrap to first day of next week
        const diff = 7 - currentDay + sorted[0];
        next = addDays(date, diff);
      }
      break;
    }

    case "MONTHLY":
      next = addMonths(date, 1);
      break;

    case "YEARLY":
      next = addYears(date, 1);
      break;
  }

  return format(next, "yyyy-MM-dd") + timeSuffix;
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/domain/services/recurrence.ts src/domain/services/__tests__/recurrence.test.ts
git commit -m "feat: add recurrence parsing and next-date computation with tests"
```

---

### Task 2: Update `toggleCompleted` to handle recurring tasks

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/domain/services/__tests__/task.service.test.ts`

**Step 1: Add failing tests for recurring task completion**

Add to `src/domain/services/__tests__/task.service.test.ts` inside `describe("toggleCompleted")`:

```typescript
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

it("opakující se úkol bez dueDate: normální toggle", async () => {
  const task = makeTask({
    isCompleted: false,
    dueDate: null,
    recurrence: "DAILY",
  });
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
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: New tests FAIL (recurring tasks get completed instead of reset)

**Step 3: Update `toggleCompleted` in task.service.ts**

In `src/domain/services/task.service.ts`, add import at top:

```typescript
import { computeNextDueDate } from "./recurrence";
```

Replace the `toggleCompleted` method:

```typescript
async toggleCompleted(id: string, userId: string): Promise<Task> {
  const task = await this.taskRepo.findById(id, userId);
  if (!task) throw new Error("Task not found");

  // Recurring task being completed → reset with next dueDate
  if (!task.isCompleted && task.recurrence && task.dueDate) {
    const nextDueDate = computeNextDueDate(task.recurrence, task.dueDate);
    return this.taskRepo.update(id, userId, {
      isCompleted: false,
      completedAt: null,
      dueDate: nextDueDate ?? task.dueDate,
      reminderAt: computeDefaultReminder(nextDueDate ?? task.dueDate),
    });
  }

  return this.taskRepo.update(id, userId, {
    isCompleted: !task.isCompleted,
    completedAt: !task.isCompleted ? new Date() : null,
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: All tests PASS

**Step 5: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat: recurring tasks reset with next dueDate on completion"
```

---

### Task 3: Add i18n keys for recurrence UI

**Files:**
- Modify: `src/lib/i18n/types.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`

**Step 1: Add recurrence section to Dictionary type**

In `src/lib/i18n/types.ts`, add after the `datePicker` section:

```typescript
recurrence: {
  addRecurrence: string;
  none: string;
  daily: string;
  weekly: string;
  monthly: string;
  yearly: string;
  everyDay: string;
  everyWeek: string;
  everyMonth: string;
  everyYear: string;
  daysShort: string[]; // ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"]
  removeRecurrence: string;
};
```

**Step 2: Add Czech dictionary entries**

In `src/lib/i18n/dictionaries/cs.ts`, add `recurrence` section:

```typescript
recurrence: {
  addRecurrence: "Přidat opakování",
  none: "Žádné",
  daily: "Denně",
  weekly: "Týdně",
  monthly: "Měsíčně",
  yearly: "Ročně",
  everyDay: "Každý den",
  everyWeek: "Každý týden",
  everyMonth: "Každý měsíc",
  everyYear: "Každý rok",
  daysShort: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
  removeRecurrence: "Zrušit opakování",
},
```

**Step 3: Add English dictionary entries**

In `src/lib/i18n/dictionaries/en.ts`, add `recurrence` section:

```typescript
recurrence: {
  addRecurrence: "Add recurrence",
  none: "None",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  everyDay: "Every day",
  everyWeek: "Every week",
  everyMonth: "Every month",
  everyYear: "Every year",
  daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  removeRecurrence: "Remove recurrence",
},
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat: add i18n keys for recurrence UI"
```

---

### Task 4: Add recurrence field to GET_TASK query and TaskDetail interface

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Step 1: Add `recurrence` to GET_TASK query**

In the GET_TASK gql query (around line 34), add `recurrence` field after `reminderAt`:

```graphql
query GetTask($id: String!) {
  task(id: $id) {
    id
    listId
    locationId
    title
    notes
    isCompleted
    completedAt
    dueDate
    reminderAt
    recurrence
    sortOrder
    createdAt
    steps { ... }
    tags { ... }
    location { ... }
    list { ... }
  }
}
```

**Step 2: Add `recurrence` to TaskDetail interface**

Add `recurrence: string | null;` after `reminderAt` in the TaskDetail interface (around line 234).

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: fetch recurrence field in task detail query"
```

---

### Task 5: Build recurrence picker UI in task-detail-panel

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Step 1: Add Repeat icon import**

Add `Repeat` to the lucide-react import:

```typescript
import { X, Bell, Calendar, Trash2, Plus, Tag, MapPin, Repeat } from "lucide-react";
```

**Step 2: Add recurrence popover state**

Add after the existing `locationSearch` state:

```typescript
const [recurrenceOpen, setRecurrenceOpen] = useState(false);
```

**Step 3: Add helper to format recurrence display**

Add a helper function inside the component (after the handler functions):

```typescript
function formatRecurrence(recurrence: string | null): string | null {
  if (!recurrence) return null;
  if (recurrence === "DAILY") return t("recurrence.everyDay");
  if (recurrence === "MONTHLY") return t("recurrence.everyMonth");
  if (recurrence === "YEARLY") return t("recurrence.everyYear");
  if (recurrence.startsWith("WEEKLY:")) {
    const days = recurrence.slice(7).split(",").map(Number);
    const dayNames = t("recurrence.daysShort") as unknown as string[];
    if (days.length === 7) return t("recurrence.everyDay");
    return days.map((d) => dayNames[d]).join(", ");
  }
  return null;
}
```

**Step 4: Add recurrence handler functions**

```typescript
function handleSetRecurrence(value: string | null) {
  if (!task) return;
  updateTask({ variables: { id: task.id, input: { recurrence: value } } });
  if (value === null) setRecurrenceOpen(false);
}

function handleToggleWeeklyDay(day: number) {
  if (!task) return;
  const current = task.recurrence?.startsWith("WEEKLY:")
    ? task.recurrence.slice(7).split(",").map(Number)
    : [];
  const updated = current.includes(day)
    ? current.filter((d) => d !== day)
    : [...current, day].sort((a, b) => a - b);
  if (updated.length === 0) {
    handleSetRecurrence(null);
  } else {
    handleSetRecurrence(`WEEKLY:${updated.join(",")}`);
  }
}
```

**Step 5: Add recurrence UI section**

In the JSX, after the Reminder `ResponsivePicker` block and before the Tags section, add:

```tsx
{/* Recurrence */}
<Popover open={recurrenceOpen} onOpenChange={setRecurrenceOpen}>
  <PopoverTrigger asChild>
    <Button
      variant="ghost"
      className={cn("w-full justify-start gap-2", task.recurrence && "text-blue-500")}
    >
      <Repeat className="h-4 w-4" />
      {task.recurrence
        ? formatRecurrence(task.recurrence)
        : t("recurrence.addRecurrence")}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-64 space-y-2 p-3" align="start">
    <div className="space-y-1">
      {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((type) => (
        <Button
          key={type}
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start",
            task.recurrence === type && "bg-accent",
            type === "WEEKLY" && task.recurrence?.startsWith("WEEKLY:") && "bg-accent",
          )}
          onClick={() => {
            if (type === "WEEKLY") {
              // Default to current day of week
              const today = new Date().getDay();
              handleSetRecurrence(`WEEKLY:${today}`);
            } else {
              handleSetRecurrence(type);
            }
          }}
        >
          {t(`recurrence.${type.toLowerCase()}` as keyof typeof t)}
        </Button>
      ))}
    </div>

    {task.recurrence?.startsWith("WEEKLY:") && (
      <>
        <Separator />
        <div className="flex gap-1">
          {(t("recurrence.daysShort") as unknown as string[]).map(
            (dayName, index) => {
              const isActive = task.recurrence
                ?.slice(7)
                .split(",")
                .map(Number)
                .includes(index);
              return (
                <Button
                  key={index}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => handleToggleWeeklyDay(index)}
                >
                  {dayName}
                </Button>
              );
            },
          )}
        </div>
      </>
    )}

    {task.recurrence && (
      <>
        <Separator />
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive w-full justify-start"
          onClick={() => handleSetRecurrence(null)}
        >
          {t("recurrence.removeRecurrence")}
        </Button>
      </>
    )}
  </PopoverContent>
</Popover>
```

**Step 6: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: add recurrence picker UI in task detail panel"
```

---

### Task 6: Add recurrence indicator to task-item

**Files:**
- Modify: `src/components/tasks/task-item.tsx`

**Step 1: Check if task-item displays recurrence**

The task-item component should show a small recurrence indicator (Repeat icon) next to tasks that have recurrence set. This is optional but improves discoverability.

Add `Repeat` to lucide-react imports and show a small icon when `task.recurrence` is set:

```tsx
{task.recurrence && (
  <Repeat className="text-muted-foreground h-3 w-3 shrink-0" />
)}
```

Place it near the existing location/dueDate badges.

**Step 2: Ensure recurrence field is fetched in task list queries**

Check that `GET_TASKS_BY_LIST` in `src/app/(app)/lists/[listId]/page.tsx` includes `recurrence` field. If not, add it.

Similarly check planned page queries.

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/tasks/task-item.tsx src/app/\(app\)/lists/\[listId\]/page.tsx
git commit -m "feat: show recurrence indicator on task items"
```

---

### Task 7: Run all checks

**Step 1: Run full check suite**

Run: `yarn check`
Expected: lint + format + typecheck + test all PASS

**Step 2: Manual verification notes**

To verify manually:
1. Create a task with dueDate, set recurrence to "Denně"
2. Complete the task → verify dueDate advances by 1 day and task is uncompleted
3. Set recurrence to "Týdně", select Po + St + Pá
4. Complete on Monday → verify dueDate advances to Wednesday
5. Remove recurrence → verify task completes normally
6. Set recurrence to "Měsíčně" on Jan 31 → verify next is Feb 28
