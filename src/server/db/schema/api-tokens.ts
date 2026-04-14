import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    name: text("name").notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("api_tokens_user_id_idx").on(table.userId),
    index("api_tokens_token_hash_idx").on(table.tokenHash),
  ],
);
