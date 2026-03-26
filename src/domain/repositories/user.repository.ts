import type { User, CreateUserInput } from "../entities/user";

export interface IUserRepository {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  create(input: CreateUserInput): Promise<User>;
  findByCalendarToken(token: string): Promise<User | undefined>;
  getCalendarToken(userId: string): Promise<string>;
  regenerateCalendarToken(userId: string): Promise<string>;
  updateCalendarSyncAll(userId: string, syncAll: boolean): Promise<void>;
  getCalendarSyncAll(userId: string): Promise<boolean>;
  updateCalendarSyncDateRange(userId: string, syncDateRange: boolean): Promise<void>;
  getCalendarSyncDateRange(userId: string): Promise<boolean>;
  updateCalendarTargetListId(userId: string, listId: string | null): Promise<void>;
  getCalendarTargetListId(userId: string): Promise<string | null>;
  updateOnboardingCompleted(userId: string, completed: boolean): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  createPasswordResetToken(email: string): Promise<string | null>;
  validatePasswordResetToken(token: string): Promise<string | null>;
  deletePasswordResetToken(token: string): Promise<void>;
  updateAiEnabled(userId: string, enabled: boolean): Promise<void>;
  updateLlmModel(userId: string, model: string): Promise<void>;
  updateGoogleCalendarEnabled(userId: string, enabled: boolean): Promise<void>;
  getGoogleCalendarEnabled(userId: string): Promise<boolean>;
  updateGoogleCalendarDirection(userId: string, direction: string): Promise<void>;
  getGoogleCalendarDirection(userId: string): Promise<string>;
  updateGoogleCalendarSyncToken(userId: string, syncToken: string | null): Promise<void>;
  updateGoogleCalendarChannel(
    userId: string,
    channelId: string | null,
    expiry: Date | null,
  ): Promise<void>;
  updateGoogleCalendarTargetListId(userId: string, listId: string | null): Promise<void>;
  getGoogleCalendarTargetListId(userId: string): Promise<string | null>;
  getGoogleCalendarSettings(userId: string): Promise<{
    enabled: boolean;
    direction: string;
    calendarId: string;
    syncToken: string | null;
    channelId: string | null;
    channelExpiry: Date | null;
    targetListId: string | null;
    syncAll: boolean;
    syncDateRange: boolean;
  }>;
  findUsersWithGoogleCalendarEnabled(): Promise<Array<{ id: string }>>;
  findUsersWithExpiringChannels(
    before: Date,
  ): Promise<Array<{ id: string; googleCalendarChannelId: string }>>;
  updateSharingDefaultList(userId: string, listId: string | null): Promise<void>;
}
