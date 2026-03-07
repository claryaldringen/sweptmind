import { builder } from "../builder";
import { ListRef, TaskRef, LocationRef } from "./refs";
import { createListSchema, updateListSchema } from "@/lib/graphql-validators";

export const ListType = ListRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    icon: t.exposeString("icon", { nullable: true }),
    themeColor: t.exposeString("themeColor", { nullable: true }),
    isDefault: t.exposeBoolean("isDefault"),
    sortOrder: t.exposeInt("sortOrder"),
    groupId: t.exposeString("groupId", { nullable: true }),
    locationId: t.exposeString("locationId", { nullable: true }),
    deviceContext: t.exposeString("deviceContext", { nullable: true }),
    taskCount: t.int({
      resolve: async (list, _args, ctx) => ctx.loaders.taskCountByListId.load(list.id),
    }),
    visibleTaskCount: t.int({
      resolve: async (list, _args, ctx) => ctx.loaders.visibleTaskCountByListId.load(list.id),
    }),
    location: t.field({
      type: LocationRef,
      nullable: true,
      resolve: async (list, _args, ctx) => {
        if (!list.locationId) return null;
        return ctx.loaders.locationById.load(list.locationId);
      },
    }),
    tasks: t.field({
      type: [TaskRef],
      resolve: async (list, _args, ctx) => ctx.services.task.getByListId(list.id, ctx.userId!),
    }),
    createdAt: t.string({
      resolve: (list) => list.createdAt.toISOString(),
    }),
  }),
});

// Queries
builder.queryField("lists", (t) =>
  t.field({
    type: [ListType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.list.getByUser(ctx.userId!),
  }),
);

builder.queryField("list", (t) =>
  t.field({
    type: ListType,
    nullable: true,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.list.getById(args.id, ctx.userId!),
  }),
);

// Input types
const CreateListInput = builder.inputType("CreateListInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    icon: t.string(),
    themeColor: t.string(),
    groupId: t.string(),
  }),
});

const UpdateListInput = builder.inputType("UpdateListInput", {
  fields: (t) => ({
    name: t.string(),
    icon: t.string(),
    themeColor: t.string(),
    groupId: t.string(),
    locationId: t.string(),
    deviceContext: t.string(),
  }),
});

const ReorderListInput = builder.inputType("ReorderListInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    sortOrder: t.int({ required: true }),
  }),
});

// Mutations
builder.mutationField("createList", (t) =>
  t.field({
    type: ListType,
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CreateListInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const input = createListSchema.parse(args.input);
      return ctx.services.list.create(ctx.userId!, input);
    },
  }),
);

builder.mutationField("updateList", (t) =>
  t.field({
    type: ListType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      input: t.arg({ type: UpdateListInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const input = updateListSchema.parse(args.input);
      return ctx.services.list.update(args.id, ctx.userId!, input);
    },
  }),
);

builder.mutationField("deleteList", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.list.delete(args.id, ctx.userId!),
  }),
);

builder.mutationField("reorderLists", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: [ReorderListInput], required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.list.reorder(ctx.userId!, args.input),
  }),
);
