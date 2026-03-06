export interface CalendarSync {
  id: string;
  userId: string;
  taskId: string;
  icalUid: string;
  etag: string;
  lastSyncedAt: Date;
}
