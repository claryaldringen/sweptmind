import { and, eq, gte, inArray, isNull, like, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { PushSubscription } from "@/domain/entities/push-subscription";
import {
  DUE_GRACE_MINUTES,
  buildDigestMessage,
  buildDueMessage,
  isDueForNotification,
  normalizeLocale,
  resolveTimeZone,
  selectDigestTasks,
  shouldSendDigest,
  toLocalDateTime,
} from "@/domain/services/task-notifications";
import type { PushDispatcher } from "./push-dispatcher";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Runs every minute (systemd timer sweptmind-push → GET /api/push/send):
 * due-time notifications for tasks with a time, and the morning digest.
 */
export class TaskReminderJob {
  constructor(
    private readonly db: Database,
    private readonly dispatcher: PushDispatcher,
  ) {}

  async run(now = new Date()): Promise<{ sent: number; digests: number }> {
    const sent = await this.sendDueNotifications(now);
    const digests = await this.sendDailyDigests(now);
    return { sent, digests };
  }

  private async sendDueNotifications(now: Date): Promise<number> {
    // Due dates are naive local times. Pre-filter by the widest offsets on Earth
    // (UTC−12 … UTC+14), then decide exactly in each user's time zone.
    const upper = new Date(now.getTime() + 14 * HOUR_MS).toISOString().slice(0, 16);
    const lower = new Date(now.getTime() - 12 * HOUR_MS - DUE_GRACE_MINUTES * 60_000)
      .toISOString()
      .slice(0, 16);

    const candidates = await this.db
      .select({
        id: schema.tasks.id,
        userId: schema.tasks.userId,
        listId: schema.tasks.listId,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        timezone: schema.users.timezone,
        locale: schema.users.locale,
      })
      .from(schema.tasks)
      .innerJoin(schema.users, eq(schema.users.id, schema.tasks.userId))
      .where(
        and(
          eq(schema.tasks.isCompleted, false),
          isNull(schema.tasks.notifiedAt),
          like(schema.tasks.dueDate, "%T%"),
          gte(schema.tasks.dueDate, lower),
          lte(schema.tasks.dueDate, upper),
        ),
      );

    const due = candidates.filter(
      (task) =>
        task.dueDate &&
        isDueForNotification(task.dueDate, toLocalDateTime(now, resolveTimeZone(task.timezone))),
    );
    if (due.length === 0) return 0;

    // Claim the tasks first; only the run that flips notified_at sends (no duplicates
    // when two runs overlap)
    const claimed = await this.db
      .update(schema.tasks)
      .set({ notifiedAt: now })
      .where(
        and(
          inArray(
            schema.tasks.id,
            due.map((t) => t.id),
          ),
          isNull(schema.tasks.notifiedAt),
        ),
      )
      .returning({ id: schema.tasks.id });
    const claimedIds = new Set(claimed.map((c) => c.id));

    const subsByUser = await this.subscriptionsByUser(
      [...new Set(due.map((t) => t.userId))],
      (sub) => sub.notifyDueDate,
    );

    let delivered = 0;
    for (const task of due) {
      if (!claimedIds.has(task.id) || !task.dueDate) continue;
      const subs = subsByUser.get(task.userId);
      if (!subs?.length) continue;

      const message = buildDueMessage(task.title, task.dueDate, normalizeLocale(task.locale));
      delivered += await this.dispatcher.send(subs, {
        ...message,
        url: `/lists/${task.listId}?task=${task.id}`,
        tag: `task:${task.id}`,
      });
    }
    return delivered;
  }

  private async sendDailyDigests(now: Date): Promise<number> {
    const subsByUser = await this.subscriptionsByUser(null, (sub) => sub.notifyReminder);
    if (subsByUser.size === 0) return 0;

    const users = await this.db
      .select({
        id: schema.users.id,
        timezone: schema.users.timezone,
        locale: schema.users.locale,
        reminderDigestSentOn: schema.users.reminderDigestSentOn,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, [...subsByUser.keys()]));

    let delivered = 0;
    for (const user of users) {
      const nowLocal = toLocalDateTime(now, resolveTimeZone(user.timezone));
      if (!shouldSendDigest(nowLocal, user.reminderDigestSentOn)) continue;

      // Claim today's digest first (also when there is nothing to send) so it runs once a day
      const claimed = await this.db
        .update(schema.users)
        .set({ reminderDigestSentOn: nowLocal.date })
        .where(
          and(
            eq(schema.users.id, user.id),
            or(
              isNull(schema.users.reminderDigestSentOn),
              ne(schema.users.reminderDigestSentOn, nowLocal.date),
            ),
          ),
        )
        .returning({ id: schema.users.id });
      if (claimed.length === 0) continue;

      const tasks = selectDigestTasks(await this.loadDigestCandidates(user.id), nowLocal.date);
      if (tasks.length === 0) continue;

      const message = buildDigestMessage(
        tasks.map((t) => t.title),
        normalizeLocale(user.locale),
      );
      delivered += await this.dispatcher.send(subsByUser.get(user.id) ?? [], {
        ...message,
        url: "/context",
        tag: `digest:${nowLocal.date}`,
      });
    }
    return delivered;
  }

  private async loadDigestCandidates(userId: string) {
    const blocker = alias(schema.tasks, "blocker");
    return this.db
      .select({
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        reminderAt: schema.tasks.reminderAt,
        isCompleted: schema.tasks.isCompleted,
        recurrence: schema.tasks.recurrence,
        blockedByTaskId: schema.tasks.blockedByTaskId,
        blockedByTaskIsCompleted: blocker.isCompleted,
      })
      .from(schema.tasks)
      .leftJoin(blocker, eq(blocker.id, schema.tasks.blockedByTaskId))
      .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.isCompleted, false)));
  }

  /** Subscriptions grouped by user; `userIds: null` = all users. */
  private async subscriptionsByUser(
    userIds: string[] | null,
    filter: (sub: PushSubscription) => boolean,
  ): Promise<Map<string, PushSubscription[]>> {
    const subs = await this.db.query.pushSubscriptions.findMany(
      userIds ? { where: inArray(schema.pushSubscriptions.userId, userIds) } : undefined,
    );
    const byUser = new Map<string, PushSubscription[]>();
    for (const sub of subs) {
      if (!filter(sub)) continue;
      byUser.set(sub.userId, [...(byUser.get(sub.userId) ?? []), sub]);
    }
    return byUser;
  }
}
