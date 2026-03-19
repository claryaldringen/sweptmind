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
  llmProvider: string | null;
  llmApiKey: string | null;
  llmBaseUrl: string | null;
  llmModel: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  hashedPassword: string;
}
