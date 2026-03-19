# Custom Recurrence Intervals — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to set custom recurrence intervals (e.g., "every 4 months", "every 2 weeks on Mon and Fri").

**Architecture:** Extend the existing string-based recurrence format with an optional interval number. All changes are backward-compatible — no DB or GraphQL schema changes needed. Domain logic (parser, computeNextDueDate) gets interval support, UI gets a custom editor view in the existing popover.

**Tech Stack:** TypeScript, Vitest (domain tests), React (shadcn/ui popover), i18n dictionaries (cs/en)

---

### Task 1: Update parseRecurrence tests for interval support

**Files:**
- Modify: `src/domain/services/__tests__/recurrence.test.ts`

**Step 1: Add failing tests for parseRecurrence with intervals**

Add these test cases inside the existing `describe("parseRecurrence")` block, after the "returns null for invalid input" test:

```typescript
  it("parses DAILY with interval", () => {
    expect(parseRecurrence("DAILY:3")).toEqual({ type: "DAILY", interval: 3 });
  });

  it("parses DAILY without interval as interval 1", () => {
    expect(parseRecurrence("DAILY")).toEqual({ type: "DAILY", interval: 1 });
  });

  it("parses WEEKLY with interval", () => {
    expect(parseRecurrence("WEEKLY:2:1,3,5")).toEqual({
      type: "WEEKLY",
      interval: 2,
      days: [1, 3, 5],
    });
  });

  it("parses WEEKLY without interval as interval 1", () => {
    expect(parseRecurrence("WEEKLY:1,3,5")).toEqual({
      type: "WEEKLY",
      interval: 1,
      days: [1, 3, 5],
    });
  });

  it("parses MONTHLY with interval", () => {
    expect(parseRecurrence("MONTHLY:4")).toEqual({ type: "MONTHLY", interval: 4 });
  });

  it("parses MONTHLY without interval as interval 1", () => {
    expect(parseRecurrence("MONTHLY")).toEqual({ type: "MONTHLY", interval: 1 });
  });

  it("parses MONTHLY_LAST with interval", () => {
    expect(parseRecurrence("MONTHLY_LAST:2")).toEqual({ type: "MONTHLY_LAST", interval: 2 });
  });

  it("parses YEARLY with interval", () => {
    expect(parseRecurrence("YEARLY:2")).toEqual({ type: "YEARLY", interval: 2 });
  });

  it("rejects interval 0", () => {
    expect(parseRecurrence("DAILY:0")).toBeNull();
  });

  it("rejects negative interval", () => {
    expect(parseRecurrence("DAILY:-1")).toBeNull();
  });

  it("rejects non-numeric interval", () => {
    expect(parseRecurrence("DAILY:abc")).toBeNull();
  });
```

Also update the existing tests that check exact equality to include `interval: 1`:

- `"parses DAILY"` → expects `{ type: "DAILY", interval: 1 }`
- `"parses WEEKLY with days"` → expects `{ type: "WEEKLY", interval: 1, days: [1, 3, 5] }`
- `"parses MONTHLY"` → expects `{ type: "MONTHLY", interval: 1 }`
- `"parses YEARLY"` → expects `{ type: "YEARLY", interval: 1 }`
- `"deduplicates WEEKLY days"` → expects `{ type: "WEEKLY", interval: 1, days: [1, 3] }`

**Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: Multiple FAIL — existing parser doesn't return `interval` field.

**Step 3: Commit**

```bash
git add src/domain/services/__tests__/recurrence.test.ts
git commit -m "test: add parseRecurrence tests for custom intervals"
```

---

### Task 2: Implement parseRecurrence interval support

**Files:**
- Modify: `src/domain/services/recurrence.ts` (lines 1–49)

**Step 1: Update type definitions to include interval**

Replace lines 3–29 with:

