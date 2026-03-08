import { eq, and, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { Location } from "@/domain/entities/location";
import type { ILocationRepository } from "@/domain/repositories/location.repository";

export class DrizzleLocationRepository implements ILocationRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string): Promise<Location[]> {
    return this.db.query.locations.findMany({
      where: eq(schema.locations.userId, userId),
      orderBy: schema.locations.name,
    });
  }

  async findById(id: string, userId: string): Promise<Location | undefined> {
    return this.db.query.locations.findFirst({
      where: and(eq(schema.locations.id, id), eq(schema.locations.userId, userId)),
    });
  }

  async findByIds(ids: string[], userId: string): Promise<Location[]> {
    if (ids.length === 0) return [];
    return this.db.query.locations.findMany({
      where: and(inArray(schema.locations.id, ids), eq(schema.locations.userId, userId)),
    });
  }

  async create(values: {
    id?: string;
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    address?: string | null;
  }): Promise<Location> {
    const [location] = await this.db.insert(schema.locations).values(values).returning();
    return location;
  }

  async update(id: string, userId: string, data: Partial<Location>): Promise<Location> {
    const [location] = await this.db
      .update(schema.locations)
      .set(data)
      .where(and(eq(schema.locations.id, id), eq(schema.locations.userId, userId)))
      .returning();
    return location;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.locations)
      .where(and(eq(schema.locations.id, id), eq(schema.locations.userId, userId)));
  }
}
