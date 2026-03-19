# AI GTD Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically analyze visible tasks via LLM to identify which are not concrete GTD "next actions", showing a lightbulb icon with reformulation suggestion.

**Architecture:** New `task_ai_analyses` table stores cached LLM results. LLM calls go through a port/adapter abstraction (Ollama for dev, cloud LLM for prod). Client-side throttled background analysis for visible tasks. Premium-only feature.

**Tech Stack:** Drizzle ORM, GraphQL Yoga + Pothos, Apollo Client, Ollama REST API (`/api/chat`)

---

### Task 1: DB Schema — task_ai_analyses table

**Files:**
- Create: `src/server/db/schema/ai-analyses.ts`
- Modify: `src/server/db/schema/index.ts`
- Modify: `src/server/db/schema/relations.ts`

**Step 1: Create the schema file**

```typescript
// src/server/db/schema/ai-analyses.ts
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

export const taskAiAnalyses = pgTable(
  "task_ai_analyses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" })
      .unique(),
    isActionable: boolean("is_actionable").notNull(),
    suggestion: text("suggestion"),
    analyzedTitle: text("analyzed_title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("task_ai_analyses_task_id_idx").on(table.taskId)],
);
```

**Step 2: Export from schema index**

Add to `src/server/db/schema/index.ts`:
```typescript
export * from "./ai-analyses";
```

**Step 3: Add relations**

Add to `src/server/db/schema/relations.ts`:
```typescript
import { taskAiAnalyses } from "./ai-analyses";

export const taskAiAnalysesRelations = relations(taskAiAnalyses, ({ one }) => ({
  task: one(tasks, { fields: [taskAiAnalyses.taskId], references: [tasks.id] }),
}));
```

Also add to the existing `tasksRelations`:
```typescript
aiAnalysis: one(taskAiAnalyses, { fields: [tasks.id], references: [taskAiAnalyses.taskId] }),
```

**Step 4: Push schema**

Run: `yarn db:push`

**Step 5: Commit**

```bash
git add src/server/db/schema/ai-analyses.ts src/server/db/schema/index.ts src/server/db/schema/relations.ts
git commit -m "feat: add task_ai_analyses DB schema"
```

---

### Task 2: Domain Entity + Repository Interface

**Files:**
- Create: `src/domain/entities/task-ai-analysis.ts`
- Create: `src/domain/repositories/task-ai-analysis.repository.ts`

**Step 1: Create the entity**

```typescript
// src/domain/entities/task-ai-analysis.ts
export interface TaskAiAnalysis {
  id: string;
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  analyzedTitle: string;
  createdAt: Date;
}

export interface CreateAiAnalysisInput {
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  analyzedTitle: string;
}
```

**Step 2: Create the repository interface**

```typescript
// src/domain/repositories/task-ai-analysis.repository.ts
import type { TaskAiAnalysis, CreateAiAnalysisInput } from "../entities/task-ai-analysis";

export interface ITaskAiAnalysisRepository {
  findByTaskId(taskId: string): Promise<TaskAiAnalysis | undefined>;
  findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAiAnalysis>>;
  upsert(input: CreateAiAnalysisInput): Promise<TaskAiAnalysis>;
  deleteByTaskId(taskId: string): Promise<void>;
}
```

**Step 3: Commit**

```bash
git add src/domain/entities/task-ai-analysis.ts src/domain/repositories/task-ai-analysis.repository.ts
git commit -m "feat: add TaskAiAnalysis entity and repository interface"
```

---

### Task 3: Drizzle Repository Implementation

**Files:**
- Create: `src/infrastructure/persistence/drizzle-task-ai-analysis.repository.ts`

**Step 1: Implement the repository**

