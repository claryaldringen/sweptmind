import { createHmac } from "crypto";
import type { Task } from "../entities/task";
import type { IUserRepository } from "../repositories/user.repository";
import type { ICalendarSyncRepository } from "../repositories/calendar-sync.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type {
  IGoogleCalendarClient,
  GoogleCalendarEventData,
} from "../ports/google-calendar-client";
import { addDays, format } from "date-fns";
import { computeDefaultReminder } from "./task-visibility";
import { resolveTimeZone, toLocalDateTime } from "./task-notifications";
import {
  eventToTaskFields,
  isImportableEvent,
  recurrenceToRrule,
  type EventTaskFields,
} from "./google-event-mapping";

/** Ends with "Z" or a UTC offset — e.g. times stored from Google before normalization. */
const UTC_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** A task time as a naive local "YYYY-MM-DDTHH:mm" in the user's zone. */
function toNaiveLocal(value: string, timeZone: string): string {
  if (UTC_OFFSET_RE.test(value)) return toLocalDateTime(new Date(value), timeZone).dateTime;
  return value.slice(0, 16);
}

/**
 * Google requires RFC3339 (with seconds) plus an offset or an explicit time zone — and the
 * time zone is mandatory for recurring events, so it's always sent.
 */
function toEventDateTime(value: string, timeZone: string): { dateTime: string; timeZone: string } {
  return { dateTime: `${toNaiveLocal(value, timeZone)}:00`, timeZone };
}

/** Default event end: one hour after the start, on the wall clock. */
function oneHourAfter(naiveLocal: string): string {
  const wallClock = Date.parse(`${naiveLocal}:00Z`) + 60 * 60 * 1000;
  return new Date(wallClock).toISOString().slice(0, 16);
}

/** Pull update for an existing task: only what actually changed in Google. */
function changesFromEvent(
  task: Task,
  fields: EventTaskFields,
  keepRecurrence: boolean,
): Partial<Task> | null {
  const changes: Partial<Task> = {};
  if (task.title !== fields.title) changes.title = fields.title;
  if ((task.notes ?? null) !== fields.notes) changes.notes = fields.notes;
  if (task.dueDate !== fields.dueDate) {
    changes.dueDate = fields.dueDate;
    // Move only the automatic reminder; a reminder set by the user stays
    if (!task.reminderAt || task.reminderAt === computeDefaultReminder(task.dueDate)) {
      changes.reminderAt = computeDefaultReminder(fields.dueDate);
    }
  }
  if ((task.dueDateEnd ?? null) !== fields.dueDateEnd) changes.dueDateEnd = fields.dueDateEnd;
  const recurrence = fields.recurrence ?? (keepRecurrence ? (task.recurrence ?? null) : null);
  if ((task.recurrence ?? null) !== recurrence) changes.recurrence = recurrence;
  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Compute an HMAC-SHA256 token for a Google Calendar webhook channel.
 * Used both when registering a watch (to send the token to Google) and
 * when receiving webhook notifications (to verify the echoed token).
 */
export function computeChannelToken(channelId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — cannot compute channel token");
  }
  return createHmac("sha256", secret).update(channelId).digest("hex");
}

