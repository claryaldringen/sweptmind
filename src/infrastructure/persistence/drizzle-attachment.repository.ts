import { eq, inArray, sql, asc } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { IAttachmentRepository } from "@/domain/repositories/attachment.repository";
import type {
  TaskAttachment,
  CreateAttachmentInput,
} from "@/domain/entities/task-attachment";

export class DrizzleAttachmentRepository implements IAttachmentRepository {
  constructor(private readonly db: Database) {}

  async findByTaskId(taskId: string): Promise<TaskAttachment[]> {
    return this.db.query.taskAttachments.findMany({
      where: eq(schema.taskAttachments.taskId, taskId),
      orderBy: asc(schema.taskAttachments.createdAt),
    });
  }

  async findByTaskIds(
    taskIds: string[],
  ): Promise<Map<string, TaskAttachment[]>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.taskAttachments.findMany({
      where: inArray(schema.taskAttachments.taskId, taskIds),
      orderBy: asc(schema.taskAttachments.createdAt),
    });
    const map = new Map<string, TaskAttachment[]>();
    for (const id of taskIds) map.set(id, []);
    for (const row of rows) map.get(row.taskId)!.push(row);
    return map;
  }

  async findById(id: string): Promise<TaskAttachment | undefined> {
    return this.db.query.taskAttachments.findFirst({
      where: eq(schema.taskAttachments.id, id),
    });
  }

  async create(input: CreateAttachmentInput): Promise<TaskAttachment> {
    const [attachment] = await this.db
      .insert(schema.taskAttachments)
      .values(input)
      .returning();
    return attachment;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(schema.taskAttachments)
      .where(eq(schema.taskAttachments.id, id));
  }

  async getTotalSizeByUser(userId: string): Promise<number> {
    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.taskAttachments.fileSize}), 0)`,
      })
      .from(schema.taskAttachments)
      .innerJoin(schema.tasks, eq(schema.taskAttachments.taskId, schema.tasks.id))
      .where(eq(schema.tasks.userId, userId));
    return Number(result[0]?.total ?? 0);
  }
}
