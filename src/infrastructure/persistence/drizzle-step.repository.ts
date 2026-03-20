import { eq, asc, desc, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { Step } from "@/domain/entities/task";
import type { IStepRepository } from "@/domain/repositories/step.repository";

export class DrizzleStepRepository implements IStepRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Step | undefined> {
    return this.db.query.steps.findFirst({
      where: eq(schema.steps.id, id),
    });
  }

  async findByTask(taskId: string): Promise<Step[]> {
    return this.db.query.steps.findMany({
      where: eq(schema.steps.taskId, taskId),
      orderBy: asc(schema.steps.sortOrder),
    });
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, Step[]>> {
    if (taskIds.length === 0) return new Map();
    const steps = await this.db.query.steps.findMany({
      where: inArray(schema.steps.taskId, taskIds),
      orderBy: asc(schema.steps.sortOrder),
    });
    const map = new Map<string, Step[]>();
    for (const id of taskIds) map.set(id, []);
    for (const step of steps) map.get(step.taskId)!.push(step);
    return map;
  }

  async findMaxSortOrder(taskId: string): Promise<number | undefined> {
    const row = await this.db.query.steps.findFirst({
      where: eq(schema.steps.taskId, taskId),
      orderBy: desc(schema.steps.sortOrder),
    });
    return row?.sortOrder;
  }

  async create(values: {
    id?: string;
    taskId: string;
    title: string;
    sortOrder: number;
  }): Promise<Step> {
    const [step] = await this.db.insert(schema.steps).values(values).returning();
    return step;
  }

  async update(id: string, data: Partial<Step>): Promise<Step> {
    const [step] = await this.db
      .update(schema.steps)
      .set(data)
      .where(eq(schema.steps.id, id))
      .returning();
    return step;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.steps).where(eq(schema.steps.id, id));
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.delete(schema.steps).where(inArray(schema.steps.id, ids));
  }

  async updateSortOrder(id: string, sortOrder: number): Promise<void> {
    await this.db
      .update(schema.steps)
      .set({ sortOrder })
      .where(eq(schema.steps.id, id));
  }
}
