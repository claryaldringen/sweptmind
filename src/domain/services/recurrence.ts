import { addDays, addMonths, addYears, getDay, format } from "date-fns";

interface RecurrenceDaily {
  type: "DAILY";
}

interface RecurrenceWeekly {
  type: "WEEKLY";
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

interface RecurrenceMonthly {
  type: "MONTHLY";
}

interface RecurrenceYearly {
  type: "YEARLY";
}

export type Recurrence =
  | RecurrenceDaily
  | RecurrenceWeekly
  | RecurrenceMonthly
  | RecurrenceYearly;

export function parseRecurrence(recurrence: string): Recurrence | null {
  if (!recurrence) return null;

  if (recurrence === "DAILY") return { type: "DAILY" };
  if (recurrence === "MONTHLY") return { type: "MONTHLY" };
  if (recurrence === "YEARLY") return { type: "YEARLY" };

  if (recurrence.startsWith("WEEKLY:")) {
    const daysStr = recurrence.slice(7);
    if (!daysStr) return null;
    const days = daysStr.split(",").map(Number);
    if (days.some((d) => isNaN(d) || d < 0 || d > 6)) return null;
    if (days.length === 0) return null;
    return { type: "WEEKLY", days: [...new Set(days)].sort((a, b) => a - b) };
  }

  return null;
}

export function computeNextDueDate(
  recurrence: string,
  currentDueDate: string,
): string | null {
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
      next = addDays(date, 1);
      break;

    case "WEEKLY": {
      const currentDay = getDay(date); // 0=Sun
      const sorted = parsed.days;
      const laterThisWeek = sorted.find((d) => d > currentDay);
      if (laterThisWeek !== undefined) {
        const diff = laterThisWeek - currentDay;
        next = addDays(date, diff);
      } else {
        const diff = 7 - currentDay + sorted[0];
        next = addDays(date, diff);
      }
      break;
    }

    case "MONTHLY":
      next = addMonths(date, 1);
      break;

    case "YEARLY":
      next = addYears(date, 1);
      break;
  }

  return format(next, "yyyy-MM-dd") + timeSuffix;
}
