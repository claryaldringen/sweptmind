import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../user.service";
import type { IUserRepository } from "../../repositories/user.repository";
import type { User } from "../../entities/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: null,
    image: null,
    hashedPassword: "hashed_password",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    onboardingCompleted: true,
    calendarSyncAll: false,
    calendarSyncDateRange: false,
    calendarToken: null,
    calendarTargetListId: null,
    googleCalendarEnabled: false,
    googleCalendarDirection: "both",
    googleCalendarId: "primary",
    googleCalendarSyncToken: null,
    googleCalendarChannelId: null,
    googleCalendarChannelExpiry: null,
    googleCalendarTargetListId: null,
    aiEnabled: true,
    llmProvider: null,
    llmApiKey: null,
    llmBaseUrl: null,
    llmModel: null,
    ...overrides,
  };
}

function makeUserRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    findByCalendarToken: vi.fn(),
    getCalendarToken: vi.fn(),
    regenerateCalendarToken: vi.fn(),
    updateCalendarSyncAll: vi.fn(),
    getCalendarSyncAll: vi.fn(),
    updateCalendarSyncDateRange: vi.fn(),
    getCalendarSyncDateRange: vi.fn(),
    updateCalendarTargetListId: vi.fn(),
    getCalendarTargetListId: vi.fn(),
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn(),
    validatePasswordResetToken: vi.fn(),
    deletePasswordResetToken: vi.fn(),
    updateAiEnabled: vi.fn(),
    updateLlmConfig: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn(),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn(),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    updateGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarSettings: vi.fn(),
    findUsersWithExpiringChannels: vi.fn(),
    ...overrides,
  };
}

describe("UserService", () => {
  let userRepo: IUserRepository;
  let service: UserService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    service = new UserService(userRepo);
  });

  describe("getById", () => {
    it("deleguje na repo", async () => {
      const user = makeUser();
      vi.mocked(userRepo.findById).mockResolvedValue(user);

      const result = await service.getById("user-1");

      expect(result).toEqual(user);
      expect(userRepo.findById).toHaveBeenCalledWith("user-1");
    });
  });

  describe("getCalendarToken", () => {
    it("deleguje na repo", async () => {
      vi.mocked(userRepo.getCalendarToken).mockResolvedValue("token-123");

      const result = await service.getCalendarToken("user-1");

      expect(result).toBe("token-123");
      expect(userRepo.getCalendarToken).toHaveBeenCalledWith("user-1");
    });
  });

  describe("updateOnboardingCompleted", () => {
    it("deleguje na repo", async () => {
      await service.updateOnboardingCompleted("user-1", true);

      expect(userRepo.updateOnboardingCompleted).toHaveBeenCalledWith("user-1", true);
    });
  });

  describe("regenerateCalendarToken", () => {
    it("deleguje na repo", async () => {
      vi.mocked(userRepo.regenerateCalendarToken).mockResolvedValue("new-token");
      const result = await service.regenerateCalendarToken("user-1");
      expect(result).toBe("new-token");
      expect(userRepo.regenerateCalendarToken).toHaveBeenCalledWith("user-1");
    });
  });

  describe("updateCalendarSyncAll", () => {
    it("deleguje na repo", async () => {
      await service.updateCalendarSyncAll("user-1", true);
      expect(userRepo.updateCalendarSyncAll).toHaveBeenCalledWith("user-1", true);
    });
  });

  describe("getCalendarSyncAll", () => {
    it("deleguje na repo", async () => {
      vi.mocked(userRepo.getCalendarSyncAll).mockResolvedValue(true);
      const result = await service.getCalendarSyncAll("user-1");
      expect(result).toBe(true);
      expect(userRepo.getCalendarSyncAll).toHaveBeenCalledWith("user-1");
    });
  });

  describe("updateGoogleCalendarEnabled", () => {
    it("deleguje na repo", async () => {
      await service.updateGoogleCalendarEnabled("user-1", true);
      expect(userRepo.updateGoogleCalendarEnabled).toHaveBeenCalledWith("user-1", true);
    });
  });

  describe("getGoogleCalendarEnabled", () => {
    it("deleguje na repo", async () => {
      vi.mocked(userRepo.getGoogleCalendarEnabled).mockResolvedValue(true);
      const result = await service.getGoogleCalendarEnabled("user-1");
      expect(result).toBe(true);
      expect(userRepo.getGoogleCalendarEnabled).toHaveBeenCalledWith("user-1");
    });
  });

  describe("updateGoogleCalendarDirection", () => {
    it("deleguje na repo", async () => {
      await service.updateGoogleCalendarDirection("user-1", "push");
      expect(userRepo.updateGoogleCalendarDirection).toHaveBeenCalledWith("user-1", "push");
    });
  });

  describe("getGoogleCalendarDirection", () => {
    it("deleguje na repo", async () => {
      vi.mocked(userRepo.getGoogleCalendarDirection).mockResolvedValue("pull");
      const result = await service.getGoogleCalendarDirection("user-1");
      expect(result).toBe("pull");
      expect(userRepo.getGoogleCalendarDirection).toHaveBeenCalledWith("user-1");
    });
  });

  describe("getGoogleCalendarSettings", () => {
    it("deleguje na repo", async () => {
      const settings = {
        enabled: true,
        direction: "both",
        calendarId: "primary",
        syncToken: "token-123",
        channelId: "channel-1",
        channelExpiry: new Date("2026-04-01"),
        targetListId: null,
        syncAll: false,
        syncDateRange: false,
      };
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue(settings);
      const result = await service.getGoogleCalendarSettings("user-1");
      expect(result).toEqual(settings);
      expect(userRepo.getGoogleCalendarSettings).toHaveBeenCalledWith("user-1");
    });
  });
});
