import { describe, it, expect, vi, afterEach } from "vitest";
import { parseRecurrence, computeNextDueDate, computeFirstOccurrence, formatRecurrenceLabel } from "../recurrence";

describe("parseRecurrence", () => {
  it("parses DAILY", () => {
    expect(parseRecurrence("DAILY")).toEqual({ type: "DAILY", interval: 1 });
  });

  it("parses WEEKLY with days", () => {
    expect(parseRecurrence("WEEKLY:1,3,5")).toEqual({
      type: "WEEKLY",
      interval: 1,
      days: [1, 3, 5],
    });
  });

  it("parses MONTHLY", () => {
    expect(parseRecurrence("MONTHLY")).toEqual({ type: "MONTHLY", interval: 1 });
  });

  it("parses YEARLY", () => {
    expect(parseRecurrence("YEARLY")).toEqual({ type: "YEARLY", interval: 1 });
  });

  it("deduplicates WEEKLY days", () => {
    expect(parseRecurrence("WEEKLY:1,1,3")).toEqual({
      type: "WEEKLY",
      interval: 1,
      days: [1, 3],
    });
  });

  it("returns null for invalid input", () => {
    expect(parseRecurrence("INVALID")).toBeNull();
    expect(parseRecurrence("")).toBeNull();
    expect(parseRecurrence("WEEKLY:")).toBeNull();
    expect(parseRecurrence("WEEKLY:8")).toBeNull();
  });

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

  it("WEEKLY: preserves time component", () => {
    expect(computeNextDueDate("WEEKLY:1,5", "2026-03-04T14:00")).toBe("2026-03-06T14:00");
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
    expect(computeNextDueDate("MONTHLY_LAST:2", "2026-03-31")).toBe("2026-05-31");
  });

  it("YEARLY:2 advances by 2 years", () => {
    expect(computeNextDueDate("YEARLY:2", "2026-03-04")).toBe("2028-03-04");
  });
});

describe("computeFirstOccurrence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("DAILY: returns today", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 8) }); // 2026-03-08
    expect(computeFirstOccurrence("DAILY")).toBe("2026-03-08");
  });

  it("WEEKLY: returns today if today matches a selected day", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 8) }); // Sunday = day 0
    expect(computeFirstOccurrence("WEEKLY:0")).toBe("2026-03-08");
  });

  it("WEEKLY: returns next matching day this week", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 9) }); // Monday = day 1
    // Wednesday is day 3, 2 days ahead
    expect(computeFirstOccurrence("WEEKLY:3,5")).toBe("2026-03-11");
  });

  it("WEEKLY: wraps to next week if no remaining days", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 13) }); // Friday = day 5
    // Only Monday (day 1) selected, next Monday is 2026-03-16
    expect(computeFirstOccurrence("WEEKLY:1")).toBe("2026-03-16");
  });

  it("MONTHLY: returns today", () => {
    vi.useFakeTimers({ now: new Date(2026, 2, 15) });
    expect(computeFirstOccurrence("MONTHLY")).toBe("2026-03-15");
  });

  it("MONTHLY_LAST: returns last day of current month", () => {
    vi.useFakeTimers({ now: new Date(2026, 1, 15) }); // Feb 15
    expect(computeFirstOccurrence("MONTHLY_LAST")).toBe("2026-02-28");
  });

  it("MONTHLY_LAST: returns today if today is the last day", () => {
    vi.useFakeTimers({ now: new Date(2026, 1, 28) }); // Feb 28 (last day)
    expect(computeFirstOccurrence("MONTHLY_LAST")).toBe("2026-02-28");
  });

  it("YEARLY: returns today", () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 1) });
    expect(computeFirstOccurrence("YEARLY")).toBe("2026-06-01");
  });

  it("returns null for invalid recurrence", () => {
    expect(computeFirstOccurrence("INVALID")).toBeNull();
  });

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
});

describe("formatRecurrenceLabel", () => {
  const labels = {
    everyDay: "Every day",
    everyNDays: (n: number) => `Every ${n} days`,
    everyNWeeks: (n: number) => `Every ${n} weeks`,
    everyMonth: "Every month",
    everyNMonths: (n: number) => `Every ${n} months`,
    everyLastDay: "Last day of month",
    everyYear: "Every year",
    everyNYears: (n: number) => `Every ${n} years`,
    daysShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  };

  it("returns null for null recurrence", () => {
    expect(formatRecurrenceLabel(null, labels)).toBeNull();
  });

  it("returns null for invalid recurrence", () => {
    expect(formatRecurrenceLabel("INVALID", labels)).toBeNull();
  });

  it("formats DAILY", () => {
    expect(formatRecurrenceLabel("DAILY", labels)).toBe("Every day");
  });

  it("formats DAILY:3", () => {
    expect(formatRecurrenceLabel("DAILY:3", labels)).toBe("Every 3 days");
  });

  it("formats WEEKLY with single day", () => {
    expect(formatRecurrenceLabel("WEEKLY:1", labels)).toBe("Mo");
  });

  it("formats WEEKLY with multiple days", () => {
    expect(formatRecurrenceLabel("WEEKLY:1,3,5", labels)).toBe("Mo, We, Fr");
  });

  it("formats WEEKLY with all 7 days as every day", () => {
    expect(formatRecurrenceLabel("WEEKLY:0,1,2,3,4,5,6", labels)).toBe("Every day");
  });

  it("formats WEEKLY:2 with interval", () => {
    expect(formatRecurrenceLabel("WEEKLY:2:1,5", labels)).toBe("Every 2 weeks: Mo, Fr");
  });

  it("formats MONTHLY", () => {
    expect(formatRecurrenceLabel("MONTHLY", labels)).toBe("Every month");
  });

  it("formats MONTHLY:4", () => {
    expect(formatRecurrenceLabel("MONTHLY:4", labels)).toBe("Every 4 months");
  });

  it("formats MONTHLY_LAST", () => {
    expect(formatRecurrenceLabel("MONTHLY_LAST", labels)).toBe("Last day of month");
  });

  it("formats MONTHLY_LAST:2", () => {
    expect(formatRecurrenceLabel("MONTHLY_LAST:2", labels)).toBe("Every 2 months, last day of month");
  });

  it("formats YEARLY", () => {
    expect(formatRecurrenceLabel("YEARLY", labels)).toBe("Every year");
  });

  it("formats YEARLY:2", () => {
    expect(formatRecurrenceLabel("YEARLY:2", labels)).toBe("Every 2 years");
  });
});
