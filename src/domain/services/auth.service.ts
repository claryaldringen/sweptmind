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

  async requestPasswordReset(email: string): Promise<string | null> {
    return this.userRepo.createPasswordResetToken(email);
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const email = await this.userRepo.validatePasswordResetToken(token);
    if (!email) return false;

    const hashedPassword = await this.hasher.hash(newPassword);
    const user = await this.userRepo.findByEmail(email);
    if (!user) return false;

    await this.userRepo.updatePassword(user.id, hashedPassword);
    await this.userRepo.deletePasswordResetToken(token);
    return true;
  }
}
