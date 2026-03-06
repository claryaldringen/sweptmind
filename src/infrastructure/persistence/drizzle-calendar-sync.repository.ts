import { eq, and } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { CalendarSync } from "@/domain/entities/calendar-sync";
import type { ICalendarSyncRepository } from "@/domain/repositories/calendar-sync.repository";

export class DrizzleCalendarSyncRepository implements ICalendarSyncRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<CalendarSync[]> {
    return this.db.query.calendarSync.findMany({
      where: eq(schema.calendarSync.userId, userId),
    });
  }

  async findByTaskId(taskId: string): Promise<CalendarSync | undefined> {
    return this.db.query.calendarSync.findFirst({
      where: eq(schema.calendarSync.taskId, taskId),
    });
  }

  async findByIcalUid(userId: string, icalUid: string): Promise<CalendarSync | undefined> {
    return this.db.query.calendarSync.findFirst({
      where: and(
        eq(schema.calendarSync.userId, userId),
        eq(schema.calendarSync.icalUid, icalUid),
      ),
    });
  }

  async upsert(data: {
    userId: string;
    taskId: string;
    icalUid: string;
    etag: string;
  }): Promise<CalendarSync> {
    const existing = await this.findByIcalUid(data.userId, data.icalUid);
    if (existing) {
      const [updated] = await this.db
        .update(schema.calendarSync)
        .set({ taskId: data.taskId, etag: data.etag, lastSyncedAt: new Date() })
        .where(eq(schema.calendarSync.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(schema.calendarSync)
      .values(data)
      .returning();
    return created;
  }

  async updateEtag(id: string, etag: string): Promise<void> {
    await this.db
      .update(schema.calendarSync)
      .set({ etag, lastSyncedAt: new Date() })
      .where(eq(schema.calendarSync.id, id));
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db
      .delete(schema.calendarSync)
      .where(eq(schema.calendarSync.taskId, taskId));
  }

  async deleteByIcalUid(userId: string, icalUid: string): Promise<void> {
    await this.db
      .delete(schema.calendarSync)
      .where(
        and(
          eq(schema.calendarSync.userId, userId),
          eq(schema.calendarSync.icalUid, icalUid),
        ),
      );
  }
}
