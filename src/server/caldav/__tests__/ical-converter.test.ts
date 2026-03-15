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
    locationRadius: null,
    title: "Test Task",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    dueDateEnd: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    blockedByTaskId: null,
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
    const task = makeTask({
      dueDate: "2026-03-15",
      recurrence: "WEEKLY:1,3,5",
    });
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
      dueDateEnd: null,
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
    expect(data?.dueDateEnd).toBe("2026-03-23"); // -1 day: exclusive → inclusive
  });
});
