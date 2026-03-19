import { eq } from "drizzle-orm";
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
}