```typescript
interface RecurrenceDaily {
  type: "DAILY";
  interval: number;
}

interface RecurrenceWeekly {
  type: "WEEKLY";
  interval: number;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

interface RecurrenceMonthly {
  type: "MONTHLY";
  interval: number;
}

interface RecurrenceMonthlyLast {
  type: "MONTHLY_LAST";
  interval: number;
}

interface RecurrenceYearly {
  type: "YEARLY";
  interval: number;
}

export type Recurrence =
  | RecurrenceDaily
  | RecurrenceWeekly
  | RecurrenceMonthly
  | RecurrenceMonthlyLast
  | RecurrenceYearly;
```

**Step 2: Update parseRecurrence function**

Replace the `parseRecurrence` function (lines 31–49) with:

```typescript
export function parseRecurrence(recurrence: string): Recurrence | null {
  if (!recurrence) return null;

  // DAILY or DAILY:N
  if (recurrence === "DAILY") return { type: "DAILY", interval: 1 };
  if (recurrence.startsWith("DAILY:")) {
    const n = Number(recurrence.slice(6));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "DAILY", interval: n };
  }

  // MONTHLY_LAST or MONTHLY_LAST:N (check before MONTHLY to avoid prefix collision)
  if (recurrence === "MONTHLY_LAST") return { type: "MONTHLY_LAST", interval: 1 };
  if (recurrence.startsWith("MONTHLY_LAST:")) {
    const n = Number(recurrence.slice(13));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "MONTHLY_LAST", interval: n };
  }

  // MONTHLY or MONTHLY:N
  if (recurrence === "MONTHLY") return { type: "MONTHLY", interval: 1 };
  if (recurrence.startsWith("MONTHLY:")) {
    const n = Number(recurrence.slice(8));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "MONTHLY", interval: n };
  }

  // YEARLY or YEARLY:N
  if (recurrence === "YEARLY") return { type: "YEARLY", interval: 1 };
  if (recurrence.startsWith("YEARLY:")) {
    const n = Number(recurrence.slice(7));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "YEARLY", interval: n };
  }

  // WEEKLY:days or WEEKLY:N:days
  if (recurrence.startsWith("WEEKLY:")) {
    const rest = recurrence.slice(7);
    if (!rest) return null;

    // Check for WEEKLY:N:days format (two colon-separated segments)
    const colonIndex = rest.indexOf(":");
    let interval = 1;
    let daysStr = rest;

    if (colonIndex !== -1) {
      const maybeInterval = Number(rest.slice(0, colonIndex));
      if (Number.isInteger(maybeInterval) && maybeInterval >= 1) {
        interval = maybeInterval;
        daysStr = rest.slice(colonIndex + 1);
      }
    }

    if (!daysStr) return null;
    const days = daysStr.split(",").map(Number);
    if (days.some((d) => isNaN(d) || d < 0 || d > 6)) return null;
    if (days.length === 0) return null;
    return { type: "WEEKLY", interval, days: [...new Set(days)].sort((a, b) => a - b) };
  }

  return null;
}
```

**Step 3: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: All parseRecurrence tests PASS. Some computeNextDueDate/computeFirstOccurrence tests may fail because they don't yet use `interval` — that's fine.

**Step 4: Commit**

```bash
git add src/domain/services/recurrence.ts
git commit -m "feat: add interval support to parseRecurrence"
```

---

### Task 3: Update computeNextDueDate tests for intervals

**Files:**
- Modify: `src/domain/services/__tests__/recurrence.test.ts`

**Step 1: Add failing tests for computeNextDueDate with intervals**

Add inside the existing `describe("computeNextDueDate")` block:

