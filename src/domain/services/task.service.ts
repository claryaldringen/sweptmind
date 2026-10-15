import type { Task } from "../entities/task";
import type { CreateTaskInput, UpdateTaskInput, ReorderItem } from "../entities/task";
import type { ITaskRepository, PaginationOpts } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IStepRepository } from "../repositories/step.repository";
import type { List } from "../entities/list";
import type { IUserRepository } from "../repositories/user.repository";
import { alignDueDateToRecurrence, nextOccurrenceFrom } from "./recurrence";
import { computeDefaultReminder } from "./task-visibility";
import { resolveTimeZone, toLocalDateTime } from "./task-notifications";
import { format } from "date-fns";
import type { TaskSharingService } from "./task-sharing.service";
import type { ITagRepository } from "../repositories/tag.repository";

export interface ImportTaskInput {
  title: string;
  dueDate?: string | null;
  notes?: string | null;
  isCompleted?: boolean | null;
  listName?: string | null;
}

export interface ImportTasksResult {
  importedCount: number;
  createdLists: string[];
}

/** End of a date range moved along with its start to `nextDueDate` (same length). */
function shiftRangeEnd(task: Task, nextDueDate: string): string | undefined {
  if (!task.dueDateEnd || !task.dueDate) return undefined;
  const startMs = new Date(task.dueDate.split("T")[0]).getTime();
  const endMs = new Date(task.dueDateEnd.split("T")[0]).getTime();
  const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  if (durationDays <= 0) return undefined;
  const newEnd = new Date(nextDueDate.split("T")[0]);
  newEnd.setDate(newEnd.getDate() + durationDays);
  const endTimeSuffix = task.dueDateEnd.includes("T") ? "T" + task.dueDateEnd.split("T")[1] : "";
  return format(newEnd, "yyyy-MM-dd") + endTimeSuffix;
}

