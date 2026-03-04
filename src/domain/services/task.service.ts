import { format } from "date-fns";
import type { Task } from "../entities/task";
import type { CreateTaskInput, UpdateTaskInput, ReorderItem } from "../entities/task";
import type { ITaskRepository } from "../repositories/task.repository";
import { computeNextDueDate } from "./recurrence";
import { computeDefaultReminder } from "./task-visibility";

export class TaskService {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async getById(id: string, userId: string): Promise<Task | undefined> {
    return this.taskRepo.findById(id, userId);
  }

  async getByList(listId: string, userId: string): Promise<Task[]> {
    return this.taskRepo.findByList(listId, userId);
  }

  async getPlanned(userId: string): Promise<Task[]> {
    return this.taskRepo.findPlanned(userId);
  }

  async getWithLocation(userId: string): Promise<Task[]> {
    return this.taskRepo.findWithLocation(userId);
  }

  async create(userId: string, input: CreateTaskInput): Promise<Task> {
    const minSort = await this.taskRepo.findMinSortOrder(input.listId);
    const sortOrder = (minSort ?? 1) - 1;

    const dueDate = input.dueDate ?? null;
    return this.taskRepo.create({
      userId,
      listId: input.listId,
      title: input.title,
      notes: input.notes ?? null,
      dueDate,
      reminderAt: computeDefaultReminder(dueDate),
      locationId: input.locationId ?? null,
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
    if (input.recurrence !== undefined) updates.recurrence = input.recurrence ?? null;
    if (input.listId != null) updates.listId = input.listId;
    if (input.locationId !== undefined) updates.locationId = input.locationId ?? null;

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
    if (!task.isCompleted && task.recurrence && task.dueDate) {
      const nextDueDate = computeNextDueDate(task.recurrence, task.dueDate);
      return this.taskRepo.update(id, userId, {
        isCompleted: false,
        completedAt: null,
        dueDate: nextDueDate ?? task.dueDate,
        reminderAt: computeDefaultReminder(nextDueDate ?? task.dueDate),
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

  async countActiveByList(listId: string): Promise<number> {
    return this.taskRepo.countActiveByList(listId);
  }

  async countVisibleByList(listId: string): Promise<number> {
    const today = format(new Date(), "yyyy-MM-dd");
    return this.taskRepo.countVisibleByList(listId, today);
  }

  async getByListId(listId: string): Promise<Task[]> {
    return this.taskRepo.findByListId(listId);
  }
}
