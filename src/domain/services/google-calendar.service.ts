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

    const event = this.taskToEvent(task);
    const syncEntry = await this.syncRepo.findByTaskId(task.id);

    if (syncEntry?.googleCalendarEventId) {
      // Patch existing event
      await this.gcalClient.patchEvent(
        userId,
        settings.calendarId,
        syncEntry.googleCalendarEventId,
        event,
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

    for (const event of result.items) {
      if (!event.id) continue;

      // Skip events we pushed (our icalUid convention)
      const existingByIcal = await this.syncRepo.findByIcalUid(userId, `sweptmind-${event.id}`);
      if (existingByIcal) continue;

      const cancelled = event.status === "cancelled";
      const syncEntry = await this.syncRepo.findByGoogleEventId(userId, event.id);

      if (cancelled) {
        // Event deleted in Google Calendar → delete task
        if (syncEntry) {
          await this.taskRepo.delete(syncEntry.taskId, userId);
          await this.syncRepo.deleteByTaskId(syncEntry.taskId);
        }
        continue;
      }

      const dueDate = this.eventToDueDate(event);
      const dueDateEnd = this.eventToDueDateEnd(event);

      if (syncEntry) {
        // Update existing task
        await this.taskRepo.update(syncEntry.taskId, userId, {
          title: event.summary,
          notes: event.description ?? null,
          dueDate,
          dueDateEnd,
          reminderAt: computeDefaultReminder(dueDate),
        });
        await this.syncRepo.updateEtag(syncEntry.id, `"${Date.now()}"`);
      } else {
        // Create new task
        const minSort = await this.taskRepo.findMinSortOrder(targetListId);
        const task = await this.taskRepo.create({
          userId,
          listId: targetListId,
          title: event.summary,
          notes: event.description ?? null,
          dueDate,
          dueDateEnd,
          reminderAt: computeDefaultReminder(dueDate),
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
  }

  /**
   * Register a webhook watch channel for push notifications.
   */
  async registerWatch(userId: string, webhookUrl: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled) return;

    const channelId = crypto.randomUUID();
    const { expiration } = await this.gcalClient.watchEvents(
      userId,
      settings.calendarId,
      channelId,
      webhookUrl,
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private eventToDueDate(event: GoogleCalendarEventData): string | null {
    if ("dateTime" in event.start && event.start.dateTime) {
      return event.start.dateTime;
    }
    if ("date" in event.start && event.start.date) {
      return event.start.date;
    }
    return null;
  }

  private eventToDueDateEnd(event: GoogleCalendarEventData): string | null {
    if ("dateTime" in event.end && event.end.dateTime) {
      return event.end.dateTime;
    }
    if ("date" in event.end && event.end.date) {
      // Google uses exclusive end date for all-day events, subtract 1 day
      const endDate = addDays(new Date(event.end.date), -1);
      const endStr = format(endDate, "yyyy-MM-dd");
      // If start == end (single day), no end date needed
      if ("date" in event.start && event.start.date === endStr) return null;
      return endStr;
    }
    return null;
  }

  private taskToEvent(task: Task): GoogleCalendarEventData {
    const hasTime = task.dueDate?.includes("T") ?? false;

    let start: GoogleCalendarEventData["start"];
    let end: GoogleCalendarEventData["end"];

    if (hasTime && task.dueDate) {
      // Time-based event
      const startIso = task.dueDate;

      if (task.dueDateEnd) {
        // Explicit end time
        end = { dateTime: task.dueDateEnd };
      } else {
        // Default duration: 1 hour
        const startDate = new Date(task.dueDate);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        end = { dateTime: endDate.toISOString() };
      }

      start = { dateTime: startIso };
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

    return {
      summary: task.title,
      description: task.notes ?? undefined,
      start,
      end,
      status: task.isCompleted ? "cancelled" : "confirmed",
    };
  }
}