```typescript
// src/infrastructure/persistence/drizzle-task-ai-analysis.repository.ts
import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ITaskAiAnalysisRepository } from "@/domain/repositories/task-ai-analysis.repository";
import type { TaskAiAnalysis, CreateAiAnalysisInput } from "@/domain/entities/task-ai-analysis";

export class DrizzleTaskAiAnalysisRepository implements ITaskAiAnalysisRepository {
  constructor(private readonly db: Database) {}

  async findByTaskId(taskId: string): Promise<TaskAiAnalysis | undefined> {
    return this.db.query.taskAiAnalyses.findFirst({
      where: eq(schema.taskAiAnalyses.taskId, taskId),
    });
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAiAnalysis>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.taskAiAnalyses.findMany({
      where: inArray(schema.taskAiAnalyses.taskId, taskIds),
    });
    const map = new Map<string, TaskAiAnalysis>();
    for (const row of rows) {
      map.set(row.taskId, row);
    }
    return map;
  }

  async upsert(input: CreateAiAnalysisInput): Promise<TaskAiAnalysis> {
    const [result] = await this.db
      .insert(schema.taskAiAnalyses)
      .values(input)
      .onConflictDoUpdate({
        target: schema.taskAiAnalyses.taskId,
        set: {
          isActionable: input.isActionable,
          suggestion: input.suggestion,
          analyzedTitle: input.analyzedTitle,
          createdAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db
      .delete(schema.taskAiAnalyses)
      .where(eq(schema.taskAiAnalyses.taskId, taskId));
  }
}
```

**Step 2: Commit**

```bash
git add src/infrastructure/persistence/drizzle-task-ai-analysis.repository.ts
git commit -m "feat: add Drizzle TaskAiAnalysis repository implementation"
```

---

### Task 4: LLM Provider Abstraction (Port + Ollama Adapter)

**Files:**
- Create: `src/domain/ports/llm-provider.ts`
- Create: `src/infrastructure/llm/ollama-provider.ts`

**Step 1: Create the port interface**

```typescript
// src/domain/ports/llm-provider.ts
export interface LlmResponse {
  isActionable: boolean;
  suggestion: string | null;
}

export interface ILlmProvider {
  analyzeTask(title: string): Promise<LlmResponse>;
}
```

**Step 2: Create the Ollama adapter**

```typescript
// src/infrastructure/llm/ollama-provider.ts
import type { ILlmProvider, LlmResponse } from "@/domain/ports/llm-provider";

const SYSTEM_PROMPT = `You are a GTD (Getting Things Done) expert. Analyze whether a task title represents a concrete, single "next action" — a physical, visible activity that can be done in one sitting.

A good next action is specific and actionable: "Call dentist to schedule appointment", "Buy milk at Tesco", "Email report to John".
A bad next action is vague or multi-step: "Handle project", "Organize office", "Deal with taxes".

Respond with valid JSON only, no other text:
{"isActionable": true/false, "suggestion": "suggested reformulation or null"}

If isActionable is true, set suggestion to null.
If isActionable is false, suggest a concrete next action that would be a good first step.`;

export class OllamaProvider implements ILlmProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model = process.env.OLLAMA_MODEL || "llama3.1",
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async analyzeTask(title: string): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: title },
        ],
        stream: false,
        format: "json",
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.message?.content;
    if (!content) {
      throw new Error("Empty response from Ollama");
    }

    const parsed = JSON.parse(content);
    return {
      isActionable: Boolean(parsed.isActionable),
      suggestion: parsed.isActionable ? null : (parsed.suggestion ?? null),
    };
  }
}
```

**Step 3: Commit**

```bash
git add src/domain/ports/llm-provider.ts src/infrastructure/llm/ollama-provider.ts
git commit -m "feat: add LLM provider abstraction with Ollama adapter"
```

---

### Task 5: AiService Domain Service + Tests

**Files:**
- Create: `src/domain/services/ai.service.ts`
- Create: `src/domain/services/__tests__/ai.service.test.ts`

**Step 1: Write the tests**

