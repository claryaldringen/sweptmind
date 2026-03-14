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
}
