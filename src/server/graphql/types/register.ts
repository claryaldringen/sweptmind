import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { UserRef } from "./refs";
import { registerInputSchema } from "@/lib/graphql-validators";

const RegisterInput = builder.inputType("RegisterInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

builder.mutationField("register", (t) =>
  t.field({
    type: UserRef,
    args: { input: t.arg({ type: RegisterInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const input = registerInputSchema.parse(args.input);
      let user;
      try {
        user = await ctx.services.auth.register(input.name, input.email, input.password);
      } catch {
        throw new GraphQLError("Registration failed");
      }
      await ctx.services.list.createDefaultList(user.id);
      await ctx.services.user.updateOnboardingCompleted(user.id, false);
      return user;
    },
  }),
);
