import type { Task } from "../entities/task";
import type { IUserRepository } from "../repositories/user.repository";
import type { ICalendarSyncRepository } from "../repositories/calendar-sync.repository";
import type {
  IGoogleCalendarClient,
  GoogleCalendarEventData,
} from "../ports/google-calendar-client";
import { addDays, format } from "date-fns";

export class GoogleCalendarService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly syncRepo: ICalendarSyncRepository,
    private readonly gcalClient: IGoogleCalendarClient,
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
      const created = await this.gcalClient.insertEvent(
        userId,
        settings.calendarId,
        event,
      );

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

    await this.gcalClient.deleteEvent(
      userId,
      settings.calendarId,
      syncEntry.googleCalendarEventId,
    );
    await this.syncRepo.deleteByTaskId(taskId);
  }

  /**
   * Pull changes from Google Calendar using incremental sync.
   */
  async pullChanges(
    userId: string,
  ): Promise<{ items: GoogleCalendarEventData[]; nextSyncToken?: string }> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "push") {
      return { items: [] };
    }

    const result = await this.gcalClient.listEvents(
      userId,
      settings.calendarId,
      settings.syncToken ?? undefined,
    );

    if (result.nextSyncToken) {
      await this.userRepo.updateGoogleCalendarSyncToken(userId, result.nextSyncToken);
    }

    return result;
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
