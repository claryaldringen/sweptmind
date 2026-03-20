import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionService } from "../connection.service";
import type { IConnectionInviteRepository } from "../../repositories/connection-invite.repository";
import type { IUserConnectionRepository } from "../../repositories/user-connection.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { INotificationSender } from "../../ports/notification-sender";
import type { ConnectionInvite } from "../../entities/connection-invite";
import type { UserConnection } from "../../entities/user-connection";

function makeInvite(overrides: Partial<ConnectionInvite> = {}): ConnectionInvite {
  return {
    id: "invite-1",
    fromUserId: "user-1",
    taskId: null,
    token: "token-abc",
    status: "pending",
    acceptedByUserId: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeConnection(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: "conn-1",
    userId: "user-1",
    connectedUserId: "user-2",
    targetListId: null,
    status: "active",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeInviteRepo(
  overrides: Partial<IConnectionInviteRepository> = {},
): IConnectionInviteRepository {
  return {
    create: vi.fn().mockResolvedValue(makeInvite()),
    findByToken: vi.fn().mockResolvedValue(undefined),
    accept: vi.fn().mockResolvedValue(makeInvite({ status: "accepted" })),
    findByUser: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeConnectionRepo(
  overrides: Partial<IUserConnectionRepository> = {},
): IUserConnectionRepository {
  return {
    create: vi.fn().mockResolvedValue(makeConnection()),
    findByUser: vi.fn().mockResolvedValue([]),
    findBetween: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    updateTargetList: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    countSharedTasks: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeListRepo(overrides: Partial<IListRepository> = {}): IListRepository {
  return {
    findDefault: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findByGroup: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
    deleteManyNonDefault: vi.fn(),
    ...overrides,
  };
}

function makeNotificationSender(overrides: Partial<INotificationSender> = {}): INotificationSender {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("ConnectionService", () => {
  let inviteRepo: IConnectionInviteRepository;
  let connectionRepo: IUserConnectionRepository;
  let listRepo: IListRepository;
  let notificationSender: INotificationSender;
  let service: ConnectionService;

  beforeEach(() => {
    inviteRepo = makeInviteRepo();
    connectionRepo = makeConnectionRepo();
    listRepo = makeListRepo();
    notificationSender = makeNotificationSender();
    service = new ConnectionService(inviteRepo, connectionRepo, listRepo, notificationSender);
  });

  describe("createInvite", () => {
    it("creates an invite and calls inviteRepo.create", async () => {
      const invite = makeInvite();
      vi.mocked(inviteRepo.create).mockResolvedValue(invite);

      const result = await service.createInvite("user-1");

      expect(inviteRepo.create).toHaveBeenCalledWith("user-1", undefined);
      expect(result).toEqual(invite);
    });
  });

  describe("acceptInvite", () => {
    it("valid invite — calls accept, creates connection, sends notification, returns UserConnection", async () => {
      const invite = makeInvite({ fromUserId: "user-1" });
      const connection = makeConnection({ userId: "user-1", connectedUserId: "user-2" });
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(invite);
      vi.mocked(connectionRepo.create).mockResolvedValue(connection);

      const result = await service.acceptInvite("token-abc", "user-2");

      expect(inviteRepo.accept).toHaveBeenCalledWith("token-abc", "user-2");
      expect(connectionRepo.create).toHaveBeenCalledWith("user-1", "user-2");
      expect(notificationSender.send).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "invite_accepted" }),
      );
      expect(result).toEqual(connection);
    });

    it("already accepted invite — throws 'Invite already used'", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite({ status: "accepted" }));

      await expect(service.acceptInvite("token-abc", "user-2")).rejects.toThrow(
        "Invite already used",
      );
    });

    it("self-invite — throws 'Cannot connect with yourself'", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite({ fromUserId: "user-1" }));

      await expect(service.acceptInvite("token-abc", "user-1")).rejects.toThrow(
        "Cannot connect with yourself",
      );
    });

    it("expired invite — throws 'Invite expired'", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(
        makeInvite({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.acceptInvite("token-abc", "user-2")).rejects.toThrow("Invite expired");
    });

    it("already connected — throws 'Already connected'", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite({ fromUserId: "user-1" }));
      vi.mocked(connectionRepo.findBetween).mockResolvedValue(makeConnection());

      await expect(service.acceptInvite("token-abc", "user-2")).rejects.toThrow(
        "Already connected",
      );
    });

    it("invalid token — throws 'Invite not found'", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(undefined);

      await expect(service.acceptInvite("bad-token", "user-2")).rejects.toThrow("Invite not found");
    });
  });

  describe("disconnect", () => {
    it("calls connectionRepo.delete", async () => {
      await service.disconnect("user-1", "user-2");

      expect(connectionRepo.delete).toHaveBeenCalledWith("user-1", "user-2");
    });
  });

  describe("updateTargetList", () => {
    it("delegates to connectionRepo.updateTargetList", async () => {
      await service.updateTargetList("user-1", "conn-1", "list-1");

      expect(connectionRepo.updateTargetList).toHaveBeenCalledWith("conn-1", "user-1", "list-1");
    });
  });
});
