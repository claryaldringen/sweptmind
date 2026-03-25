import { builder } from "../builder";
import { TaskAiAnalysisRef } from "./refs";
import type { ShoppingItem, ShoppingItemSuggestion } from "@/domain/entities/task-ai-analysis";

const CallIntentRef = builder.objectRef<{ name: string; reason: string | null }>("CallIntent");
CallIntentRef.implement({
  fields: (t) => ({
    name: t.exposeString("name"),
    reason: t.exposeString("reason", { nullable: true }),
  }),
});

const DecompositionStepRef = builder.objectRef<{
  title: string;
  listName: string | null;
  dependsOn: number | null;
}>("DecompositionStep");
DecompositionStepRef.implement({
  fields: (t) => ({
    title: t.exposeString("title"),
    listName: t.exposeString("listName", { nullable: true }),
    dependsOn: t.exposeInt("dependsOn", { nullable: true }),
  }),
});

const ShoppingItemSuggestionRef =
  builder.objectRef<ShoppingItemSuggestion>("ShoppingItemSuggestion");
ShoppingItemSuggestionRef.implement({
  fields: (t) => ({
    action: t.exposeString("action"),
    target: t.exposeString("target"),
    targetId: t.exposeString("targetId", { nullable: true }),
    confidence: t.exposeFloat("confidence"),
    reason: t.exposeString("reason"),
  }),
});

const ShoppingItemRef = builder.objectRef<ShoppingItem>("ShoppingItem");
ShoppingItemRef.implement({
  fields: (t) => ({
    stepId: t.exposeString("stepId", { nullable: true }),
    stepTitle: t.exposeString("stepTitle"),
    suggestions: t.field({
      type: [ShoppingItemSuggestionRef],
      resolve: (item) => item.suggestions,
    }),
  }),
});

export const TaskAiAnalysisType = TaskAiAnalysisRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    taskId: t.exposeString("taskId"),
    isActionable: t.exposeBoolean("isActionable"),
    suggestion: t.exposeString("suggestion", { nullable: true }),
    suggestedTitle: t.exposeString("suggestedTitle", { nullable: true }),
    projectName: t.exposeString("projectName", { nullable: true }),
    decomposition: t.field({
      type: [DecompositionStepRef],
      nullable: true,
      resolve: (analysis) => analysis.decomposition ?? null,
    }),
    duplicateTaskId: t.exposeString("duplicateTaskId", { nullable: true }),
    callIntent: t.field({
      type: CallIntentRef,
      nullable: true,
      resolve: (analysis) => analysis.callIntent ?? null,
    }),
    shoppingDistribution: t.field({
      type: [ShoppingItemRef],
      nullable: true,
      resolve: (analysis) => analysis.shoppingDistribution ?? null,
    }),
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
      locale: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.userId) return null;
      return ctx.services.ai.analyzeTask(args.taskId, ctx.userId, args.locale ?? "en");
    },
  }),
);

builder.mutationField("markTasksActionable", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      taskIds: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.userId) return false;
      await ctx.services.ai.markActionable(args.taskIds, ctx.userId);
      return true;
    },
  }),
);
