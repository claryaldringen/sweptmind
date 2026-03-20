import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { SharedTask } from "@/domain/entities/shared-task";
import type { ISharedTaskRepository } from "@/domain/repositories/shared-task.repository";

export class DrizzleSharedTaskRepository implements ISharedTaskRepository {
  constructor(private readonly db: Database) {}

  async create(
    connectionId: string,
    sourceTaskId: string,
    targetTaskId: string,
  ): Promise<SharedTask> {
    const [sharedTask] = await this.db
      .insert(schema.sharedTasks)
      .values({ connectionId, sourceTaskId, targetTaskId })
      .returning();
    return sharedTask;
  }

  async findById(id: string): Promise<SharedTask | undefined> {
    return this.db.query.sharedTasks.findFirst({
      where: eq(schema.sharedTasks.id, id),
    });
  }

  async findBySourceTask(taskId: string): Promise<SharedTask[]> {
    return this.db.query.sharedTasks.findMany({
      where: eq(schema.sharedTasks.sourceTaskId, taskId),
    });
  }

  async findByTargetTask(taskId: string): Promise<SharedTask | undefined> {
    return this.db.query.sharedTasks.findFirst({
      where: eq(schema.sharedTasks.targetTaskId, taskId),
    });
  }

  async findByConnection(connectionId: string): Promise<SharedTask[]> {
    return this.db.query.sharedTasks.findMany({
      where: eq(schema.sharedTasks.connectionId, connectionId),
    });
  }

  async deleteByConnection(connectionId: string): Promise<void> {
    await this.db
      .delete(schema.sharedTasks)
      .where(eq(schema.sharedTasks.connectionId, connectionId));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.sharedTasks).where(eq(schema.sharedTasks.id, id));
  }

  async findBySourceTaskIds(taskIds: string[]): Promise<Map<string, SharedTask[]>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.sharedTasks.findMany({
      where: inArray(schema.sharedTasks.sourceTaskId, taskIds),
    });
    const map = new Map<string, SharedTask[]>();
    for (const row of rows) {
      const existing = map.get(row.sourceTaskId) ?? [];
      existing.push(row);
      map.set(row.sourceTaskId, existing);
    }
    return map;
  }

  async findByTargetTaskIds(taskIds: string[]): Promise<Map<string, SharedTask | undefined>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.sharedTasks.findMany({
      where: inArray(schema.sharedTasks.targetTaskId, taskIds),
    });
    const map = new Map<string, SharedTask | undefined>();
    for (const row of rows) {
      map.set(row.targetTaskId, row);
    }
    return map;
  }
}
