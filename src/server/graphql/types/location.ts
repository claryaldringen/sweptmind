import { builder } from "../builder";
import { LocationRef } from "./refs";
import { createLocationSchema, updateLocationSchema } from "@/lib/graphql-validators";

export const LocationType = LocationRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    latitude: t.exposeFloat("latitude"),
    longitude: t.exposeFloat("longitude"),
    address: t.exposeString("address", { nullable: true }),
    createdAt: t.string({
      resolve: (location) => location.createdAt.toISOString(),
    }),
  }),
});

// Queries
builder.queryField("locations", (t) =>
  t.field({
    type: [LocationType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.location.getByUser(ctx.userId!),
  }),
);

builder.queryField("location", (t) =>
  t.field({
    type: LocationType,
    nullable: true,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.location.getById(args.id, ctx.userId!),
  }),
);

// Input types
const CreateLocationInput = builder.inputType("CreateLocationInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    latitude: t.float({ required: true }),
    longitude: t.float({ required: true }),
    address: t.string(),
  }),
});

const UpdateLocationInput = builder.inputType("UpdateLocationInput", {
  fields: (t) => ({
    name: t.string(),
    latitude: t.float(),
    longitude: t.float(),
    address: t.string(),
  }),
});

// Mutations
builder.mutationField("createLocation", (t) =>
  t.field({
    type: LocationType,
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CreateLocationInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const input = createLocationSchema.parse(args.input);
      return ctx.services.location.create(ctx.userId!, {
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address ?? undefined,
      });
    },
  }),
);

builder.mutationField("updateLocation", (t) =>
  t.field({
    type: LocationType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      input: t.arg({ type: UpdateLocationInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const input = updateLocationSchema.parse(args.input);
      return ctx.services.location.update(args.id, ctx.userId!, {
        name: input.name ?? undefined,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        address: input.address !== undefined ? input.address : undefined,
      });
    },
  }),
);

builder.mutationField("deleteLocation", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.location.delete(args.id, ctx.userId!),
  }),
);
