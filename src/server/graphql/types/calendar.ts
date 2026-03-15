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
