import { eq, and, count } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { UserConnection, ConnectionWithUser } from "@/domain/entities/user-connection";
import type { IUserConnectionRepository } from "@/domain/repositories/user-connection.repository";

export class DrizzleUserConnectionRepository implements IUserConnectionRepository {
  constructor(private readonly db: Database) {}

  async create(userId: string, connectedUserId: string): Promise<UserConnection> {
    const [first] = await this.db
      .insert(schema.userConnections)
      .values([
        { userId, connectedUserId },
        { userId: connectedUserId, connectedUserId: userId },
      ])
      .returning();
    return first as UserConnection;
  }

  async findByUser(userId: string): Promise<ConnectionWithUser[]> {
    const connections = await this.db.query.userConnections.findMany({
      where: eq(schema.userConnections.userId, userId),
      with: {
        connectedUser: true,
        sharedTasks: true,
      },
    });

    return connections.map((conn) => ({
      id: conn.id,
      userId: conn.userId,
      connectedUserId: conn.connectedUserId,
      targetListId: conn.targetListId,
      status: conn.status as "active",
      createdAt: conn.createdAt,
      connectedUser: {
        id: conn.connectedUser.id,
        name: conn.connectedUser.name ?? null,
        email: conn.connectedUser.email ?? null,
        image: conn.connectedUser.image ?? null,
      },
      sharedTaskCount: conn.sharedTasks.length,
    }));
  }

  async findBetween(userId: string, otherUserId: string): Promise<UserConnection | undefined> {
    const conn = await this.db.query.userConnections.findFirst({
      where: and(
        eq(schema.userConnections.userId, userId),
        eq(schema.userConnections.connectedUserId, otherUserId),
      ),
    });
    return conn as UserConnection | undefined;
  }

  async findById(id: string, userId: string): Promise<UserConnection | undefined> {
    const conn = await this.db.query.userConnections.findFirst({
      where: and(eq(schema.userConnections.id, id), eq(schema.userConnections.userId, userId)),
    });
    return conn as UserConnection | undefined;
  }

  async updateTargetList(id: string, userId: string, listId: string | null): Promise<void> {
    await this.db
      .update(schema.userConnections)
      .set({ targetListId: listId })
      .where(and(eq(schema.userConnections.id, id), eq(schema.userConnections.userId, userId)));
  }

  async delete(userId: string, connectedUserId: string): Promise<void> {
    await this.db
      .delete(schema.userConnections)
      .where(
        and(
          eq(schema.userConnections.userId, userId),
          eq(schema.userConnections.connectedUserId, connectedUserId),
        ),
      );
    await this.db
      .delete(schema.userConnections)
      .where(
        and(
          eq(schema.userConnections.userId, connectedUserId),
          eq(schema.userConnections.connectedUserId, userId),
        ),
      );
  }

  async countSharedTasks(connectionId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(schema.sharedTasks)
      .where(eq(schema.sharedTasks.connectionId, connectionId));
    return row?.count ?? 0;
  }
}
