# Task Dependencies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow a task to depend on completion of another task. Dependent tasks appear in "Future" section until the blocking task is completed.

**Architecture:** Single nullable FK `blockedByTaskId` on `tasks` table with ON DELETE SET NULL. Circular dependency check in service layer. Fulltext search with tag-based prioritization for selecting blocking task. Offline-first via Apollo optimistic updates.

**Tech Stack:** Drizzle ORM, Pothos GraphQL, Apollo Client v4, shadcn/ui Command component, Vitest

---

### Task 1: DB Schema + Entity

**Files:**
- Modify: `src/server/db/schema/tasks.ts`
- Modify: `src/domain/entities/task.ts`

**Step 1: Add `blockedByTaskId` column to tasks schema**

In `src/server/db/schema/tasks.ts`, add the self-referential FK column after `deviceContext`:

```typescript
blockedByTaskId: text("blocked_by_task_id").references(() => tasks.id, {
  onDelete: "set null",
}),
```

Add an index in the table's index array:

```typescript
index("tasks_blocked_by_task_id_idx").on(table.blockedByTaskId),
```

**Step 2: Add `blockedByTaskId` to Task entity**

In `src/domain/entities/task.ts`, add to the `Task` interface:

```typescript
blockedByTaskId: string | null;
```

Add to `UpdateTaskInput`:

```typescript
blockedByTaskId?: string | null;
```

**Step 3: Push schema to DB**

Run: `yarn db:push`
Expected: Schema changes applied successfully.

**Step 4: Update test helper**

In `src/domain/services/__tests__/task.service.test.ts`, update `makeTask()`:

```typescript
blockedByTaskId: null,
```

Add it after `deviceContext: null,`.

**Step 5: Run tests to verify nothing broke**

Run: `yarn test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/server/db/schema/tasks.ts src/domain/entities/task.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat: add blockedByTaskId column to tasks schema and entity"
```

---

### Task 2: Repository — findDependentTaskIds + searchTasks

**Files:**
- Modify: `src/domain/repositories/task.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-task.repository.ts`

**Step 1: Add methods to ITaskRepository interface**

In `src/domain/repositories/task.repository.ts`, add:

```typescript
findDependentTaskIds(taskId: string): Promise<string[]>;
searchTasks(userId: string, query: string, tagIds?: string[]): Promise<Task[]>;
```

**Step 2: Implement `findDependentTaskIds` in Drizzle repository**

In `src/infrastructure/persistence/drizzle-task.repository.ts`, add:

```typescript
async findDependentTaskIds(taskId: string): Promise<string[]> {
  const rows = await this.db.query.tasks.findMany({
    where: eq(schema.tasks.blockedByTaskId, taskId),
    columns: { id: true },
  });
  return rows.map((r) => r.id);
}
```

**Step 3: Implement `searchTasks` in Drizzle repository**

In `src/infrastructure/persistence/drizzle-task.repository.ts`, add:

```typescript
async searchTasks(userId: string, query: string, tagIds?: string[]): Promise<Task[]> {
  const results = await this.db.query.tasks.findMany({
    where: and(
      eq(schema.tasks.userId, userId),
      eq(schema.tasks.isCompleted, false),
      ilike(schema.tasks.title, `%${query}%`),
    ),
    orderBy: asc(schema.tasks.sortOrder),
    limit: 20,
  });

  if (!tagIds || tagIds.length === 0) return results;

  // Prioritize tasks that share tags
  const tagTaskRows = await this.db.query.taskTags.findMany({
    where: inArray(schema.taskTags.tagId, tagIds),
    columns: { taskId: true },
  });
  const tagTaskIdSet = new Set(tagTaskRows.map((r) => r.taskId));

  return results.sort((a, b) => {
    const aHasTag = tagTaskIdSet.has(a.id) ? 0 : 1;
    const bHasTag = tagTaskIdSet.has(b.id) ? 0 : 1;
    return aHasTag - bHasTag;
  });
}
```

Add `ilike` to the imports from `drizzle-orm`.

**Step 4: Update test mock**

In `src/domain/services/__tests__/task.service.test.ts`, add to `makeRepo()`:

```typescript
findDependentTaskIds: vi.fn().mockResolvedValue([]),
searchTasks: vi.fn().mockResolvedValue([]),
```

**Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/domain/repositories/task.repository.ts src/infrastructure/persistence/drizzle-task.repository.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat: add findDependentTaskIds and searchTasks to task repository"
```

---

### Task 3: Service — setDependency with circular check

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/domain/services/__tests__/task.service.test.ts`

**Step 1: Write failing tests for setDependency**

In `src/domain/services/__tests__/task.service.test.ts`, add a new describe block:

```typescript
describe("setDependency", () => {
  it("sets blockedByTaskId on task", async () => {
    vi.mocked(repo.findById).mockResolvedValue(makeTask({ id: "task-a", blockedByTaskId: null }));
    vi.mocked(repo.update).mockResolvedValue(makeTask({ id: "task-a", blockedByTaskId: "task-b" }));

    await service.setDependency("task-a", "user-1", "task-b");

    expect(repo.update).toHaveBeenCalledWith("task-a", "user-1", { blockedByTaskId: "task-b" });
  });

  it("removes dependency when blockedByTaskId is null", async () => {
    vi.mocked(repo.update).mockResolvedValue(makeTask({ id: "task-a", blockedByTaskId: null }));

    await service.setDependency("task-a", "user-1", null);

    expect(repo.update).toHaveBeenCalledWith("task-a", "user-1", { blockedByTaskId: null });
  });

  it("throws on circular dependency (A → B → A)", async () => {
    // task-b is blocked by task-a
    vi.mocked(repo.findById)
      .mockResolvedValueOnce(makeTask({ id: "task-a" })) // task-a exists
      .mockResolvedValueOnce(makeTask({ id: "task-b", blockedByTaskId: "task-a" })); // task-b blocked by task-a

    await expect(service.setDependency("task-a", "user-1", "task-b")).rejects.toThrow(
      "Circular dependency",
    );
  });

  it("throws when task not found", async () => {
    vi.mocked(repo.findById).mockResolvedValue(undefined);

    await expect(service.setDependency("x", "user-1", "task-b")).rejects.toThrow("Task not found");
  });

  it("allows A → B when B has no dependency", async () => {
    vi.mocked(repo.findById)
      .mockResolvedValueOnce(makeTask({ id: "task-a" }))
      .mockResolvedValueOnce(makeTask({ id: "task-b", blockedByTaskId: null }));
    vi.mocked(repo.update).mockResolvedValue(makeTask({ id: "task-a", blockedByTaskId: "task-b" }));

    await service.setDependency("task-a", "user-1", "task-b");

    expect(repo.update).toHaveBeenCalledWith("task-a", "user-1", { blockedByTaskId: "task-b" });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test`
Expected: FAIL — `service.setDependency is not a function`

**Step 3: Implement setDependency in TaskService**

In `src/domain/services/task.service.ts`, add:

```typescript
async setDependency(taskId: string, userId: string, blockedByTaskId: string | null): Promise<Task> {
  if (blockedByTaskId === null) {
    return this.taskRepo.update(taskId, userId, { blockedByTaskId: null });
  }

  const task = await this.taskRepo.findById(taskId, userId);
  if (!task) throw new Error("Task not found");

  // Check for circular dependency: follow chain from blocker
  let currentId: string | null = blockedByTaskId;
  const visited = new Set<string>([taskId]);
  while (currentId) {
    if (visited.has(currentId)) throw new Error("Circular dependency");
    visited.add(currentId);
    const current = await this.taskRepo.findById(currentId, userId);
    currentId = current?.blockedByTaskId ?? null;
  }

  return this.taskRepo.update(taskId, userId, { blockedByTaskId });
}
```

**Step 4: Handle blockedByTaskId in update method**

In `src/domain/services/task.service.ts`, in the `update` method, add after the `deviceContext` handling:

```typescript
if (input.blockedByTaskId !== undefined) updates.blockedByTaskId = input.blockedByTaskId ?? null;
```

**Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat: add setDependency with circular dependency prevention"
```

---

### Task 4: Task Visibility — isFutureTask supports blockedByTaskId

**Files:**
- Modify: `src/domain/services/task-visibility.ts`
- Modify: `src/domain/services/__tests__/task-visibility.test.ts`
- Modify: `src/hooks/use-departure-animation.ts`

**Step 1: Write failing tests**

In `src/domain/services/__tests__/task-visibility.test.ts`, add tests:

```typescript
describe("isFutureTask — dependency blocking", () => {
  it("returns true when task is blocked by incomplete task", () => {
    expect(
      isFutureTask({
        dueDate: null,
        reminderAt: null,
        isCompleted: false,
        blockedByTaskId: "blocker-1",
        blockedByTaskIsCompleted: false,
      }),
    ).toBe(true);
  });

  it("returns false when blocking task is completed", () => {
    expect(
      isFutureTask({
        dueDate: null,
        reminderAt: null,
        isCompleted: false,
        blockedByTaskId: "blocker-1",
        blockedByTaskIsCompleted: true,
      }),
    ).toBe(false);
  });

  it("returns false when no dependency", () => {
    expect(
      isFutureTask({
        dueDate: null,
        reminderAt: null,
        isCompleted: false,
        blockedByTaskId: null,
      }),
    ).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test`
Expected: FAIL — type errors or wrong boolean values.

**Step 3: Extend VisibilityTask and isFutureTask**

In `src/domain/services/task-visibility.ts`, update the `VisibilityTask` interface:

```typescript
interface VisibilityTask {
  dueDate: string | null;
  reminderAt: string | null;
  isCompleted: boolean;
  recurrence?: string | null;
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean;
}
```

In `isFutureTask`, add before the existing `getVisibleDate` call:

```typescript
// Blocked by an incomplete task → future
if (task.blockedByTaskId && task.blockedByTaskIsCompleted === false) return true;
```

**Step 4: Update VisibilityTask in use-departure-animation.ts**

In `src/hooks/use-departure-animation.ts`, update the `VisibilityTask` interface:

```typescript
interface VisibilityTask {
  id: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence?: string | null;
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean;
}
```

**Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/domain/services/task-visibility.ts src/domain/services/__tests__/task-visibility.test.ts src/hooks/use-departure-animation.ts
git commit -m "feat: extend isFutureTask to support task dependencies"
```

---

### Task 5: GraphQL — extend Task type, add searchTasks query

**Files:**
- Modify: `src/server/graphql/types/task.ts`
- Modify: `src/server/graphql/dataloaders.ts`
- Modify: `src/lib/graphql-validators.ts`

**Step 1: Add dependentTaskCount dataloader**

In `src/server/graphql/dataloaders.ts`, add to `DataLoaders` interface:

```typescript
dependentTaskCountByTaskId: DataLoader<string, number>;
```

In `createDataLoaders`, add:

```typescript
dependentTaskCountByTaskId: new DataLoader(async (taskIds) => {
  const counts = await Promise.all(
    [...taskIds].map(async (id) => {
      const deps = await repos.task.findDependentTaskIds(id);
      return deps.length;
    }),
  );
  return taskIds.map((_, i) => counts[i]);
}),
```

**Step 2: Add dependency fields to TaskType**

In `src/server/graphql/types/task.ts`, add these fields to `TaskRef.implement({ fields })`:

```typescript
blockedByTaskId: t.exposeString("blockedByTaskId", { nullable: true }),
blockedByTask: t.field({
  type: TaskRef,
  nullable: true,
  resolve: async (task, _args, ctx) => {
    if (!task.blockedByTaskId) return null;
    return ctx.services.task.getById(task.blockedByTaskId, ctx.userId!);
  },
}),
blockedByTaskIsCompleted: t.boolean({
  nullable: true,
  resolve: async (task, _args, ctx) => {
    if (!task.blockedByTaskId) return null;
    const blocker = await ctx.services.task.getById(task.blockedByTaskId, ctx.userId!);
    return blocker?.isCompleted ?? null;
  },
}),
dependentTaskCount: t.int({
  resolve: async (task, _args, ctx) => {
    return ctx.loaders.dependentTaskCountByTaskId.load(task.id);
  },
}),
```

**Step 3: Add blockedByTaskId to UpdateTaskInput**

In `src/server/graphql/types/task.ts`, in `UpdateTaskInput`, add:

```typescript
blockedByTaskId: t.string(),
```

**Step 4: Add `blockedByTaskId` to updateTask validator**

In `src/lib/graphql-validators.ts`, in `updateTaskSchema`, add:

```typescript
blockedByTaskId: z.string().uuid().nullish(),
```

**Step 5: Add searchTasks query**

In `src/server/graphql/types/task.ts`, add:

```typescript
builder.queryField("searchTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      query: t.arg.string({ required: true }),
      tagIds: t.arg.stringList({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const query = args.query.trim();
      if (query.length < 1) return [];
      return ctx.services.task.searchTasks(ctx.userId!, query, args.tagIds ?? undefined);
    },
  }),
);
```

**Step 6: Add searchTasks to TaskService**

In `src/domain/services/task.service.ts`, add:

```typescript
async searchTasks(userId: string, query: string, tagIds?: string[]): Promise<Task[]> {
  return this.taskRepo.searchTasks(userId, query, tagIds);
}
```

**Step 7: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 8: Commit**

```bash
git add src/server/graphql/types/task.ts src/server/graphql/dataloaders.ts src/lib/graphql-validators.ts src/domain/services/task.service.ts
git commit -m "feat: add dependency fields and searchTasks query to GraphQL"
```

---

### Task 6: i18n — dependency translations

**Files:**
- Modify: `src/lib/i18n/types.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`

**Step 1: Add dependency keys to Dictionary type**

In `src/lib/i18n/types.ts`, add a new section inside `Dictionary`:

```typescript
dependency: {
  title: string;
  addDependency: string;
  dependsOn: string;
  blocksCount: string;
  circularError: string;
  searchPlaceholder: string;
};
```

**Step 2: Add Czech translations**

In `src/lib/i18n/dictionaries/cs.ts`, add:

```typescript
dependency: {
  title: "Závislost",
  addDependency: "Přidat závislost",
  dependsOn: "Závisí na",
  blocksCount: "Blokuje {count}",
  circularError: "Cyklická závislost není povolena",
  searchPlaceholder: "Hledat úkol...",
},
```

**Step 3: Add English translations**

In `src/lib/i18n/dictionaries/en.ts`, add:

```typescript
dependency: {
  title: "Dependency",
  addDependency: "Add dependency",
  dependsOn: "Depends on",
  blocksCount: "Blocks {count}",
  circularError: "Circular dependency not allowed",
  searchPlaceholder: "Search task...",
},
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat: add dependency i18n translations (cs/en)"
```

---

### Task 7: UI — Task Detail Panel dependency section

**Files:**
- Create: `src/components/tasks/detail/task-dependency.tsx`
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Step 1: Create TaskDependency component**

Create `src/components/tasks/detail/task-dependency.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Link2, Lock, Search, X } from "lucide-react";
import { gql } from "@apollo/client";
import { useLazyQuery, useApolloClient } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n";

const SEARCH_TASKS = gql`
  query SearchTasks($query: String!, $tagIds: [String!]) {
    searchTasks(query: $query, tagIds: $tagIds) {
      id
      title
      list {
        id
        name
      }
    }
  }
`;

interface SearchResult {
  id: string;
  title: string;
  list: { id: string; name: string } | null;
}

interface TaskDependencyProps {
  taskId: string;
  blockedByTask: { id: string; title: string } | null;
  tagIds: string[];
  onSetDependency: (blockedByTaskId: string | null) => void;
  onNavigateToTask: (taskId: string) => void;
}

export function TaskDependency({
  taskId,
  blockedByTask,
  tagIds,
  onSetDependency,
  onNavigateToTask,
}: TaskDependencyProps) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const apolloClient = useApolloClient();

  const [searchTasks, { data: searchData, loading: searchLoading }] =
    useLazyQuery<{ searchTasks: SearchResult[] }>(SEARCH_TASKS, {
      fetchPolicy: "network-only",
    });

  function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim().length >= 1) {
      searchTasks({ variables: { query: query.trim(), tagIds } });
    }
  }

  function handleSearchOffline(query: string): SearchResult[] {
    if (query.trim().length < 1) return [];
    const cache = apolloClient.cache.extract();
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    for (const key in cache) {
      const obj = cache[key] as Record<string, unknown> | undefined;
      if (
        obj?.__typename === "Task" &&
        typeof obj.title === "string" &&
        obj.isCompleted === false &&
        obj.id !== taskId &&
        obj.title.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: obj.id as string,
          title: obj.title,
          list: null,
        });
      }
    }
    return results.slice(0, 20);
  }

  const onlineResults = searchData?.searchTasks ?? [];
  const offlineResults = handleSearchOffline(searchQuery);
  const results = onlineResults.length > 0 ? onlineResults : offlineResults;
  const filteredResults = results.filter((r) => r.id !== taskId);

  if (blockedByTask) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
        <button
          className="text-muted-foreground hover:text-foreground truncate text-sm transition-colors"
          onClick={() => onNavigateToTask(blockedByTask.id)}
        >
          {t("dependency.dependsOn")}: {blockedByTask.title}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onSetDependency(null)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground h-auto w-full justify-start gap-2 px-0 py-1 text-sm font-normal">
          <Link2 className="h-4 w-4" />
          {t("dependency.addDependency")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("dependency.searchPlaceholder")}
            value={searchQuery}
            onValueChange={handleSearch}
          />
          <CommandList>
            <CommandEmpty>
              {searchLoading ? "..." : searchQuery.length < 1 ? t("dependency.searchPlaceholder") : "—"}
            </CommandEmpty>
            {filteredResults.length > 0 && (
              <CommandGroup>
                {filteredResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.id}
                    onSelect={() => {
                      onSetDependency(result.id);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{result.title}</span>
                      {result.list && (
                        <span className="text-muted-foreground text-xs">{result.list.name}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Add dependency fields to GET_TASK query**

In `src/components/tasks/task-detail-panel.tsx`, update the `GET_TASK` query to include:

```graphql
blockedByTaskId
blockedByTask {
  id
  title
}
blockedByTaskIsCompleted
```

**Step 3: Add dependency fields to TaskDetail interface**

In `src/components/tasks/task-detail-panel.tsx`, update `TaskDetail`:

```typescript
blockedByTaskId: string | null;
blockedByTask: { id: string; title: string } | null;
blockedByTaskIsCompleted: boolean | null;
```

**Step 4: Add dependency fields to UPDATE_TASK mutation**

In `src/components/tasks/task-detail-panel.tsx`, update `UPDATE_TASK` to include in response:

```graphql
blockedByTaskId
blockedByTask {
  id
  title
}
```

Also add `blockedByTaskId` and `blockedByTask` to the `UpdateTaskData` interface.

**Step 5: Add dependency handler**

In `src/components/tasks/task-detail-panel.tsx`, add handler:

```typescript
function handleSetDependency(blockedByTaskId: string | null) {
  if (!task) return;
  optimisticUpdate({ blockedByTaskId });
}
```

**Step 6: Add TaskDependency component to render**

In `src/components/tasks/task-detail-panel.tsx`, import `TaskDependency`:

```typescript
import { TaskDependency } from "./detail/task-dependency";
```

Add the component after Notes (the `<Textarea>`) and before the footer `<TaskActions>`. Place it inside the scrollable area, after the `<Separator />` that follows Notes:

```tsx
<Separator />

{/* Dependency */}
<TaskDependency
  taskId={task.id}
  blockedByTask={task.blockedByTask ?? null}
  tagIds={(task.tags ?? []).map((t) => t.id)}
  onSetDependency={handleSetDependency}
  onNavigateToTask={(id) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", id);
    router.push(`?${params.toString()}`, { scroll: false });
  }}
/>
```

**Step 7: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 8: Commit**

```bash
git add src/components/tasks/detail/task-dependency.tsx src/components/tasks/task-detail-panel.tsx
git commit -m "feat: add dependency section to task detail panel with search"
```

---

### Task 8: UI — Task Item dependency badges

**Files:**
- Modify: `src/components/tasks/task-item.tsx`

**Step 1: Update Task interface in task-item.tsx**

Add to the `Task` interface:

```typescript
blockedByTaskId?: string | null;
blockedByTaskIsCompleted?: boolean | null;
dependentTaskCount?: number;
```

**Step 2: Add Lock and Link2 icons**

Update the Lucide import to include `Lock` and `Link2`:

```typescript
import {
  Bell,
  CalendarDays,
  FolderOutput,
  Link2,
  List,
  Lock,
  MapPin,
  Monitor,
  Repeat,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
```

**Step 3: Add badge rendering logic**

After the existing `deviceMatch` variable, add:

```typescript
const isBlocked = !!task.blockedByTaskId && task.blockedByTaskIsCompleted === false;
const dependentCount = task.dependentTaskCount ?? 0;
```

Update `hasMetadata` to include:

```typescript
isBlocked ||
dependentCount > 0 ||
```

**Step 4: Add badge icons to the metadata row**

After the device context badge section (before the closing `</div>` of the metadata row), add:

```tsx
{isBlocked &&
  (deviceMatch ||
    hasLocation ||
    hasTags ||
    totalSteps > 0 ||
    task.dueDate ||
    hasReminder ||
    (showListName && task.list)) && (
    <span className="text-muted-foreground">·</span>
  )}
{isBlocked && (
  <span className="text-muted-foreground flex items-center gap-0.5">
    <Lock className="h-3 w-3" />
  </span>
)}
{dependentCount > 0 &&
  (isBlocked ||
    deviceMatch ||
    hasLocation ||
    hasTags ||
    totalSteps > 0 ||
    task.dueDate ||
    hasReminder ||
    (showListName && task.list)) && (
    <span className="text-muted-foreground">·</span>
  )}
{dependentCount > 0 && (
  <span className="text-muted-foreground flex items-center gap-0.5">
    <Link2 className="h-3 w-3" />
    {dependentCount}
  </span>
)}
```

**Step 5: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add src/components/tasks/task-item.tsx
git commit -m "feat: add Lock and Link2 badges for task dependencies"
```

---

### Task 9: GraphQL queries — add dependency fields to all task queries

**Files:**
- Modify: `src/graphql/queries/tasks.graphql` (if it exists)
- Modify: `src/components/tasks/task-list.tsx`
- Modify: `src/components/tasks/sortable-task-list.tsx`
- Modify: any page that queries tasks (check `src/app/(app)/planned/page.tsx`, `src/app/(app)/lists/[listId]/page.tsx`, `src/app/(app)/nearby/page.tsx`, `src/app/(app)/tags/[tagId]/page.tsx`)

**Step 1: Identify all task query locations**

Search for all GraphQL task queries across the codebase. Each task query needs `blockedByTaskId`, `blockedByTaskIsCompleted`, and `dependentTaskCount` fields added.

Check these files for GQL queries returning tasks:
- `src/app/(app)/planned/page.tsx`
- `src/app/(app)/lists/[listId]/page.tsx`
- `src/app/(app)/nearby/page.tsx`
- `src/app/(app)/tags/[tagId]/page.tsx`
- `src/components/tasks/task-detail-panel.tsx` (already done in Task 7)

**Step 2: Add dependency fields to each task query**

For every GQL query that returns task objects, add these fields:

```graphql
blockedByTaskId
blockedByTaskIsCompleted
dependentTaskCount
```

**Step 3: Update TypeScript interfaces**

Update each page's local task type/interface to include:

```typescript
blockedByTaskId: string | null;
blockedByTaskIsCompleted: boolean | null;
dependentTaskCount: number;
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/ src/components/tasks/
git commit -m "feat: add dependency fields to all task GraphQL queries"
```

---

### Task 10: Push schema to production + final verification

**Step 1: Run full check**

Run: `yarn check`
Expected: All lint, format, typecheck, and tests pass.

**Step 2: Run dev server and test manually**

Run: `yarn dev`
Test:
1. Open a task detail panel
2. Scroll down — "Dependency" section visible after Notes
3. Click "Add dependency" → search popover opens
4. Search for a task → results appear, same-tag tasks first
5. Select a task → dependency set, task moves to Future section
6. Click the blocking task name → navigates to its detail
7. Click ✕ → dependency removed, task returns to active list
8. On the blocking task, Link2 badge with count appears in the task list
9. On the blocked task, Lock icon appears in the task list
10. Complete the blocking task → dependent task automatically unblocks
11. Delete the blocking task → dependent task automatically unblocks

**Step 3: Commit everything**

```bash
git add -A
git commit -m "feat: complete task dependencies feature"
```

**Step 4: Push to main for Vercel deployment**

```bash
git push origin main
```

**Step 5: Push schema to production DB**

```bash
vercel env pull .env.production.local
source <(grep -v '^#' .env.production.local | sed 's/^/export /')
DATABASE_URL=$(grep DATABASE_URL .env.production.local | cut -d= -f2-) yarn db:push
rm .env.production.local
```
