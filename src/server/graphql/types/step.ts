import { builder } from "../builder";
import { StepRef } from "./refs";
import { createStepSchema } from "@/lib/graphql-validators";

export const StepType = StepRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    taskId: t.exposeString("taskId"),
    title: t.exposeString("title"),
    isCompleted: t.exposeBoolean("isCompleted"),
    sortOrder: t.exposeInt("sortOrder"),
    createdAt: t.string({
      resolve: (step) => step.createdAt.toISOString(),
    }),
  }),
});

const CreateStepInput = builder.inputType("CreateStepInput", {
  fields: (t) => ({
    id: t.string({ required: false }),
    taskId: t.string({ required: true }),
    title: t.string({ required: true }),
  }),
});

builder.mutationField("createStep", (t) =>
  t.field({
    type: StepType,
    authScopes: { authenticated: true },
    args: {
      input: t.arg({ type: CreateStepInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const input = createStepSchema.parse(args.input);
      return ctx.services.step.create(
        ctx.userId!,
        input.taskId,
        input.title,
        input.id ?? undefined,
      );
    },
  }),
);

builder.mutationField("updateStep", (t) =>
  t.field({
    type: StepType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      title: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => ctx.services.step.update(ctx.userId!, args.id, args.title),
  }),
);

builder.mutationField("deleteStep", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => ctx.services.step.delete(ctx.userId!, args.id),
  }),
);

builder.mutationField("toggleStepCompleted", (t) =>
  t.field({
    type: StepType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => ctx.services.step.toggleCompleted(ctx.userId!, args.id),
  }),
);

builder.mutationField("deleteSteps", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.step.deleteMany(ctx.userId!, args.ids),
  }),
);

const ReorderStepInput = builder.inputType("ReorderStepInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    sortOrder: t.int({ required: true }),
  }),
});

builder.mutationField("reorderSteps", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      input: t.arg({ type: [ReorderStepInput], required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.step.reorder(ctx.userId!, args.taskId, args.input),
  }),
);
