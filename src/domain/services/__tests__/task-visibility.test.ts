import { describe, it, expect } from "vitest";
import { getVisibleDate, isFutureTask, computeDefaultReminder } from "../task-visibility";

describe("getVisibleDate", () => {
  it("vrátí null pro úkol bez dueDate a bez reminderAt", () => {
    expect(getVisibleDate({ dueDate: null, reminderAt: null, isCompleted: false })).toBeNull();
  });

  it("vrátí dueDate pro date-only dueDate", () => {
    expect(getVisibleDate({ dueDate: "2026-03-10", reminderAt: null, isCompleted: false })).toBe(
      "2026-03-10",
    );
  });

  it("vrátí den předem pro dueDate s časem", () => {
    expect(
      getVisibleDate({ dueDate: "2026-03-10T14:00", reminderAt: null, isCompleted: false }),
    ).toBe("2026-03-09");
  });

  it("reminderAt přebíjí dueDate pravidla", () => {
    expect(
      getVisibleDate({ dueDate: "2026-03-10", reminderAt: "2026-03-05", isCompleted: false }),
    ).toBe("2026-03-05");
  });

  it("reminderAt přebíjí i dueDate s časem", () => {
    expect(
      getVisibleDate({ dueDate: "2026-03-10T14:00", reminderAt: "2026-03-07", isCompleted: false }),
    ).toBe("2026-03-07");
  });

  it("vrátí den předem přes hranici roku pro dueDate s časem", () => {
    expect(
      getVisibleDate({ dueDate: "2026-01-01T08:00", reminderAt: null, isCompleted: false }),
    ).toBe("2025-12-31");
  });

  it("vrátí reminderAt i bez dueDate", () => {
    expect(getVisibleDate({ dueDate: null, reminderAt: "2026-06-15", isCompleted: false })).toBe(
      "2026-06-15",
    );
  });
});

describe("computeDefaultReminder", () => {
  it("vrátí null pro null dueDate", () => {
    expect(computeDefaultReminder(null)).toBeNull();
  });

  it("vrátí stejné datum pro date-only dueDate", () => {
    expect(computeDefaultReminder("2026-03-07")).toBe("2026-03-07");
  });

  it("vrátí den předem pro dueDate s časem", () => {
    expect(computeDefaultReminder("2026-03-07T14:00")).toBe("2026-03-06");
  });

  it("vrátí den předem přes hranici měsíce", () => {
    expect(computeDefaultReminder("2026-04-01T10:00")).toBe("2026-03-31");
  });

  it("vrátí den předem přes hranici roku (1. leden → 31. prosinec předchozího roku)", () => {
    expect(computeDefaultReminder("2026-01-01T09:00")).toBe("2025-12-31");
  });

  it("vrátí den předem v přestupném roce (1. březen → 29. únor)", () => {
    expect(computeDefaultReminder("2028-03-01T10:00")).toBe("2028-02-29");
  });

  it("vrátí den předem v nepřestupném roce (1. březen → 28. únor)", () => {
    expect(computeDefaultReminder("2026-03-01T10:00")).toBe("2026-02-28");
  });
});

describe("isFutureTask", () => {
  const today = "2026-03-04";

  it("vrátí false pro úkol bez dueDate a bez reminderAt", () => {
    expect(isFutureTask({ dueDate: null, reminderAt: null, isCompleted: false }, today)).toBe(
      false,
    );
  });

  it("vrátí false pro dokončený úkol", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-10", reminderAt: null, isCompleted: true }, today),
    ).toBe(false);
  });

  it("vrátí true pro date-only dueDate v budoucnosti", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-05", reminderAt: null, isCompleted: false }, today),
    ).toBe(true);
  });

  it("vrátí false pro date-only dueDate dnes", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-04", reminderAt: null, isCompleted: false }, today),
    ).toBe(false);
  });

  it("vrátí false pro date-only dueDate v minulosti", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-02", reminderAt: null, isCompleted: false }, today),
    ).toBe(false);
  });

  it("dueDate s časem zítra → viditelný dnes (den předem)", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-05T14:00", reminderAt: null, isCompleted: false }, today),
    ).toBe(false);
  });

  it("dueDate s časem pozítří → budoucí (den předem je zítřek)", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-06T14:00", reminderAt: null, isCompleted: false }, today),
    ).toBe(true);
  });

  it("reminderAt dnes → viditelný", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-10", reminderAt: "2026-03-04", isCompleted: false }, today),
    ).toBe(false);
  });

  it("reminderAt v budoucnosti → skrytý", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-10", reminderAt: "2026-03-06", isCompleted: false }, today),
    ).toBe(true);
  });

  it("reminderAt v minulosti → viditelný", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-10", reminderAt: "2026-03-01", isCompleted: false }, today),
    ).toBe(false);
  });

  it("dokončený úkol s reminderAt v budoucnosti → viditelný (completed overrides)", () => {
    expect(
      isFutureTask({ dueDate: "2026-03-10", reminderAt: "2026-03-10", isCompleted: true }, today),
    ).toBe(false);
  });

  it("dueDate s časem přes hranici roku → viditelný den předem", () => {
    const dec31 = "2025-12-31";
    expect(
      isFutureTask({ dueDate: "2026-01-01T10:00", reminderAt: null, isCompleted: false }, dec31),
    ).toBe(false);
  });

  it("recurring task bez dueDate → budoucí (next occurrence)", () => {
    // WEEKLY:1 (Monday), today is Wednesday → next Monday is future
    const wednesday = "2026-03-11"; // a Wednesday
    expect(
      isFutureTask(
        { dueDate: null, reminderAt: null, isCompleted: false, recurrence: "WEEKLY:1" },
        wednesday,
      ),
    ).toBe(true);
  });

  it("recurring task s prošlým dueDate → budoucí", () => {
    const wednesday = "2026-03-11"; // a Wednesday
    expect(
      isFutureTask(
        {
          dueDate: "2025-01-01",
          reminderAt: null,
          isCompleted: false,
          recurrence: "WEEKLY:1",
        },
        wednesday,
      ),
    ).toBe(true); // past dueDate → compute next occurrence which is in the future
  });

  it("recurring DAILY task bez dueDate → viditelný dnes", () => {
    expect(
      isFutureTask(
        { dueDate: null, reminderAt: null, isCompleted: false, recurrence: "DAILY" },
        today,
      ),
    ).toBe(false); // daily = today, so not future
  });
});

describe("isFutureTask — dependency blocking", () => {
  it("returns true when task is blocked by incomplete task", () => {
    expect(
      isFutureTask({
        dueDate: null,
        reminderAt: null,
        isCompleted: false,
        blockedByTaskId: "blocker-1",
        blockedByTaskIsCompleted: false,
      }),
    ).toBe(true);
  });

  it("returns false when blocking task is completed", () => {
    expect(
      isFutureTask({
        dueDate: null,
        reminderAt: null,
        isCompleted: false,
        blockedByTaskId: "blocker-1",
        blockedByTaskIsCompleted: true,
      }),
    ).toBe(false);
  });

  it("returns false when no dependency", () => {
    expect(
      isFutureTask({
        dueDate: null,
        reminderAt: null,
        isCompleted: false,
        blockedByTaskId: null,
      }),
    ).toBe(false);
  });
});
