import type { TaskAiAnalysis } from "../entities/task-ai-analysis";
import type { ITaskAiAnalysisRepository } from "../repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IUserRepository } from "../repositories/user.repository";
import type { IAiUsageRepository } from "../repositories/ai-usage.repository";
import type { IStepRepository } from "../repositories/step.repository";
import type { ILlmProvider } from "../ports/llm-provider";
import type { SubscriptionService } from "./subscription.service";
import { getModelConfig } from "../config/ai-models";

export class AiService {
  constructor(
    private readonly analysisRepo: ITaskAiAnalysisRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly listRepo: IListRepository,
    private readonly defaultLlm: ILlmProvider,
    private readonly subscriptionService: SubscriptionService,
    private readonly userRepo: IUserRepository,
    private readonly aiUsageRepo: IAiUsageRepository,
    private readonly stepRepo: IStepRepository,
  ) {}

  private async checkBudget(userId: string, model: string): Promise<void> {
    const config = getModelConfig(model);
    const yearMonth = new Date().toISOString().slice(0, 7);
    const usage = await this.aiUsageRepo.getByUserAndMonth(userId, yearMonth);
    const currentCount = usage?.analysisCount ?? 0;
    if (currentCount >= config.monthlyLimit) {
      throw new Error(
        `Monthly AI analysis limit reached (${config.monthlyLimit}/${config.monthlyLimit})`,
      );
    }
  }

  async getUsage(userId: string): Promise<{ used: number; limit: number; model: string }> {
    const user = await this.userRepo.findById(userId);
    const model = user?.llmModel ?? "gpt-4o-mini";
    const config = getModelConfig(model);
    const yearMonth = new Date().toISOString().slice(0, 7);
    const usage = await this.aiUsageRepo.getByUserAndMonth(userId, yearMonth);
    return {
      used: usage?.analysisCount ?? 0,
      limit: config.monthlyLimit,
      model: config.id,
    };
  }

  async analyzeTask(taskId: string, userId: string, locale = "en"): Promise<TaskAiAnalysis> {
    const isPremium = await this.subscriptionService.isPremium(userId);
    if (!isPremium) {
      throw new Error("Premium subscription required");
    }

    const user = await this.userRepo.findById(userId);
    if (user && !user.aiEnabled) {
      throw new Error("AI is not configured");
    }

    if (!this.defaultLlm.isConfigured()) {
      throw new Error("AI is not configured");
    }

    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Check cache — return if title hasn't changed and result is complete
    const cached = await this.analysisRepo.findByTaskId(taskId);
    if (cached && cached.analyzedTitle === task.title) {
      const needsReanalysis =
        !cached.isActionable &&
        !cached.decomposition &&
        !cached.suggestedTitle &&
        !cached.duplicateTaskId &&
        !cached.callIntent &&
        !cached.shoppingDistribution;
      if (!needsReanalysis) return cached;
    }

    // Check budget before making LLM call
    const model = user?.llmModel ?? "gpt-4o-mini";
    await this.checkBudget(userId, model);

    // Get user's lists, active tasks, steps, and completed history for context
    const [lists, activeTasks, taskList, steps, completedTasks] = await Promise.all([
      this.listRepo.findByUser(userId),
      this.taskRepo.findActiveByUser(userId),
      task.listId ? this.listRepo.findById(task.listId, userId) : Promise.resolve(undefined),
      this.stepRepo.findByTask(taskId),
      this.taskRepo.findCompletedByUser(userId, 50, 0),
    ]);
    const listNames = lists.map((l) => l.name);
    const otherTasks = activeTasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({ id: t.id, title: t.title }));

    // Build completed task history for shopping pattern detection
    const completedStepMap = await this.stepRepo.findByTaskIds(completedTasks.map((t) => t.id));
    const completedTaskHistory = completedTasks.map((t) => ({
      title: t.title,
      listName: lists.find((l) => l.id === t.listId)?.name ?? "unknown",
      hadSteps: (completedStepMap.get(t.id)?.length ?? 0) > 0,
      completedAt: t.completedAt?.toISOString().slice(0, 10) ?? "",
    }));

    // Call LLM — single prompt handles analysis, decomposition, duplicate detection, call intent, and shopping distribution
    const result = await this.defaultLlm.analyzeTask(
      task.title,
      locale,
      {
        lists: listNames,
        tasks: otherTasks,
        deviceContext: task.deviceContext,
        listName: taskList?.name ?? null,
        steps: steps.map((s) => s.title),
        completedTaskHistory,
      },
      model,
    );

    // Resolve shopping distribution names to IDs
    let resolvedDistribution = result.shoppingDistribution;
    if (resolvedDistribution) {
      for (const item of resolvedDistribution) {
        const matchedStep = steps.find(
          (s) => s.title.toLowerCase() === item.stepTitle.toLowerCase(),
        );
        for (const suggestion of item.suggestions) {
          if (suggestion.action === "add_to_task") {
            const matchedTask = activeTasks.find(
              (t) =>
                t.title.toLowerCase().includes(suggestion.target.toLowerCase()) ||
                suggestion.target.toLowerCase().includes(t.title.toLowerCase()),
            );
            (suggestion as { targetId?: string | null }).targetId = matchedTask?.id ?? null;
          } else {
            const matchedList = lists.find(
              (l) => l.name.toLowerCase() === suggestion.target.toLowerCase(),
            );
            (suggestion as { targetId?: string | null }).targetId = matchedList?.id ?? null;
          }
        }
        item.suggestions = item.suggestions.filter(
          (s) => (s as { targetId?: string | null }).targetId != null,
        );
        (item as { stepId?: string | null }).stepId = matchedStep?.id ?? null;
      }
      resolvedDistribution = resolvedDistribution.filter((i) => i.suggestions.length > 0);
      if (resolvedDistribution.length === 0) resolvedDistribution = null;
    }

    // Increment usage counter after successful call
    const yearMonth = new Date().toISOString().slice(0, 7);
    await this.aiUsageRepo.increment(userId, yearMonth);

    // Cache result
    return this.analysisRepo.upsert({
      taskId,
      isActionable: result.isActionable,
      suggestion: result.suggestion,
      suggestedTitle: result.suggestedTitle,
      projectName: result.projectName,
      decomposition: result.steps,
      duplicateTaskId: result.duplicateTaskId,
      callIntent: result.callIntent,
      shoppingDistribution: resolvedDistribution
        ? resolvedDistribution.map((item) => ({
            stepId: (item as { stepId?: string | null }).stepId ?? null,
            stepTitle: item.stepTitle,
            suggestions: item.suggestions.map((s) => ({
              action: s.action,
              target: s.target,
              targetId: (s as { targetId?: string | null }).targetId ?? null,
              confidence: s.confidence,
              reason: s.reason,
            })),
          }))
        : null,
      analyzedTitle: task.title,
    });
  }

  /** Pre-mark tasks as actionable (e.g. after decomposition — no LLM call). */
  async markActionable(taskIds: string[], userId: string): Promise<void> {
    const tasks = await Promise.all(taskIds.map((id) => this.taskRepo.findById(id, userId)));
    for (let i = 0; i < taskIds.length; i++) {
      const task = tasks[i];
      if (!task) continue;
      await this.analysisRepo.upsert({
        taskId: task.id,
        isActionable: true,
        suggestion: null,
        suggestedTitle: null,
        projectName: null,
        decomposition: null,
        duplicateTaskId: null,
        callIntent: null,
        shoppingDistribution: null,
        analyzedTitle: task.title,
      });
    }
  }
}
