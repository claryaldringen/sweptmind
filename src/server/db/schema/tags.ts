import { pgTable, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tasks } from "./tasks";
import { locations } from "./locations";

export const tags = pgTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("blue"),
    deviceContext: text("device_context"), // 'phone' | 'computer' | null
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("tags_user_id_idx").on(table.userId)],
);

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.tagId] }),
    index("task_tags_task_id_idx").on(t.taskId),
    index("task_tags_tag_id_idx").on(t.tagId),
  ],
);
