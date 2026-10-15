import { describe, it, expect } from "vitest";
import {
  rruleToRecurrence,
  recurrenceToRrule,
  isImportableEvent,
  eventToTaskFields,
} from "../google-event-mapping";
import type { GoogleCalendarEventData } from "../../ports/google-calendar-client";

describe("rruleToRecurrence", () => {
  it("převede denní, měsíční a roční pravidla i s intervalem", () => {
    expect(rruleToRecurrence(["RRULE:FREQ=DAILY"], "2026-10-15")).toBe("DAILY");
    expect(rruleToRecurrence(["RRULE:FREQ=DAILY;INTERVAL=3"], "2026-10-15")).toBe("DAILY:3");
    expect(rruleToRecurrence(["RRULE:FREQ=MONTHLY"], "2026-10-15")).toBe("MONTHLY");
    expect(rruleToRecurrence(["RRULE:FREQ=YEARLY"], "2026-10-15")).toBe("YEARLY");
    expect(rruleToRecurrence(["RRULE:FREQ=YEARLY;INTERVAL=2"], "2026-10-15")).toBe("YEARLY:2");
  });

  it("týdenní pravidlo převede i se dny v týdnu", () => {
    expect(rruleToRecurrence(["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"], "2026-10-12")).toBe(
      "WEEKLY:1,3,5",
    );
    expect(rruleToRecurrence(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"], "2026-10-13")).toBe(
      "WEEKLY:2:2",
    );
  });

  it("týdenní pravidlo bez dnů opakuje v den začátku", () => {
    // 2026-10-15 is a Thursday
    expect(rruleToRecurrence(["RRULE:FREQ=WEEKLY"], "2026-10-15")).toBe("WEEKLY:4");
  });

  it("poslední den v měsíci", () => {
    expect(rruleToRecurrence(["RRULE:FREQ=MONTHLY;BYMONTHDAY=-1"], "2026-10-31")).toBe(
      "MONTHLY_LAST",
    );
  });

  it("nepodporovaná pravidla vrátí null místo špatného opakování", () => {
    expect(rruleToRecurrence(["RRULE:FREQ=MONTHLY;BYDAY=2TU"], "2026-10-13")).toBeNull();
    expect(rruleToRecurrence(["RRULE:FREQ=HOURLY"], "2026-10-13")).toBeNull();
    expect(rruleToRecurrence(["EXDATE:20261020"], "2026-10-13")).toBeNull();
    expect(rruleToRecurrence(undefined, "2026-10-13")).toBeNull();
  });
});

describe("recurrenceToRrule", () => {
  it("převede opakování aplikace na RRULE", () => {
    expect(recurrenceToRrule("DAILY")).toEqual(["RRULE:FREQ=DAILY"]);
    expect(recurrenceToRrule("DAILY:2")).toEqual(["RRULE:FREQ=DAILY;INTERVAL=2"]);
    expect(recurrenceToRrule("WEEKLY:1,3")).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]);
    expect(recurrenceToRrule("WEEKLY:2:0")).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU"]);
    expect(recurrenceToRrule("MONTHLY:4")).toEqual(["RRULE:FREQ=MONTHLY;INTERVAL=4"]);
    expect(recurrenceToRrule("MONTHLY_LAST")).toEqual(["RRULE:FREQ=MONTHLY;BYMONTHDAY=-1"]);
    expect(recurrenceToRrule("YEARLY")).toEqual(["RRULE:FREQ=YEARLY"]);
    expect(recurrenceToRrule("nonsense")).toBeNull();
  });

  it("cesta tam a zpět zachová opakování", () => {
    for (const recurrence of [
      "DAILY:2",
      "WEEKLY:2:4",
      "WEEKLY:1,3,5",
      "MONTHLY",
      "MONTHLY_LAST:2",
      "YEARLY",
    ]) {
      expect(rruleToRecurrence(recurrenceToRrule(recurrence)!, "2026-10-15")).toBe(recurrence);
    }
  });
});

