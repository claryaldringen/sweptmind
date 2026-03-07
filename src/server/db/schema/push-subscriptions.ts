import { pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    uniqueIndex("push_subscriptions_user_endpoint_idx").on(table.userId, table.endpoint),
  ],
);
