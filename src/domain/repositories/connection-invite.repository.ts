import type { ConnectionInvite } from "../entities/connection-invite";

export interface IConnectionInviteRepository {
  create(fromUserId: string): Promise<ConnectionInvite>;
  findByToken(token: string): Promise<ConnectionInvite | undefined>;
  accept(token: string, acceptedByUserId: string): Promise<ConnectionInvite>;
  findByUser(userId: string): Promise<ConnectionInvite[]>;
  delete(id: string, userId: string): Promise<void>;
}
