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
    calendarSyncAll: false,
    calendarToken: null,
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

  describe("getById", () => {
    it("deleguje na repo", async () => {
      const user = makeUser();
      vi.mocked(userRepo.findById).mockResolvedValue(user);

      const result = await service.getById("user-1");

      expect(result).toEqual(user);
      expect(userRepo.findById).toHaveBeenCalledWith("user-1");
    });
  });
});
