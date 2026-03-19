import { eq, and, asc, desc, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { List } from "@/domain/entities/list";
import type { IListRepository } from "@/domain/repositories/list.repository";

export class DrizzleListRepository implements IListRepository {
  constructor(private readonly db: Database) {}

  async findDefault(userId: string): Promise<List | undefined> {
    return this.db.query.lists.findFirst({
      where: and(eq(schema.lists.userId, userId), eq(schema.lists.isDefault, true)),
    });
  }

  async findById(id: string, userId: string): Promise<List | undefined> {
    return this.db.query.lists.findFirst({
      where: and(eq(schema.lists.id, id), eq(schema.lists.userId, userId)),
    });
  }

  async findByIds(ids: string[], userId: string): Promise<List[]> {
    if (ids.length === 0) return [];
    return this.db.query.lists.findMany({
      where: and(inArray(schema.lists.id, ids), eq(schema.lists.userId, userId)),
    });
  }

  async findByUser(userId: string): Promise<List[]> {
    return this.db.query.lists.findMany({
      where: eq(schema.lists.userId, userId),
      orderBy: asc(schema.lists.sortOrder),
    });
  }

  async findByGroup(groupId: string): Promise<List[]> {
    return this.db.query.lists.findMany({
      where: eq(schema.lists.groupId, groupId),
      orderBy: asc(schema.lists.sortOrder),
    });
  }

  async findMaxSortOrder(userId: string): Promise<number | undefined> {
    const row = await this.db.query.lists.findFirst({
      where: eq(schema.lists.userId, userId),
      orderBy: desc(schema.lists.sortOrder),
    });
    return row?.sortOrder;
  }

  async create(
    values: Partial<List> & { userId: string; name: string; sortOrder: number },
  ): Promise<List> {
    const [list] = await this.db.insert(schema.lists).values(values).returning();
    return list;
  }

  async update(id: string, userId: string, data: Partial<List>): Promise<List> {
    const [list] = await this.db
      .update(schema.lists)
      .set(data)
      .where(and(eq(schema.lists.id, id), eq(schema.lists.userId, userId)))
      .returning();
    return list;
  }

  async deleteNonDefault(id: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.lists)
      .where(
        and(
          eq(schema.lists.id, id),
          eq(schema.lists.userId, userId),
          eq(schema.lists.isDefault, false),
        ),
      );
  }

  async updateSortOrder(id: string, userId: string, sortOrder: number): Promise<void> {
    await this.db
      .update(schema.lists)
      .set({ sortOrder })
      .where(and(eq(schema.lists.id, id), eq(schema.lists.userId, userId)));
  }

  async deleteManyNonDefault(ids: string[], userId: string): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .delete(schema.lists)
      .where(
        and(
          inArray(schema.lists.id, ids),
          eq(schema.lists.userId, userId),
          eq(schema.lists.isDefault, false),
        ),
      );
  }

  async ungroupByGroupId(groupId: string): Promise<void> {
    await this.db
      .update(schema.lists)
      .set({ groupId: null })
      .where(eq(schema.lists.groupId, groupId));
  }
}
