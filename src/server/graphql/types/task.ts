import { builder } from "../builder";
import {
  TaskRef,
  ListRef,
  StepRef,
  TagRef,
  LocationRef,
  AttachmentRef,
  TaskAiAnalysisRef,
} from "./refs";
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
    dueDateEnd: t.exposeString("dueDateEnd", { nullable: true }),
    reminderAt: t.exposeString("reminderAt", { nullable: true }),
    recurrence: t.exposeString("recurrence", { nullable: true }),
    locationRadius: t.exposeFloat("locationRadius", { nullable: true }),
    deviceContext: t.exposeString("deviceContext", { nullable: true }),
    forceCalendarSync: t.exposeBoolean("forceCalendarSync"),
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
    blockedByTaskId: t.exposeString("blockedByTaskId", { nullable: true }),
    blockedByTask: t.field({
      type: TaskRef,
      nullable: true,
      resolve: async (task, _args, ctx) => {
        if (!task.blockedByTaskId) return null;
        return ctx.services.task.getById(task.blockedByTaskId, ctx.userId!);
      },
    }),
    blockedByTaskIsCompleted: t.boolean({
      nullable: true,
      resolve: async (task, _args, ctx) => {
        if (!task.blockedByTaskId) return null;
        const blocker = await ctx.services.task.getById(task.blockedByTaskId, ctx.userId!);
        return blocker?.isCompleted ?? null;
      },
    }),
    dependentTaskCount: t.int({
      resolve: async (task, _args, ctx) => {
        return ctx.loaders.dependentTaskCountByTaskId.load(task.id);
      },
    }),
    attachments: t.field({
      type: [AttachmentRef],
      resolve: async (task, _args, ctx) => {
        return ctx.loaders.attachmentsByTaskId.load(task.id);
      },
    }),
    aiAnalysis: t.field({
      type: TaskAiAnalysisRef,
      nullable: true,
      resolve: async (task, _args, ctx) => {
        return ctx.loaders.aiAnalysisByTaskId.load(task.id);
      },
    }),
    isGoogleCalendarEvent: t.boolean({
      resolve: async (task, _args, ctx) => {
        const syncEntry = await ctx.loaders.calendarSyncByTaskId.load(task.id);
        return syncEntry?.googleCalendarEventId != null;
      },
    }),
    isSharedTo: t.boolean({
      resolve: async (task, _args, ctx) => {
        if (!ctx.userId) return false;
        const shares = await ctx.loaders.sharedTasksBySourceTaskId.load(task.id);
        return shares.length > 0;
      },
    }),
    isSharedFrom: t.boolean({
      resolve: async (task, _args, ctx) => {
        if (!ctx.userId) return false;
        const source = await ctx.loaders.sharedTaskByTargetTaskId.load(task.id);
        return !!source;
      },
    }),
    shareCompletionMode: t.exposeString("shareCompletionMode", { nullable: true }),
    shareCompletionAction: t.exposeString("shareCompletionAction", { nullable: true }),
    shareCompletionListId: t.exposeString("shareCompletionListId", { nullable: true }),
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

builder.queryField("allTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.task.getByUser(ctx.userId!),
  }),
);

builder.queryField("activeTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => ctx.services.task.getActiveByUser(ctx.userId!),
  }),
);

const CompletedTasksConnectionType = builder.objectType(
  builder.objectRef<{ tasks: import("@/domain/entities/task").Task[]; hasMore: boolean }>(
    "CompletedTasksConnection",
  ),
  {
    fields: (t) => ({
      tasks: t.field({
        type: [TaskType],
        resolve: (parent) => parent.tasks,
      }),
      hasMore: t.exposeBoolean("hasMore"),
    }),
  },
);

builder.queryField("completedTasks", (t) =>
  t.field({
    type: CompletedTasksConnectionType,
    authScopes: { authenticated: true },
    args: {
      limit: t.arg.int({ required: true }),
      offset: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.getCompletedByUser(ctx.userId!, args.limit, args.offset ?? 0),
  }),
);

builder.queryField("searchTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      query: t.arg.string({ required: true }),
      tagIds: t.arg.stringList({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const query = args.query.trim();
      if (query.length < 1) return [];
      return ctx.services.task.searchTasks(ctx.userId!, query, args.tagIds ?? undefined);
    },
  }),
);

// Input types
const CreateTaskInput = builder.inputType("CreateTaskInput", {
  fields: (t) => ({
    id: t.string({ required: false }),
    listId: t.string({ required: true }),
    title: t.string({ required: true }),
    notes: t.string(),
    dueDate: t.string(),
    dueDateEnd: t.string(),
    locationId: t.string(),
    locationRadius: t.float({ required: false }),
    deviceContext: t.string(),
  }),
});

const UpdateTaskInput = builder.inputType("UpdateTaskInput", {
  fields: (t) => ({
    title: t.string(),
    notes: t.string(),
    dueDate: t.string(),
    dueDateEnd: t.string(),
    reminderAt: t.string(),
    recurrence: t.string(),
    listId: t.string(),
    locationId: t.string(),
    locationRadius: t.float({ required: false }),
    deviceContext: t.string(),
    blockedByTaskId: t.string(),
    shareCompletionMode: t.string(),
    shareCompletionAction: t.string(),
    shareCompletionListId: t.string(),
    forceCalendarSync: t.boolean({ required: false }),
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

builder.mutationField("cloneTask", (t) =>
  t.field({
    type: TaskType,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => ctx.services.task.clone(args.id, ctx.userId!),
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

// Bulk operations
const BulkTaskUpdateInput = builder.inputType("BulkTaskUpdateInput", {
  fields: (t) => ({
    listId: t.string(),
    dueDate: t.string(),
    dueDateEnd: t.string(),
    recurrence: t.string(),
    deviceContext: t.string(),
  }),
});

builder.mutationField("deleteTasks", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.deleteMany(args.ids, ctx.userId!),
  }),
);

builder.mutationField("updateTasks", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      ids: t.arg.stringList({ required: true }),
      input: t.arg({ type: BulkTaskUpdateInput, required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.updateMany(args.ids, ctx.userId!, {
        listId: args.input.listId ?? undefined,
        dueDate: args.input.dueDate ?? undefined,
        dueDateEnd: args.input.dueDateEnd ?? undefined,
        recurrence: args.input.recurrence ?? undefined,
        deviceContext: args.input.deviceContext ?? undefined,
      }),
  }),
);

builder.mutationField("setTasksCompleted", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      ids: t.arg.stringList({ required: true }),
      isCompleted: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.setManyCompleted(args.ids, ctx.userId!, args.isCompleted),
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
