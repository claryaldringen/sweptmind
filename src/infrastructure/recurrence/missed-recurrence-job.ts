import { and, eq, isNotNull, lt } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { TaskService } from "@/domain/services/task.service";
import { resolveTimeZone, toLocalDateTime } from "@/domain/services/task-notifications";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Runs every minute with the push job: recurring tasks set to skip missed occurrences
 * move to their next occurrence once the day of the current one has passed in the
 * user's time zone (the others stay overdue).
 */
export class MissedRecurrenceJob {
  constructor(
    private readonly db: Database,
    private readonly taskService: Pick<TaskService, "skipMissedOccurrence">,
  ) {}

  async run(now = new Date()): Promise<number> {
    // Due dates are naive local dates — pre-filter by the latest "today" on Earth
    // (UTC+14), then decide exactly in each user's time zone
    const latestToday = new Date(now.getTime() + 14 * HOUR_MS).toISOString().slice(0, 10);

    const candidates = await this.db
      .select({
        id: schema.tasks.id,
        userId: schema.tasks.userId,
        dueDate: schema.tasks.dueDate,
        timezone: schema.users.timezone,
      })
      .from(schema.tasks)
      .innerJoin(schema.users, eq(schema.users.id, schema.tasks.userId))
      .where(
        and(
          eq(schema.tasks.isCompleted, false),
          eq(schema.tasks.skipMissedRecurrence, true),
          isNotNull(schema.tasks.recurrence),
          lt(schema.tasks.dueDate, latestToday),
        ),
      );

    let moved = 0;
    for (const task of candidates) {
      const today = toLocalDateTime(now, resolveTimeZone(task.timezone)).date;
      if (!task.dueDate || task.dueDate.slice(0, 10) >= today) continue;
      try {
        if (await this.taskService.skipMissedOccurrence(task.id, task.userId, today)) moved++;
      } catch (error) {
        console.error(`[MissedRecurrenceJob] failed to move task ${task.id}:`, error);
      }
    }
    return moved;
  }
}
