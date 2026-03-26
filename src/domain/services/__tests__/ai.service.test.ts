import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiService } from "../ai.service";
import { SubscriptionService } from "../subscription.service";
import type { ITaskAiAnalysisRepository } from "../../repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { ILlmProvider } from "../../ports/llm-provider";
import type { IUserRepository } from "../../repositories/user.repository";
import type { IAiUsageRepository } from "../../repositories/ai-usage.repository";
import type { IStepRepository } from "../../repositories/step.repository";
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
    dueDateEnd: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    blockedByTaskId: null,
    shareCompletionMode: null,
    shareCompletionAction: null,
    shareCompletionListId: null,
    forceCalendarSync: false,
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
    suggestedTitle: null,
    projectName: null,
    decomposition: null,
    duplicateTaskId: null,
    callIntent: null,
    shoppingDistribution: null,
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
    countDependentByTaskIds: vi.fn().mockResolvedValue(new Map()),
    searchTasks: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findActiveByUser: vi.fn().mockResolvedValue([]),
    findCompletedByUser: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findByIdUnchecked: vi.fn(),
    updateUnchecked: vi.fn(),
    ...overrides,
  };
}

function makeListRepo(): IListRepository {
  return {
    findDefault: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([
      {
        id: "list-1",
        name: "Tasks",
        userId: "user-1",
        isDefault: true,
        groupId: null,
        sortOrder: 0,
        createdAt: new Date(),
      },
    ]),
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
    analyzeTask: vi.fn().mockResolvedValue({
      isActionable: true,
      suggestion: null,
      suggestedTitle: null,
      projectName: null,
      steps: null,
      duplicateTaskId: null,
      callIntent: null,
      shoppingDistribution: null,
    }),
    isConfigured: vi.fn().mockReturnValue(true),
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
    calendarSyncDateRange: false,
    calendarToken: null,
    calendarTargetListId: null,
    googleCalendarEnabled: false,
    googleCalendarDirection: "both",
    googleCalendarId: "primary",
    googleCalendarSyncToken: null,
    googleCalendarChannelId: null,
    googleCalendarChannelExpiry: null,
    googleCalendarTargetListId: null,
    aiEnabled: true,
    llmModel: null,
    sharingDefaultListId: null,
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
    updateCalendarSyncDateRange: vi.fn(),
    getCalendarSyncDateRange: vi.fn().mockResolvedValue(false),
    updateCalendarTargetListId: vi.fn(),
    getCalendarTargetListId: vi.fn().mockResolvedValue(null),
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn().mockResolvedValue(null),
    validatePasswordResetToken: vi.fn().mockResolvedValue(null),
    deletePasswordResetToken: vi.fn(),
    updateAiEnabled: vi.fn(),
    updateLlmModel: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn().mockResolvedValue(false),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn().mockResolvedValue("both"),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    updateGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarTargetListId: vi.fn().mockResolvedValue(null),
    getGoogleCalendarSettings: vi.fn().mockResolvedValue({
      enabled: false,
      direction: "both",
      calendarId: "primary",
      syncToken: null,
      channelId: null,
      channelExpiry: null,
      targetListId: null,
    }),
    findUsersWithGoogleCalendarEnabled: vi.fn().mockResolvedValue([]),
    findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
    updateSharingDefaultList: vi.fn(),
  };
}

function makeStepRepo(): IStepRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByTask: vi.fn().mockResolvedValue([]),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    updateSortOrder: vi.fn(),
  };
}

