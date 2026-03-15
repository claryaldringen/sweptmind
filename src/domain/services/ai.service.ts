import type { TaskAiAnalysis } from "../entities/task-ai-analysis";
import type { ITaskAiAnalysisRepository } from "../repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IUserRepository } from "../repositories/user.repository";
import type { ILlmProvider, DecomposeResponse } from "../ports/llm-provider";
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
    return this.defaultLlm;
  }

  async analyzeTask(taskId: string, userId: string): Promise<TaskAiAnalysis> {
    const isPremium = await this.subscriptionService.isPremium(userId);
    if (!isPremium) {
      throw new Error("Premium subscription required");
    }

    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Check cache — return if title hasn't changed
    const cached = await this.analysisRepo.findByTaskId(taskId);
    if (cached && cached.analyzedTitle === task.title) {
      return cached;
    }

    // Resolve provider (user-specific or default)
    const llm = await this.resolveProvider(userId);

    // Call LLM
    const result = await llm.analyzeTask(task.title);

    // Cache result
    return this.analysisRepo.upsert({
      taskId,
      isActionable: result.isActionable,
      suggestion: result.suggestion,
      analyzedTitle: task.title,
    });
  }

  async decomposeTask(taskId: string, userId: string): Promise<DecomposeResponse> {
    const isPremium = await this.subscriptionService.isPremium(userId);
    if (!isPremium) {
      throw new Error("Premium subscription required");
    }

    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) {
      throw new Error("Task not found");
    }

    const lists = await this.listRepo.findByUser(userId);
    const listNames = lists.map((l) => l.name);

    const llm = await this.resolveProvider(userId);
    return llm.decomposeTask(task.title, { lists: listNames, tags: [] });
  }
}
