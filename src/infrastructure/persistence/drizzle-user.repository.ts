import { eq, and, gt } from "drizzle-orm";
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

  async updateOnboardingCompleted(userId: string, completed: boolean): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ onboardingCompleted: completed })
      .where(eq(schema.users.id, userId));
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.db.update(schema.users).set({ hashedPassword }).where(eq(schema.users.id, userId));
  }

  async createPasswordResetToken(email: string): Promise<string | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing tokens for this email
    await this.db
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, email));

    await this.db.insert(schema.verificationTokens).values({
      identifier: email,
      token,
      expires,
    });

    return token;
  }

  async validatePasswordResetToken(token: string): Promise<string | null> {
    const result = await this.db.query.verificationTokens.findFirst({
      where: and(
        eq(schema.verificationTokens.token, token),
        gt(schema.verificationTokens.expires, new Date()),
      ),
    });
    return result?.identifier ?? null;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await this.db
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.token, token));
  }

  async updateLlmConfig(
    userId: string,
    config: {
      llmProvider: string | null;
      llmApiKey: string | null;
      llmBaseUrl: string | null;
      llmModel: string | null;
    },
  ): Promise<void> {
    await this.db.update(schema.users).set(config).where(eq(schema.users.id, userId));
  }
}
