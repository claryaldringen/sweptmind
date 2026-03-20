# Shared Task Completion Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umožnit vlastníkovi sdíleného tasku nastavit pravidla dokončení — kdy se task považuje za hotový (kdokoliv / všichni) a co se pak stane (označit jako hotový / přesunout do seznamu).

**Architecture:** 3 nová nullable pole na `tasks` tabulce (`shareCompletionMode`, `shareCompletionAction`, `shareCompletionListId`). Při `toggleCompleted` na jakékoliv kopii sdíleného tasku se zkontroluje pravidlo na zdrojovém tasku a případně se provede akce na všech kopiích. UI v task detail panelu zobrazí sekci s nastavením pravidel jen pro vlastníka sdíleného tasku.

**Tech Stack:** Drizzle ORM, GraphQL (Pothos), Apollo Client, React (shadcn/ui Select)

---

### Task 1: DB schéma + entity + repository

**Files:**
- Modify: `src/server/db/schema/tasks.ts`
- Modify: `src/domain/entities/task.ts`
- Modify: `src/domain/repositories/task.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-task.repository.ts`

- [ ] **Step 1: Přidat 3 sloupce do DB schématu**

V `src/server/db/schema/tasks.ts`, po `blockedByTaskId`:

```typescript
shareCompletionMode: text("share_completion_mode"), // 'any' | 'all'
shareCompletionAction: text("share_completion_action"), // 'complete' | 'move'
shareCompletionListId: text("share_completion_list_id").references(() => lists.id, {
  onDelete: "set null",
}),
```

- [ ] **Step 2: Přidat pole do Task entity**

V `src/domain/entities/task.ts`, interface `Task`, po `blockedByTaskId`:

```typescript
shareCompletionMode: string | null;
shareCompletionAction: string | null;
shareCompletionListId: string | null;
```

- [ ] **Step 3: Přidat pole do UpdateTaskInput**

V `src/domain/entities/task.ts`, interface `UpdateTaskInput`, po `blockedByTaskId`:

```typescript
shareCompletionMode?: string | null;
shareCompletionAction?: string | null;
shareCompletionListId?: string | null;
```

- [ ] **Step 4: Pushout DB schéma**

Run: `yarn db:push`
Expected: Changes applied

- [ ] **Step 5: Spustit testy**