```typescript
// src/domain/services/__tests__/ai.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiService } from "../ai.service";
import type { ITaskAiAnalysisRepository } from "@/domain/repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "@/domain/repositories/task.repository";
import type { ILlmProvider } from "@/domain/ports/llm-provider";
import type { ISubscriptionRepository } from "@/domain/repositories/subscription.repository";
import { SubscriptionService } from "../subscription.service";

function createMockRepo(): ITaskAiAnalysisRepository {
  return {
    findByTaskId: vi.fn(),
    findByTaskIds: vi.fn(),
    upsert: vi.fn(),
    deleteByTaskId: vi.fn(),
  };
}

function createMockTaskRepo(): Pick<ITaskRepository, "findById"> {
  return { findById: vi.fn() };
}

function createMockLlm(): ILlmProvider {
  return { analyzeTask: vi.fn() };
}

function createMockSubscriptionService() {
  const subRepo: ISubscriptionRepository = {
    findActiveByUser: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    findByStripeSubscriptionId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateStripeIds: vi.fn(),
  };
  return new SubscriptionService(subRepo);
}

describe("AiService", () => {
  let service: AiService;
  let repo: ITaskAiAnalysisRepository;
  let taskRepo: Pick<ITaskRepository, "findById">;
  let llm: ILlmProvider;
  let subscriptionService: SubscriptionService;

  beforeEach(() => {
    repo = createMockRepo();
    taskRepo = createMockTaskRepo();
    llm = createMockLlm();
    subscriptionService = createMockSubscriptionService();
    service = new AiService(repo, taskRepo as ITaskRepository, llm, subscriptionService);
  });

  describe("analyzeTask", () => {
    it("returns cached analysis if title matches", async () => {
      const cached = {
        id: "1",
        taskId: "t1",
        isActionable: false,
        suggestion: "Call dentist",
        analyzedTitle: "Handle dentist",
        createdAt: new Date(),
      };
      (repo.findByTaskId as ReturnType<typeof vi.fn>).mockResolvedValue(cached);
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        title: "Handle dentist",
        userId: "u1",
      });
      vi.spyOn(subscriptionService, "isPremium").mockResolvedValue(true);

      const result = await service.analyzeTask("t1", "u1");

      expect(result).toEqual(cached);
      expect(llm.analyzeTask).not.toHaveBeenCalled();
    });

    it("calls LLM and caches when no analysis exists", async () => {
      (repo.findByTaskId as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        title: "Handle project",
        userId: "u1",
      });
      vi.spyOn(subscriptionService, "isPremium").mockResolvedValue(true);
      (llm.analyzeTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        isActionable: false,
        suggestion: "Email John about project status",
      });
      const upserted = {
        id: "2",
        taskId: "t1",
        isActionable: false,
        suggestion: "Email John about project status",
        analyzedTitle: "Handle project",
        createdAt: new Date(),
      };
      (repo.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(upserted);

      const result = await service.analyzeTask("t1", "u1");

      expect(llm.analyzeTask).toHaveBeenCalledWith("Handle project");
      expect(repo.upsert).toHaveBeenCalled();
      expect(result).toEqual(upserted);
    });

    it("re-analyzes when title has changed", async () => {
      const stale = {
        id: "1",
        taskId: "t1",
        isActionable: true,
        suggestion: null,
        analyzedTitle: "Old title",
        createdAt: new Date(),
      };
      (repo.findByTaskId as ReturnType<typeof vi.fn>).mockResolvedValue(stale);
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t1",
        title: "New vague title",
        userId: "u1",
      });
      vi.spyOn(subscriptionService, "isPremium").mockResolvedValue(true);
      (llm.analyzeTask as ReturnType<typeof vi.fn>).mockResolvedValue({
        isActionable: false,
        suggestion: "Be more specific",
      });
      (repo.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "1",
        taskId: "t1",
        isActionable: false,
        suggestion: "Be more specific",
        analyzedTitle: "New vague title",
        createdAt: new Date(),
      });

      const result = await service.analyzeTask("t1", "u1");

      expect(llm.analyzeTask).toHaveBeenCalledWith("New vague title");
      expect(result.isActionable).toBe(false);
    });

    it("throws for non-premium users", async () => {
      vi.spyOn(subscriptionService, "isPremium").mockResolvedValue(false);

      await expect(service.analyzeTask("t1", "u1")).rejects.toThrow("Premium");
    });

    it("throws when task not found", async () => {
      vi.spyOn(subscriptionService, "isPremium").mockResolvedValue(true);
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await expect(service.analyzeTask("t1", "u1")).rejects.toThrow("not found");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/ai.service.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the service**

```typescript
// src/domain/services/ai.service.ts
import type { TaskAiAnalysis } from "../entities/task-ai-analysis";
import type { ITaskAiAnalysisRepository } from "../repositories/task-ai-analysis.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { ILlmProvider } from "../ports/llm-provider";
import type { SubscriptionService } from "./subscription.service";

