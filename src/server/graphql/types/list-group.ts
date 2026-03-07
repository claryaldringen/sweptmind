import { builder } from "../builder";
import { ListGroupRef, ListRef } from "./refs";

export const ListGroupType = ListGroupRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    sortOrder: t.exposeInt("sortOrder"),
    isExpanded: t.exposeBoolean("isExpanded"),
    lists: t.field({
      type: [ListRef],
      resolve: async (group, _args, ctx) => ctx.services.list.getByGroup(group.id),
    }),
    createdAt: t.string({
      resolve: (group) => group.createdAt.toISOString(),
    }),
  }),
});

builder.queryField("listGroups", (t) =>
  t.field({
    type: [ListGroupType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.listGroup.getByUser(ctx.userId!),
  }),
);

const CreateListGroupInput = builder.inputType("CreateListGroupInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
  }),
});

builder.mutationField("createListGroup", (t) =>
  t.field({
    type: ListGroupType,
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CreateListGroupInput, required: true }) },
    resolve: async (_root, args, ctx) =>
      ctx.services.listGroup.create(ctx.userId!, args.input.name),
  }),
);

builder.mutationField("updateListGroup", (t) =>
  t.field({
    type: ListGroupType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.listGroup.update(args.id, ctx.userId!, args.name),
  }),
);

builder.mutationField("deleteListGroup", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.listGroup.delete(args.id, ctx.userId!),
  }),
);