Run: `yarn test`
Expected: PASS (žádná logika se ještě nezměnila)

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/tasks.ts src/domain/entities/task.ts
git commit -m "feat(sharing): add share completion rule fields to tasks schema"
```

---

### Task 2: GraphQL — expose nová pole + update mutation

**Files:**
- Modify: `src/server/graphql/types/task.ts`
- Modify: `src/lib/graphql-validators.ts` (updateTaskSchema)

- [ ] **Step 1: Přidat pole do TaskType v Pothos**

V `src/server/graphql/types/task.ts`, v `TaskRef.implement`, po `isSharedFrom`:

```typescript
shareCompletionMode: t.exposeString("shareCompletionMode", { nullable: true }),
shareCompletionAction: t.exposeString("shareCompletionAction", { nullable: true }),
shareCompletionListId: t.exposeString("shareCompletionListId", { nullable: true }),
```

- [ ] **Step 2: Přidat pole do UpdateTaskInput v Pothos**

V `src/server/graphql/types/task.ts`, v `UpdateTaskInput` builder, po `blockedByTaskId`:

```typescript
shareCompletionMode: t.string(),
shareCompletionAction: t.string(),
shareCompletionListId: t.string(),
```

- [ ] **Step 3: Přidat pole do updateTaskSchema validátoru**

V `src/lib/graphql-validators.ts`, v `updateTaskSchema`, přidat:

```typescript
shareCompletionMode: z.string().nullish(),
shareCompletionAction: z.string().nullish(),
shareCompletionListId: z.string().nullish(),
```

- [ ] **Step 4: Spustit testy**

Run: `yarn test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/graphql/types/task.ts src/lib/graphql-validators.ts
git commit -m "feat(sharing): expose share completion rule fields in GraphQL"
```

---

### Task 3: Backend logika — evaluace pravidel při toggleCompleted

**Files:**
- Modify: `src/domain/services/task-sharing.service.ts`
- Modify: `src/domain/services/task.service.ts`
- Test: `src/domain/services/__tests__/task-sharing.service.test.ts`

- [ ] **Step 1: Přidat metodu `evaluateCompletionRule` do TaskSharingService**

V `src/domain/services/task-sharing.service.ts` přidat:

```typescript
async evaluateCompletionRule(taskId: string, userId: string): Promise<void> {
  // Determine if this task is a source or target of a share
  const sharesAsSource = await this.sharedTaskRepo.findBySourceTask(taskId);
  const shareAsTarget = await this.sharedTaskRepo.findByTargetTask(taskId);

  // Find the source task (the one with the rules)
  const sourceTaskId = shareAsTarget ? shareAsTarget.sourceTaskId : taskId;
  const shares = shareAsTarget
    ? await this.sharedTaskRepo.findBySourceTask(sourceTaskId)
    : sharesAsSource;

  if (shares.length === 0) return; // Not a shared task

  const sourceTask = await this.taskRepo.findByIdUnchecked(sourceTaskId);
  if (!sourceTask) return;
  if (!sourceTask.shareCompletionMode) return; // No rule configured

  const mode = sourceTask.shareCompletionMode;
  const action = sourceTask.shareCompletionAction ?? "complete";

  // Check if condition is met
  if (mode === "all") {
    // Check source task
    if (!sourceTask.isCompleted) return;
    // Check all target tasks
    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (targetTask && !targetTask.isCompleted) return;
    }
  }
  // mode === "any" — condition already met (someone just toggled complete)

  // Execute action
  if (action === "complete") {
    // Mark all copies as completed
    if (!sourceTask.isCompleted) {
      await this.taskRepo.updateUnchecked(sourceTaskId, {
        isCompleted: true,
        completedAt: new Date(),
      });
    }
    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (targetTask && !targetTask.isCompleted) {
        await this.taskRepo.updateUnchecked(share.targetTaskId, {
          isCompleted: true,
          completedAt: new Date(),
        });
      }
    }
  } else if (action === "move" && sourceTask.shareCompletionListId) {
    // Move source task to the configured list
    if (!sourceTask.isCompleted) {
      await this.taskRepo.updateUnchecked(sourceTaskId, {
        listId: sourceTask.shareCompletionListId,
        isCompleted: true,
        completedAt: new Date(),
      });
    } else {
      await this.taskRepo.updateUnchecked(sourceTaskId, {
        listId: sourceTask.shareCompletionListId,
      });
    }
    // Mark all target copies as completed
    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (targetTask && !targetTask.isCompleted) {
        await this.taskRepo.updateUnchecked(share.targetTaskId, {
          isCompleted: true,
          completedAt: new Date(),
        });
      }
    }
  }
}
```

- [ ] **Step 2: Volat `evaluateCompletionRule` z TaskService.toggleCompleted**

V `src/domain/services/task.service.ts`, v metodě `toggleCompleted`, po řádku 229 (po `notifyOwnerAction`):

```typescript
if (this.taskSharingService && toggled.isCompleted) {
  this.taskSharingService.notifyOwnerAction(id, "completed").catch(() => {});
  this.taskSharingService.evaluateCompletionRule(id, userId).catch(() => {});
}
```

Pozor: `notifyOwnerAction` tam už je na řádku 228-230. Stačí přidat `evaluateCompletionRule` volání za něj. Nový kód:

```typescript
if (this.taskSharingService && toggled.isCompleted) {
  this.taskSharingService.notifyOwnerAction(id, "completed").catch(() => {});
  this.taskSharingService.evaluateCompletionRule(id, userId).catch(() => {});
}
```

- [ ] **Step 3: Napsat testy pro evaluateCompletionRule**

V `src/domain/services/__tests__/task-sharing.service.test.ts` přidat describe blok:

```typescript
describe("evaluateCompletionRule", () => {
  it("mode=any, action=complete — marks all copies as completed", async () => {
    const sourceTask = {
      id: "source-1", userId: "owner-1", isCompleted: false,
      shareCompletionMode: "any", shareCompletionAction: "complete",
      shareCompletionListId: null,
    } as any;
    const targetTask = {
      id: "target-1", userId: "user-2", isCompleted: true,
    } as any;

    vi.mocked(sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
    vi.mocked(sharedTaskRepo.findBySourceTask).mockResolvedValue([
      { id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date() },
    ]);
    vi.mocked(taskRepo.findByIdUnchecked).mockImplementation(async (id: string) => {
      if (id === "source-1") return sourceTask;
      if (id === "target-1") return targetTask;
      return undefined;
    });

    await service.evaluateCompletionRule("source-1", "owner-1");

    expect(taskRepo.updateUnchecked).toHaveBeenCalledWith("source-1", {
      isCompleted: true,
      completedAt: expect.any(Date),
    });
  });

  it("mode=all — does NOT trigger when not all copies are completed", async () => {
    const sourceTask = {
      id: "source-1", userId: "owner-1", isCompleted: true,
      shareCompletionMode: "all", shareCompletionAction: "complete",
      shareCompletionListId: null,
    } as any;
    const targetTask = {
      id: "target-1", userId: "user-2", isCompleted: false,
    } as any;

    vi.mocked(sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
    vi.mocked(sharedTaskRepo.findBySourceTask).mockResolvedValue([
      { id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date() },
    ]);
    vi.mocked(taskRepo.findByIdUnchecked).mockImplementation(async (id: string) => {
      if (id === "source-1") return sourceTask;
      if (id === "target-1") return targetTask;
      return undefined;
    });

    await service.evaluateCompletionRule("source-1", "owner-1");

    expect(taskRepo.updateUnchecked).not.toHaveBeenCalled();
  });

  it("mode=all — triggers when ALL copies are completed", async () => {
    const sourceTask = {
      id: "source-1", userId: "owner-1", isCompleted: true,
      shareCompletionMode: "all", shareCompletionAction: "complete",
      shareCompletionListId: null,
    } as any;
    const targetTask = {
      id: "target-1", userId: "user-2", isCompleted: true,
    } as any;

    vi.mocked(sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
    vi.mocked(sharedTaskRepo.findBySourceTask).mockResolvedValue([
      { id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date() },
    ]);
    vi.mocked(taskRepo.findByIdUnchecked).mockImplementation(async (id: string) => {
      if (id === "source-1") return sourceTask;
      if (id === "target-1") return targetTask;
      return undefined;
    });

    await service.evaluateCompletionRule("source-1", "owner-1");

    // Source already completed, no update needed. No target updates needed.
    // Both already completed — action already done
    expect(taskRepo.updateUnchecked).not.toHaveBeenCalled();
  });

  it("mode=any, action=move — moves source task to configured list", async () => {
    const sourceTask = {
      id: "source-1", userId: "owner-1", isCompleted: false,
      shareCompletionMode: "any", shareCompletionAction: "move",
      shareCompletionListId: "list-done",
    } as any;

    vi.mocked(sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
    vi.mocked(sharedTaskRepo.findBySourceTask).mockResolvedValue([
      { id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date() },
    ]);
    vi.mocked(taskRepo.findByIdUnchecked).mockImplementation(async (id: string) => {
      if (id === "source-1") return sourceTask;
      if (id === "target-1") return { id: "target-1", userId: "user-2", isCompleted: true } as any;
      return undefined;
    });

    await service.evaluateCompletionRule("source-1", "owner-1");

    expect(taskRepo.updateUnchecked).toHaveBeenCalledWith("source-1", {
      listId: "list-done",
      isCompleted: true,
      completedAt: expect.any(Date),
    });
  });

  it("no rule configured — does nothing", async () => {
    const sourceTask = {
      id: "source-1", userId: "owner-1", isCompleted: true,
      shareCompletionMode: null, shareCompletionAction: null,
      shareCompletionListId: null,
    } as any;

    vi.mocked(sharedTaskRepo.findByTargetTask).mockResolvedValue(undefined);
    vi.mocked(sharedTaskRepo.findBySourceTask).mockResolvedValue([
      { id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date() },
    ]);
    vi.mocked(taskRepo.findByIdUnchecked).mockResolvedValue(sourceTask);

    await service.evaluateCompletionRule("source-1", "owner-1");

    expect(taskRepo.updateUnchecked).not.toHaveBeenCalled();
  });

  it("called from target task — resolves source task and evaluates", async () => {
    const sourceTask = {
      id: "source-1", userId: "owner-1", isCompleted: false,
      shareCompletionMode: "any", shareCompletionAction: "complete",
      shareCompletionListId: null,
    } as any;
    const targetTask = {
      id: "target-1", userId: "user-2", isCompleted: true,
    } as any;

    vi.mocked(sharedTaskRepo.findByTargetTask).mockResolvedValue({
      id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date(),
    });
    vi.mocked(sharedTaskRepo.findBySourceTask).mockResolvedValue([
      { id: "st-1", sourceTaskId: "source-1", targetTaskId: "target-1", connectionId: "c-1", createdAt: new Date() },
    ]);
    vi.mocked(taskRepo.findByIdUnchecked).mockImplementation(async (id: string) => {
      if (id === "source-1") return sourceTask;
      if (id === "target-1") return targetTask;
      return undefined;
    });

    await service.evaluateCompletionRule("target-1", "user-2");

    expect(taskRepo.updateUnchecked).toHaveBeenCalledWith("source-1", {
      isCompleted: true,
      completedAt: expect.any(Date),
    });
  });
});
```

- [ ] **Step 4: Spustit testy**

Run: `yarn test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/task-sharing.service.ts src/domain/services/task.service.ts src/domain/services/__tests__/task-sharing.service.test.ts
git commit -m "feat(sharing): evaluate completion rules when shared task is toggled"
```

---

### Task 4: Frontend — UI pro nastavení pravidel v task detail panelu

**Files:**
- Create: `src/components/tasks/detail/task-completion-rules.tsx`
- Modify: `src/components/tasks/task-detail-panel.tsx`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`

- [ ] **Step 1: Přidat i18n klíče**

V `src/lib/i18n/dictionaries/cs.ts`, do `sharing` sekce:

```typescript
completionRules: "Pravidla dokončení",
completionMode: "Hotový když",
completionModeAny: "kdokoliv označí",
completionModeAll: "všichni označí",
completionAction: "Pak udělej",
completionActionComplete: "označit jako hotový",
completionActionMove: "přesunout do seznamu",
completionSelectList: "Vyber seznam",
completionNoRule: "žádné pravidlo",
```

V `src/lib/i18n/dictionaries/en.ts`, do `sharing` sekce:

```typescript
completionRules: "Completion rules",
completionMode: "Done when",
completionModeAny: "anyone marks done",
completionModeAll: "everyone marks done",
completionAction: "Then",
completionActionComplete: "mark as completed",
completionActionMove: "move to list",
completionSelectList: "Select list",
completionNoRule: "no rule",
```

- [ ] **Step 2: Vytvořit TaskCompletionRules komponentu**

Vytvořit `src/components/tasks/detail/task-completion-rules.tsx`:

```typescript
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";

interface TaskCompletionRulesProps {
  mode: string | null;
  action: string | null;
  listId: string | null;
  lists: { id: string; name: string }[];
  onModeChange: (mode: string | null) => void;
  onActionChange: (action: string | null) => void;
  onListChange: (listId: string | null) => void;
}

export function TaskCompletionRules({
  mode,
  action,
  listId,
  lists,
  onModeChange,
  onActionChange,
  onListChange,
}: TaskCompletionRulesProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">
        {t("sharing.completionRules")}
      </p>

      {/* Mode: when is it done? */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-24 shrink-0 text-xs">
          {t("sharing.completionMode")}
        </span>
        <Select
          value={mode ?? "none"}
          onValueChange={(v) => {
            if (v === "none") {
              onModeChange(null);
              onActionChange(null);
              onListChange(null);
            } else {
              onModeChange(v);
              if (!action) onActionChange("complete");
            }
          }}
        >
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("sharing.completionNoRule")}</SelectItem>
            <SelectItem value="any">{t("sharing.completionModeAny")}</SelectItem>
            <SelectItem value="all">{t("sharing.completionModeAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action: what happens? (only if mode is set) */}
      {mode && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24 shrink-0 text-xs">
            {t("sharing.completionAction")}
          </span>
          <Select
            value={action ?? "complete"}
            onValueChange={(v) => {
              onActionChange(v);
              if (v !== "move") onListChange(null);
            }}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="complete">
                {t("sharing.completionActionComplete")}
              </SelectItem>
              <SelectItem value="move">
                {t("sharing.completionActionMove")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List picker (only if action is move) */}
      {mode && action === "move" && (
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0" />
          <Select
            value={listId ?? ""}
            onValueChange={(v) => onListChange(v || null)}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue placeholder={t("sharing.completionSelectList")} />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrovat do TaskDetailPanel**

V `src/components/tasks/task-detail-panel.tsx`:

1. Přidat import:
```typescript
import { TaskCompletionRules } from "./detail/task-completion-rules";
```

2. Přidat nové pole do `TaskDetail` interface (po `blockedByTask`):
```typescript
shareCompletionMode: string | null;
shareCompletionAction: string | null;
shareCompletionListId: string | null;
```

3. Přidat pole do `UPDATE_TASK` mutation GQL string:
```graphql
shareCompletionMode
shareCompletionAction
shareCompletionListId
```

4. Přidat nové pole do `UpdateTaskData.updateTask` interface:
```typescript
shareCompletionMode: string | null;
shareCompletionAction: string | null;
shareCompletionListId: string | null;
```

5. V JSX, po `<TaskSharing>` a před `<Separator>`, přidat (jen pro vlastníka sdíleného tasku):
```tsx
{/* Completion rules (only for shared-out tasks) */}
{(task.steps?.length > 0 || shares.length > 0) && (
  // Show only if task is shared to others (isSharedTo)
  null
)}
```

Vlastně jednodušeji — přidat `isSharedTo` do `TaskDetail`:
```typescript
isSharedTo: boolean;
```

A vložit komponentu:
```tsx
{task.isSharedTo && (
  <TaskCompletionRules
    mode={task.shareCompletionMode}
    action={task.shareCompletionAction}
    listId={task.shareCompletionListId}
    lists={allLists}
    onModeChange={(mode) => optimisticUpdate({ shareCompletionMode: mode })}
    onActionChange={(action) => optimisticUpdate({ shareCompletionAction: action })}
    onListChange={(listId) => optimisticUpdate({ shareCompletionListId: listId })}
  />
)}
```

Vložit ho za `<TaskSharing taskId={task.id} />` řádek.

6. Přidat `isSharedTo` do TaskFields GraphQL fragment (pokud existuje) nebo se spolehnout na `useAppData()` task objekt, který už `isSharedTo` field má z GraphQL query.

- [ ] **Step 4: Otestovat manuálně**

1. Nasdílej task jinému uživateli
2. V detailu sdíleného tasku by se měla objevit sekce "Pravidla dokončení"
3. Vyber "kdokoliv označí" + "označit jako hotový"
4. Příjemce označí svou kopii jako hotovou
5. Ověř, že vlastníkův task se také označí jako hotový

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/detail/task-completion-rules.tsx src/components/tasks/task-detail-panel.tsx src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat(sharing): add completion rules UI for shared tasks"
```
