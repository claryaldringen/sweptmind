/**
 * Mapping between Google Calendar events and SweptMind tasks.
 *
 * Task dates are naive local strings in the user's time zone ("YYYY-MM-DD" or
 * "YYYY-MM-DDTHH:mm"); Google times are RFC3339 with an offset.
 */

import type { GoogleCalendarEventData } from "../ports/google-calendar-client";
import { computeNextDueDate, parseRecurrence } from "./recurrence";
import { toLocalDateTime } from "./task-notifications";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DEFAULT_EVENT_MINUTES = 60;
const MAX_RECURRENCE_STEPS = 5000;

function parseRrule(rrule: string): Map<string, string> {
  return new Map(
    rrule
      .slice("RRULE:".length)
      .split(";")
      .map((part) => part.split("=") as [string, string]),
  );
}

/**
 * Google RRULE → SweptMind recurrence. Patterns SweptMind can't express (e.g. "second
 * Tuesday of the month") return null rather than a recurrence on the wrong days.
 */
export function rruleToRecurrence(
  recurrence: string[] | undefined,
  startDate: string,
): string | null {
  const rrule = recurrence?.find((r) => r.startsWith("RRULE:"));
  if (!rrule) return null;

  const rule = parseRrule(rrule);
  const interval = Number(rule.get("INTERVAL") ?? "1");
  if (!Number.isInteger(interval) || interval < 1) return null;
  const withInterval = (type: string) => (interval > 1 ? `${type}:${interval}` : type);
  const byDay = rule.get("BYDAY");

  switch (rule.get("FREQ")) {
    case "DAILY":
      return withInterval("DAILY");
    case "WEEKLY": {
      const days = byDay
        ? byDay.split(",").map((code) => DAY_CODES.indexOf(code.replace(/^[+-]?\d+/, "")))
        : [new Date(`${startDate.slice(0, 10)}T00:00:00Z`).getUTCDay()];
      if (days.some((d) => d < 0)) return null;
      const daysStr = [...new Set(days)].sort((a, b) => a - b).join(",");
      return interval > 1 ? `WEEKLY:${interval}:${daysStr}` : `WEEKLY:${daysStr}`;
    }
    case "MONTHLY":
      if (rule.get("BYMONTHDAY") === "-1") return withInterval("MONTHLY_LAST");
      if (byDay || rule.has("BYMONTHDAY") || rule.has("BYSETPOS")) return null;
      return withInterval("MONTHLY");
    case "YEARLY":
      if (byDay || rule.has("BYSETPOS")) return null;
      return withInterval("YEARLY");
    default:
      return null;
  }
}

/** SweptMind recurrence → Google RRULE (the series starts on the task's due date). */
export function recurrenceToRrule(recurrence: string): string[] | null {
  const parsed = parseRecurrence(recurrence);
  if (!parsed) return null;
  const interval = parsed.interval > 1 ? `;INTERVAL=${parsed.interval}` : "";

  switch (parsed.type) {
    case "DAILY":
      return [`RRULE:FREQ=DAILY${interval}`];
    case "WEEKLY":
      return [
        `RRULE:FREQ=WEEKLY${interval};BYDAY=${parsed.days.map((d) => DAY_CODES[d]).join(",")}`,
      ];
    case "MONTHLY":
      return [`RRULE:FREQ=MONTHLY${interval}`];
    case "MONTHLY_LAST":
      return [`RRULE:FREQ=MONTHLY${interval};BYMONTHDAY=-1`];
    case "YEARLY":
      return [`RRULE:FREQ=YEARLY${interval}`];
  }
}

/**
 * Only the user's own events become tasks: no birthdays, Gmail-generated events,
 * out-of-office/focus time, public calendars (holidays) or declined invitations.
 * A modified occurrence of a recurring series is skipped — the series is one task.
 */
export function isImportableEvent(event: GoogleCalendarEventData): boolean {
  if (event.eventType && event.eventType !== "default") return false;
  if (event.recurringEventId) return false;
  if (event.organizer?.email?.endsWith("@group.v.calendar.google.com")) return false;
  if (event.attendees?.some((a) => a.self && a.responseStatus === "declined")) return false;
  return true;
}

export interface EventTaskFields {
  title: string;
  notes: string | null;
  dueDate: string;
  dueDateEnd: string | null;
  recurrence: string | null;
}

function minutesBetween(fromNaive: string, toNaive: string): number {
  return (Date.parse(`${toNaive}:00Z`) - Date.parse(`${fromNaive}:00Z`)) / 60_000;
}

function shiftNaive(value: string, minutes: number): string {
  const hasTime = value.includes("T");
  const base = hasTime ? `${value}:00Z` : `${value}T00:00:00Z`;
  const shifted = new Date(Date.parse(base) + minutes * 60_000).toISOString();
  return hasTime ? shifted.slice(0, 16) : shifted.slice(0, 10);
}

/** First occurrence of the series on or after `floorDate` (YYYY-MM-DD). */
function rollForward(recurrence: string, dueDate: string, floorDate: string): string {
  let current = dueDate;
  for (let i = 0; i < MAX_RECURRENCE_STEPS && current.slice(0, 10) < floorDate; i++) {
    const next = computeNextDueDate(recurrence, current);
    if (!next) break;
    current = next;
  }
  return current;
}

/**
 * Task fields for an event. A recurring series is moved to its first occurrence on or
 * after `floorDate` (today for new tasks, the task's current occurrence for updates).
 */
export function eventToTaskFields(
  event: GoogleCalendarEventData,
  timeZone: string,
  floorDate: string,
): EventTaskFields {
  let dueDate: string;
  let dueDateEnd: string | null;

  if ("dateTime" in event.start && event.start.dateTime) {
    dueDate = toLocalDateTime(new Date(event.start.dateTime), timeZone).dateTime;
    const end =
      "dateTime" in event.end && event.end.dateTime
        ? toLocalDateTime(new Date(event.end.dateTime), timeZone).dateTime
        : null;
    // The app's default length isn't an explicit end
    dueDateEnd = end && minutesBetween(dueDate, end) !== DEFAULT_EVENT_MINUTES ? end : null;
  } else {
    dueDate = "date" in event.start ? event.start.date : "";
    // Google's all-day end is exclusive
    const end = "date" in event.end && event.end.date ? shiftNaive(event.end.date, -24 * 60) : null;
    dueDateEnd = end && end > dueDate ? end : null;
  }

  const recurrence = rruleToRecurrence(event.recurrence, dueDate);
  if (recurrence) {
    const rolled = rollForward(recurrence, dueDate, floorDate);
    if (rolled !== dueDate) {
      if (dueDateEnd) dueDateEnd = shiftNaive(dueDateEnd, minutesBetweenAny(dueDate, rolled));
      dueDate = rolled;
    }
  }

  return {
    title: event.summary,
    notes: event.description ?? null,
    dueDate,
    dueDateEnd,
    recurrence,
  };
}

function minutesBetweenAny(from: string, to: string): number {
  const normalize = (v: string) => (v.includes("T") ? v : `${v}T00:00`);
  return minutesBetween(normalize(from), normalize(to));
}
