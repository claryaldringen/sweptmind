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
  updateOnboardingCompleted(userId: string, completed: boolean): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  createPasswordResetToken(email: string): Promise<string | null>;
  validatePasswordResetToken(token: string): Promise<string | null>;
  deletePasswordResetToken(token: string): Promise<void>;
  updateLlmConfig(
    userId: string,
    config: {
      llmProvider: string | null;
      llmApiKey: string | null;
      llmBaseUrl: string | null;
      llmModel: string | null;
    },
  ): Promise<void>;
}
