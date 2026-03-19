import { pgTable, text, timestamp, primaryKey, integer, boolean, index } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  hashedPassword: text("hashed_password"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(true),
  calendarSyncAll: boolean("calendar_sync_all").notNull().default(false),
  calendarSyncDateRange: boolean("calendar_sync_date_range").notNull().default(false),
  calendarToken: text("calendar_token").unique(),
  calendarTargetListId: text("calendar_target_list_id"),
  googleCalendarEnabled: boolean("google_calendar_enabled").notNull().default(false),
  googleCalendarDirection: text("google_calendar_direction").default("both"),
  googleCalendarId: text("google_calendar_id").default("primary"),
  googleCalendarSyncToken: text("google_calendar_sync_token"),
  googleCalendarChannelId: text("google_calendar_channel_id"),
  googleCalendarChannelExpiry: timestamp("google_calendar_channel_expiry", { mode: "date" }),
  googleCalendarTargetListId: text("google_calendar_target_list_id"),
  llmProvider: text("llm_provider"),
  llmApiKey: text("llm_api_key"),
  llmBaseUrl: text("llm_base_url"),
  llmModel: text("llm_model"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    index("accounts_user_id_idx").on(account.userId),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [
    primaryKey({
      columns: [vt.identifier, vt.token],
    }),
  ],
);
