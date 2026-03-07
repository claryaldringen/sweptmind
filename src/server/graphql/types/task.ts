import { builder } from "../builder";
import { TaskRef, ListRef, StepRef, TagRef, LocationRef } from "./refs";
import { createTaskSchema, updateTaskSchema, importTaskSchema } from "@/lib/graphql-validators";

export const TaskType = TaskRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    listId: t.exposeString("listId"),
    locationId: t.exposeString("locationId", { nullable: true }),
    title: t.exposeString("title"),
    notes: t.exposeString("notes", { nullable: true }),
    isCompleted: t.exposeBoolean("isCompleted"),
    completedAt: t.string({
      nullable: true,
      resolve: (task) => task.completedAt?.toISOString() ?? null,
    }),
    dueDate: t.exposeString("dueDate", { nullable: true }),
    reminderAt: t.exposeString("reminderAt", { nullable: true }),
    recurrence: t.exposeString("recurrence", { nullable: true }),
    deviceContext: t.exposeString("deviceContext", { nullable: true }),
    sortOrder: t.exposeInt("sortOrder"),
    createdAt: t.string({
      resolve: (task) => task.createdAt.toISOString(),
    }),
    list: t.field({
      type: ListRef,
      resolve: async (task, _args, ctx) => {
        const list = await ctx.loaders.listById.load(task.listId);
        return list!;
      },
    }),
    location: t.field({
      type: LocationRef,
      nullable: true,
      resolve: async (task, _args, ctx) => {
        if (task.locationId) {
          return ctx.loaders.locationById.load(task.locationId);
        }
        // Fall back to list's location
        const list = await ctx.loaders.listById.load(task.listId);
        if (list?.locationId) {
          return ctx.loaders.locationById.load(list.locationId);
        }
        return null;
      },
    }),
    steps: t.field({
      type: [StepRef],
      resolve: async (task, _args, ctx) => {
        return ctx.loaders.stepsByTaskId.load(task.id);
      },
    }),
    tags: t.field({
      type: [TagRef],
      resolve: async (task, _args, ctx) => {
        return ctx.loaders.tagsByTaskId.load(task.id);
      },
    }),
  }),
});

// Queries
builder.queryField("tasksByList", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      listId: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false }),
      offset: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.getByList(args.listId, ctx.userId!, {
        limit: args.limit ?? 200,
        offset: args.offset ?? 0,
      }),
  }),
);

builder.queryField("task", (t) =>
  t.field({
    type: TaskType,
    nullable: true,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.getById(args.id, ctx.userId!),
  }),
);

builder.queryField("plannedTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      limit: t.arg.int({ required: false }),
      offset: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.getPlanned(ctx.userId!, {
        limit: args.limit ?? 200,
        offset: args.offset ?? 0,
      }),
  }),
);

builder.queryField("allTasksWithLocation", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      limit: t.arg.int({ required: false }),
      offset: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.getWithLocation(ctx.userId!, {
        limit: args.limit ?? 1000,
        offset: args.offset ?? 0,
      }),
  }),
);

builder.queryField("contextTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      deviceContext: t.arg.string({ required: false }),
      nearbyLocationIds: t.arg.stringList({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.getContextTasks(
        ctx.userId!,
        args.deviceContext ?? null,
        args.nearbyLocationIds ?? [],
      ),
  }),
);

// Input types
const CreateTaskInput = builder.inputType("CreateTaskInput", {
  fields: (t) => ({
    listId: t.string({ required: true }),
    title: t.string({ required: true }),
    notes: t.string(),
    dueDate: t.string(),
    locationId: t.string(),
    deviceContext: t.string(),
  }),
});

const UpdateTaskInput = builder.inputType("UpdateTaskInput", {
  fields: (t) => ({
    title: t.string(),
    notes: t.string(),
    dueDate: t.string(),
    reminderAt: t.string(),
    recurrence: t.string(),
    listId: t.string(),
    locationId: t.string(),
    deviceContext: t.string(),
  }),
});

const ReorderTaskInput = builder.inputType("ReorderTaskInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    sortOrder: t.int({ required: true }),
  }),
});

// Mutations
builder.mutationField("createTask", (t) =>
  t.field({
    type: TaskType,
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CreateTaskInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const input = createTaskSchema.parse(args.input);
      return ctx.services.task.create(ctx.userId!, input);
    },
  }),
);

builder.mutationField("updateTask", (t) =>
  t.field({
    type: TaskType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      input: t.arg({ type: UpdateTaskInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const input = updateTaskSchema.parse(args.input);
      return ctx.services.task.update(args.id, ctx.userId!, input);
    },
  }),
);

builder.mutationField("deleteTask", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.delete(args.id, ctx.userId!),
  }),
);

builder.mutationField("toggleTaskCompleted", (t) =>
  t.field({
    type: TaskType,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.toggleCompleted(args.id, ctx.userId!),
  }),
);

builder.mutationField("reorderTasks", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: [ReorderTaskInput], required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.reorder(ctx.userId!, args.input),
  }),
);

builder.mutationField("convertTaskToList", (t) =>
  t.field({
    type: ListRef,
    authScopes: { authenticated: true },
    args: { taskId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.convertToList(args.taskId, ctx.userId!),
  }),
);

// Import tasks
const ImportTaskInput = builder.inputType("ImportTaskInput", {
  fields: (t) => ({
    title: t.string({ required: true }),
    dueDate: t.string(),
    notes: t.string(),
    isCompleted: t.boolean(),
    listName: t.string(),
  }),
});

const ImportTasksResultType = builder.objectType(
  builder.objectRef<{ importedCount: number; createdLists: string[] }>("ImportTasksResult"),
  {
    fields: (t) => ({
      importedCount: t.exposeInt("importedCount"),
      createdLists: t.exposeStringList("createdLists"),
    }),
  },
);

builder.mutationField("importTasks", (t) =>
  t.field({
    type: ImportTasksResultType,
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: [ImportTaskInput], required: true }) },
    resolve: async (_root, args, ctx) => {
      const input = args.input.map((item) => importTaskSchema.parse(item));
      return ctx.services.task.importTasks(ctx.userId!, input);
    },
  }),
);