```typescript
  it("DAILY:3 advances by 3 days", () => {
    expect(computeNextDueDate("DAILY:3", "2026-03-04")).toBe("2026-03-07");
  });

  it("DAILY:3 preserves time component", () => {
    expect(computeNextDueDate("DAILY:3", "2026-03-04T14:00")).toBe("2026-03-07T14:00");
  });

  it("WEEKLY:2 advances to next matching day this week first", () => {
    // 2026-03-04 is Wednesday (day 3). WEEKLY:2:1,5 = every 2 weeks Mon, Fri.
    // Still within the same week cycle: next is Friday 2026-03-06
    expect(computeNextDueDate("WEEKLY:2:1,5", "2026-03-04")).toBe("2026-03-06");
  });

  it("WEEKLY:2 skips extra week when wrapping", () => {
    // 2026-03-06 is Friday (day 5). WEEKLY:2:1,5.
    // No more days this week. Next cycle = skip 1 extra week.
    // Next Monday: 2026-03-06 + (7 - 5 + 1) = +3 days = Mon Mar 9 (that's interval=1)
    // With interval=2: +3 + 7 = +10 days = Mon Mar 16
    expect(computeNextDueDate("WEEKLY:2:1,5", "2026-03-06")).toBe("2026-03-16");
  });

  it("WEEKLY:3 single day skips 2 extra weeks", () => {
    // 2026-03-04 is Wednesday (day 3). WEEKLY:3:3.
    // Next Wednesday with interval=1 would be 2026-03-11.
    // With interval=3: 2026-03-11 + 14 days = 2026-03-25
    expect(computeNextDueDate("WEEKLY:3:3", "2026-03-04")).toBe("2026-03-25");
  });

  it("MONTHLY:4 advances by 4 months", () => {
    expect(computeNextDueDate("MONTHLY:4", "2026-03-15")).toBe("2026-07-15");
  });

  it("MONTHLY_LAST:2 advances by 2 months to last day", () => {
    // Last day of March = 31. +2 months = last day of May = 31.
    expect(computeNextDueDate("MONTHLY_LAST:2", "2026-03-31")).toBe("2026-05-31");
  });

  it("YEARLY:2 advances by 2 years", () => {
    expect(computeNextDueDate("YEARLY:2", "2026-03-04")).toBe("2028-03-04");
  });
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: New interval tests FAIL — computeNextDueDate still uses hardcoded `1`.

**Step 3: Commit**

```bash
git add src/domain/services/__tests__/recurrence.test.ts
git commit -m "test: add computeNextDueDate tests for custom intervals"
```

---

### Task 4: Implement computeNextDueDate interval support

**Files:**
- Modify: `src/domain/services/recurrence.ts` (computeNextDueDate function, lines 91–139)

**Step 1: Update computeNextDueDate to use interval**

Replace the switch statement (lines 106–136) with:

```typescript
  let next: Date;

  switch (parsed.type) {
    case "DAILY":
      next = addDays(date, parsed.interval);
      break;

    case "WEEKLY": {
      const currentDay = getDay(date); // 0=Sun
      const sorted = parsed.days;
      const laterThisWeek = sorted.find((d) => d > currentDay);
      if (laterThisWeek !== undefined) {
        // Still within same week cycle — no interval skip
        next = addDays(date, laterThisWeek - currentDay);
      } else {
        // Wrap to first day of next cycle — skip (interval - 1) extra weeks
        const daysToNextWeek = 7 - currentDay + sorted[0];
        const extraWeeks = (parsed.interval - 1) * 7;
        next = addDays(date, daysToNextWeek + extraWeeks);
      }
      break;
    }

    case "MONTHLY":
      next = addMonths(date, parsed.interval);
      break;

    case "MONTHLY_LAST":
      next = lastDayOfMonth(addMonths(date, parsed.interval));
      break;

    case "YEARLY":
      next = addYears(date, parsed.interval);
      break;
  }
