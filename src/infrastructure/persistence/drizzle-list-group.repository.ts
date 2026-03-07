import { eq, and, asc, desc } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ListGroup } from "@/domain/entities/list";
import type { IListGroupRepository } from "@/domain/repositories/list-group.repository";

export class DrizzleListGroupRepository implements IListGroupRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string): Promise<ListGroup[]> {
    return this.db.query.listGroups.findMany({
      where: eq(schema.listGroups.userId, userId),
      orderBy: asc(schema.listGroups.sortOrder),
    });
  }

  async findMaxSortOrder(userId: string): Promise<number | undefined> {
    const row = await this.db.query.listGroups.findFirst({
      where: eq(schema.listGroups.userId, userId),
      orderBy: desc(schema.listGroups.sortOrder),
    });
    return row?.sortOrder;
  }

  async create(values: { userId: string; name: string; sortOrder: number }): Promise<ListGroup> {
    const [group] = await this.db.insert(schema.listGroups).values(values).returning();
    return group;
  }

  async update(id: string, userId: string, data: Partial<ListGroup>): Promise<ListGroup> {
    const [group] = await this.db
      .update(schema.listGroups)
      .set(data)
      .where(and(eq(schema.listGroups.id, id), eq(schema.listGroups.userId, userId)))
      .returning();
    return group;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.listGroups)
      .where(and(eq(schema.listGroups.id, id), eq(schema.listGroups.userId, userId)));
  }
}
