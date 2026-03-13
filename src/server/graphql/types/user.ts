import { builder } from "../builder";
import { UserRef } from "./refs";

export const UserType = UserRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    image: t.exposeString("image", { nullable: true }),
    createdAt: t.string({
      resolve: (user) => user.createdAt.toISOString(),
    }),
    isPremium: t.field({
      type: "Boolean",
      resolve: async (user, _args, ctx) => {
        return ctx.services.subscription.isPremium(user.id);
      },
    }),
  }),
});

builder.queryField("me", (t) =>
  t.field({
    type: UserType,
    nullable: true,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      if (!ctx.userId) return null;
      return ctx.services.user.getById(ctx.userId);
    },
  }),
);
