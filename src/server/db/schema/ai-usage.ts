import { index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(), // e.g. "2026-03"
    analysisCount: integer("analysis_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("ai_usage_user_month_idx").on(table.userId, table.yearMonth),
    index("ai_usage_user_id_idx").on(table.userId),
  ],
);
