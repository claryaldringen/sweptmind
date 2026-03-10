import { pgTable, text, timestamp, integer, boolean, doublePrecision, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { locations } from "./locations";

export const listGroups = pgTable(
  "list_groups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isExpanded: boolean("is_expanded").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("list_groups_user_id_idx").on(table.userId)],
);

export const lists = pgTable(
  "lists",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => listGroups.id, {
      onDelete: "set null",
    }),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    icon: text("icon"),
    themeColor: text("theme_color"),
    isDefault: boolean("is_default").notNull().default(false),
    locationRadius: doublePrecision("location_radius"), // km, null = use location default
    deviceContext: text("device_context"), // 'phone' | 'computer' | null
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("lists_user_id_idx").on(table.userId),
    index("lists_group_id_idx").on(table.groupId),
  ],
);
