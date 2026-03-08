import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lists } from "./lists";
import { locations } from "./locations";

export const tasks = pgTable(
  "tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { mode: "date" }),
    dueDate: text("due_date"), // YYYY-MM-DD date string
    reminderAt: text("reminder_at"), // YYYY-MM-DD date string (visibility override)
    recurrence: text("recurrence"), // iCal RRULE
    deviceContext: text("device_context"), // 'phone' | 'computer' | null
    notifiedAt: timestamp("notified_at", { mode: "date" }),
    blockedByTaskId: text("blocked_by_task_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_list_id_idx").on(table.listId),
    index("tasks_due_date_idx").on(table.dueDate),
    index("tasks_user_completed_idx").on(table.userId, table.isCompleted),
    index("tasks_location_id_idx").on(table.locationId),
    index("tasks_reminder_at_idx").on(table.reminderAt),
    index("tasks_blocked_by_task_id_idx").on(table.blockedByTaskId),
  ],
);

export const steps = pgTable(
  "steps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("steps_task_id_idx").on(table.taskId)],
);