export class TaskService {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly listRepo: IListRepository | null = null,
    private readonly stepRepo: IStepRepository | null = null,
    private readonly googleCalendarService?: {
      pushTask(userId: string, task: Task): Promise<void>;
      deleteTaskEvent(userId: string, taskId: string): Promise<void>;
    },
    private readonly taskSharingService?: TaskSharingService,
    private readonly tagRepo?: ITagRepository,
    private readonly userRepo?: Pick<IUserRepository, "getTimeZone">,
  ) {}

  /** Today's date in the user's time zone (the server runs in UTC). */
  private async localToday(userId: string): Promise<string> {
    const timeZone = await this.userRepo?.getTimeZone(userId).catch(() => null);
    return toLocalDateTime(new Date(), resolveTimeZone(timeZone)).date;
  }

  async getByUser(userId: string): Promise<Task[]> {
    return this.taskRepo.findByUser(userId);
  }

  async getActiveByUser(userId: string): Promise<Task[]> {
    return this.taskRepo.findActiveByUser(userId);
  }

  async getCompletedByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ tasks: Task[]; hasMore: boolean }> {
    const tasks = await this.taskRepo.findCompletedByUser(userId, limit + 1, offset);
    const hasMore = tasks.length > limit;
    return { tasks: tasks.slice(0, limit), hasMore };
  }

  async getById(id: string, userId: string): Promise<Task | undefined> {
    return this.taskRepo.findById(id, userId);
  }

  async getByList(listId: string, userId: string, opts?: PaginationOpts): Promise<Task[]> {
    return this.taskRepo.findByList(listId, userId, opts);
  }

  async getPlanned(userId: string, opts?: PaginationOpts): Promise<Task[]> {
    return this.taskRepo.findPlanned(userId, opts);
  }

  async getWithLocation(userId: string, opts?: PaginationOpts): Promise<Task[]> {
    return this.taskRepo.findWithLocation(userId, opts);
  }

  async getContextTasks(
    userId: string,
    deviceContext: string | null,
    nearbyLocationIds: string[],
  ): Promise<Task[]> {
    return this.taskRepo.findContextTasks(userId, deviceContext, nearbyLocationIds);
  }

  async create(userId: string, input: CreateTaskInput): Promise<Task> {
    const minSort = await this.taskRepo.findMinSortOrder(input.listId);
    const sortOrder = (minSort ?? 1) - 1;

    const dueDate = input.dueDate ?? null;
    const created = await this.taskRepo.create({
      ...(input.id ? { id: input.id } : {}),
      userId,
      listId: input.listId,
      title: input.title,
      notes: input.notes ?? null,
      dueDate,
      dueDateEnd: input.dueDateEnd ?? null,
      reminderAt: computeDefaultReminder(dueDate),
      locationId: input.locationId ?? null,
      deviceContext: input.deviceContext ?? null,
      sortOrder,
    });

    if (this.googleCalendarService && created.dueDate) {
      this.googleCalendarService
        .pushTask(userId, created)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }

    return created;
  }

  async update(id: string, userId: string, input: UpdateTaskInput): Promise<Task> {
    const updates: Partial<Task> = {};
    if (input.title != null) updates.title = input.title;
    if (input.notes !== undefined) updates.notes = input.notes ?? null;
    if (input.dueDate !== undefined) {
      updates.dueDate = input.dueDate ?? null;
      // Auto-compute reminderAt when dueDate changes (unless reminderAt is explicitly set)
      if (input.reminderAt === undefined) {
        updates.reminderAt = computeDefaultReminder(updates.dueDate);
      }
    }
    if (input.reminderAt !== undefined) {
      updates.reminderAt = input.reminderAt || null;
    }
    if (input.recurrence !== undefined) {
      updates.recurrence = input.recurrence ?? null;

      // Auto-set dueDate when recurrence is configured and dueDate is missing or past
      if (input.recurrence && input.dueDate === undefined) {
        const currentTask = await this.taskRepo.findById(id, userId);
        if (currentTask) {
          const today = await this.localToday(userId);
          if (!currentTask.dueDate || currentTask.dueDate.slice(0, 10) < today) {
            const aligned = alignDueDateToRecurrence(input.recurrence, currentTask, today);
            if (aligned) {
              updates.dueDate = aligned.dueDate;
              if (input.dueDateEnd === undefined) updates.dueDateEnd = aligned.dueDateEnd;
              updates.reminderAt = computeDefaultReminder(aligned.dueDate);
            }
          }
        }
      }
    }
    if (input.dueDateEnd !== undefined) {
      updates.dueDateEnd = input.dueDateEnd ?? null;
    }
    // Clearing dueDate always clears dueDateEnd (takes precedence over explicit dueDateEnd)
    if (input.dueDate === null) {
      updates.dueDateEnd = null;
    }
    if (input.listId != null) updates.listId = input.listId;
    if (input.locationId !== undefined) updates.locationId = input.locationId ?? null;
    if (input.locationRadius !== undefined) updates.locationRadius = input.locationRadius ?? null;
    if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;
    if (input.blockedByTaskId !== undefined)
      updates.blockedByTaskId = input.blockedByTaskId ?? null;
    if (input.forceCalendarSync !== undefined)
      updates.forceCalendarSync = input.forceCalendarSync ?? false;
    if (input.skipMissedRecurrence !== undefined)
      updates.skipMissedRecurrence = input.skipMissedRecurrence ?? false;

    const updated = await this.taskRepo.update(id, userId, updates);

    if (this.googleCalendarService && updated.dueDate) {
      this.googleCalendarService
        .pushTask(userId, updated)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    } else if (this.googleCalendarService && !updated.dueDate) {
      this.googleCalendarService
        .deleteTaskEvent(userId, id)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }

    if (this.taskSharingService) {
      this.taskSharingService
        .syncSharedFields(id, updates)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }

    return updated;
  }

  /**
   * `deleteFromCalendar` also removes the task's Google Calendar event (the user is asked
   * in the UI). It must run before the task is deleted — the calendar link is deleted
   * with the task.
   */
  async delete(
    id: string,
    userId: string,
    options: { deleteFromCalendar?: boolean } = {},
  ): Promise<boolean> {
    if (options.deleteFromCalendar) await this.deleteCalendarEvents(userId, [id]);
    await this.taskRepo.delete(id, userId);

    if (this.taskSharingService) {
      this.taskSharingService
        .notifyOwnerAction(id, "deleted")
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }

    return true;
  }

  async toggleCompleted(id: string, userId: string): Promise<Task> {
    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new Error("Task not found");

    // Recurring task being completed → reset with next dueDate. Occurrences already in
    // the past are skipped — completing it late shouldn't leave it overdue again.
    if (!task.isCompleted && task.recurrence) {
      const today = await this.localToday(userId);
      const baseDueDate = task.dueDate ?? today;
      const nextDueDate = nextOccurrenceFrom(task.recurrence, baseDueDate, today);
      const recurrenceUpdates: Partial<Task> = {
        isCompleted: false,
        completedAt: null,
        dueDate: nextDueDate ?? baseDueDate,
        reminderAt: computeDefaultReminder(nextDueDate ?? baseDueDate),
      };
      const dueDateEnd = nextDueDate ? shiftRangeEnd(task, nextDueDate) : undefined;
      if (dueDateEnd) recurrenceUpdates.dueDateEnd = dueDateEnd;

      const toggled = await this.taskRepo.update(id, userId, recurrenceUpdates);

      if (this.googleCalendarService && toggled.dueDate) {
        this.googleCalendarService
          .pushTask(userId, toggled)
          .catch((err) => console.error("[TaskService] background operation failed:", err));
      }

      return toggled;
    }

    const toggled = await this.taskRepo.update(id, userId, {
      isCompleted: !task.isCompleted,
      completedAt: !task.isCompleted ? new Date() : null,
    });

    if (this.googleCalendarService && toggled.dueDate) {
      this.googleCalendarService
        .pushTask(userId, toggled)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }

    if (this.taskSharingService && toggled.isCompleted) {
      this.taskSharingService
        .notifyOwnerAction(id, "completed")
        .catch((err) => console.error("[TaskService] background operation failed:", err));
      this.taskSharingService
        .evaluateCompletionRule(id, userId)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }

    return toggled;
  }

  /**
   * Moves a recurring task whose occurrence was missed (its day passed unfinished) to the
   * next occurrence — today at the earliest — when the task is set to skip missed
   * occurrences. Returns the moved task, or null when there's nothing to move.
   */
  async skipMissedOccurrence(id: string, userId: string, today: string): Promise<Task | null> {
    const task = await this.taskRepo.findById(id, userId);
    if (!task || task.isCompleted || !task.recurrence || !task.skipMissedRecurrence) return null;
    if (!task.dueDate || task.dueDate.slice(0, 10) >= today) return null;

    const nextDueDate = nextOccurrenceFrom(task.recurrence, task.dueDate, today, {
      includeToday: true,
    });
    if (!nextDueDate) return null;

    const updates: Partial<Task> = {
      dueDate: nextDueDate,
      reminderAt: computeDefaultReminder(nextDueDate),
    };
    const dueDateEnd = shiftRangeEnd(task, nextDueDate);
    if (dueDateEnd) updates.dueDateEnd = dueDateEnd;

    const moved = await this.taskRepo.update(id, userId, updates);
    if (this.googleCalendarService && moved.dueDate) {
      this.googleCalendarService
        .pushTask(userId, moved)
        .catch((err) => console.error("[TaskService] background operation failed:", err));
    }
    return moved;
  }
  async reorder(userId: string, items: ReorderItem[]): Promise<boolean> {
    for (const item of items) {
      await this.taskRepo.updateSortOrder(item.id, userId, item.sortOrder);
    }
    return true;
  }

  async getByListId(listId: string, userId: string): Promise<Task[]> {
    return this.taskRepo.findByListId(listId, userId);
  }

  async importTasks(userId: string, tasks: ImportTaskInput[]): Promise<ImportTasksResult> {
    if (!this.listRepo) throw new Error("ListRepository not configured for import");

    const userLists = await this.listRepo.findByUser(userId);
    const listMap = new Map<string, string>(); // listName → listId
    const createdLists: string[] = [];

    // Find default list
    const defaultList = userLists.find((l) => l.isDefault);
    if (!defaultList) throw new Error("Default list not found");

    // Pre-map existing lists by name (case-insensitive)
    for (const list of userLists) {
      listMap.set(list.name.toLowerCase(), list.id);
    }

    // Resolve list IDs for all unique list names
    const uniqueListNames = [
      ...new Set(tasks.map((t) => t.listName?.trim()).filter((n): n is string => !!n)),
    ];
    for (const name of uniqueListNames) {
      if (!listMap.has(name.toLowerCase())) {
        const maxSort = await this.listRepo.findMaxSortOrder(userId);
        const newList = await this.listRepo.create({
          userId,
          name,
          sortOrder: (maxSort ?? -1) + 1,
        });
        listMap.set(name.toLowerCase(), newList.id);
        createdLists.push(name);
      }
    }

    let importedCount = 0;
    for (const task of tasks) {
      if (!task.title?.trim()) continue;

      const listId = task.listName?.trim()
        ? (listMap.get(task.listName.trim().toLowerCase()) ?? defaultList.id)
        : defaultList.id;

      const minSort = await this.taskRepo.findMinSortOrder(listId);
      const sortOrder = (minSort ?? 1) - 1;

      const dueDate = task.dueDate ?? null;
      const created = await this.taskRepo.create({
        userId,
        listId,
        title: task.title.trim(),
        notes: task.notes ?? null,
        dueDate,
        dueDateEnd: null,
        reminderAt: computeDefaultReminder(dueDate),
        sortOrder,
      });

      if (task.isCompleted) {
        await this.taskRepo.update(created.id, userId, {
          isCompleted: true,
          completedAt: new Date(),
        });
      }

      importedCount++;
    }

    return { importedCount, createdLists };
  }

  async setDependency(
    taskId: string,
    userId: string,
    blockedByTaskId: string | null,
  ): Promise<Task> {
    if (blockedByTaskId === null) {
      return this.taskRepo.update(taskId, userId, { blockedByTaskId: null });
    }

    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    // Check for circular dependency: follow chain from blocker
    let currentId: string | null = blockedByTaskId;
    const visited = new Set<string>([taskId]);
    while (currentId) {
      if (visited.has(currentId)) throw new Error("Circular dependency");
      visited.add(currentId);
      const current = await this.taskRepo.findById(currentId, userId);
      currentId = current?.blockedByTaskId ?? null;
    }

    return this.taskRepo.update(taskId, userId, { blockedByTaskId });
  }

  async deleteMany(
    ids: string[],
    userId: string,
    options: { deleteFromCalendar?: boolean } = {},
  ): Promise<boolean> {
    if (options.deleteFromCalendar) await this.deleteCalendarEvents(userId, ids);
    await this.taskRepo.deleteMany(ids, userId);
    return true;
  }

  /** Best effort — a Google failure must not prevent deleting the task. */
  private async deleteCalendarEvents(userId: string, ids: string[]): Promise<void> {
    if (!this.googleCalendarService) return;
    for (const id of ids) {
      await this.googleCalendarService
        .deleteTaskEvent(userId, id)
        .catch((err) => console.error("[TaskService] calendar event deletion failed:", err));
    }
  }

  async updateMany(
    ids: string[],
    userId: string,
    input: Partial<
      Pick<
        Task,
        "listId" | "dueDate" | "dueDateEnd" | "reminderAt" | "recurrence" | "deviceContext"
      >
    >,
  ): Promise<boolean> {
    const data: Partial<Task> = {};
    if (input.listId !== undefined) data.listId = input.listId;
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate;
      data.reminderAt = computeDefaultReminder(input.dueDate);
    }
    if (input.dueDateEnd !== undefined) data.dueDateEnd = input.dueDateEnd;
    if (input.recurrence !== undefined) data.recurrence = input.recurrence;
    if (input.deviceContext !== undefined) data.deviceContext = input.deviceContext;
    await this.taskRepo.updateMany(ids, userId, data);
    return true;
  }

  async setManyCompleted(ids: string[], userId: string, isCompleted: boolean): Promise<boolean> {
    await this.taskRepo.updateMany(ids, userId, {
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    });
    return true;
  }

  async searchTasks(userId: string, query: string, tagIds?: string[]): Promise<Task[]> {
    return this.taskRepo.searchTasks(userId, query, tagIds);
  }

  async convertToList(taskId: string, userId: string): Promise<List> {
    if (!this.listRepo) throw new Error("ListRepository not configured");
    if (!this.stepRepo) throw new Error("StepRepository not configured");

    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    const steps = await this.stepRepo.findByTask(taskId);

    const maxSort = await this.listRepo.findMaxSortOrder(userId);
    const newList = await this.listRepo.create({
      userId,
      name: task.title,
      sortOrder: (maxSort ?? -1) + 1,
    });

    for (let i = 0; i < steps.length; i++) {
      await this.taskRepo.create({
        userId,
        listId: newList.id,
        title: steps[i].title,
        notes: null,
        dueDate: null,
        dueDateEnd: null,
        reminderAt: null,
        sortOrder: i,
      });
    }

    await this.taskRepo.delete(taskId, userId);

    return newList;
  }

  async clone(id: string, userId: string): Promise<Task> {
    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new Error("Task not found");
    if (!this.stepRepo) throw new Error("StepRepository not configured");

    const minSort = await this.taskRepo.findMinSortOrder(task.listId);
    const sortOrder = (minSort ?? 1) - 1;

    const cloned = await this.taskRepo.create({
      userId,
      listId: task.listId,
      title: task.title,
      notes: task.notes,
      dueDate: null,
      dueDateEnd: null,
      reminderAt: null,
      recurrence: null,
      locationId: task.locationId,
      locationRadius: task.locationRadius,
      deviceContext: task.deviceContext,
      sortOrder,
    });

    const steps = await this.stepRepo.findByTask(id);
    for (const step of steps) {
      await this.stepRepo.create({
        taskId: cloned.id,
        title: step.title,
        sortOrder: step.sortOrder,
      });
    }

    if (this.tagRepo) {
      const tags = await this.tagRepo.findByTask(id);
      for (const tag of tags) {
        await this.tagRepo.addToTask(cloned.id, tag.id);
      }
    }

    return cloned;
  }
}
