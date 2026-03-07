import { eq, and, inArray, count } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { Tag } from "@/domain/entities/tag";
import type { ITagRepository } from "@/domain/repositories/tag.repository";

export class DrizzleTagRepository implements ITagRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string): Promise<Tag[]> {
    return this.db.query.tags.findMany({
      where: eq(schema.tags.userId, userId),
      orderBy: schema.tags.name,
    });
  }

  async findByTask(taskId: string): Promise<Tag[]> {
    const rows = await this.db.query.taskTags.findMany({
      where: eq(schema.taskTags.taskId, taskId),
      with: { tag: true },
    });
    return rows.map((r) => r.tag);
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, Tag[]>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.taskTags.findMany({
      where: inArray(schema.taskTags.taskId, taskIds),
      with: { tag: true },
    });
    const map = new Map<string, Tag[]>();
    for (const id of taskIds) map.set(id, []);
    for (const row of rows) map.get(row.taskId)!.push(row.tag);
    return map;
  }

  async findById(id: string, userId: string): Promise<Tag | undefined> {
    return this.db.query.tags.findFirst({
      where: and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)),
    });
  }

  async create(values: { userId: string; name: string; color: string }): Promise<Tag> {
    const [tag] = await this.db.insert(schema.tags).values(values).returning();
    return tag;
  }

  async update(id: string, userId: string, data: Partial<Tag>): Promise<Tag> {
    const [tag] = await this.db
      .update(schema.tags)
      .set(data)
      .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)))
      .returning();
    return tag;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.tags)
      .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)));
  }

  async addToTask(taskId: string, tagId: string): Promise<void> {
    await this.db.insert(schema.taskTags).values({ taskId, tagId }).onConflictDoNothing();
  }

  async removeFromTask(taskId: string, tagId: string): Promise<void> {
    await this.db
      .delete(schema.taskTags)
      .where(and(eq(schema.taskTags.taskId, taskId), eq(schema.taskTags.tagId, tagId)));
  }

  async countTasksByTag(tagId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(schema.taskTags)
      .where(eq(schema.taskTags.tagId, tagId));
    return row?.count ?? 0;
  }

  async countTasksByTags(tagIds: string[]): Promise<Map<string, number>> {
    if (tagIds.length === 0) return new Map();
    const rows = await this.db
      .select({ tagId: schema.taskTags.tagId, count: count() })
      .from(schema.taskTags)
      .where(inArray(schema.taskTags.tagId, tagIds))
      .groupBy(schema.taskTags.tagId);
    const map = new Map<string, number>();
    for (const id of tagIds) map.set(id, 0);
    for (const row of rows) map.set(row.tagId, row.count);
    return map;
  }
}
