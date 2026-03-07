import { eq, and, or, isNotNull, asc, desc, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { Task } from "@/domain/entities/task";
import type { ITaskRepository, PaginationOpts } from "@/domain/repositories/task.repository";
import { isFutureTask } from "@/domain/services/task-visibility";

export class DrizzleTaskRepository implements ITaskRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string, userId: string): Promise<Task | undefined> {
    return this.db.query.tasks.findFirst({
      where: and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)),
    });
  }

  async findByList(listId: string, userId: string, opts?: PaginationOpts): Promise<Task[]> {
    return this.db.query.tasks.findMany({
      where: and(eq(schema.tasks.listId, listId), eq(schema.tasks.userId, userId)),
      orderBy: asc(schema.tasks.sortOrder),
      ...(opts?.limit != null && { limit: opts.limit }),
      ...(opts?.offset != null && { offset: opts.offset }),
    });
  }

  async findPlanned(userId: string, opts?: PaginationOpts): Promise<Task[]> {
    return this.db.query.tasks.findMany({
      where: and(isNotNull(schema.tasks.dueDate), eq(schema.tasks.userId, userId)),
      orderBy: asc(schema.tasks.dueDate),
      ...(opts?.limit != null && { limit: opts.limit }),
      ...(opts?.offset != null && { offset: opts.offset }),
    });
  }

  async findMaxSortOrder(listId: string): Promise<number | undefined> {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.listId, listId),
      orderBy: desc(schema.tasks.sortOrder),
    });
    return row?.sortOrder;
  }

  async findMinSortOrder(listId: string): Promise<number | undefined> {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.listId, listId),
      orderBy: asc(schema.tasks.sortOrder),
    });
    return row?.sortOrder;
  }

  async create(
    values: Partial<Task> & { userId: string; listId: string; title: string; sortOrder: number },
  ): Promise<Task> {
    const [task] = await this.db.insert(schema.tasks).values(values).returning();
    return task;
  }

  async update(id: string, userId: string, data: Partial<Task>): Promise<Task> {
    const [task] = await this.db
      .update(schema.tasks)
      .set(data)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)))
      .returning();
    return task;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.tasks)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)));
  }

  async updateSortOrder(id: string, userId: string, sortOrder: number): Promise<void> {
    await this.db
      .update(schema.tasks)
      .set({ sortOrder })
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)));
  }

  async countActiveByList(listId: string): Promise<number> {
    const tasks = await this.db.query.tasks.findMany({
      where: and(eq(schema.tasks.listId, listId), eq(schema.tasks.isCompleted, false)),
    });
    return tasks.length;
  }

  async countVisibleByList(listId: string, today: string): Promise<number> {
    const tasks = await this.db.query.tasks.findMany({
      where: and(eq(schema.tasks.listId, listId), eq(schema.tasks.isCompleted, false)),
    });
    return tasks.filter((t) => !isFutureTask(t, today)).length;
  }

  async countActiveByListIds(listIds: string[]): Promise<Map<string, number>> {
    if (listIds.length === 0) return new Map();
    const tasks = await this.db.query.tasks.findMany({
      where: and(inArray(schema.tasks.listId, listIds), eq(schema.tasks.isCompleted, false)),
      columns: { listId: true },
    });
    const map = new Map<string, number>();
    for (const id of listIds) map.set(id, 0);
    for (const t of tasks) map.set(t.listId, (map.get(t.listId) ?? 0) + 1);
    return map;
  }

  async countVisibleByListIds(listIds: string[], today: string): Promise<Map<string, number>> {
    if (listIds.length === 0) return new Map();
    const tasks = await this.db.query.tasks.findMany({
      where: and(inArray(schema.tasks.listId, listIds), eq(schema.tasks.isCompleted, false)),
    });
    const map = new Map<string, number>();
    for (const id of listIds) map.set(id, 0);
    for (const t of tasks) {
      if (!isFutureTask(t, today)) {
        map.set(t.listId, (map.get(t.listId) ?? 0) + 1);
      }
    }
    return map;
  }

  async findByListId(listId: string): Promise<Task[]> {
    return this.db.query.tasks.findMany({
      where: eq(schema.tasks.listId, listId),
      orderBy: asc(schema.tasks.sortOrder),
    });
  }

  async findWithLocation(userId: string, opts?: PaginationOpts): Promise<Task[]> {
    // Find list IDs that have a location
    const locatedLists = await this.db.query.lists.findMany({
      where: and(eq(schema.lists.userId, userId), isNotNull(schema.lists.locationId)),
      columns: { id: true },
    });
    const locatedListIds = locatedLists.map((l) => l.id);

    // Find task IDs from tags that have a location
    const locatedTags = await this.db.query.tags.findMany({
      where: and(eq(schema.tags.userId, userId), isNotNull(schema.tags.locationId)),
      columns: { id: true },
    });
    let locatedTagTaskIds: string[] = [];
    if (locatedTags.length > 0) {
      const tagTaskRows = await this.db.query.taskTags.findMany({
        where: inArray(
          schema.taskTags.tagId,
          locatedTags.map((t) => t.id),
        ),
        columns: { taskId: true },
      });
      locatedTagTaskIds = tagTaskRows.map((r) => r.taskId);
    }

    const orConditions = [isNotNull(schema.tasks.locationId)];
    if (locatedListIds.length > 0) {
      orConditions.push(inArray(schema.tasks.listId, locatedListIds));
    }
    if (locatedTagTaskIds.length > 0) {
      orConditions.push(inArray(schema.tasks.id, locatedTagTaskIds));
    }

    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        eq(schema.tasks.isCompleted, false),
        or(...orConditions),
      ),
      orderBy: asc(schema.tasks.sortOrder),
      ...(opts?.limit != null && { limit: opts.limit }),
      ...(opts?.offset != null && { offset: opts.offset }),
    });
  }

  async findByTagId(tagId: string, userId: string): Promise<Task[]> {
    const taskTagRows = await this.db.query.taskTags.findMany({
      where: eq(schema.taskTags.tagId, tagId),
    });
    const taskIds = taskTagRows.map((r) => r.taskId);
    if (taskIds.length === 0) return [];
    return this.db.query.tasks.findMany({
      where: and(inArray(schema.tasks.id, taskIds), eq(schema.tasks.userId, userId)),
      orderBy: asc(schema.tasks.sortOrder),
    });
  }

  async findContextTasks(
    userId: string,
    deviceContext: string | null,
    locationIds: string[],
  ): Promise<Task[]> {
    // 1. Find lists matching device or location context
    const contextListConditions = [];
    if (deviceContext) {
      contextListConditions.push(eq(schema.lists.deviceContext, deviceContext));
    }
    if (locationIds.length > 0) {
      contextListConditions.push(inArray(schema.lists.locationId, locationIds));
    }

    let contextListIds: string[] = [];
    if (contextListConditions.length > 0) {
      const contextLists = await this.db.query.lists.findMany({
        where: and(eq(schema.lists.userId, userId), or(...contextListConditions)),
        columns: { id: true },
      });
      contextListIds = contextLists.map((l) => l.id);
    }

    // 2. Find tags matching device or location context
    const contextTagConditions = [];
    if (deviceContext) {
      contextTagConditions.push(eq(schema.tags.deviceContext, deviceContext));
    }
    if (locationIds.length > 0) {
      contextTagConditions.push(inArray(schema.tags.locationId, locationIds));
    }

    let contextTagTaskIds: string[] = [];
    if (contextTagConditions.length > 0) {
      const contextTags = await this.db.query.tags.findMany({
        where: and(eq(schema.tags.userId, userId), or(...contextTagConditions)),
        columns: { id: true },
      });
      const contextTagIds = contextTags.map((t) => t.id);
      if (contextTagIds.length > 0) {
        const tagTaskRows = await this.db.query.taskTags.findMany({
          where: inArray(schema.taskTags.tagId, contextTagIds),
          columns: { taskId: true },
        });
        contextTagTaskIds = tagTaskRows.map((r) => r.taskId);
      }
    }

    // 3. Build task conditions: direct match OR list match OR tag match
    const taskConditions = [];
    if (deviceContext) {
      taskConditions.push(eq(schema.tasks.deviceContext, deviceContext));
    }
    if (locationIds.length > 0) {
      taskConditions.push(inArray(schema.tasks.locationId, locationIds));
    }
    if (contextListIds.length > 0) {
      taskConditions.push(inArray(schema.tasks.listId, contextListIds));
    }
    if (contextTagTaskIds.length > 0) {
      taskConditions.push(inArray(schema.tasks.id, contextTagTaskIds));
    }

    if (taskConditions.length === 0) return [];

    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        eq(schema.tasks.isCompleted, false),
        or(...taskConditions),
      ),
      orderBy: asc(schema.tasks.sortOrder),
    });
  }
}
