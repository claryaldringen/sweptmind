import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

export const taskAiAnalyses = pgTable(
  "task_ai_analyses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" })
      .unique(),
    isActionable: boolean("is_actionable").notNull(),
    suggestion: text("suggestion"),
    analyzedTitle: text("analyzed_title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("task_ai_analyses_task_id_idx").on(table.taskId)],
);
