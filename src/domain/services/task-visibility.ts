/**
 * Shared visibility logic for tasks.
 *
 * Rules:
 * 1. No dueDate and no reminderAt → always visible (returns null)
 * 2. dueDate date-only (YYYY-MM-DD) → visible on that day
 * 3. dueDate with time (YYYY-MM-DDTHH:mm) → visible the day before
 * 4. reminderAt set → overrides rules 2+3, visible from that date
 * 5. recurrence set + dueDate null/past → visible from next occurrence
 */

import { computeFirstOccurrence } from "./recurrence";

interface VisibilityTask {
  dueDate: string | null;
  reminderAt: string | null;
  isCompleted: boolean;
  recurrence?: string | null;
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
}

/** Returns the YYYY-MM-DD date when the task should become visible, or null (always visible). */
export function getVisibleDate(task: VisibilityTask, today?: string): string | null {
  if (task.reminderAt) {
    return task.reminderAt;
  }

  // For recurring tasks with null or past dueDate, compute effective visible date
  if (task.recurrence) {
    const todayStr = today ?? new Date().toISOString().slice(0, 10);
    if (!task.dueDate || task.dueDate.slice(0, 10) < todayStr) {
      const nextOccurrence = computeFirstOccurrence(task.recurrence, todayStr);
      if (nextOccurrence) return nextOccurrence;
    }
  }

  if (!task.dueDate) {
    return null;
  }

  if (task.dueDate.includes("T")) {
    // Has time → visible the day before
    const [year, month, day] = task.dueDate.split("T")[0].split("-").map(Number);
    const date = new Date(year, month - 1, day - 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Date-only → visible on that day
  return task.dueDate;
}

/** Computes the default reminderAt from a dueDate. Called automatically when dueDate changes. */
export function computeDefaultReminder(dueDate: string | null): string | null {
  if (!dueDate) return null;

  if (dueDate.includes("T")) {
    // Has time → day before
    const [year, month, day] = dueDate.split("T")[0].split("-").map(Number);
    const date = new Date(year, month - 1, day - 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Date-only → same day
  return dueDate;
}

/** Returns true if the task should NOT be visible yet (it's a future task). */
export function isFutureTask(task: VisibilityTask, today?: string): boolean {
  if (task.isCompleted) return false;

  // Blocked by an incomplete task → future
  if (task.blockedByTaskId && task.blockedByTaskIsCompleted === false) return true;

  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const visibleDate = getVisibleDate(task, todayStr);
  if (!visibleDate) return false;
  return visibleDate > todayStr;
}
