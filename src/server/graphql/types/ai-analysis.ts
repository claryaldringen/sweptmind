import { builder } from "../builder";
import { TaskAiAnalysisRef } from "./refs";

export const TaskAiAnalysisType = TaskAiAnalysisRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    taskId: t.exposeString("taskId"),
    isActionable: t.exposeBoolean("isActionable"),
    suggestion: t.exposeString("suggestion", { nullable: true }),
    analyzedTitle: t.exposeString("analyzedTitle"),
    createdAt: t.string({
      resolve: (analysis) => analysis.createdAt.toISOString(),
    }),
  }),
});

builder.mutationField("analyzeTask", (t) =>
  t.field({
    type: TaskAiAnalysisType,
    nullable: true,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.userId) return null;
      return ctx.services.ai.analyzeTask(args.taskId, ctx.userId);
    },
  }),
);

// Decomposition types
const DecomposeStepRef = builder.objectRef<{ title: string; listName: string | null; dependsOn: number | null }>("DecomposeStep");
DecomposeStepRef.implement({
  fields: (t) => ({
    title: t.exposeString("title"),
    listName: t.exposeString("listName", { nullable: true }),
    dependsOn: t.exposeInt("dependsOn", { nullable: true }),
  }),
});

const DecomposeResultRef = builder.objectRef<{ projectName: string; steps: { title: string; listName: string | null; dependsOn: number | null }[] }>("DecomposeResult");
DecomposeResultRef.implement({
  fields: (t) => ({
    projectName: t.exposeString("projectName"),
    steps: t.field({
      type: [DecomposeStepRef],
      resolve: (parent) => parent.steps,
    }),
  }),
});

builder.mutationField("decomposeTask", (t) =>
  t.field({
    type: DecomposeResultRef,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.userId) return { projectName: "", steps: [] };
      return ctx.services.ai.decomposeTask(args.taskId, ctx.userId);
    },
  }),
);
