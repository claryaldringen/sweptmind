import { builder } from "../builder";
import {
  ConnectionInviteRef,
  UserConnectionRef,
  SharedTaskInfoRef,
  IncomingShareInfoRef,
  UserRef,
  ListRef,
  TaskRef,
} from "./refs";

// ── Types ──────────────────────────────────────────────────────────────────

export const ConnectionInviteType = ConnectionInviteRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    token: t.exposeString("token"),
    status: t.exposeString("status"),
    expiresAt: t.string({
      resolve: (invite) => invite.expiresAt.toISOString(),
    }),
    createdAt: t.string({
      resolve: (invite) => invite.createdAt.toISOString(),
    }),
  }),
});

export const UserConnectionType = UserConnectionRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    connectedUser: t.field({
      type: UserRef,
      resolve: async (connection, _args, ctx) => {
        const user = await ctx.services.user.getById(connection.connectedUserId);
        return user!;
      },
    }),
    targetList: t.field({
      type: ListRef,
      nullable: true,
      resolve: async (connection, _args, ctx) => {
        if (!connection.targetListId) return null;
        return ctx.services.list.getById(connection.targetListId, connection.userId);
      },
    }),
    sharedTaskCount: t.exposeInt("sharedTaskCount"),
    createdAt: t.string({
      resolve: (connection) => connection.createdAt.toISOString(),
    }),
  }),
});

// Helper inline user type used inside SharedTaskInfo / IncomingShareInfo
const ShareUserRef = builder.objectRef<{
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}>("ShareUser");

const ShareUserType = ShareUserRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    image: t.exposeString("image", { nullable: true }),
  }),
});

export const SharedTaskInfoType = SharedTaskInfoRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    sharedWith: t.field({
      type: ShareUserRef,
      resolve: (info) => info.sharedWith,
    }),
    targetTask: t.field({
      type: TaskRef,
      resolve: (info) => info.targetTask,
    }),
    createdAt: t.string({
      resolve: (info) => info.createdAt.toISOString(),
    }),
  }),
});

export const IncomingShareInfoType = IncomingShareInfoRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    owner: t.field({
      type: ShareUserRef,
      resolve: (info) => info.owner,
    }),
    sourceTask: t.field({
      type: TaskRef,
      resolve: (info) => info.sourceTask,
    }),
    createdAt: t.string({
      resolve: (info) => info.createdAt.toISOString(),
    }),
  }),
});

// ── Queries ────────────────────────────────────────────────────────────────

builder.queryField("sharingDefaultListId", (t) =>
  t.string({
    nullable: true,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      const user = await ctx.services.user.getById(ctx.userId!);
      return user?.sharingDefaultListId ?? null;
    },
  }),
);

builder.queryField("connections", (t) =>
  t.field({
    type: [UserConnectionType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.connection.getConnections(ctx.userId!),
  }),
);

builder.queryField("connectionInvites", (t) =>
  t.field({
    type: [ConnectionInviteType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.connection.getInvites(ctx.userId!),
  }),
);

builder.queryField("taskShares", (t) =>
  t.field({
    type: [SharedTaskInfoType],
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const shares = await ctx.services.taskSharing.getShareInfo(args.taskId, ctx.userId!);
      const results = await Promise.all(
        shares.map(async (share) => {
          const targetTask = await ctx.services.taskSharing.getTaskUnchecked(share.targetTaskId);
          if (!targetTask) return null;
          const targetUser = await ctx.services.user.getById(targetTask.userId);
          if (!targetUser) return null;
          return {
            id: share.id,
            sharedWith: {
              id: targetUser.id,
              name: targetUser.name,
              email: targetUser.email,
              image: targetUser.image,
            },
            targetTask,
            createdAt: share.createdAt,
          };
        }),
      );
      return results.filter((r): r is NonNullable<typeof r> => r !== null);
    },
  }),
);

builder.queryField("taskShareSource", (t) =>
  t.field({
    type: IncomingShareInfoType,
    nullable: true,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const share = await ctx.services.taskSharing.getShareSource(args.taskId, ctx.userId!);
      if (!share) return null;
      const sourceTask = await ctx.services.taskSharing.getTaskUnchecked(share.sourceTaskId);
      if (!sourceTask) return null;
      const owner = await ctx.services.user.getById(sourceTask.userId);
      if (!owner) return null;
      return {
        id: share.id,
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          image: owner.image,
        },
        sourceTask,
        createdAt: share.createdAt,
      };
    },
  }),
);

// ── Mutations ──────────────────────────────────────────────────────────────

builder.mutationField("createConnectionInvite", (t) =>
  t.field({
    type: ConnectionInviteType,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.connection.createInvite(ctx.userId!, args.taskId ?? undefined),
  }),
);

builder.mutationField("acceptConnectionInvite", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      token: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.connection.acceptInvite(args.token, ctx.userId!);
      return true;
    },
  }),
);

builder.mutationField("cancelConnectionInvite", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      inviteId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.connection.cancelInvite(args.inviteId, ctx.userId!);
      return true;
    },
  }),
);

builder.mutationField("disconnect", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      connectedUserId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.connection.disconnect(ctx.userId!, args.connectedUserId);
      return true;
    },
  }),
);

builder.mutationField("updateConnectionTargetList", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      connectionId: t.arg.string({ required: true }),
      listId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.connection.updateTargetList(
        ctx.userId!,
        args.connectionId,
        args.listId ?? null,
      );
      return true;
    },
  }),
);

builder.mutationField("updateSharingDefaultList", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      listId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateSharingDefaultList(ctx.userId!, args.listId ?? null);
      return true;
    },
  }),
);

builder.mutationField("shareTask", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      targetUserId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.taskSharing.shareTask(args.taskId, ctx.userId!, args.targetUserId);
      return true;
    },
  }),
);

builder.mutationField("unshareTask", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      sharedTaskId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await ctx.services.taskSharing.unshareTask(args.sharedTaskId, ctx.userId!);
      return true;
    },
  }),
);

// Keep ShareUserType referenced so it's included in schema
void ShareUserType;
