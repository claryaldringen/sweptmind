import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService, type IPasswordHasher } from "../auth.service";
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
    llmModel: null,
    sharingDefaultListId: null,
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
    updateLlmModel: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn().mockResolvedValue(false),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn().mockResolvedValue("both"),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    updateGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarTargetListId: vi.fn().mockResolvedValue(null),
    getGoogleCalendarSettings: vi.fn().mockResolvedValue({
      enabled: false,
      direction: "both",
      calendarId: "primary",
      syncToken: null,
      channelId: null,
      channelExpiry: null,
      targetListId: null,
    }),
    findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
    updateSharingDefaultList: vi.fn(),
    ...overrides,
  };
}

function makeHasher(overrides: Partial<IPasswordHasher> = {}): IPasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("AuthService", () => {
  let userRepo: IUserRepository;
  let hasher: IPasswordHasher;
  let service: AuthService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    hasher = makeHasher();
    service = new AuthService(userRepo, hasher);
  });

  describe("register", () => {
    it("vytvoří nového uživatele s hashovaným heslem", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(undefined);
      vi.mocked(userRepo.create).mockResolvedValue(makeUser());

      await service.register("Test", "test@example.com", "password123");

      expect(hasher.hash).toHaveBeenCalledWith("password123");
      expect(userRepo.create).toHaveBeenCalledWith({
        name: "Test",
        email: "test@example.com",
        hashedPassword: "hashed_password",
      });
    });

    it("vyhodí chybu pokud email už existuje", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

      await expect(service.register("Test", "test@example.com", "pass")).rejects.toThrow(
        "A user with this email already exists",
      );
    });
  });

  describe("authenticate", () => {
    it("vrátí uživatele při správném hesle", async () => {
      const user = makeUser();
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user);
      vi.mocked(hasher.compare).mockResolvedValue(true);

      const result = await service.authenticate("test@example.com", "correct");

      expect(result).toEqual(user);
    });

    it("vrátí null při špatném hesle", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());
      vi.mocked(hasher.compare).mockResolvedValue(false);

      const result = await service.authenticate("test@example.com", "wrong");

      expect(result).toBeNull();
    });

    it("vrátí null pokud uživatel neexistuje", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(undefined);

      const result = await service.authenticate("unknown@example.com", "any");

      expect(result).toBeNull();
    });

    it("vrátí null pokud uživatel nemá heslo (OAuth)", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ hashedPassword: null }));

      const result = await service.authenticate("oauth@example.com", "any");

      expect(result).toBeNull();
    });
  });

  describe("requestPasswordReset", () => {
    it("deleguje na repo a vrátí token", async () => {
      vi.mocked(userRepo.createPasswordResetToken).mockResolvedValue("reset-token");
      const result = await service.requestPasswordReset("test@example.com");
      expect(result).toBe("reset-token");
      expect(userRepo.createPasswordResetToken).toHaveBeenCalledWith("test@example.com");
    });

    it("vrátí null pokud email neexistuje", async () => {
      vi.mocked(userRepo.createPasswordResetToken).mockResolvedValue(null);
      const result = await service.requestPasswordReset("unknown@example.com");
      expect(result).toBeNull();
    });
  });

  describe("resetPassword", () => {
    it("resetuje heslo s platným tokenem", async () => {
      vi.mocked(userRepo.validatePasswordResetToken).mockResolvedValue("test@example.com");
      vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser());

      const result = await service.resetPassword("valid-token", "newPassword123");

      expect(result).toBe(true);
      expect(hasher.hash).toHaveBeenCalledWith("newPassword123");
      expect(userRepo.updatePassword).toHaveBeenCalledWith("user-1", "hashed_password");
      expect(userRepo.deletePasswordResetToken).toHaveBeenCalledWith("valid-token");
    });

    it("vrátí false pro neplatný token", async () => {
      vi.mocked(userRepo.validatePasswordResetToken).mockResolvedValue(null);
      const result = await service.resetPassword("invalid-token", "newPass");
      expect(result).toBe(false);
    });

    it("vrátí false pokud uživatel s emailem neexistuje", async () => {
      vi.mocked(userRepo.validatePasswordResetToken).mockResolvedValue("deleted@example.com");
      vi.mocked(userRepo.findByEmail).mockResolvedValue(undefined);
      const result = await service.resetPassword("valid-token", "newPass");
      expect(result).toBe(false);
    });
  });
});
