import type { Task } from "@/domain/entities/task";

const DAY_MAP: Record<number, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

const REVERSE_DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export function recurrenceToRrule(recurrence: string | null): string | null {
  if (!recurrence) return null;
  if (recurrence === "DAILY") return "FREQ=DAILY";
  if (recurrence === "MONTHLY") return "FREQ=MONTHLY";
  if (recurrence === "YEARLY") return "FREQ=YEARLY";
  if (recurrence.startsWith("WEEKLY:")) {
    const days = recurrence
      .slice(7)
      .split(",")
      .map((d) => DAY_MAP[parseInt(d)])
      .filter(Boolean);
    return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
  }
  return null;
}

export function rruleToRecurrence(rrule: string): string | null {
  const rule = rrule.replace(/^RRULE:/, "");
  const parts = new Map(
    rule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k, v] as [string, string];
    }),
  );
  const freq = parts.get("FREQ");
  if (freq === "DAILY") return "DAILY";
  if (freq === "MONTHLY") return "MONTHLY";
  if (freq === "YEARLY") return "YEARLY";
  if (freq === "WEEKLY") {
    const byday = parts.get("BYDAY");
    if (!byday) return "WEEKLY:1";
    const days = byday
      .split(",")
      .map((d) => REVERSE_DAY_MAP[d])
      .filter((d) => d !== undefined)
      .sort((a, b) => a - b);
    return `WEEKLY:${days.join(",")}`;
  }
  return null;
}

function formatDateIcal(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function formatDateTimeIcal(dateStr: string): string {
  const [date, time] = dateStr.split("T");
  return `${date.replace(/-/g, "")}T${time.replace(/:/g, "")}00`;
}

function addOneDay(dateStr: string): string {
  const d = new Date(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8)),
  );
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addOneHour(dtStr: string): string {
  const date = dtStr.slice(0, 8);
  const h = parseInt(dtStr.slice(9, 11));
  const m = dtStr.slice(11, 13);
  const s = dtStr.slice(13, 15);
  const newH = String(h + 1).padStart(2, "0");
  return `${date}T${newH}${m}${s}`;
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function taskToVevent(task: Task, icalUid: string): string {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${icalUid}`);
  lines.push(`SUMMARY:${escapeIcalText(task.title)}`);

  if (task.notes) {
    lines.push(`DESCRIPTION:${escapeIcalText(task.notes)}`);
  }

  if (task.dueDate) {
    const hasTime = task.dueDate.includes("T");
    if (hasTime) {
      const dt = formatDateTimeIcal(task.dueDate);
      lines.push(`DTSTART:${dt}`);
      lines.push(`DTEND:${addOneHour(dt)}`);
    } else {
      const d = formatDateIcal(task.dueDate);
      lines.push(`DTSTART;VALUE=DATE:${d}`);
      lines.push(`DTEND;VALUE=DATE:${addOneDay(d)}`);
    }
  }

  lines.push(`STATUS:${task.isCompleted ? "COMPLETED" : "NEEDS-ACTION"}`);

  if (task.recurrence) {
    const rrule = recurrenceToRrule(task.recurrence);
    if (rrule) lines.push(`RRULE:${rrule}`);
  }

  const created = task.createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const modified = task.updatedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  lines.push(`CREATED:${created}`);
  lines.push(`LAST-MODIFIED:${modified}`);
  lines.push(`DTSTAMP:${modified}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

export interface VeventTaskData {
  title: string;
  notes: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  recurrence: string | null;
  icalUid: string;
}

function getIcalProperty(lines: string[], prop: string): string | null {
  for (const line of lines) {
    if (line.startsWith(prop + ":") || line.startsWith(prop + ";")) {
      const colonIdx = line.indexOf(":");
      return colonIdx >= 0 ? line.slice(colonIdx + 1) : null;
    }
  }
  return null;
}

function parseIcalDate(dtstart: string): string {
  if (dtstart.length === 8) {
    return `${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`;
  }
  const date = `${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`;
  const time = `${dtstart.slice(9, 11)}:${dtstart.slice(11, 13)}`;
  return `${date}T${time}`;
}

function unescapeIcalText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function veventToTaskData(ical: string): VeventTaskData | null {
  const lines = ical.split(/\r?\n/);
  const uid = getIcalProperty(lines, "UID");
  const summary = getIcalProperty(lines, "SUMMARY");
  if (!uid || !summary) return null;

  const dtstart = getIcalProperty(lines, "DTSTART");
  const description = getIcalProperty(lines, "DESCRIPTION");
  const status = getIcalProperty(lines, "STATUS");
  const rrule = getIcalProperty(lines, "RRULE");

  return {
    title: unescapeIcalText(summary),
    notes: description ? unescapeIcalText(description) : null,
    dueDate: dtstart ? parseIcalDate(dtstart) : null,
    isCompleted: status?.toUpperCase() === "COMPLETED",
    recurrence: rrule ? rruleToRecurrence(rrule) : null,
    icalUid: uid,
  };
}
