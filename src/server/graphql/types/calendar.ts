import { builder } from "../builder";

builder.mutationField("getCalendarToken", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.auth.getCalendarToken(ctx.userId!);
    },
  }),
);

builder.mutationField("regenerateCalendarToken", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.auth.regenerateCalendarToken(ctx.userId!);
    },
  }),
);

builder.mutationField("updateCalendarSyncAll", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: { syncAll: t.arg.boolean({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.auth.updateCalendarSyncAll(ctx.userId!, args.syncAll);
      return args.syncAll;
    },
  }),
);

builder.queryField("calendarSyncAll", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.auth.getCalendarSyncAll(ctx.userId!);
    },
  }),
);
