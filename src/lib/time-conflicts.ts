/**
 * Detect time conflicts between tasks with overlapping time ranges.
 * A conflict only occurs when both tasks have a location and those locations differ
 * (i.e. the user would need to be in two places at once).
 * Considers:
 * - Time-based tasks (dueDate containing "T") — compared by exact time range
 * - Date-range tasks (dueDate + dueDateEnd, both date-only) — compared by day overlap
 * Tasks without dueDateEnd are treated as:
 * - 1-hour duration for time-based tasks
 * - single-day for date-only tasks
 * Returns a Set of task IDs that have at least one conflict.
 */
export function detectTimeConflicts(
  tasks: Array<{
    id: string;
    dueDate: string | null;
    dueDateEnd: string | null;
    isCompleted: boolean;
    locationId: string | null;
  }>,
): Set<string> {
  const conflicting = new Set<string>();

  // Filter to incomplete tasks with dueDate
  const eligible = tasks.filter((t) => !t.isCompleted && t.dueDate != null);

  if (eligible.length < 2) return conflicting;

  // Build intervals in milliseconds
  const intervals = eligible.map((t) => {
    const hasTime = t.dueDate!.includes("T");
    let start: number;
    let end: number;

    if (hasTime) {
      start = new Date(t.dueDate!).getTime();
      if (t.dueDateEnd && t.dueDateEnd.includes("T")) {
        end = new Date(t.dueDateEnd).getTime();
      } else {
        // Default 1-hour duration
        end = start + 60 * 60 * 1000;
      }
    } else {
      // Date-only: treat as full day (00:00 to 23:59:59.999)
      start = new Date(t.dueDate! + "T00:00:00").getTime();
      if (t.dueDateEnd) {
        // End date is inclusive — end of that day
        end = new Date(t.dueDateEnd + "T23:59:59.999").getTime();
      } else {
        // Single day
        end = new Date(t.dueDate! + "T23:59:59.999").getTime();
      }
    }

    return { start, end, id: t.id, locationId: t.locationId };
  });

  // Sort by start time for efficient sweep
  intervals.sort((a, b) => a.start - b.start);

  // Sweep: compare each interval with subsequent ones
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      // Since sorted by start, if j.start >= i.end, no more overlaps for i
      if (intervals[j].start >= intervals[i].end) break;
      // Conflict only when both have a location and they differ
      const a = intervals[i];
      const b = intervals[j];
      if (!a.locationId || !b.locationId || a.locationId === b.locationId) continue;
      conflicting.add(a.id);
      conflicting.add(b.id);
    }
  }

  return conflicting;
}
