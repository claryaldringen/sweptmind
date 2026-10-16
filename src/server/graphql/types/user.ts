import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { UserRef } from "./refs";
import { AI_MODELS, DEFAULT_AI_MODEL, isValidModel } from "@/domain/config/ai-models";
import { EmailMismatchError } from "@/domain/services/account.service";

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
    llmModel: t.string({
      resolve: (user) => user.llmModel ?? DEFAULT_AI_MODEL,
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

// AI model options for settings UI
const AiModelOptionType = builder.objectType(
  builder.objectRef<{ id: string; label: string; monthlyLimit: number }>("AiModelOption"),
  {
    fields: (t) => ({
      id: t.exposeString("id"),
      label: t.exposeString("label"),
      monthlyLimit: t.exposeInt("monthlyLimit"),
    }),
  },
);

builder.queryField("aiModels", (t) =>
  t.field({
    type: [AiModelOptionType],
    authScopes: { authenticated: true },
    resolve: () => AI_MODELS,
  }),
);

// AI usage for current month
const AiUsageType = builder.objectType(
  builder.objectRef<{ used: number; limit: number; model: string }>("AiUsage"),
  {
    fields: (t) => ({
      used: t.exposeInt("used"),
      limit: t.exposeInt("limit"),
      model: t.exposeString("model"),
    }),
  },
);

builder.queryField("aiUsage", (t) =>
  t.field({
    type: AiUsageType,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      if (!ctx.userId) throw new Error("Not authenticated");
      return ctx.services.ai.getUsage(ctx.userId);
    },
  }),
);

builder.mutationField("updateAiModel", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      model: t.arg.string({ required: true }),
    },
    resolve: async (_root, { model }, ctx) => {
      if (!ctx.userId) return false;
      if (!isValidModel(model)) {
        throw new Error(`Invalid model: ${model}`);
      }
      await ctx.services.user.updateLlmModel(ctx.userId, model);
      return true;
    },
  }),
);

builder.mutationField("updateClientSettings", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      timezone: t.arg.string(),
      locale: t.arg.string(),
    },
    resolve: async (_root, { timezone, locale }, ctx) => {
      if (!ctx.userId) return false;
      await ctx.services.user.updateClientSettings(ctx.userId, { timezone, locale });
      return true;
    },
  }),
);

builder.mutationField("deleteAccount", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (_root, { email }, ctx) => {
      // A leaked CLI/MCP token must not be able to wipe the whole account
      if (ctx.viaApiToken) {
        throw new GraphQLError("Account deletion requires signing in", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      try {
        await ctx.services.account.deleteAccount(ctx.userId!, email);
      } catch (err) {
        // Unlike plain errors, a GraphQLError reaches the client unmasked
        if (err instanceof EmailMismatchError) {
          throw new GraphQLError(err.message, { extensions: { code: "EMAIL_MISMATCH" } });
        }
        throw err;
      }
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
