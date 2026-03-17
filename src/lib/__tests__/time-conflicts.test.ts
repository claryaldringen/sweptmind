import { describe, it, expect } from "vitest";
import { detectTimeConflicts } from "../time-conflicts";

function makeTask(overrides: Partial<{ id: string; dueDate: string | null; dueDateEnd: string | null; isCompleted: boolean }> = {}) {
  return {
    id: overrides.id ?? "t-1",
    dueDate: overrides.dueDate ?? null,
    dueDateEnd: overrides.dueDateEnd ?? null,
    isCompleted: overrides.isCompleted ?? false,
  };
}

describe("detectTimeConflicts", () => {
  it("returns empty set for fewer than 2 eligible tasks", () => {
    const result = detectTimeConflicts([makeTask({ dueDate: "2025-06-15" })]);
    expect(result.size).toBe(0);
  });

  it("detects conflict between two time-based tasks overlapping", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00" }),
      makeTask({ id: "b", dueDate: "2025-06-15T10:30:00" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("no conflict between non-overlapping time-based tasks", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00" }),
      makeTask({ id: "b", dueDate: "2025-06-15T11:30:00" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("detects conflict between two date-only tasks on the same day", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15" }),
      makeTask({ id: "b", dueDate: "2025-06-15" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("no conflict between date-only tasks on different days", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15" }),
      makeTask({ id: "b", dueDate: "2025-06-16" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("detects conflict between overlapping date-range tasks", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", dueDateEnd: "2025-06-17" }),
      makeTask({ id: "b", dueDate: "2025-06-16", dueDateEnd: "2025-06-18" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("detects conflict between date-range and date-only on overlapping day", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", dueDateEnd: "2025-06-17" }),
      makeTask({ id: "b", dueDate: "2025-06-16" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("skips completed tasks", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", isCompleted: true }),
      makeTask({ id: "b", dueDate: "2025-06-15" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("skips tasks without dueDate", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: null }),
      makeTask({ id: "b", dueDate: "2025-06-15" }),
    ]);
    expect(result.size).toBe(0);
  });
});
