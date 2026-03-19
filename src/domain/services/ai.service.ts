import type { TaskAiAnalysis } from "../entities/task-ai-analysis";
import type { ITaskAiAnalysisRepository } from "../repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IUserRepository } from "../repositories/user.repository";
import type { ILlmProvider } from "../ports/llm-provider";
import type { SubscriptionService } from "./subscription.service";

export interface ILlmProviderFactory {
  create(config: {
    provider: string;
    apiKey: string;
    baseUrl?: string | null;
    model?: string | null;
  }): ILlmProvider;
}

export class AiService {
  constructor(
    private readonly analysisRepo: ITaskAiAnalysisRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly listRepo: IListRepository,
    private readonly defaultLlm: ILlmProvider,
    private readonly subscriptionService: SubscriptionService,
    private readonly userRepo: IUserRepository,
    private readonly llmFactory: ILlmProviderFactory,
  ) {}

  private async resolveProvider(userId: string): Promise<ILlmProvider> {
    const user = await this.userRepo.findById(userId);
    if (user?.llmProvider && user.llmApiKey) {
      return this.llmFactory.create({
        provider: user.llmProvider,
        apiKey: user.llmApiKey,
        baseUrl: user.llmBaseUrl,
        model: user.llmModel,
      });
    }
    if (!this.defaultLlm.isConfigured()) {
      throw new Error("AI is not configured");
    }
    return this.defaultLlm;
  }

  async analyzeTask(taskId: string, userId: string, locale = "en"): Promise<TaskAiAnalysis> {
    const isPremium = await this.subscriptionService.isPremium(userId);
    if (!isPremium) {
      throw new Error("Premium subscription required");
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
        !cached.callIntent;
      if (!needsReanalysis) return cached;
    }

    // Get user's lists and active tasks for context
    const [lists, activeTasks, taskList] = await Promise.all([
      this.listRepo.findByUser(userId),
      this.taskRepo.findActiveByUser(userId),
      task.listId ? this.listRepo.findById(task.listId, userId) : Promise.resolve(undefined),
    ]);
    const listNames = lists.map((l) => l.name);
    const otherTasks = activeTasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({ id: t.id, title: t.title }));

    // Resolve provider (user-specific or default)
    const llm = await this.resolveProvider(userId);

    // Call LLM — single prompt handles analysis, decomposition, duplicate detection, and call intent
    const result = await llm.analyzeTask(task.title, locale, {
      lists: listNames,
      tasks: otherTasks,
      deviceContext: task.deviceContext,
      listName: taskList?.name ?? null,
    });

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
        analyzedTitle: task.title,
      });
    }
  }
}
