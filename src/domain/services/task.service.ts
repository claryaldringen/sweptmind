import type { Task } from "../entities/task";
import type { CreateTaskInput, UpdateTaskInput, ReorderItem } from "../entities/task";
import type { ITaskRepository, PaginationOpts } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IStepRepository } from "../repositories/step.repository";
import type { List } from "../entities/list";
import { computeNextDueDate, computeFirstOccurrence } from "./recurrence";
import { computeDefaultReminder, isFutureTask } from "./task-visibility";
import { format } from "date-fns";

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

export class TaskService {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly listRepo: IListRepository | null = null,
    private readonly stepRepo: IStepRepository | null = null,
  ) {}

  async getByUser(userId: string): Promise<Task[]> {
    return this.taskRepo.findByUser(userId);
  }

  async getVisibleByUser(userId: string, listId?: string | null): Promise<Task[]> {
    const tasks = listId
      ? await this.taskRepo.findByList(listId, userId)
      : await this.taskRepo.findActiveByUser(userId);
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => !t.isCompleted && !isFutureTask(t, today));
  }

  async getFutureByUser(userId: string): Promise<Task[]> {
    const tasks = await this.taskRepo.findActiveByUser(userId);
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => isFutureTask(t, today));
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
    return this.taskRepo.create({
      ...(input.id ? { id: input.id } : {}),
      userId,
      listId: input.listId,
      title: input.title,
      notes: input.notes ?? null,
      dueDate,
      reminderAt: computeDefaultReminder(dueDate),
      locationId: input.locationId ?? null,
      deviceContext: input.deviceContext ?? null,
      sortOrder,
    });
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
          const today = new Date().toISOString().slice(0, 10);
          if (!currentTask.dueDate || currentTask.dueDate.slice(0, 10) < today) {
            const nextDue = computeFirstOccurrence(input.recurrence);
            if (nextDue) {
              updates.dueDate = nextDue;
              updates.reminderAt = computeDefaultReminder(nextDue);
            }
          }
        }
      }
    }
    if (input.listId != null) updates.listId = input.listId;
    if (input.locationId !== undefined) updates.locationId = input.locationId ?? null;
    if (input.locationRadius !== undefined) updates.locationRadius = input.locationRadius ?? null;
    if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;
    if (input.blockedByTaskId !== undefined)
      updates.blockedByTaskId = input.blockedByTaskId ?? null;

    return this.taskRepo.update(id, userId, updates);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    await this.taskRepo.delete(id, userId);
    return true;
  }

  async toggleCompleted(id: string, userId: string): Promise<Task> {
    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new Error("Task not found");

    // Recurring task being completed → reset with next dueDate
    if (!task.isCompleted && task.recurrence) {
      const baseDueDate = task.dueDate ?? format(new Date(), "yyyy-MM-dd");
      const nextDueDate = computeNextDueDate(task.recurrence, baseDueDate);
      return this.taskRepo.update(id, userId, {
        isCompleted: false,
        completedAt: null,
        dueDate: nextDueDate ?? baseDueDate,
        reminderAt: computeDefaultReminder(nextDueDate ?? baseDueDate),
      });
    }

    return this.taskRepo.update(id, userId, {
      isCompleted: !task.isCompleted,
      completedAt: !task.isCompleted ? new Date() : null,
    });
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

  async deleteMany(ids: string[], userId: string): Promise<boolean> {
    await this.taskRepo.deleteMany(ids, userId);
    return true;
  }

  async updateMany(
    ids: string[],
    userId: string,
    input: Partial<
      Pick<Task, "listId" | "dueDate" | "reminderAt" | "recurrence" | "deviceContext">
    >,
  ): Promise<boolean> {
    const data: Partial<Task> = {};
    if (input.listId !== undefined) data.listId = input.listId;
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate;
      data.reminderAt = computeDefaultReminder(input.dueDate);
    }
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
        reminderAt: null,
        sortOrder: i,
      });
    }

    await this.taskRepo.delete(taskId, userId);

    return newList;
  }
}
