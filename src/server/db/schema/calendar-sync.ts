import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tasks } from "./tasks";

export const calendarSync = pgTable(
  "calendar_sync",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    icalUid: text("ical_uid").notNull(),
    etag: text("etag").notNull(),
    googleCalendarEventId: text("google_calendar_event_id"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("calendar_sync_user_ical_uid_idx").on(table.userId, table.icalUid),
    index("calendar_sync_task_id_idx").on(table.taskId),
  ],
);
