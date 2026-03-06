import { eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { User, CreateUserInput } from "@/domain/entities/user";
import type { IUserRepository } from "@/domain/repositories/user.repository";

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    const [user] = await this.db.insert(schema.users).values(input).returning();
    return user;
  }

  async findByCalendarToken(token: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.calendarToken, token),
    });
  }

  async getCalendarToken(userId: string): Promise<string> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    if (user?.calendarToken) return user.calendarToken;
    const token = crypto.randomUUID();
    await this.db
      .update(schema.users)
      .set({ calendarToken: token })
      .where(eq(schema.users.id, userId));
    return token;
  }

  async regenerateCalendarToken(userId: string): Promise<string> {
    const token = crypto.randomUUID();
    await this.db
      .update(schema.users)
      .set({ calendarToken: token })
      .where(eq(schema.users.id, userId));
    return token;
  }

  async updateCalendarSyncAll(userId: string, syncAll: boolean): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ calendarSyncAll: syncAll })
      .where(eq(schema.users.id, userId));
  }

  async getCalendarSyncAll(userId: string): Promise<boolean> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { calendarSyncAll: true },
    });
    return user?.calendarSyncAll ?? false;
  }
}
