import { describe, it, expect } from "vitest";
import {
  isValidTimeZone,
  toLocalDateTime,
  isDueForNotification,
  shouldSendDigest,
  selectDigestTasks,
  buildDueMessage,
  buildDigestMessage,
  normalizeLocale,
  resolveTimeZone,
} from "../task-notifications";

describe("isValidTimeZone", () => {
  it("přijme platné IANA pásmo", () => {
    expect(isValidTimeZone("Europe/Prague")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
  });

  it("odmítne neplatné pásmo", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("resolveTimeZone", () => {
  it("vrátí uložené platné pásmo", () => {
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
  });

  it("bez pásma nebo s neplatným použije Europe/Prague", () => {
    expect(resolveTimeZone(null)).toBe("Europe/Prague");
    expect(resolveTimeZone("nonsense")).toBe("Europe/Prague");
  });
});

describe("toLocalDateTime", () => {
  it("převede UTC na letní čas v Praze (UTC+2)", () => {
    const now = new Date("2026-07-01T12:30:00Z");
    expect(toLocalDateTime(now, "Europe/Prague")).toEqual({
      date: "2026-07-01",
      dateTime: "2026-07-01T14:30",
      hour: 14,
    });
  });

  it("převede UTC na zimní čas v Praze (UTC+1)", () => {
    const now = new Date("2026-12-01T12:30:00Z");
    expect(toLocalDateTime(now, "Europe/Prague").dateTime).toBe("2026-12-01T13:30");
  });

  it("posune datum přes půlnoc", () => {
    const now = new Date("2026-07-01T23:30:00Z");
    expect(toLocalDateTime(now, "Europe/Prague")).toEqual({
      date: "2026-07-02",
      dateTime: "2026-07-02T01:30",
      hour: 1,
    });
  });

  it("vrátí půlnoc jako hodinu 0, ne 24", () => {
    const now = new Date("2026-07-01T22:00:00Z");
    expect(toLocalDateTime(now, "Europe/Prague").hour).toBe(0);
  });
});

describe("isDueForNotification", () => {
  const nowLocal = { date: "2026-07-01", dateTime: "2026-07-01T14:30", hour: 14 };

  it("úkol s časem, který právě nastal, je na řadě", () => {
    expect(isDueForNotification("2026-07-01T14:30", nowLocal)).toBe(true);
    expect(isDueForNotification("2026-07-01T14:00", nowLocal)).toBe(true);
  });

  it("budoucí úkol ještě není na řadě", () => {
    expect(isDueForNotification("2026-07-01T14:31", nowLocal)).toBe(false);
  });

  it("úkol starší než okno tolerance se už neoznamuje", () => {
    expect(isDueForNotification("2026-07-01T13:30", nowLocal)).toBe(false);
    expect(isDueForNotification("2026-06-30T14:30", nowLocal)).toBe(false);
  });

  it("okno tolerance přes půlnoc", () => {
    const afterMidnight = { date: "2026-07-02", dateTime: "2026-07-02T00:10", hour: 0 };
    expect(isDueForNotification("2026-07-01T23:50", afterMidnight)).toBe(true);
  });

  it("úkol jen s datem se neoznamuje", () => {
    expect(isDueForNotification("2026-07-01", nowLocal)).toBe(false);
  });
});

describe("shouldSendDigest", () => {
  it("pošle shrnutí ráno, pokud dnes ještě neodešlo", () => {
    expect(
      shouldSendDigest({ date: "2026-07-01", dateTime: "2026-07-01T08:00", hour: 8 }, null),
    ).toBe(true);
    expect(
      shouldSendDigest({ date: "2026-07-01", dateTime: "2026-07-01T09:15", hour: 9 }, "2026-06-30"),
    ).toBe(true);
  });

  it("nepošle shrnutí dvakrát za den", () => {
    expect(
      shouldSendDigest({ date: "2026-07-01", dateTime: "2026-07-01T09:15", hour: 9 }, "2026-07-01"),
    ).toBe(false);
  });

  it("nepošle shrnutí před 8:00 ani odpoledne", () => {
    expect(
      shouldSendDigest({ date: "2026-07-01", dateTime: "2026-07-01T07:59", hour: 7 }, null),
    ).toBe(false);
    expect(
      shouldSendDigest({ date: "2026-07-01", dateTime: "2026-07-01T12:00", hour: 12 }, null),
    ).toBe(false);
  });
});

describe("selectDigestTasks", () => {
  const base = {
    reminderAt: null,
    isCompleted: false,
    recurrence: null,
    blockedByTaskId: null,
    blockedByTaskIsCompleted: null,
  };

  it("vybere úkoly s termínem dnes – jen s datem i s časem", () => {
    const tasks = [
      { ...base, id: "date-today", title: "A", dueDate: "2026-07-01", reminderAt: "2026-07-01" },
      {
        ...base,
        id: "timed-today",
        title: "B",
        dueDate: "2026-07-01T15:00",
        reminderAt: "2026-06-30",
      },
    ];
    expect(selectDigestTasks(tasks, "2026-07-01").map((t) => t.id)).toEqual([
      "date-today",
      "timed-today",
    ]);
  });

  it("vybere úkoly s ručně nastavenou připomínkou na dnes", () => {
    const tasks = [
      {
        ...base,
        id: "reminder-today",
        title: "A",
        dueDate: "2026-07-05",
        reminderAt: "2026-07-01",
      },
      { ...base, id: "reminder-no-due", title: "B", dueDate: null, reminderAt: "2026-07-01" },
    ];
    expect(selectDigestTasks(tasks, "2026-07-01").map((t) => t.id)).toEqual([
      "reminder-today",
      "reminder-no-due",
    ]);
  });

  it("nezahrne zítřejší úkol s časem, i když je vidět už dnes", () => {
    // Automatic reminder of a timed task = the day before → visible today, but due tomorrow
    const tasks = [
      {
        ...base,
        id: "timed-tomorrow",
        title: "A",
        dueDate: "2026-07-02T10:00",
        reminderAt: "2026-07-01",
      },
    ];
    expect(selectDigestTasks(tasks, "2026-07-01")).toEqual([]);
  });

  it("vynechá dokončené, blokované, bez data a s jiným termínem", () => {
    const tasks = [
      { ...base, id: "done", title: "A", dueDate: "2026-07-01", isCompleted: true },
      {
        ...base,
        id: "blocked",
        title: "B",
        dueDate: "2026-07-01",
        blockedByTaskId: "x",
        blockedByTaskIsCompleted: false,
      },
      { ...base, id: "no-date", title: "C", dueDate: null },
      { ...base, id: "yesterday", title: "D", dueDate: "2026-06-30" },
      { ...base, id: "next-week", title: "E", dueDate: "2026-07-08" },
    ];
    expect(selectDigestTasks(tasks, "2026-07-01")).toEqual([]);
  });
});

describe("normalizeLocale", () => {
  it("rozpozná podporované jazyky, jinak čeština", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("cs")).toBe("cs");
    expect(normalizeLocale("de")).toBe("de");
    expect(normalizeLocale(null)).toBe("cs");
    expect(normalizeLocale("pl")).toBe("cs");
  });
});

describe("buildDueMessage", () => {
  it("česky uvede čas termínu", () => {
    expect(buildDueMessage("Zavolat mámě", "2026-07-01T14:30", "cs")).toEqual({
      title: "Zavolat mámě",
      body: "Termín: dnes 14:30",
    });
  });

  it("anglicky uvede čas termínu", () => {
    expect(buildDueMessage("Call mom", "2026-07-01T14:30", "en")).toEqual({
      title: "Call mom",
      body: "Due today at 14:30",
    });
  });
});

describe("buildDigestMessage", () => {
  it("vypíše až tři úkoly", () => {
    expect(buildDigestMessage(["A", "B"], "cs")).toEqual({
      title: "Úkoly na dnes (2)",
      body: "A, B",
    });
  });

  it("zbytek shrne počtem", () => {
    expect(buildDigestMessage(["A", "B", "C", "D", "E"], "cs").body).toBe("A, B, C a další 2");
    expect(buildDigestMessage(["A", "B", "C", "D"], "en")).toEqual({
      title: "Today's tasks (4)",
      body: "A, B, C and 1 more",
    });
  });
});

describe("zprávy v dalších jazycích", () => {
  it("termín i ranní přehled jsou přeložené", () => {
    expect(buildDueMessage("Arzt anrufen", "2026-07-01T14:30", "de").body).toBe(
      "Heute fällig um 14:30",
    );
    expect(buildDigestMessage(["A", "B", "C", "D"], "fr")).toEqual({
      title: "Tâches du jour (4)",
      body: "A, B, C et 1 de plus",
    });
    expect(buildDigestMessage(["A"], "es").title).toBe("Tareas de hoy (1)");
    expect(buildDueMessage("Chiamare", "2026-07-01T09:00", "it").body).toBe(
      "Scadenza: oggi alle 09:00",
    );
  });
});
