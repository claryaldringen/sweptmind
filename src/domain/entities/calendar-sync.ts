export interface CalendarSync {
  id: string;
  userId: string;
  taskId: string;
  icalUid: string;
  etag: string;
  googleCalendarEventId: string | null;
  lastSyncedAt: Date;
}