```

**Step 2: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: ALL tests PASS.

**Step 3: Commit**

```bash
git add src/domain/services/recurrence.ts
git commit -m "feat: add interval support to computeNextDueDate"
```

---

### Task 5: Add computeFirstOccurrence tests for intervals

**Files:**
- Modify: `src/domain/services/__tests__/recurrence.test.ts`

**Step 1: Add tests confirming computeFirstOccurrence ignores interval**

Add inside the existing `describe("computeFirstOccurrence")` block:

```typescript
  it("DAILY:3 still returns today", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 8) });
    expect(computeFirstOccurrence("DAILY:3")).toBe("2026-03-08");
  });

  it("WEEKLY:2 still returns next matching day from today", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 9) }); // Monday = day 1
    expect(computeFirstOccurrence("WEEKLY:2:3,5")).toBe("2026-03-11");
  });

  it("MONTHLY:4 still returns today", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 15) });
    expect(computeFirstOccurrence("MONTHLY:4")).toBe("2026-03-15");
  });

  it("YEARLY:2 still returns today", () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 1) });
    expect(computeFirstOccurrence("YEARLY:2")).toBe("2026-06-01");
  });
```

**Step 2: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/recurrence.test.ts`
Expected: ALL PASS — computeFirstOccurrence doesn't use interval, just parser compatibility.

**Step 3: Commit**

```bash
git add src/domain/services/__tests__/recurrence.test.ts
git commit -m "test: verify computeFirstOccurrence works with interval formats"
```

---

### Task 6: Add i18n keys for custom recurrence UI

**Files:**
- Modify: `src/lib/i18n/dictionaries/cs.ts` (lines 218–233)
- Modify: `src/lib/i18n/dictionaries/en.ts` (lines 218–233)
- Modify: `src/lib/i18n/types.ts` (lines 202–217)

**Step 1: Update TypeScript types**

In `src/lib/i18n/types.ts`, replace the `recurrence` block (lines 202–217) with:

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
    monthlyLast: string;
    everyLastDay: string;
    everyYear: string;
    daysShort: string[];
    removeRecurrence: string;
    custom: string;
    back: string;
    done: string;
    every: string;
    unitDays: string[];
    unitWeeks: string[];
    unitMonths: string[];
    unitYears: string[];
    everyNDays: string;
    everyNWeeks: string;
    everyNMonths: string;
    everyNYears: string;
  };
```

**Step 2: Update Czech dictionary**

In `src/lib/i18n/dictionaries/cs.ts`, replace the `recurrence` block (lines 218–233) with:

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
    monthlyLast: "Poslední den v měsíci",
    everyLastDay: "Poslední den v měsíci",
    everyYear: "Každý rok",
    daysShort: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
    removeRecurrence: "Zrušit opakování",
    custom: "Vlastní…",
    back: "Zpět",
    done: "Hotovo",
    every: "Každých",
    unitDays: ["den", "dny", "dnů"],
    unitWeeks: ["týden", "týdny", "týdnů"],
    unitMonths: ["měsíc", "měsíce", "měsíců"],
    unitYears: ["rok", "roky", "let"],
    everyNDays: "Každé {n} dny",
    everyNWeeks: "Každé {n} týdny",
    everyNMonths: "Každé {n} měsíce",
    everyNYears: "Každé {n} roky",
  },
```

**Step 3: Update English dictionary**

In `src/lib/i18n/dictionaries/en.ts`, replace the `recurrence` block (lines 218–233) with:

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
    monthlyLast: "Last day of month",
    everyLastDay: "Last day of month",
    everyYear: "Every year",
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    removeRecurrence: "Remove recurrence",
    custom: "Custom…",
    back: "Back",
    done: "Done",
    every: "Every",
    unitDays: ["day", "days"],
    unitWeeks: ["week", "weeks"],
    unitMonths: ["month", "months"],
    unitYears: ["year", "years"],
    everyNDays: "Every {n} days",
    everyNWeeks: "Every {n} weeks",
    everyNMonths: "Every {n} months",
    everyNYears: "Every {n} years",
  },
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: PASS — all dictionaries satisfy the updated type.

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat: add i18n keys for custom recurrence intervals"
```

---

### Task 7: Update formatRecurrence for intervals

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx` (lines 632–645, the `formatRecurrence` function)

**Step 1: Replace formatRecurrence with interval-aware version**

Replace the `formatRecurrence` function (lines 632–645) with:

