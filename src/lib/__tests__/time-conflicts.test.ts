import { describe, it, expect } from "vitest";
import { detectTimeConflicts } from "../time-conflicts";

function makeTask(
  overrides: Partial<{
    id: string;
    dueDate: string | null;
    dueDateEnd: string | null;
    isCompleted: boolean;
    locationId: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "t-1",
    dueDate: overrides.dueDate ?? null,
    dueDateEnd: overrides.dueDateEnd ?? null,
    isCompleted: overrides.isCompleted ?? false,
    locationId: overrides.locationId ?? null,
  };
}

describe("detectTimeConflicts", () => {
  it("returns empty set for fewer than 2 eligible tasks", () => {
    const result = detectTimeConflicts([makeTask({ dueDate: "2025-06-15", locationId: "loc-1" })]);
    expect(result.size).toBe(0);
  });

  it("detects conflict between two time-based tasks at different locations", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15T10:30:00", locationId: "loc-2" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("no conflict when overlapping tasks are at the same location", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15T10:30:00", locationId: "loc-1" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("no conflict when overlapping tasks have no location", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00" }),
      makeTask({ id: "b", dueDate: "2025-06-15T10:30:00" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("no conflict when only one task has a location", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15T10:30:00" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("no conflict between non-overlapping tasks at different locations", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15T10:00:00", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15T11:30:00", locationId: "loc-2" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("detects conflict between date-only tasks on the same day at different locations", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15", locationId: "loc-2" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("no conflict between date-only tasks on different days", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-16", locationId: "loc-2" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("detects conflict between overlapping date-range tasks at different locations", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", dueDateEnd: "2025-06-17", locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-16", dueDateEnd: "2025-06-18", locationId: "loc-2" }),
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("skips completed tasks", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: "2025-06-15", isCompleted: true, locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15", locationId: "loc-2" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("skips tasks without dueDate", () => {
    const result = detectTimeConflicts([
      makeTask({ id: "a", dueDate: null, locationId: "loc-1" }),
      makeTask({ id: "b", dueDate: "2025-06-15", locationId: "loc-2" }),
    ]);
    expect(result.size).toBe(0);
  });
});
