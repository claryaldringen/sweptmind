import type { User } from "../entities/user";
import type { IUserRepository } from "../repositories/user.repository";

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  async register(name: string, email: string, password: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new Error("A user with this email already exists");
    }

    const hashedPassword = await this.hasher.hash(password);
    return this.userRepo.create({ name, email, hashedPassword });
  }

  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findByEmail(email);
    if (!user?.hashedPassword) return null;

    const isValid = await this.hasher.compare(password, user.hashedPassword);
    if (!isValid) return null;

    return user;
  }

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
}
