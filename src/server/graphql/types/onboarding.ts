import { builder } from "../builder";

const OnboardingLocationInput = builder.inputType("OnboardingLocationInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    latitude: t.float({ required: true }),
    longitude: t.float({ required: true }),
    address: t.string(),
  }),
});

const OnboardingListInput = builder.inputType("OnboardingListInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    icon: t.string(),
    deviceContext: t.string(),
    location: t.field({ type: OnboardingLocationInput }),
  }),
});

const CompleteOnboardingInput = builder.inputType("CompleteOnboardingInput", {
  fields: (t) => ({
    lists: t.field({ type: [OnboardingListInput], required: true }),
  }),
});

builder.mutationField("completeOnboarding", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CompleteOnboardingInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      if (!ctx.userId) throw new Error("Not authenticated");
      const lists = args.input.lists.map((l) => ({
        name: l.name,
        icon: l.icon ?? null,
        deviceContext: l.deviceContext ?? null,
        location: l.location
          ? {
              name: l.location.name,
              latitude: l.location.latitude,
              longitude: l.location.longitude,
              address: l.location.address ?? null,
            }
          : null,
      }));
      await ctx.services.onboarding.complete(ctx.userId, lists);
      return true;
    },
  }),
);

builder.mutationField("skipOnboarding", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      if (!ctx.userId) throw new Error("Not authenticated");
      await ctx.services.onboarding.skip(ctx.userId);
      return true;
    },
  }),
);
