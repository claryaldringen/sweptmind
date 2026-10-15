export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  hashedPassword: string | null;
  createdAt: Date;
  updatedAt: Date;
  onboardingCompleted: boolean;
  calendarSyncAll: boolean;
  calendarSyncDateRange: boolean;
  calendarToken: string | null;
  calendarTargetListId: string | null;
  googleCalendarEnabled: boolean;
  googleCalendarDirection: string | null;
  googleCalendarId: string | null;
  googleCalendarSyncToken: string | null;
  googleCalendarChannelId: string | null;
  googleCalendarChannelExpiry: Date | null;
  googleCalendarTargetListId: string | null;
  aiEnabled: boolean;
  llmModel: string | null;
  sharingDefaultListId: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  hashedPassword: string;
}

/** Languages of the app — the UI, notifications and anything else sent to the user. */
export const USER_LOCALES = ["cs", "en", "de", "it", "fr", "es"] as const;

export type UserLocale = (typeof USER_LOCALES)[number];

export function isUserLocale(value: unknown): value is UserLocale {
  return typeof value === "string" && (USER_LOCALES as readonly string[]).includes(value);
}

/** Settings reported by the client so the server can act in the user's local time and language. */
export interface ClientSettings {
  timezone?: string;
  locale?: UserLocale;
}
