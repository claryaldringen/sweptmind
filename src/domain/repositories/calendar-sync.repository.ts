import type { CalendarSync } from "../entities/calendar-sync";

export interface ICalendarSyncRepository {
  findByUserId(userId: string): Promise<CalendarSync[]>;
  findByTaskId(taskId: string): Promise<CalendarSync | undefined>;
  findByIcalUid(userId: string, icalUid: string): Promise<CalendarSync | undefined>;
  upsert(data: { userId: string; taskId: string; icalUid: string; etag: string }): Promise<CalendarSync>;
  updateEtag(id: string, etag: string): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
  deleteByIcalUid(userId: string, icalUid: string): Promise<void>;
}