```typescript
  function formatRecurrence(recurrence: string | null): string | null {
    if (!recurrence) return null;
    const parsed = parseRecurrence(recurrence);
    if (!parsed) return null;

    const dayNames = tArray("recurrence.daysShort");

    switch (parsed.type) {
      case "DAILY":
        return parsed.interval === 1
          ? t("recurrence.everyDay")
          : t("recurrence.everyNDays", { n: parsed.interval });

      case "WEEKLY": {
        const daysLabel = parsed.days.length === 7
          ? t("recurrence.everyDay")
          : parsed.days.map((d) => dayNames[d]).join(", ");
        if (parsed.interval === 1) return daysLabel;
        return `${t("recurrence.everyNWeeks", { n: parsed.interval })}: ${daysLabel}`;
      }

      case "MONTHLY":
        return parsed.interval === 1
          ? t("recurrence.everyMonth")
          : t("recurrence.everyNMonths", { n: parsed.interval });

      case "MONTHLY_LAST":
        return parsed.interval === 1
          ? t("recurrence.everyLastDay")
          : `${t("recurrence.everyNMonths", { n: parsed.interval })}, ${t("recurrence.everyLastDay").toLowerCase()}`;

      case "YEARLY":
        return parsed.interval === 1
          ? t("recurrence.everyYear")
          : t("recurrence.everyNYears", { n: parsed.interval });
    }
  }
```

Also add the `parseRecurrence` import at the top of the file. Look for the existing import of `computeFirstOccurrence`:

```typescript
import { computeFirstOccurrence } from "@/domain/services/recurrence";
```

Change it to:

```typescript
import { parseRecurrence, computeFirstOccurrence } from "@/domain/services/recurrence";
```

**Step 2: Update handleToggleWeeklyDay for WEEKLY:N:days format**

The existing `handleToggleWeeklyDay` (lines 658–671) uses `task.recurrence.slice(7)` which won't work for `WEEKLY:2:1,5`. Replace it with:

```typescript
  function handleToggleWeeklyDay(day: number) {
    if (!task) return;
    const parsed = task.recurrence ? parseRecurrence(task.recurrence) : null;
    const current = parsed?.type === "WEEKLY" ? parsed.days : [];
    const interval = parsed?.type === "WEEKLY" ? parsed.interval : 1;
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    if (updated.length === 0) {
      handleSetRecurrence(null);
    } else {
      const prefix = interval > 1 ? `WEEKLY:${interval}:` : "WEEKLY:";
      handleSetRecurrence(`${prefix}${updated.join(",")}`);
    }
  }
```

**Step 3: Run typecheck and dev server**

