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
