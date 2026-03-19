import { pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lists } from "./lists";
import { tasks } from "./tasks";

export const connectionInvites = pgTable(
  "connection_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("connection_invites_from_user_idx").on(table.fromUserId),
  ],
);

export const userConnections = pgTable(
  "user_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedUserId: text("connected_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetListId: text("target_list_id").references(() => lists.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_connections_pair_idx").on(table.userId, table.connectedUserId),
    index("user_connections_user_id_idx").on(table.userId),
  ],
);

export const sharedTasks = pgTable(
  "shared_tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => userConnections.id, { onDelete: "cascade" }),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shared_tasks_source_target_idx").on(table.sourceTaskId, table.targetTaskId),
    index("shared_tasks_source_idx").on(table.sourceTaskId),
    index("shared_tasks_target_idx").on(table.targetTaskId),
    index("shared_tasks_connection_idx").on(table.connectionId),
  ],
);
