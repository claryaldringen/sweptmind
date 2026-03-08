import { pgTable, text, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const locations = pgTable(
  "locations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    radius: doublePrecision("radius").notNull().default(5),
    address: text("address"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("locations_user_id_idx").on(table.userId)],
);
