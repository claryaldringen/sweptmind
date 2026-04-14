import { builder } from "../builder";
import { ApiTokenRef } from "./refs";

export const ApiTokenType = ApiTokenRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    lastUsedAt: t.string({
      nullable: true,
      resolve: (token) => token.lastUsedAt?.toISOString() ?? null,
    }),
    createdAt: t.string({
      resolve: (token) => token.createdAt.toISOString(),
    }),
  }),
});

// Query: list user's API tokens
builder.queryField("apiTokens", (t) =>
  t.field({
    type: [ApiTokenType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.apiToken.listTokens(ctx.userId!);
    },
  }),
);

// Mutation: create API token (returns raw token — shown only once)
const CreateApiTokenPayload = builder.objectRef<{
  rawToken: string;
  id: string;
  name: string;
}>("CreateApiTokenPayload");
CreateApiTokenPayload.implement({
  fields: (t) => ({
    rawToken: t.exposeString("rawToken"),
    id: t.exposeString("id"),
    name: t.exposeString("name"),
  }),
});

builder.mutationField("createApiToken", (t) =>
  t.field({
    type: CreateApiTokenPayload,
    authScopes: { authenticated: true },
    args: {
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, { name }, ctx) => {
      const { rawToken, token } = await ctx.services.apiToken.createToken(
        ctx.userId!,
        name,
      );
      return { rawToken, id: token.id, name: token.name };
    },
  }),
);

// Mutation: revoke API token
builder.mutationField("revokeApiToken", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      await ctx.services.apiToken.revokeToken(id);
      return true;
    },
  }),
);