export class AiService {
  constructor(
    private readonly analysisRepo: ITaskAiAnalysisRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly llm: ILlmProvider,
    private readonly subscriptionService: SubscriptionService,
  ) {}

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

    // Call LLM
    const result = await this.llm.analyzeTask(task.title);

    // Cache result
    return this.analysisRepo.upsert({
      taskId,
      isActionable: result.isActionable,
      suggestion: result.suggestion,
      analyzedTitle: task.title,
    });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/ai.service.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/domain/services/ai.service.ts src/domain/services/__tests__/ai.service.test.ts
git commit -m "feat: add AiService with GTD analysis and caching"
```

---

### Task 6: Wire Up in DI Container

**Files:**
- Modify: `src/infrastructure/container.ts`

**Step 1: Add imports and wiring**

Add to `src/infrastructure/container.ts`:

```typescript
import { DrizzleTaskAiAnalysisRepository } from "./persistence/drizzle-task-ai-analysis.repository";
import { OllamaProvider } from "./llm/ollama-provider";
import { AiService } from "@/domain/services/ai.service";

const aiAnalysisRepo = new DrizzleTaskAiAnalysisRepository(db);
const llmProvider = new OllamaProvider();
const aiService = new AiService(aiAnalysisRepo, taskRepo, llmProvider, subscriptionService);
```

Add `aiAnalysis: aiAnalysisRepo` to the `repos` object.
Add `ai: aiService` to the `services` object.

Also export `aiAnalysis` in the `Repos` type and `ai` in the `Services` type.

**Step 2: Commit**

```bash
git add src/infrastructure/container.ts
git commit -m "feat: wire AiService into DI container"
```

---

### Task 7: GraphQL Types + Mutation

**Files:**
- Modify: `src/server/graphql/types/refs.ts`
- Create: `src/server/graphql/types/ai-analysis.ts`
- Modify: `src/server/graphql/types/task.ts`
- Modify: `src/server/graphql/dataloaders.ts`
- Modify: `src/server/graphql/schema.ts`

**Step 1: Add ref**

In `src/server/graphql/types/refs.ts`:
```typescript
import type { TaskAiAnalysis } from "@/domain/entities/task-ai-analysis";
export const TaskAiAnalysisRef = builder.objectRef<TaskAiAnalysis>("TaskAiAnalysis");
```

**Step 2: Create the type + mutation**

```typescript
// src/server/graphql/types/ai-analysis.ts
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
```

**Step 3: Add DataLoader**

In `src/server/graphql/dataloaders.ts`, add:
```typescript
aiAnalysisByTaskId: new DataLoader(async (taskIds) => {
  const map = await repos.aiAnalysis.findByTaskIds([...taskIds]);
  return taskIds.map((id) => map.get(id) ?? null);
}),
```

Update the `DataLoaders` type accordingly.

**Step 4: Extend Task type**

In `src/server/graphql/types/task.ts`, add to `TaskType` fields:
```typescript
aiAnalysis: t.field({
  type: TaskAiAnalysisRef,
  nullable: true,
  resolve: async (task, _args, ctx) => {
    return ctx.loaders.aiAnalysisByTaskId.load(task.id);
  },
}),
```

**Step 5: Register in schema**

In `src/server/graphql/schema.ts`, add:
```typescript
import "./types/ai-analysis";
```

**Step 6: Commit**

```bash
git add src/server/graphql/types/refs.ts src/server/graphql/types/ai-analysis.ts \
  src/server/graphql/types/task.ts src/server/graphql/dataloaders.ts src/server/graphql/schema.ts
git commit -m "feat: add GraphQL types and mutation for AI analysis"
```

---

### Task 8: Client-side GraphQL Operations

**Files:**
- Create: `src/graphql/mutations/ai-analysis.graphql`
- Modify: `src/components/providers/app-data-provider.tsx` (add `aiAnalysis` to fragment)

**Step 1: Create mutation file**

```graphql
# src/graphql/mutations/ai-analysis.graphql
mutation AnalyzeTask($taskId: String!) {
  analyzeTask(taskId: $taskId) {
    id
    taskId
    isActionable
    suggestion
    analyzedTitle
  }
}
```

**Step 2: Add aiAnalysis to APP_TASK_FIELDS fragment**

In `src/components/providers/app-data-provider.tsx`, add to the fragment:
```graphql
aiAnalysis {
  id
  taskId
  isActionable
  suggestion
  analyzedTitle
}
```

Also add to the `AppTask` TypeScript type:
```typescript
aiAnalysis: {
  id: string;
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  analyzedTitle: string;
} | null;
```

**Step 3: Commit**

```bash
git add src/graphql/mutations/ai-analysis.graphql src/components/providers/app-data-provider.tsx
git commit -m "feat: add client-side GraphQL operations for AI analysis"
```

---

### Task 9: Lightbulb Icon in TaskItem

**Files:**
- Modify: `src/components/tasks/task-item.tsx`

**Step 1: Add lightbulb to metadata row**

Import `Lightbulb` from lucide-react.

In the metadata row, after the attachments badge, add:

```tsx
{/* AI Analysis — not actionable indicator */}
{task.aiAnalysis && !task.aiAnalysis.isActionable && (
  <>
    {hasMetadataBefore && <span className="text-muted-foreground">·</span>}
    <span className="flex items-center gap-0.5 text-yellow-500" title={task.aiAnalysis.suggestion ?? undefined}>
      <Lightbulb className="h-3 w-3" />
    </span>
  </>
)}
```

Also handle the loading state — when `aiAnalysis` is `null` but the task is being analyzed (this will be driven by the analysis hook in the next task), show a pulsing lightbulb:

```tsx
{analyzingTaskIds?.has(task.id) && (
  <>
    {hasMetadataBefore && <span className="text-muted-foreground">·</span>}
    <span className="flex items-center gap-0.5 text-yellow-500/50">
      <Lightbulb className="h-3 w-3 animate-pulse" />
    </span>
  </>
)}
```

Add `analyzingTaskIds` to the TaskItem props interface:
```typescript
analyzingTaskIds?: Set<string>;
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-item.tsx
git commit -m "feat: add lightbulb icon for non-actionable tasks"
```

---

### Task 10: Background Analysis Hook + Integration

**Files:**
- Create: `src/hooks/use-task-analysis.ts`
- Modify: `src/components/tasks/task-list.tsx` (pass analyzingTaskIds)
- Modify: `src/components/tasks/task-input.tsx` (add aiAnalysis to optimistic cache)

**Step 1: Create the analysis hook**

```typescript
// src/hooks/use-task-analysis.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const ANALYZE_TASK = gql`
  mutation AnalyzeTask($taskId: String!) {
    analyzeTask(taskId: $taskId) {
      id
      taskId
      isActionable
      suggestion
      analyzedTitle
    }
  }
`;

interface AnalyzableTask {
  id: string;
  title: string;
  aiAnalysis: {
    analyzedTitle: string;
  } | null;
}

export function useTaskAnalysis(tasks: AnalyzableTask[], isPremium: boolean) {
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const analyzedRef = useRef<Set<string>>(new Set());

  const [analyzeTask] = useMutation(ANALYZE_TASK, {
    update(cache, { data }) {
      if (!data?.analyzeTask) return;
      const analysis = data.analyzeTask;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: analysis.taskId }),
        fields: {
          aiAnalysis() {
            return cache.writeFragment({
              data: analysis,
              fragment: gql`
                fragment NewAiAnalysis on TaskAiAnalysis {
                  id
                  taskId
                  isActionable
                  suggestion
                  analyzedTitle
                }
              `,
            });
          },
        },
      });
    },
  });

  const analyzeNext = useCallback(async () => {
    if (!isPremium) return;

    // Find tasks needing analysis: no analysis, or title changed
    const needsAnalysis = tasks.filter(
      (t) =>
        !analyzedRef.current.has(t.id) &&
        (!t.aiAnalysis || t.aiAnalysis.analyzedTitle !== t.title),
    );

    if (needsAnalysis.length === 0) return;

    const task = needsAnalysis[0];
    analyzedRef.current.add(task.id);
    setAnalyzingIds((prev) => new Set(prev).add(task.id));

    try {
      await analyzeTask({ variables: { taskId: task.id } });
    } catch {
      // Silently fail — don't block UI
      analyzedRef.current.delete(task.id);
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, [tasks, isPremium, analyzeTask]);

  // Throttled: analyze one task every 2 seconds
  useEffect(() => {
    if (!isPremium) return;
    const interval = setInterval(analyzeNext, 2000);
    return () => clearInterval(interval);
  }, [analyzeNext, isPremium]);

  return analyzingIds;
}
```

**Step 2: Integrate in task-list.tsx**

In `src/components/tasks/task-list.tsx`, import and use the hook:
```typescript
import { useTaskAnalysis } from "@/hooks/use-task-analysis";
```

Pass `analyzingTaskIds` to each `TaskItem`:
```tsx
<TaskItem task={task} analyzingTaskIds={analyzingIds} />
```

Note: The hook needs `isPremium` from the `GetMe` query. Import `useQuery` and the `GET_ME` query, or accept `isPremium` as a prop to TaskList.

**Step 3: Add `aiAnalysis: null` to optimistic cache in task-input.tsx**

In `src/components/tasks/task-input.tsx`, add `aiAnalysis: null` to the optimistic writeFragment data (alongside `attachments: []`).

**Step 4: Commit**

```bash
git add src/hooks/use-task-analysis.ts src/components/tasks/task-list.tsx src/components/tasks/task-input.tsx
git commit -m "feat: add background AI analysis hook with throttling"
```

---

### Task 11: i18n + CLAUDE.md + Env Variables

**Files:**
- Modify: `src/lib/i18n/types.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `CLAUDE.md`

**Step 1: Add i18n keys**

Types:
```typescript
// In premium section
aiAnalyzing: string;
aiNotActionable: string;
```

CS:
```typescript
aiAnalyzing: "Analyzuji...",
aiNotActionable: "Tento úkol není konkrétní next action",
```

EN:
```typescript
aiAnalyzing: "Analyzing...",
aiNotActionable: "This task is not a concrete next action",
```

**Step 2: Update CLAUDE.md**

Add `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to the env variables section.

**Step 3: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts CLAUDE.md
git commit -m "feat: add i18n keys and env docs for AI analysis"
```

---

### Task 12: Run All Checks

**Step 1: Run full check suite**

Run: `yarn check`
Expected: lint, format, typecheck, and tests all pass.

Fix any issues that arise.

**Step 2: Commit any fixes**

```bash
git commit -m "fix: resolve lint/type issues in AI analysis feature"
```