describe("isImportableEvent", () => {
  const base: GoogleCalendarEventData = {
    id: "e1",
    summary: "Schůzka",
    start: { dateTime: "2026-10-15T10:00:00+02:00" },
    end: { dateTime: "2026-10-15T11:00:00+02:00" },
  };

  it("vlastní událost importuje", () => {
    expect(isImportableEvent({ ...base, eventType: "default" })).toBe(true);
    expect(isImportableEvent(base)).toBe(true);
  });

  it("narozeniny, události z Gmailu a nepřítomnost neimportuje", () => {
    expect(isImportableEvent({ ...base, eventType: "birthday" })).toBe(false);
    expect(isImportableEvent({ ...base, eventType: "fromGmail" })).toBe(false);
    expect(isImportableEvent({ ...base, eventType: "outOfOffice" })).toBe(false);
  });

  it("státní svátky a jiné veřejné kalendáře neimportuje", () => {
    expect(
      isImportableEvent({
        ...base,
        organizer: { email: "cs.czech#holiday@group.v.calendar.google.com" },
      }),
    ).toBe(false);
  });

  it("odmítnuté pozvání neimportuje", () => {
    expect(
      isImportableEvent({
        ...base,
        attendees: [{ email: "me@x.cz", self: true, responseStatus: "declined" }],
      }),
    ).toBe(false);
  });

  it("upravený výskyt opakované série neimportuje (série je jeden úkol)", () => {
    expect(isImportableEvent({ ...base, recurringEventId: "series-1" })).toBe(false);
  });
});

describe("eventToTaskFields", () => {
  const today = "2026-10-15";
  const tz = "Europe/Prague";

  it("převede čas z Google na místní čas aplikace", () => {
    const fields = eventToTaskFields(
      {
        summary: "Očkování",
        start: { dateTime: "2026-10-15T08:40:00Z" },
        end: { dateTime: "2026-10-15T09:40:00Z" },
      },
      tz,
      today,
    );
    expect(fields).toEqual({
      title: "Očkování",
      notes: null,
      dueDate: "2026-10-15T10:40",
      dueDateEnd: null, // the default one-hour length isn't an explicit end
      recurrence: null,
    });
  });

  it("delší událost si konec ponechá", () => {
    const fields = eventToTaskFields(
      {
        summary: "Workshop",
        start: { dateTime: "2026-10-20T09:00:00+02:00" },
        end: { dateTime: "2026-10-20T12:30:00+02:00" },
      },
      tz,
      today,
    );
    expect(fields.dueDate).toBe("2026-10-20T09:00");
    expect(fields.dueDateEnd).toBe("2026-10-20T12:30");
  });

  it("celodenní událost na jeden den nemá konec, vícedenní ano", () => {
    expect(
      eventToTaskFields(
        { summary: "A", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } },
        tz,
        today,
      ).dueDateEnd,
    ).toBeNull();
    expect(
      eventToTaskFields(
        { summary: "B", start: { date: "2026-10-20" }, end: { date: "2026-10-23" } },
        tz,
        today,
      ).dueDateEnd,
    ).toBe("2026-10-22");
  });

  it("opakovanou sérii z minulosti posune na nejbližší výskyt", () => {
    const fields = eventToTaskFields(
      {
        summary: "Narozeniny",
        start: { date: "2024-01-08" },
        end: { date: "2024-01-09" },
        recurrence: ["RRULE:FREQ=YEARLY"],
      },
      tz,
      today,
    );
    expect(fields.recurrence).toBe("YEARLY");
    expect(fields.dueDate).toBe("2027-01-08");
    expect(fields.dueDateEnd).toBeNull();
  });

  it("u posunuté série posune i konec", () => {
    const fields = eventToTaskFields(
      {
        summary: "Trénink",
        start: { dateTime: "2026-10-05T18:00:00+02:00" }, // Monday
        end: { dateTime: "2026-10-05T19:30:00+02:00" },
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
      },
      tz,
      today,
    );
    expect(fields.dueDate).toBe("2026-10-19T18:00");
    expect(fields.dueDateEnd).toBe("2026-10-19T19:30");
  });

  it("výskyt série neposune před zadané minimum (aktuální výskyt úkolu)", () => {
    const fields = eventToTaskFields(
      {
        summary: "Trénink",
        start: { dateTime: "2026-10-05T18:00:00+02:00" },
        end: { dateTime: "2026-10-05T19:00:00+02:00" },
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
      },
      tz,
      "2026-10-12", // the task's current (overdue) occurrence
    );
    expect(fields.dueDate).toBe("2026-10-12T18:00");
  });
});
