import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
    suggestedTitle: text("suggested_title"),
    projectName: text("project_name"),
    decomposition: jsonb("decomposition"),
    duplicateTaskId: text("duplicate_task_id").references(() => tasks.id, { onDelete: "set null" }),
    callIntent: jsonb("call_intent"),
    shoppingDistribution: jsonb("shopping_distribution"),
    analyzedTitle: text("analyzed_title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("task_ai_analyses_task_id_idx").on(table.taskId)],
);
