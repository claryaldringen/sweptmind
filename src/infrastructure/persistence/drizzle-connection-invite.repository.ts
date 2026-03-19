import { eq, and } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ConnectionInvite } from "@/domain/entities/connection-invite";
import type { IConnectionInviteRepository } from "@/domain/repositories/connection-invite.repository";

export class DrizzleConnectionInviteRepository implements IConnectionInviteRepository {
  constructor(private readonly db: Database) {}

  async create(fromUserId: string): Promise<ConnectionInvite> {
    const token = crypto.randomUUID().slice(0, 8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [invite] = await this.db
      .insert(schema.connectionInvites)
      .values({ fromUserId, token, expiresAt })
      .returning();
    return invite as ConnectionInvite;
  }

  async findByToken(token: string): Promise<ConnectionInvite | undefined> {
    const invite = await this.db.query.connectionInvites.findFirst({
      where: eq(schema.connectionInvites.token, token),
    });
    return invite as ConnectionInvite | undefined;
  }

  async accept(token: string, acceptedByUserId: string): Promise<ConnectionInvite> {
    const [invite] = await this.db
      .update(schema.connectionInvites)
      .set({ status: "accepted", acceptedByUserId })
      .where(eq(schema.connectionInvites.token, token))
      .returning();
    return invite as ConnectionInvite;
  }

  async findByUser(userId: string): Promise<ConnectionInvite[]> {
    const invites = await this.db.query.connectionInvites.findMany({
      where: and(
        eq(schema.connectionInvites.fromUserId, userId),
        eq(schema.connectionInvites.status, "pending"),
      ),
    });
    return invites as ConnectionInvite[];
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(schema.connectionInvites)
      .where(
        and(
          eq(schema.connectionInvites.id, id),
          eq(schema.connectionInvites.fromUserId, userId),
        ),
      );
  }
}
