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

  it("deduplicates WEEKLY days", () => {
    expect(parseRecurrence("WEEKLY:1,1,3")).toEqual({
      type: "WEEKLY",
      days: [1, 3],
    });
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
});
