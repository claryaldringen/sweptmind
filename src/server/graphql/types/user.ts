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
    aiEnabled: t.exposeBoolean("aiEnabled"),
    llmProvider: t.exposeString("llmProvider", { nullable: true }),
    llmApiKey: t.string({
      nullable: true,
      resolve: (user) => (user.llmApiKey ? "••••••••" : null),
    }),
    llmBaseUrl: t.exposeString("llmBaseUrl", { nullable: true }),
    llmModel: t.exposeString("llmModel", { nullable: true }),
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

const UpdateLlmConfigInput = builder.inputType("UpdateLlmConfigInput", {
  fields: (t) => ({
    llmProvider: t.string({ required: false }),
    llmApiKey: t.string({ required: false }),
    llmBaseUrl: t.string({ required: false }),
    llmModel: t.string({ required: false }),
  }),
});

builder.mutationField("updateLlmConfig", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      input: t.arg({ type: UpdateLlmConfigInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      if (!ctx.userId) return false;
      await ctx.services.user.updateLlmConfig(ctx.userId, {
        llmProvider: input.llmProvider ?? null,
        llmApiKey: input.llmApiKey ?? null,
        llmBaseUrl: input.llmBaseUrl ?? null,
        llmModel: input.llmModel ?? null,
      });
      return true;
    },
  }),
);

builder.mutationField("updateAiEnabled", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      enabled: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, { enabled }, ctx) => {
      if (!ctx.userId) return false;
      await ctx.services.user.updateAiEnabled(ctx.userId, enabled);
      return true;
    },
  }),
);
