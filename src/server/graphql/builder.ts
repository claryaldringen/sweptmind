import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import type { GraphQLContext } from "./context";

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  AuthScopes: {
    authenticated: boolean;
  };
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    authScopes: async (context) => ({
      authenticated: !!context.userId,
    }),
  },
});

builder.queryType({});
builder.mutationType({});