Run: `yarn typecheck`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: update formatRecurrence and handleToggleWeeklyDay for intervals"
```

---

### Task 8: Add custom editor to TaskRecurrence popover

**Files:**
- Modify: `src/components/tasks/detail/task-recurrence.tsx`

**Step 1: Update props interface**

Add new props to `TaskRecurrenceProps`:

```typescript
interface TaskRecurrenceProps {
  recurrence: string | null;
  onSetRecurrence: (value: string | null) => void;
  onToggleWeeklyDay: (day: number) => void;
  formatRecurrence: (recurrence: string | null) => string | null;
  daysShort: string[];
  addRecurrenceLabel: string;
  dailyLabel: string;
  weeklyLabel: string;
  monthlyLabel: string;
  monthlyLastLabel: string;
  yearlyLabel: string;
  removeRecurrenceLabel: string;
  customLabel: string;
  backLabel: string;
  doneLabel: string;
  everyLabel: string;
  unitLabels: { days: string[]; weeks: string[]; months: string[]; years: string[] };
}
```

**Step 2: Rewrite the component with custom editor view**

Replace the entire component body with:

```typescript
export function TaskRecurrence({
  recurrence,
  onSetRecurrence,
  onToggleWeeklyDay,
  formatRecurrence,
  daysShort,
  addRecurrenceLabel,
  dailyLabel,
  weeklyLabel,
  monthlyLabel,
  monthlyLastLabel,
  yearlyLabel,
  removeRecurrenceLabel,
  customLabel,
  backLabel,
  doneLabel,
  everyLabel,
  unitLabels,
}: TaskRecurrenceProps) {
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [customView, setCustomView] = useState(false);
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"days" | "weeks" | "months" | "years">("months");
  const [customDays, setCustomDays] = useState<number[]>([]);

  function handleSetRecurrence(value: string | null) {
    onSetRecurrence(value);
    if (!value?.startsWith("WEEKLY:")) setRecurrenceOpen(false);
  }

  function openCustomView() {
    setCustomInterval(2);
    setCustomUnit("months");
    setCustomDays([new Date().getDay()]);
    setCustomView(true);
  }

  function handleCustomDone() {
    let value: string;
    switch (customUnit) {
      case "days":
        value = customInterval === 1 ? "DAILY" : `DAILY:${customInterval}`;
        break;
      case "weeks":
        if (customDays.length === 0) return;
        value = customInterval === 1
          ? `WEEKLY:${customDays.join(",")}`
          : `WEEKLY:${customInterval}:${customDays.join(",")}`;
        break;
      case "months":
        value = customInterval === 1 ? "MONTHLY" : `MONTHLY:${customInterval}`;
        break;
      case "years":
        value = customInterval === 1 ? "YEARLY" : `YEARLY:${customInterval}`;
        break;
    }
    onSetRecurrence(value);
    setCustomView(false);
    setRecurrenceOpen(false);
  }

  function toggleCustomDay(day: number) {
    setCustomDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  function unitLabel(unit: string, labels: string[]): string {
    // Czech: 3 forms (1 / 2-4 / 5+). English: 2 forms (1 / 2+).
    if (labels.length === 3) {
      if (customInterval === 1) return labels[0];
      if (customInterval >= 2 && customInterval <= 4) return labels[1];
      return labels[2];
    }
    return customInterval === 1 ? labels[0] : labels[1];
  }

  const recurrenceTypes = [
    { type: "DAILY" as const, label: dailyLabel },
    { type: "WEEKLY" as const, label: weeklyLabel },
    { type: "MONTHLY" as const, label: monthlyLabel },
    { type: "MONTHLY_LAST" as const, label: monthlyLastLabel },
    { type: "YEARLY" as const, label: yearlyLabel },
  ];

  const isWeeklyActive = recurrence?.startsWith("WEEKLY:");

  return (
    <Popover
      open={recurrenceOpen}
      onOpenChange={(open) => {
        setRecurrenceOpen(open);
        if (!open) setCustomView(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-2", recurrence && "text-blue-500")}
        >
          <Repeat className="h-4 w-4" />
          {recurrence ? formatRecurrence(recurrence) : addRecurrenceLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        {customView ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1"
              onClick={() => setCustomView(false)}
            >
              ← {backLabel}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm">{everyLabel}</span>
              <input
                type="number"
                min={1}
                max={999}
                value={customInterval}
                onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="border-input bg-background h-8 w-16 rounded-md border px-2 text-center text-sm"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="border-input bg-background h-8 rounded-md border px-2 text-sm"
              >
                <option value="days">{unitLabel("days", unitLabels.days)}</option>
                <option value="weeks">{unitLabel("weeks", unitLabels.weeks)}</option>
                <option value="months">{unitLabel("months", unitLabels.months)}</option>
                <option value="years">{unitLabel("years", unitLabels.years)}</option>
              </select>
            </div>

            {customUnit === "weeks" && (
              <>
                <Separator />
                <div className="flex gap-0.5">
                  {daysShort.map((dayName, index) => (
                    <Button
                      key={index}
                      variant={customDays.includes(index) ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => toggleCustomDay(index)}
                    >
                      {dayName}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={handleCustomDone}
              disabled={customUnit === "weeks" && customDays.length === 0}
            >
              {doneLabel}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {recurrenceTypes.map(({ type, label }) => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start",
                    recurrence === type && "bg-accent",
                    type === "WEEKLY" && isWeeklyActive && "bg-accent",
                  )}
                  onClick={() => {
                    if (type === "WEEKLY") {
                      const today = new Date().getDay();
                      handleSetRecurrence(`WEEKLY:${today}`);
                    } else {
                      handleSetRecurrence(type);
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            {isWeeklyActive && (
              <>
                <Separator />
                <div className="flex gap-0.5">
                  {daysShort.map((dayName, index) => {
                    const parts = recurrence!.split(":");
                    const daysStr = parts.length === 3 ? parts[2] : parts[1];
                    const isActive = daysStr.split(",").map(Number).includes(index);
                    return (
                      <Button
                        key={index}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => onToggleWeeklyDay(index)}
                      >
                        {dayName}
                      </Button>
                    );
                  })}
                </div>
              </>
            )}

            <Separator />

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={openCustomView}
            >
              {customLabel}
            </Button>

            {recurrence && (
              <>
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive w-full justify-start"
                  onClick={() => handleSetRecurrence(null)}
                >
                  {removeRecurrenceLabel}
                </Button>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: FAIL — `task-detail-panel.tsx` doesn't pass new props yet. That's Task 9.

**Step 4: Commit**

```bash
git add src/components/tasks/detail/task-recurrence.tsx
git commit -m "feat: add custom interval editor to TaskRecurrence popover"
```

---

### Task 9: Wire new props from task-detail-panel to TaskRecurrence

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx` (lines 741–754, the `<TaskRecurrence>` JSX)

**Step 1: Add new props to the TaskRecurrence usage**

Find the `<TaskRecurrence` block (around line 741) and add the new props:

```tsx
          <TaskRecurrence
            recurrence={task.recurrence}
            onSetRecurrence={handleSetRecurrence}
            onToggleWeeklyDay={handleToggleWeeklyDay}
            formatRecurrence={formatRecurrence}
            daysShort={tArray("recurrence.daysShort")}
            addRecurrenceLabel={t("recurrence.addRecurrence")}
            dailyLabel={t("recurrence.daily")}
            weeklyLabel={t("recurrence.weekly")}
            monthlyLabel={t("recurrence.monthly")}
            monthlyLastLabel={t("recurrence.monthlyLast")}
            yearlyLabel={t("recurrence.yearly")}
            removeRecurrenceLabel={t("recurrence.removeRecurrence")}
            customLabel={t("recurrence.custom")}
            backLabel={t("recurrence.back")}
            doneLabel={t("recurrence.done")}
            everyLabel={t("recurrence.every")}
            unitLabels={{
              days: tArray("recurrence.unitDays"),
              weeks: tArray("recurrence.unitWeeks"),
              months: tArray("recurrence.unitMonths"),
              years: tArray("recurrence.unitYears"),
            }}
          />
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: PASS.

**Step 3: Run full test suite**

Run: `yarn test`
Expected: ALL PASS.

**Step 4: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: wire custom recurrence props to TaskRecurrence component"
```

---

### Task 10: Final verification and quality check

**Step 1: Run full check suite**

Run: `yarn check`
Expected: lint + format + typecheck + test — ALL PASS.

**Step 2: Fix any lint/format issues**

If formatting fails, run: `yarn format:write` (or `npx prettier --write <files>`)
If lint fails, fix the reported issues.

**Step 3: Manual smoke test**

Start dev server: `yarn dev`
1. Open a task detail panel
2. Click recurrence button → verify preset options still work (Daily, Weekly, etc.)
3. Click "Vlastní…" → verify custom editor appears
4. Set "Každých 4 měsíců" → verify it saves and displays correctly
5. Set "Každé 2 týdny" + select Mon/Fri → verify day picker works
6. Remove recurrence → verify it clears

**Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: lint and format issues for custom recurrence"
```

**Step 5: Squash or keep commits, push to main**

```bash
git push origin main
```
