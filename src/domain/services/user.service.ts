import type { User } from "../entities/user";
import type { IUserRepository } from "../repositories/user.repository";

export class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  async getById(id: string): Promise<User | undefined> {
    return this.userRepo.findById(id);
  }

  async getCalendarToken(userId: string): Promise<string> {
    return this.userRepo.getCalendarToken(userId);
  }

  async regenerateCalendarToken(userId: string): Promise<string> {
    return this.userRepo.regenerateCalendarToken(userId);
  }

  async updateCalendarSyncAll(userId: string, syncAll: boolean): Promise<void> {
    return this.userRepo.updateCalendarSyncAll(userId, syncAll);
  }

  async getCalendarSyncAll(userId: string): Promise<boolean> {
    return this.userRepo.getCalendarSyncAll(userId);
  }

  async updateCalendarSyncDateRange(userId: string, syncDateRange: boolean): Promise<void> {
    return this.userRepo.updateCalendarSyncDateRange(userId, syncDateRange);
  }

  async getCalendarSyncDateRange(userId: string): Promise<boolean> {
    return this.userRepo.getCalendarSyncDateRange(userId);
  }

  async updateCalendarTargetListId(userId: string, listId: string | null): Promise<void> {
    await this.userRepo.updateCalendarTargetListId(userId, listId);
  }

  async getCalendarTargetListId(userId: string): Promise<string | null> {
    return this.userRepo.getCalendarTargetListId(userId);
  }

  async updateOnboardingCompleted(userId: string, completed: boolean): Promise<void> {
    return this.userRepo.updateOnboardingCompleted(userId, completed);
  }

  async updateLlmConfig(
    userId: string,
    config: {
      llmProvider: string | null;
      llmApiKey: string | null;
      llmBaseUrl: string | null;
      llmModel: string | null;
    },
  ): Promise<void> {
    return this.userRepo.updateLlmConfig(userId, config);
  }

  async updateGoogleCalendarEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.userRepo.updateGoogleCalendarEnabled(userId, enabled);
  }

  async getGoogleCalendarEnabled(userId: string): Promise<boolean> {
    return this.userRepo.getGoogleCalendarEnabled(userId);
  }

  async updateGoogleCalendarDirection(userId: string, direction: string): Promise<void> {
    await this.userRepo.updateGoogleCalendarDirection(userId, direction);
  }

  async getGoogleCalendarDirection(userId: string): Promise<string> {
    return this.userRepo.getGoogleCalendarDirection(userId);
  }

  async updateGoogleCalendarTargetListId(userId: string, listId: string | null): Promise<void> {
    await this.userRepo.updateGoogleCalendarTargetListId(userId, listId);
  }

  async getGoogleCalendarTargetListId(userId: string): Promise<string | null> {
    return this.userRepo.getGoogleCalendarTargetListId(userId);
  }

  async getGoogleCalendarSettings(userId: string) {
    return this.userRepo.getGoogleCalendarSettings(userId);
  }

  async updateGoogleCalendarSyncToken(userId: string, syncToken: string | null): Promise<void> {
    await this.userRepo.updateGoogleCalendarSyncToken(userId, syncToken);
  }

  async updateGoogleCalendarChannel(
    userId: string,
    channelId: string | null,
    expiry: Date | null,
  ): Promise<void> {
    await this.userRepo.updateGoogleCalendarChannel(userId, channelId, expiry);
  }
}
