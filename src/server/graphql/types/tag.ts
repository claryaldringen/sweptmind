import { builder } from "../builder";
import { TagRef, LocationRef } from "./refs";
import { TaskType } from "./task";
import { createTagSchema, updateTagSchema } from "@/lib/graphql-validators";

export const TagType = TagRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    color: t.exposeString("color"),
    deviceContext: t.exposeString("deviceContext", { nullable: true }),
    locationId: t.exposeString("locationId", { nullable: true }),
    locationRadius: t.exposeFloat("locationRadius", { nullable: true }),
    location: t.field({
      type: LocationRef,
      nullable: true,
      resolve: async (tag, _args, ctx) => {
        if (!tag.locationId) return null;
        return ctx.loaders.locationById.load(tag.locationId);
      },
    }),
    createdAt: t.string({
      resolve: (tag) => tag.createdAt.toISOString(),
    }),
    taskCount: t.int({
      resolve: async (tag, _args, ctx) => {
        return ctx.loaders.taskCountByTagId.load(tag.id);
      },
    }),
  }),
});

// Queries
builder.queryField("tags", (t) =>
  t.field({
    type: [TagType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.tag.getByUser(ctx.userId!),
  }),
);

builder.queryField("tasksByTag", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: { tagId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.tag.getTasksByTag(args.tagId, ctx.userId!),
  }),
);

// Input types
const CreateTagInput = builder.inputType("CreateTagInput", {
  fields: (t) => ({
    id: t.string({ required: false }),
    name: t.string({ required: true }),
    color: t.string(),
    deviceContext: t.string(),
    locationId: t.string(),
    locationRadius: t.float({ required: false }),
  }),
});

const UpdateTagInput = builder.inputType("UpdateTagInput", {
  fields: (t) => ({
    name: t.string(),
    color: t.string(),
    deviceContext: t.string(),
    locationId: t.string(),
    locationRadius: t.float({ required: false }),
  }),
});

// Mutations
builder.mutationField("createTag", (t) =>
  t.field({
    type: TagType,
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CreateTagInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const input = createTagSchema.parse(args.input);
      return ctx.services.tag.create(ctx.userId!, {
        id: input.id ?? undefined,
        name: input.name,
        color: input.color ?? undefined,
        deviceContext: input.deviceContext ?? undefined,
        locationId: input.locationId ?? undefined,
        locationRadius: input.locationRadius ?? undefined,
      });
    },
  }),
);

builder.mutationField("updateTag", (t) =>
  t.field({
    type: TagType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      input: t.arg({ type: UpdateTagInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const input = updateTagSchema.parse(args.input);
      return ctx.services.tag.update(args.id, ctx.userId!, {
        name: input.name ?? undefined,
        color: input.color ?? undefined,
        deviceContext: input.deviceContext,
        locationId: input.locationId,
        locationRadius: input.locationRadius,
      });
    },
  }),
);

builder.mutationField("deleteTag", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.tag.delete(args.id, ctx.userId!),
  }),
);

builder.mutationField("addTagToTask", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      tagId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.tag.addToTask(args.taskId, args.tagId, ctx.userId!),
  }),
);

builder.mutationField("removeTagFromTask", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      tagId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.tag.removeFromTask(args.taskId, args.tagId, ctx.userId!),
  }),
);
