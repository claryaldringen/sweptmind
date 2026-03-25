import type { Task } from "../entities/task";
import type { CalendarSync } from "../entities/calendar-sync";
import type { ICalendarSyncRepository } from "../repositories/calendar-sync.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { VeventTaskData } from "../entities/calendar";
import { computeDefaultReminder } from "./task-visibility";

export class CalendarService {
  constructor(
    private readonly syncRepo: ICalendarSyncRepository,
    private readonly taskRepo: ITaskRepository,
  ) {}

  async getSyncableTasks(
    userId: string,
    syncAll: boolean,
    syncDateRange: boolean = false,
  ): Promise<Task[]> {
    const tasks = await this.taskRepo.findPlanned(userId);
    if (syncAll) {
      return tasks.filter((t) => t.dueDate != null);
    }
    return tasks.filter(
      (t) =>
        (t.forceCalendarSync && t.dueDate != null) ||
        (t.dueDate != null && (t.dueDate.includes("T") || (syncDateRange && t.dueDateEnd != null))),
    );
  }

  async getSyncEntry(taskId: string): Promise<CalendarSync | undefined> {
    return this.syncRepo.findByTaskId(taskId);
  }

  async getSyncEntryByIcalUid(userId: string, icalUid: string): Promise<CalendarSync | undefined> {
    return this.syncRepo.findByIcalUid(userId, icalUid);
  }

  async upsertFromIcal(
    userId: string,
    defaultListId: string,
    data: VeventTaskData,
  ): Promise<{ task: Task; syncEntry: CalendarSync }> {
    const existing = await this.syncRepo.findByIcalUid(userId, data.icalUid);
    let task: Task;

    if (existing) {
      task = await this.taskRepo.update(existing.taskId, userId, {
        title: data.title,
        notes: data.notes,
        dueDate: data.dueDate,
        reminderAt: computeDefaultReminder(data.dueDate),
        recurrence: data.recurrence,
        isCompleted: data.isCompleted,
        completedAt: data.isCompleted ? new Date() : null,
      });
    } else {
      const minSort = await this.taskRepo.findMinSortOrder(defaultListId);
      task = await this.taskRepo.create({
        userId,
        listId: defaultListId,
        title: data.title,
        notes: data.notes,
        dueDate: data.dueDate,
        reminderAt: computeDefaultReminder(data.dueDate),
        recurrence: data.recurrence,
        sortOrder: (minSort ?? 1) - 1,
      });
      if (data.isCompleted) {
        task = await this.taskRepo.update(task.id, userId, {
          isCompleted: true,
          completedAt: new Date(),
        });
      }
    }

    const etag = `"${task.updatedAt.getTime()}"`;
    const syncEntry = await this.syncRepo.upsert({
      userId,
      taskId: task.id,
      icalUid: data.icalUid,
      etag,
    });

    return { task, syncEntry };
  }

  async deleteFromIcal(userId: string, icalUid: string): Promise<void> {
    const syncEntry = await this.syncRepo.findByIcalUid(userId, icalUid);
    if (!syncEntry) return;
    await this.taskRepo.delete(syncEntry.taskId, userId);
    await this.syncRepo.deleteByIcalUid(userId, icalUid);
  }

  async updateEtag(taskId: string, etag: string): Promise<void> {
    const syncEntry = await this.syncRepo.findByTaskId(taskId);
    if (syncEntry) {
      await this.syncRepo.updateEtag(syncEntry.id, etag);
    }
  }

  generateEtag(task: Task): string {
    return `"${task.updatedAt.getTime()}"`;
  }
}
