import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    blobUrl: text("blob_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("task_attachments_task_id_idx").on(table.taskId)],
);
