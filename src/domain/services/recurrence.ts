import { addDays, addMonths, addYears, getDay, format, lastDayOfMonth } from "date-fns";

interface RecurrenceDaily {
  type: "DAILY";
  interval: number;
}

interface RecurrenceWeekly {
  type: "WEEKLY";
  interval: number;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

interface RecurrenceMonthly {
  type: "MONTHLY";
  interval: number;
}

interface RecurrenceMonthlyLast {
  type: "MONTHLY_LAST";
  interval: number;
}

interface RecurrenceYearly {
  type: "YEARLY";
  interval: number;
}

export type Recurrence =
  | RecurrenceDaily
  | RecurrenceWeekly
  | RecurrenceMonthly
  | RecurrenceMonthlyLast
  | RecurrenceYearly;

export function parseRecurrence(recurrence: string): Recurrence | null {
  if (!recurrence) return null;

  // DAILY or DAILY:N
  if (recurrence === "DAILY") return { type: "DAILY", interval: 1 };
  if (recurrence.startsWith("DAILY:")) {
    const n = Number(recurrence.slice(6));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "DAILY", interval: n };
  }

  // MONTHLY_LAST or MONTHLY_LAST:N (check before MONTHLY to avoid prefix collision)
  if (recurrence === "MONTHLY_LAST") return { type: "MONTHLY_LAST", interval: 1 };
  if (recurrence.startsWith("MONTHLY_LAST:")) {
    const n = Number(recurrence.slice(13));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "MONTHLY_LAST", interval: n };
  }

  // MONTHLY or MONTHLY:N
  if (recurrence === "MONTHLY") return { type: "MONTHLY", interval: 1 };
  if (recurrence.startsWith("MONTHLY:")) {
    const n = Number(recurrence.slice(8));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "MONTHLY", interval: n };
  }

  // YEARLY or YEARLY:N
  if (recurrence === "YEARLY") return { type: "YEARLY", interval: 1 };
  if (recurrence.startsWith("YEARLY:")) {
    const n = Number(recurrence.slice(7));
    if (!Number.isInteger(n) || n < 1) return null;
    return { type: "YEARLY", interval: n };
  }

  // WEEKLY:days or WEEKLY:N:days
  if (recurrence.startsWith("WEEKLY:")) {
    const rest = recurrence.slice(7);
    if (!rest) return null;

    // Check for WEEKLY:N:days format (two colon-separated segments)
    const colonIndex = rest.indexOf(":");
    let interval = 1;
    let daysStr = rest;

    if (colonIndex !== -1) {
      const maybeInterval = Number(rest.slice(0, colonIndex));
      if (Number.isInteger(maybeInterval) && maybeInterval >= 1) {
        interval = maybeInterval;
        daysStr = rest.slice(colonIndex + 1);
      }
    }

    if (!daysStr) return null;
    const days = daysStr.split(",").map(Number);
    if (days.some((d) => isNaN(d) || d < 0 || d > 6)) return null;
    if (days.length === 0) return null;
    return { type: "WEEKLY", interval, days: [...new Set(days)].sort((a, b) => a - b) };
  }

  return null;
}

/**
 * Compute the first occurrence date from today (including today if it matches).
 * Used when recurrence is set and dueDate is missing or past.
 */
export function computeFirstOccurrence(recurrence: string, todayOverride?: string): string | null {
  const parsed = parseRecurrence(recurrence);
  if (!parsed) return null;

  const today = todayOverride
    ? (() => {
        const [y, m, d] = todayOverride.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  switch (parsed.type) {
    case "DAILY":
      return todayStr;

    case "WEEKLY": {
      const currentDay = getDay(today);
      const todayOrLater = parsed.days.find((d) => d >= currentDay);
      if (todayOrLater !== undefined) {
        return format(addDays(today, todayOrLater - currentDay), "yyyy-MM-dd");
      }
      return format(addDays(today, 7 - currentDay + parsed.days[0]), "yyyy-MM-dd");
    }

    case "MONTHLY":
      return todayStr;

    case "MONTHLY_LAST": {
      const lastDay = lastDayOfMonth(today);
      if (today.getDate() === lastDay.getDate()) return todayStr;
      return format(lastDay, "yyyy-MM-dd");
    }

    case "YEARLY":
      return todayStr;
  }
}

/**
 * Format a recurrence string into a human-readable label.
 * Pure function — all translated strings are passed as parameters.
 */
export function formatRecurrenceLabel(
  recurrence: string | null,
  labels: {
    everyDay: string;
    everyNDays: (n: number) => string;
    everyNWeeks: (n: number) => string;
    everyMonth: string;
    everyNMonths: (n: number) => string;
    everyLastDay: string;
    everyYear: string;
    everyNYears: (n: number) => string;
    daysShort: string[];
  },
): string | null {
  if (!recurrence) return null;
  const parsed = parseRecurrence(recurrence);
  if (!parsed) return null;

  switch (parsed.type) {
    case "DAILY":
      return parsed.interval === 1
        ? labels.everyDay
        : labels.everyNDays(parsed.interval);

    case "WEEKLY": {
      const daysLabel =
        parsed.days.length === 7
          ? labels.everyDay
          : parsed.days.map((d) => labels.daysShort[d]).join(", ");
      if (parsed.interval === 1) return daysLabel;
      return `${labels.everyNWeeks(parsed.interval)}: ${daysLabel}`;
    }

    case "MONTHLY":
      return parsed.interval === 1
        ? labels.everyMonth
        : labels.everyNMonths(parsed.interval);

    case "MONTHLY_LAST":
      return parsed.interval === 1
        ? labels.everyLastDay
        : `${labels.everyNMonths(parsed.interval)}, ${labels.everyLastDay.toLowerCase()}`;

    case "YEARLY":
      return parsed.interval === 1
        ? labels.everyYear
        : labels.everyNYears(parsed.interval);
  }
}

export function computeNextDueDate(recurrence: string, currentDueDate: string): string | null {
  if (!currentDueDate) return null;

  const parsed = parseRecurrence(recurrence);
  if (!parsed) return null;

  const hasTime = currentDueDate.includes("T");
  const dateStr = hasTime ? currentDueDate.split("T")[0] : currentDueDate;
  const timeSuffix = hasTime ? `T${currentDueDate.split("T")[1]}` : "";

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  let next: Date;

  switch (parsed.type) {
    case "DAILY":
      next = addDays(date, parsed.interval);
      break;

    case "WEEKLY": {
      const currentDay = getDay(date); // 0=Sun
      const sorted = parsed.days;
      const laterThisWeek = sorted.find((d) => d > currentDay);
      if (laterThisWeek !== undefined) {
        // Still within same week cycle — no interval skip
        next = addDays(date, laterThisWeek - currentDay);
      } else {
        // Wrap to first day of next cycle — skip (interval - 1) extra weeks
        const daysToNextWeek = 7 - currentDay + sorted[0];
        const extraWeeks = (parsed.interval - 1) * 7;
        next = addDays(date, daysToNextWeek + extraWeeks);
      }
      break;
    }

    case "MONTHLY":
      next = addMonths(date, parsed.interval);
      break;

    case "MONTHLY_LAST":
      next = lastDayOfMonth(addMonths(date, parsed.interval));
      break;

    case "YEARLY":
      next = addYears(date, parsed.interval);
      break;
  }

  return format(next, "yyyy-MM-dd") + timeSuffix;
}
