import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiService } from "../ai.service";
import { SubscriptionService } from "../subscription.service";
import type { ITaskAiAnalysisRepository } from "../../repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { ILlmProvider } from "../../ports/llm-provider";
import type { IUserRepository } from "../../repositories/user.repository";
import type { ILlmProviderFactory } from "../ai.service";
import type { TaskAiAnalysis } from "../../entities/task-ai-analysis";
import type { Task } from "../../entities/task";
import type { User } from "../../entities/user";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    locationRadius: null,
    title: "Buy groceries",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    blockedByTaskId: null,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<TaskAiAnalysis> = {}): TaskAiAnalysis {
  return {
    id: "analysis-1",
    taskId: "task-1",
    isActionable: false,
    suggestion: 'Rewrite as "Buy milk and eggs at the store"',
    analyzedTitle: "Buy groceries",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeAnalysisRepo(
  overrides: Partial<ITaskAiAnalysisRepository> = {},
): ITaskAiAnalysisRepository {
  return {
    findByTaskId: vi.fn().mockResolvedValue(undefined),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    upsert: vi.fn(),
    deleteByTaskId: vi.fn(),
    ...overrides,
  };
}

function makeTaskRepo(overrides: Partial<ITaskRepository> = {}): ITaskRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByList: vi.fn().mockResolvedValue([]),
    findPlanned: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    findMinSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateSortOrder: vi.fn(),
    countActiveByList: vi.fn().mockResolvedValue(0),
    countActiveByListIds: vi.fn().mockResolvedValue(new Map()),
    countVisibleByList: vi.fn().mockResolvedValue(0),
    countVisibleByListIds: vi.fn().mockResolvedValue(new Map()),
    findByListId: vi.fn().mockResolvedValue([]),
    findByTagId: vi.fn().mockResolvedValue([]),
    findWithLocation: vi.fn().mockResolvedValue([]),
    findContextTasks: vi.fn().mockResolvedValue([]),
    findDependentTaskIds: vi.fn().mockResolvedValue([]),
    searchTasks: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findActiveByUser: vi.fn().mockResolvedValue([]),
    findCompletedByUser: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    ...overrides,
  };
}

function makeListRepo(): IListRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findByGroup: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
    deleteManyNonDefault: vi.fn(),
  };
}

function makeLlmProvider(overrides: Partial<ILlmProvider> = {}): ILlmProvider {
  return {
    analyzeTask: vi
      .fn()
      .mockResolvedValue({ isActionable: true, suggestion: "Looks good as an action" }),
    decomposeTask: vi
      .fn()
      .mockResolvedValue({ steps: [] }),
    ...overrides,
  };
}

function makeSubscriptionService(isPremium = true): SubscriptionService {
  const svc = {
    isPremium: vi.fn().mockResolvedValue(isPremium),
    getSubscription: vi.fn().mockResolvedValue(undefined),
    activateBankTransfer: vi.fn(),
    handleStripeSubscriptionUpdate: vi.fn(),
  } as unknown as SubscriptionService;
  return svc;
}

function makeUserRepo(overrides: Partial<User> = {}): IUserRepository {
  const user: User = {
    id: "user-1",
    name: "Test",
    email: "test@test.com",
    emailVerified: null,
    image: null,
    hashedPassword: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    onboardingCompleted: true,
    calendarSyncAll: false,
    calendarToken: null,
    llmProvider: null,
    llmApiKey: null,
    llmBaseUrl: null,
    llmModel: null,
    ...overrides,
  };
  return {
    findById: vi.fn().mockResolvedValue(user),
    findByEmail: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    findByCalendarToken: vi.fn().mockResolvedValue(undefined),
    getCalendarToken: vi.fn().mockResolvedValue(""),
    regenerateCalendarToken: vi.fn().mockResolvedValue(""),
    updateCalendarSyncAll: vi.fn(),
    getCalendarSyncAll: vi.fn().mockResolvedValue(false),
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn().mockResolvedValue(null),
    validatePasswordResetToken: vi.fn().mockResolvedValue(null),
    deletePasswordResetToken: vi.fn(),
    updateLlmConfig: vi.fn(),
  };
}

function makeLlmFactory(): ILlmProviderFactory {
  return {
    create: vi.fn().mockReturnValue(makeLlmProvider()),
  };
}