export class GoogleCalendarService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly syncRepo: ICalendarSyncRepository,
    private readonly gcalClient: IGoogleCalendarClient,
    private readonly taskRepo?: ITaskRepository,
    private readonly listRepo?: IListRepository,
  ) {}

  /**
   * Push a task to Google Calendar. Creates a new event or patches an existing one.
   */
  async pushTask(userId: string, task: Task): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "pull") return;

    // Respect sync scope setting
    if (!this.taskMatchesSyncScope(task, settings.syncAll, settings.syncDateRange)) return;

    const event = this.taskToEvent(task, resolveTimeZone(settings.timeZone));
    const syncEntry = await this.syncRepo.findByTaskId(task.id);

    if (syncEntry?.googleCalendarEventId) {
      // Patch existing event
      await this.gcalClient.patchEvent(
        userId,
        settings.calendarId,
        syncEntry.googleCalendarEventId,
        // An empty list removes a recurrence dropped in SweptMind
        { ...event, recurrence: event.recurrence ?? [] },
      );
    } else {
      // Create new event
      const created = await this.gcalClient.insertEvent(userId, settings.calendarId, event);

      // Upsert sync entry with icalUid derived from task id
      const entry = await this.syncRepo.upsert({
        userId,
        taskId: task.id,
        icalUid: `sweptmind-${task.id}`,
        etag: `"${task.updatedAt.getTime()}"`,
      });

      if (created.id) {
        await this.syncRepo.updateGoogleEventId(entry.id, created.id);
      }
    }
  }

  /** Which of the tasks have an event in Google Calendar that SweptMind may delete. */
  async findTasksInCalendar(userId: string, taskIds: string[]): Promise<string[]> {
    if (taskIds.length === 0) return [];
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "pull") return [];

    const entries = await this.syncRepo.findByTaskIds(taskIds);
    return taskIds.filter((id) => {
      const entry = entries.get(id);
      return entry?.userId === userId && !!entry.googleCalendarEventId;
    });
  }

  /**
   * Delete the Google Calendar event associated with a task.
   */
  async deleteTaskEvent(userId: string, taskId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "pull") return;

    const syncEntry = await this.syncRepo.findByTaskId(taskId);
    if (!syncEntry?.googleCalendarEventId) return;

    await this.gcalClient.deleteEvent(userId, settings.calendarId, syncEntry.googleCalendarEventId);
    await this.syncRepo.deleteByTaskId(taskId);
  }

  /**
   * Pull changes from Google Calendar and create/update tasks.
   */
  async pullChanges(userId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "push") return;
    if (!this.taskRepo || !this.listRepo) return;

    const result = await this.gcalClient.listEvents(
      userId,
      settings.calendarId,
      settings.syncToken ?? undefined,
    );

    if (result.nextSyncToken) {
      await this.userRepo.updateGoogleCalendarSyncToken(userId, result.nextSyncToken);
    }

    const targetListId = settings.targetListId;
    if (!targetListId) return;

    const timeZone = resolveTimeZone(settings.timeZone);
    const today = toLocalDateTime(new Date(), timeZone).date;

    for (const event of result.items) {
      if (!event.id) continue;

      const syncEntry = await this.syncRepo.findByGoogleEventId(userId, event.id);
      const fromGoogle = syncEntry?.icalUid.startsWith("gcal-") ?? false;

      if (event.status === "cancelled") {
        // Event deleted in Google Calendar → delete task
        if (syncEntry) {
          await this.taskRepo.delete(syncEntry.taskId, userId);
          await this.syncRepo.deleteByTaskId(syncEntry.taskId);
        }
        continue;
      }

      if (!isImportableEvent(event)) {
        // Birthday, holiday, … imported before this filter existed → remove it
        if (syncEntry && fromGoogle) {
          await this.taskRepo.delete(syncEntry.taskId, userId);
          await this.syncRepo.deleteByTaskId(syncEntry.taskId);
        }
        continue;
      }

      if (syncEntry) {
        const task = await this.taskRepo.findById(syncEntry.taskId, userId);
        if (!task) continue;
        // A series stays on the task's current occurrence instead of jumping to today
        const floor = task.dueDate?.slice(0, 10) ?? today;
        const fields = eventToTaskFields(event, timeZone, floor);
        // Recurrence of tasks created in SweptMind wasn't sent to Google before — keep it
        const changes = changesFromEvent(task, fields, !fromGoogle);
        if (changes) {
          await this.taskRepo.update(syncEntry.taskId, userId, changes);
          await this.syncRepo.updateEtag(syncEntry.id, `"${Date.now()}"`);
        }
        continue;
      }

      const fields = eventToTaskFields(event, timeZone, today);
      const minSort = await this.taskRepo.findMinSortOrder(targetListId);
      const task = await this.taskRepo.create({
        userId,
        listId: targetListId,
        ...fields,
        reminderAt: computeDefaultReminder(fields.dueDate),
        sortOrder: (minSort ?? 1) - 1,
      });
      const entry = await this.syncRepo.upsert({
        userId,
        taskId: task.id,
        icalUid: `gcal-${event.id}`,
        etag: `"${task.updatedAt.getTime()}"`,
      });
      await this.syncRepo.updateGoogleEventId(entry.id, event.id);
    }
  }

  /**
   * Register a webhook watch channel for push notifications.
   */
  async registerWatch(userId: string, webhookUrl: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled) return;

    const channelId = crypto.randomUUID();
    const token = computeChannelToken(channelId);
    const { expiration } = await this.gcalClient.watchEvents(
      userId,
      settings.calendarId,
      channelId,
      webhookUrl,
      token,
    );

    await this.userRepo.updateGoogleCalendarChannel(
      userId,
      channelId,
      new Date(Number(expiration)),
    );
  }

  /**
   * Stop the existing watch channel.
   */
  async stopWatch(userId: string, resourceId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.channelId) return;

    await this.gcalClient.stopChannel(userId, settings.channelId, resourceId);
    await this.userRepo.updateGoogleCalendarChannel(userId, null, null);
  }

  /**
   * Push all tasks that match sync scope but don't have a calendar_sync entry yet.
   */
  async pushUnsyncedTasks(userId: string): Promise<number> {
    if (!this.taskRepo) throw new Error("TaskRepository not configured");

    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "pull") return 0;

    const tasks = await this.taskRepo.findByUser(userId);
    const syncable = tasks.filter(
      (t) =>
        !t.isCompleted && this.taskMatchesSyncScope(t, settings.syncAll, settings.syncDateRange),
    );
    if (syncable.length === 0) return 0;

    const syncMap = await this.syncRepo.findByTaskIds(syncable.map((t) => t.id));
    const unsynced = syncable.filter((t) => !syncMap.has(t.id));

    let pushed = 0;
    for (const task of unsynced) {
      try {
        await this.pushTask(userId, task);
        pushed++;
      } catch (error) {
        console.error(`Failed to push task ${task.id}:`, error);
      }
    }
    return pushed;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private taskMatchesSyncScope(task: Task, syncAll: boolean, syncDateRange: boolean): boolean {
    if (task.forceCalendarSync && task.dueDate) return true;
    if (!task.dueDate) return false;
    if (syncAll) return true;
    const hasTime = task.dueDate.includes("T");
    if (hasTime) return true;
    return syncDateRange && task.dueDateEnd != null;
  }

  private taskToEvent(task: Task, timeZone: string): GoogleCalendarEventData {
    const hasTime = task.dueDate?.includes("T") ?? false;

    let start: GoogleCalendarEventData["start"];
    let end: GoogleCalendarEventData["end"];

    if (hasTime && task.dueDate) {
      // Time-based event; an end without a time means the end of that day (Google
      // requires both ends of the same type)
      const endValue = task.dueDateEnd
        ? task.dueDateEnd.includes("T")
          ? task.dueDateEnd
          : `${task.dueDateEnd}T23:59`
        : oneHourAfter(toNaiveLocal(task.dueDate, timeZone));

      start = toEventDateTime(task.dueDate, timeZone);
      end = toEventDateTime(endValue, timeZone);
    } else if (task.dueDate) {
      // All-day event — Google Calendar uses exclusive end date
      const dateStr = task.dueDate.slice(0, 10);

      if (task.dueDateEnd) {
        // Multi-day: end date is exclusive, so +1 day
        const endDate = addDays(new Date(task.dueDateEnd.slice(0, 10)), 1);
        end = { date: format(endDate, "yyyy-MM-dd") };
      } else {
        // Single day: end is next day (exclusive)
        const endDate = addDays(new Date(dateStr), 1);
        end = { date: format(endDate, "yyyy-MM-dd") };
      }

      start = { date: dateStr };
    } else {
      // No date — create as today's all-day event
      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
      start = { date: today };
      end = { date: tomorrow };
    }

    const recurrence = task.recurrence ? recurrenceToRrule(task.recurrence) : null;

    return {
      summary: task.title,
      description: task.notes ?? undefined,
      start,
      end,
      status: task.isCompleted ? "cancelled" : "confirmed",
      ...(recurrence ? { recurrence } : {}),
    };
  }
}
