/**
 * Detect time conflicts between tasks with overlapping time ranges.
 * Only considers incomplete tasks with time-based dueDates (containing "T").
 * Tasks without dueDateEnd are treated as 1-hour duration.
 * Returns a Set of task IDs that have at least one conflict.
 */
export function detectTimeConflicts(
  tasks: Array<{
    id: string;
    dueDate: string | null;
    dueDateEnd: string | null;
    isCompleted: boolean;
  }>,
): Set<string> {
  const conflicting = new Set<string>();

  // Filter to incomplete tasks with time-based dueDate
  const timeTasks = tasks.filter(
    (t) => !t.isCompleted && t.dueDate != null && t.dueDate.includes("T"),
  );

  if (timeTasks.length < 2) return conflicting;

  // Build intervals: [start, end, taskId]
  const intervals = timeTasks.map((t) => {
    const start = new Date(t.dueDate!).getTime();
    let end: number;
    if (t.dueDateEnd && t.dueDateEnd.includes("T")) {
      end = new Date(t.dueDateEnd).getTime();
    } else {
      // Default 1-hour duration
      end = start + 60 * 60 * 1000;
    }
    return { start, end, id: t.id };
  });

  // Sort by start time for efficient sweep
  intervals.sort((a, b) => a.start - b.start);

  // Sweep: compare each interval with subsequent ones
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      // Since sorted by start, if j.start >= i.end, no more overlaps for i
      if (intervals[j].start >= intervals[i].end) break;
      // Overlap detected
      conflicting.add(intervals[i].id);
      conflicting.add(intervals[j].id);
    }
  }

  return conflicting;
}
