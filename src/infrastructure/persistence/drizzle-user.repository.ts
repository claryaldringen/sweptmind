import { eq, and, gt, lt } from "drizzle-orm";
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

  async updateCalendarSyncDateRange(userId: string, syncDateRange: boolean): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ calendarSyncDateRange: syncDateRange })
      .where(eq(schema.users.id, userId));
  }

  async getCalendarSyncDateRange(userId: string): Promise<boolean> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { calendarSyncDateRange: true },
    });
    return user?.calendarSyncDateRange ?? false;
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

  async updateGoogleCalendarEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ googleCalendarEnabled: enabled })
      .where(eq(schema.users.id, userId));
  }

  async getGoogleCalendarEnabled(userId: string): Promise<boolean> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { googleCalendarEnabled: true },
    });
    return user?.googleCalendarEnabled ?? false;
  }

  async updateGoogleCalendarDirection(userId: string, direction: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ googleCalendarDirection: direction })
      .where(eq(schema.users.id, userId));
  }

  async getGoogleCalendarDirection(userId: string): Promise<string> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { googleCalendarDirection: true },
    });
    return user?.googleCalendarDirection ?? "both";
  }

  async updateGoogleCalendarSyncToken(userId: string, syncToken: string | null): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ googleCalendarSyncToken: syncToken })
      .where(eq(schema.users.id, userId));
  }

  async updateGoogleCalendarChannel(
    userId: string,
    channelId: string | null,
    expiry: Date | null,
  ): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ googleCalendarChannelId: channelId, googleCalendarChannelExpiry: expiry })
      .where(eq(schema.users.id, userId));
  }

  async getGoogleCalendarSettings(userId: string): Promise<{
    enabled: boolean;
    direction: string;
    calendarId: string;
    syncToken: string | null;
    channelId: string | null;
    channelExpiry: Date | null;
  }> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        googleCalendarEnabled: true,
        googleCalendarDirection: true,
        googleCalendarId: true,
        googleCalendarSyncToken: true,
        googleCalendarChannelId: true,
        googleCalendarChannelExpiry: true,
      },
    });
    return {
      enabled: user?.googleCalendarEnabled ?? false,
      direction: user?.googleCalendarDirection ?? "both",
      calendarId: user?.googleCalendarId ?? "primary",
      syncToken: user?.googleCalendarSyncToken ?? null,
      channelId: user?.googleCalendarChannelId ?? null,
      channelExpiry: user?.googleCalendarChannelExpiry ?? null,
    };
  }

  async findUsersWithExpiringChannels(
    before: Date,
  ): Promise<Array<{ id: string; googleCalendarChannelId: string }>> {
    const users = await this.db.query.users.findMany({
      where: and(
        eq(schema.users.googleCalendarEnabled, true),
        lt(schema.users.googleCalendarChannelExpiry, before),
      ),
      columns: { id: true, googleCalendarChannelId: true },
    });
    return users.filter(
      (u): u is { id: string; googleCalendarChannelId: string } =>
        u.googleCalendarChannelId !== null,
    );
  }
}