describe("AiService", () => {
  let analysisRepo: ITaskAiAnalysisRepository;
  let taskRepo: ITaskRepository;
  let llm: ILlmProvider;
  let subscriptionService: SubscriptionService;
  let userRepo: IUserRepository;
  let llmFactory: ILlmProviderFactory;
  let service: AiService;

  beforeEach(() => {
    analysisRepo = makeAnalysisRepo();
    taskRepo = makeTaskRepo();
    llm = makeLlmProvider();
    subscriptionService = makeSubscriptionService(true);
    userRepo = makeUserRepo();
    llmFactory = makeLlmFactory();
    service = new AiService(analysisRepo, taskRepo, makeListRepo(), llm, subscriptionService, userRepo, llmFactory);
  });

  it("vrati cachovanu analyzu pokud se title nezmenil (nevola LLM)", async () => {
    const task = makeTask({ title: "Buy groceries" });
    const cached = makeAnalysis({ analyzedTitle: "Buy groceries" });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(cached);

    const result = await service.analyzeTask("task-1", "user-1");

    expect(result).toEqual(cached);
    expect(llm.analyzeTask).not.toHaveBeenCalled();
    expect(analysisRepo.upsert).not.toHaveBeenCalled();
  });

  it("zavola LLM a ulozi vysledek kdyz analyza neexistuje", async () => {
    const task = makeTask({ title: "Buy groceries" });
    const newAnalysis = makeAnalysis({ isActionable: true, suggestion: "Looks good as an action" });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(undefined);
    vi.mocked(analysisRepo.upsert).mockResolvedValue(newAnalysis);

    const result = await service.analyzeTask("task-1", "user-1");

    expect(result).toEqual(newAnalysis);
    expect(llm.analyzeTask).toHaveBeenCalledWith("Buy groceries");
    expect(analysisRepo.upsert).toHaveBeenCalledWith({
      taskId: "task-1",
      isActionable: true,
      suggestion: "Looks good as an action",
      analyzedTitle: "Buy groceries",
    });
  });

  it("znovu analyzuje kdyz se title zmenil (zavola LLM)", async () => {
    const task = makeTask({ title: "Buy milk and eggs" });
    const oldCached = makeAnalysis({ analyzedTitle: "Buy groceries" });
    const updatedAnalysis = makeAnalysis({
      analyzedTitle: "Buy milk and eggs",
      isActionable: true,
      suggestion: "Looks good as an action",
    });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(oldCached);
    vi.mocked(analysisRepo.upsert).mockResolvedValue(updatedAnalysis);

    const result = await service.analyzeTask("task-1", "user-1");

    expect(result).toEqual(updatedAnalysis);
    expect(llm.analyzeTask).toHaveBeenCalledWith("Buy milk and eggs");
    expect(analysisRepo.upsert).toHaveBeenCalledWith({
      taskId: "task-1",
      isActionable: true,
      suggestion: "Looks good as an action",
      analyzedTitle: "Buy milk and eggs",
    });
  });

  it("vyhodi chybu pro ne-premium uzivatele", async () => {
    subscriptionService = makeSubscriptionService(false);
    service = new AiService(analysisRepo, taskRepo, makeListRepo(), llm, subscriptionService, userRepo, llmFactory);

    await expect(service.analyzeTask("task-1", "user-1")).rejects.toThrow(
      "Premium subscription required",
    );
    expect(taskRepo.findById).not.toHaveBeenCalled();
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("pouzije uzivateluv vlastni LLM provider kdyz je nastaven", async () => {
    const customLlm = makeLlmProvider({
      analyzeTask: vi
        .fn()
        .mockResolvedValue({ isActionable: false, suggestion: "Custom suggestion" }),
    });
    const customUserRepo = makeUserRepo({
      llmProvider: "openai",
      llmApiKey: "sk-test",
      llmBaseUrl: "https://custom.api/v1",
      llmModel: "custom-model",
    });
    const customFactory: ILlmProviderFactory = { create: vi.fn().mockReturnValue(customLlm) };
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      customUserRepo,
      customFactory,
    );

    const task = makeTask({ title: "Handle project" });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.upsert).mockResolvedValue(
      makeAnalysis({ isActionable: false, suggestion: "Custom suggestion" }),
    );

    await service.analyzeTask("task-1", "user-1");

    expect(customFactory.create).toHaveBeenCalledWith({
      provider: "openai",
      apiKey: "sk-test",
      baseUrl: "https://custom.api/v1",
      model: "custom-model",
    });
    expect(customLlm.analyzeTask).toHaveBeenCalledWith("Handle project");
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("vyhodi chybu kdyz task neexistuje", async () => {
    vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

    await expect(service.analyzeTask("nonexistent", "user-1")).rejects.toThrow("Task not found");
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });
});