function makeAiUsageRepo(): IAiUsageRepository {
  return {
    getByUserAndMonth: vi.fn().mockResolvedValue(undefined),
    increment: vi.fn().mockResolvedValue({
      id: "usage-1",
      userId: "user-1",
      yearMonth: "2026-03",
      analysisCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };
}

describe("AiService", () => {
  let analysisRepo: ITaskAiAnalysisRepository;
  let taskRepo: ITaskRepository;
  let llm: ILlmProvider;
  let subscriptionService: SubscriptionService;
  let userRepo: IUserRepository;
  let aiUsageRepo: IAiUsageRepository;
  let service: AiService;

  beforeEach(() => {
    analysisRepo = makeAnalysisRepo();
    taskRepo = makeTaskRepo();
    llm = makeLlmProvider();
    subscriptionService = makeSubscriptionService(true);
    userRepo = makeUserRepo();
    aiUsageRepo = makeAiUsageRepo();
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      userRepo,
      aiUsageRepo,
      makeStepRepo(),
    );
  });

  it("vrati cachovanu analyzu pokud se title nezmenil (nevola LLM)", async () => {
    const task = makeTask({ title: "Buy groceries" });
    const cached = makeAnalysis({ analyzedTitle: "Buy groceries", isActionable: true });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(cached);

    const result = await service.analyzeTask("task-1", "user-1");

    expect(result).toEqual(cached);
    expect(llm.analyzeTask).not.toHaveBeenCalled();
    expect(analysisRepo.upsert).not.toHaveBeenCalled();
  });

  it("zavola LLM a ulozi vysledek kdyz analyza neexistuje", async () => {
    const task = makeTask({ title: "Buy groceries" });
    const newAnalysis = makeAnalysis({
      isActionable: true,
      suggestion: null,
      projectName: null,
      decomposition: null,
    });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(undefined);
    vi.mocked(analysisRepo.upsert).mockResolvedValue(newAnalysis);

    const result = await service.analyzeTask("task-1", "user-1");

    expect(result).toEqual(newAnalysis);
    expect(llm.analyzeTask).toHaveBeenCalledWith(
      "Buy groceries",
      "en",
      {
        lists: ["Tasks"],
        tasks: [],
        deviceContext: null,
        listName: null,
        steps: [],
        completedTaskHistory: [],
      },
      "gpt-4o-mini",
    );
    expect(aiUsageRepo.increment).toHaveBeenCalled();
  });

  it("znovu analyzuje kdyz se title zmenil (zavola LLM)", async () => {
    const task = makeTask({ title: "Buy milk and eggs" });
    const oldCached = makeAnalysis({ analyzedTitle: "Buy groceries" });
    const updatedAnalysis = makeAnalysis({
      analyzedTitle: "Buy milk and eggs",
      isActionable: true,
      suggestion: null,
      projectName: null,
      decomposition: null,
    });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(oldCached);
    vi.mocked(analysisRepo.upsert).mockResolvedValue(updatedAnalysis);

    const result = await service.analyzeTask("task-1", "user-1");

    expect(result).toEqual(updatedAnalysis);
    expect(llm.analyzeTask).toHaveBeenCalled();
    expect(aiUsageRepo.increment).toHaveBeenCalled();
  });

  it("vyhodi chybu pro ne-premium uzivatele", async () => {
    subscriptionService = makeSubscriptionService(false);
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      userRepo,
      aiUsageRepo,
      makeStepRepo(),
    );

    await expect(service.analyzeTask("task-1", "user-1")).rejects.toThrow(
      "Premium subscription required",
    );
    expect(taskRepo.findById).not.toHaveBeenCalled();
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("vyhodi chybu kdyz je budget vycerpany", async () => {
    vi.mocked(aiUsageRepo.getByUserAndMonth).mockResolvedValue({
      id: "usage-1",
      userId: "user-1",
      yearMonth: "2026-03",
      analysisCount: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const task = makeTask({ title: "Buy groceries" });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);

    await expect(service.analyzeTask("task-1", "user-1")).rejects.toThrow(
      "Monthly AI analysis limit reached",
    );
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("vyhodi chybu kdyz task neexistuje", async () => {
    vi.mocked(taskRepo.findById).mockResolvedValue(undefined);

    await expect(service.analyzeTask("nonexistent", "user-1")).rejects.toThrow("Task not found");
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("vyhodi chybu kdyz je AI zakazano na uzivateli", async () => {
    userRepo = makeUserRepo({ aiEnabled: false });
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      userRepo,
      aiUsageRepo,
      makeStepRepo(),
    );

    await expect(service.analyzeTask("task-1", "user-1")).rejects.toThrow("AI is not configured");
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("vyhodi chybu kdyz LLM neni nakonfigurovano", async () => {
    llm = makeLlmProvider({ isConfigured: vi.fn().mockReturnValue(false) });
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      userRepo,
      aiUsageRepo,
      makeStepRepo(),
    );

    await expect(service.analyzeTask("task-1", "user-1")).rejects.toThrow("AI is not configured");
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  it("pouzije uzivateluv zvoleny model pro LLM volani", async () => {
    userRepo = makeUserRepo({ llmModel: "gpt-4.1" });
    aiUsageRepo = makeAiUsageRepo();
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      userRepo,
      aiUsageRepo,
      makeStepRepo(),
    );

    const task = makeTask({ title: "Buy groceries" });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);
    vi.mocked(analysisRepo.findByTaskId).mockResolvedValue(undefined);
    vi.mocked(analysisRepo.upsert).mockResolvedValue(makeAnalysis({ isActionable: true }));

    await service.analyzeTask("task-1", "user-1");

    expect(llm.analyzeTask).toHaveBeenCalledWith(
      "Buy groceries",
      "en",
      expect.any(Object),
      "gpt-4.1",
    );
  });

  it("budget respektuje limit zvoleneho modelu", async () => {
    userRepo = makeUserRepo({ llmModel: "gpt-4.1" });
    aiUsageRepo = makeAiUsageRepo();
    vi.mocked(aiUsageRepo.getByUserAndMonth).mockResolvedValue({
      id: "usage-1",
      userId: "user-1",
      yearMonth: "2026-03",
      analysisCount: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    service = new AiService(
      analysisRepo,
      taskRepo,
      makeListRepo(),
      llm,
      subscriptionService,
      userRepo,
      aiUsageRepo,
      makeStepRepo(),
    );

    const task = makeTask({ title: "Buy groceries" });
    vi.mocked(taskRepo.findById).mockResolvedValue(task);

    await expect(service.analyzeTask("task-1", "user-1")).rejects.toThrow(
      "Monthly AI analysis limit reached",
    );
    expect(llm.analyzeTask).not.toHaveBeenCalled();
  });

  describe("getUsage", () => {
    it("vrati usage pro default model kdyz uzivatel nema zvoleny", async () => {
      const result = await service.getUsage("user-1");

      expect(result).toEqual({ used: 0, limit: 500, model: "gpt-4o-mini" });
    });

    it("vrati usage s limitem dle zvoleneho modelu", async () => {
      userRepo = makeUserRepo({ llmModel: "gpt-4.1-mini" });
      vi.mocked(aiUsageRepo.getByUserAndMonth).mockResolvedValue({
        id: "usage-1",
        userId: "user-1",
        yearMonth: "2026-03",
        analysisCount: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      service = new AiService(
        analysisRepo,
        taskRepo,
        makeListRepo(),
        llm,
        subscriptionService,
        userRepo,
        aiUsageRepo,
        makeStepRepo(),
      );

      const result = await service.getUsage("user-1");

      expect(result).toEqual({ used: 42, limit: 200, model: "gpt-4.1-mini" });
    });
  });

  describe("markActionable", () => {
    it("oznaci existujici tasky jako actionable", async () => {
      const task1 = makeTask({ id: "t1", title: "Task 1" });
      const task2 = makeTask({ id: "t2", title: "Task 2" });
      vi.mocked(taskRepo.findById).mockResolvedValueOnce(task1).mockResolvedValueOnce(task2);

      await service.markActionable(["t1", "t2"], "user-1");

      expect(analysisRepo.upsert).toHaveBeenCalledTimes(2);
      expect(analysisRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "t1", isActionable: true }),
      );
      expect(analysisRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "t2", isActionable: true }),
      );
    });

    it("preskoci neexistujici tasky", async () => {
      vi.mocked(taskRepo.findById)
        .mockResolvedValueOnce(makeTask({ id: "t1" }))
        .mockResolvedValueOnce(undefined);

      await service.markActionable(["t1", "t2"], "user-1");

      expect(analysisRepo.upsert).toHaveBeenCalledTimes(1);
    });
  });
});

describe("ai-models config", () => {
  it("getModelConfig vrati spravny config pro zname modely", async () => {
    const { getModelConfig } = await import("../../config/ai-models");

    expect(getModelConfig("gpt-4o-mini")).toEqual({
      id: "gpt-4o-mini",
      label: "GPT-4o Mini",
      monthlyLimit: 500,
    });
    expect(getModelConfig("gpt-4.1")).toEqual({
      id: "gpt-4.1",
      label: "GPT-4.1",
      monthlyLimit: 50,
    });
  });

  it("getModelConfig vrati default pro neznamy model", async () => {
    const { getModelConfig } = await import("../../config/ai-models");

    expect(getModelConfig("nonexistent")).toEqual(expect.objectContaining({ id: "gpt-4o-mini" }));
    expect(getModelConfig(null)).toEqual(expect.objectContaining({ id: "gpt-4o-mini" }));
  });

  it("isValidModel rozpozna platne a neplatne modely", async () => {
    const { isValidModel } = await import("../../config/ai-models");

    expect(isValidModel("gpt-4o-mini")).toBe(true);
    expect(isValidModel("gpt-4.1-mini")).toBe(true);
    expect(isValidModel("gpt-4.1")).toBe(true);
    expect(isValidModel("nonexistent")).toBe(false);
    expect(isValidModel("")).toBe(false);
  });
});
