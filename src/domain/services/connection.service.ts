import type { ConnectionInvite } from "../entities/connection-invite";
import type { UserConnection, ConnectionWithUser } from "../entities/user-connection";
import type { IConnectionInviteRepository } from "../repositories/connection-invite.repository";
import type { IUserConnectionRepository } from "../repositories/user-connection.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { INotificationSender } from "../ports/notification-sender";

export class ConnectionService {
  constructor(
    private readonly inviteRepo: IConnectionInviteRepository,
    private readonly connectionRepo: IUserConnectionRepository,
    private readonly listRepo: IListRepository,
    private readonly notificationSender: INotificationSender,
  ) {}

  async createInvite(userId: string): Promise<ConnectionInvite> {
    return this.inviteRepo.create(userId);
  }

  async getInvites(userId: string): Promise<ConnectionInvite[]> {
    return this.inviteRepo.findByUser(userId);
  }

  async cancelInvite(inviteId: string, userId: string): Promise<void> {
    await this.inviteRepo.delete(inviteId, userId);
  }

  async acceptInvite(token: string, userId: string): Promise<UserConnection> {
    const invite = await this.inviteRepo.findByToken(token);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite already used");
    if (invite.fromUserId === userId) throw new Error("Cannot connect with yourself");
    if (invite.expiresAt < new Date()) throw new Error("Invite expired");

    const existing = await this.connectionRepo.findBetween(invite.fromUserId, userId);
    if (existing) throw new Error("Already connected");

    await this.inviteRepo.accept(token, userId);
    const connection = await this.connectionRepo.create(invite.fromUserId, userId);

    await this.notificationSender.send(invite.fromUserId, {
      type: "invite_accepted",
      title: "Invite accepted",
      body: "Your connection invite was accepted",
    });

    return connection;
  }

  async getConnections(userId: string): Promise<ConnectionWithUser[]> {
    return this.connectionRepo.findByUser(userId);
  }

  async disconnect(userId: string, connectedUserId: string): Promise<void> {
    await this.connectionRepo.delete(userId, connectedUserId);
  }

  async updateTargetList(userId: string, connectionId: string, listId: string | null): Promise<void> {
    await this.connectionRepo.updateTargetList(connectionId, userId, listId);
  }
}
