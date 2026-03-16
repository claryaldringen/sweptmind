import { builder } from "../builder";

builder.mutationField("getCalendarToken", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getCalendarToken(ctx.userId!);
    },
  }),
);

builder.mutationField("regenerateCalendarToken", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.regenerateCalendarToken(ctx.userId!);
    },
  }),
);

builder.mutationField("updateCalendarSyncAll", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: { syncAll: t.arg.boolean({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateCalendarSyncAll(ctx.userId!, args.syncAll);
      return args.syncAll;
    },
  }),
);

builder.queryField("calendarSyncAll", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getCalendarSyncAll(ctx.userId!);
    },
  }),
);

builder.mutationField("updateCalendarSyncDateRange", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: { syncDateRange: t.arg.boolean({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateCalendarSyncDateRange(ctx.userId!, args.syncDateRange);
      return args.syncDateRange;
    },
  }),
);

builder.queryField("calendarSyncDateRange", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getCalendarSyncDateRange(ctx.userId!);
    },
  }),
);

builder.queryField("calendarTargetListId", (t) =>
  t.string({
    nullable: true,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getCalendarTargetListId(ctx.userId!);
    },
  }),
);

builder.mutationField("updateCalendarTargetListId", (t) =>
  t.string({
    nullable: true,
    authScopes: { authenticated: true },
    args: { listId: t.arg.string({ required: false }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateCalendarTargetListId(ctx.userId!, args.listId ?? null);
      return args.listId ?? null;
    },
  }),
);

builder.queryField("googleCalendarEnabled", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getGoogleCalendarEnabled(ctx.userId!);
    },
  }),
);

builder.queryField("googleCalendarDirection", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getGoogleCalendarDirection(ctx.userId!);
    },
  }),
);

builder.mutationField("updateGoogleCalendarDirection", (t) =>
  t.string({
    authScopes: { authenticated: true },
    args: { direction: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateGoogleCalendarDirection(ctx.userId!, args.direction);
      return args.direction;
    },
  }),
);

builder.queryField("googleCalendarTargetListId", (t) =>
  t.string({
    nullable: true,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getGoogleCalendarTargetListId(ctx.userId!);
    },
  }),
);

builder.mutationField("updateGoogleCalendarTargetListId", (t) =>
  t.string({
    nullable: true,
    authScopes: { authenticated: true },
    args: { listId: t.arg.string({ required: false }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateGoogleCalendarTargetListId(ctx.userId!, args.listId ?? null);
      return args.listId ?? null;
    },
  }),
);

builder.mutationField("disconnectGoogleCalendar", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      // Clear channel settings (channel will expire on its own since we
      // don't persist the resourceId needed to call stopChannel)
      await ctx.services.user.updateGoogleCalendarChannel(ctx.userId!, null, null);
      await ctx.services.user.updateGoogleCalendarEnabled(ctx.userId!, false);
      await ctx.services.user.updateGoogleCalendarSyncToken(ctx.userId!, null);
      return true;
    },
  }),
);
