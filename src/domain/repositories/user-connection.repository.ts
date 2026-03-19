import type { UserConnection, ConnectionWithUser } from "../entities/user-connection";

export interface IUserConnectionRepository {
  create(userId: string, connectedUserId: string): Promise<UserConnection>;
  findByUser(userId: string): Promise<ConnectionWithUser[]>;
  findBetween(userId: string, otherUserId: string): Promise<UserConnection | undefined>;
  findById(id: string, userId: string): Promise<UserConnection | undefined>;
  updateTargetList(id: string, userId: string, listId: string | null): Promise<void>;
  delete(userId: string, connectedUserId: string): Promise<void>;
  countSharedTasks(connectionId: string): Promise<number>;
}
