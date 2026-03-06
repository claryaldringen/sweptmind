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
}
