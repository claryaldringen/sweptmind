/**
 * Scheduling rules for push notifications about tasks.
 *
 * Task dates are stored as naive local strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm in the user's
 * own time), so every comparison happens in the user's time zone.
 *
 * - Due notification: a task with a time is announced when its time comes (within a grace
 *   window, so a missed cron run still delivers but stale tasks aren't announced).
 * - Daily digest ("Připomenutí"): one morning summary of today's tasks.
 */

import { computeDefaultReminder } from "./task-visibility";

export const DEFAULT_TIME_ZONE = "Europe/Prague";
export const DUE_GRACE_MINUTES = 60;
/** The digest goes out in the first cron run in [DIGEST_FROM_HOUR, DIGEST_UNTIL_HOUR). */
export const DIGEST_FROM_HOUR = 8;
export const DIGEST_UNTIL_HOUR = 12;
const DIGEST_MAX_TITLES = 3;

export type NotificationLocale = "cs" | "en";

export interface LocalDateTime {
  date: string; // YYYY-MM-DD
  dateTime: string; // YYYY-MM-DDTHH:mm
  hour: number;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

export function normalizeLocale(locale: string | null | undefined): NotificationLocale {
  return locale === "en" ? "en" : "cs";
}

export function toLocalDateTime(now: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour")) % 24;
  return { date, dateTime: `${date}T${String(hour).padStart(2, "0")}:${get("minute")}`, hour };
}

/** Shifts a naive "YYYY-MM-DDTHH:mm" string by whole minutes (no time zone involved). */
function shiftNaiveDateTime(dateTime: string, minutes: number): string {
  const shifted = new Date(Date.parse(`${dateTime}:00Z`) + minutes * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function isDueForNotification(
  dueDate: string,
  nowLocal: LocalDateTime,
  graceMinutes = DUE_GRACE_MINUTES,
): boolean {
  if (!dueDate.includes("T")) return false;
  const due = dueDate.slice(0, 16);
  return due <= nowLocal.dateTime && due > shiftNaiveDateTime(nowLocal.dateTime, -graceMinutes);
}

export function shouldSendDigest(nowLocal: LocalDateTime, lastSentOn: string | null): boolean {
  return (
    nowLocal.hour >= DIGEST_FROM_HOUR &&
    nowLocal.hour < DIGEST_UNTIL_HOUR &&
    lastSentOn !== nowLocal.date
  );
}

interface DigestCandidate {
  dueDate: string | null;
  reminderAt: string | null;
  isCompleted: boolean;
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
}

/**
 * Today's tasks: due today (date-only or with a time) plus explicit reminders for today.
 * The automatic reminder of a timed task (the day before) doesn't count — that task is
 * due tomorrow.
 */
export function selectDigestTasks<T extends DigestCandidate>(tasks: T[], today: string): T[] {
  return tasks.filter((task) => {
    if (task.isCompleted) return false;
    if (task.blockedByTaskId && task.blockedByTaskIsCompleted === false) return false;
    if (task.dueDate?.slice(0, 10) === today) return true;
    return task.reminderAt === today && task.reminderAt !== computeDefaultReminder(task.dueDate);
  });
}

export function buildDueMessage(
  taskTitle: string,
  dueDate: string,
  locale: NotificationLocale,
): { title: string; body: string } {
  const time = dueDate.slice(11, 16);
  return {
    title: taskTitle,
    body: locale === "en" ? `Due today at ${time}` : `Termín: dnes ${time}`,
  };
}

export function buildDigestMessage(
  taskTitles: string[],
  locale: NotificationLocale,
): { title: string; body: string } {
  const shown = taskTitles.slice(0, DIGEST_MAX_TITLES).join(", ");
  const rest = taskTitles.length - DIGEST_MAX_TITLES;

  if (locale === "en") {
    return {
      title: `Today's tasks (${taskTitles.length})`,
      body: rest > 0 ? `${shown} and ${rest} more` : shown,
    };
  }
  return {
    title: `Úkoly na dnes (${taskTitles.length})`,
    body: rest > 0 ? `${shown} a další ${rest}` : shown,
  };
}
