# Clone Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clone task feature that duplicates a task (with steps and tags, without dates) via a button in the task detail panel with instant UI feedback.

**Architecture:** New `clone` method in TaskService creates a copy via `taskRepo.create` directly (bypasses reminderAt computation and calendar sync). GraphQL resolver handles tag copying via TagService. UI uses Apollo cache `writeQuery` for optimistic display, then opens cloned task's detail.

**Tech Stack:** Drizzle ORM, Pothos GraphQL, Apollo Client, React (Lucide icons)

---

### Task 1: Domain service — clone method (TDD)

**Files:**
- Modify: `src/domain/services/task.service.ts` (add clone method)
- Modify: `src/domain/services/__tests__/task.service.test.ts` (add tests)

- [ ] **Step 1: Write failing test for clone**

In `src/domain/services/__tests__/task.service.test.ts`, add a new describe block:

```typescript
describe("clone", () => {
  it("creates a copy of task without date fields", async () => {
    const original = makeTask({
      id: "original-1",
      title: "Buy groceries",
      notes: "Weekly shopping",
      listId: "list-1",
      dueDate: "2026-03-25T10:00",
      dueDateEnd: "2026-03-25T11:00",
      reminderAt: "2026-03-25",
      recurrence: "WEEKLY",
      locationId: "loc-1",
      locationRadius: 500,
      deviceContext: "phone",
      isCompleted: true,
      completedAt: new Date(),
      forceCalendarSync: true,
    });
    vi.mocked(taskRepo.findById).mockResolvedValue(original);
    vi.mocked(stepRepo.findByTask).mockResolvedValue([]);
    vi.mocked(taskRepo.findMinSortOrder).mockResolvedValue(5);
    vi.mocked(taskRepo.create).mockImplementation(async (data) => ({
      ...makeTask({}),
      ...data,
      id: data.id ?? "new-id",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const cloned = await service.clone("original-1", "user-1");

    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        listId: "list-1",
        title: "Buy groceries",
        notes: "Weekly shopping",
        locationId: "loc-1",
        locationRadius: 500,
        deviceContext: "phone",
        dueDate: null,
        dueDateEnd: null,
        reminderAt: null,
        sortOrder: 4,
      }),
    );
    expect(cloned.dueDate).toBeNull();
    expect(cloned.isCompleted).toBe(false);
    expect(cloned.forceCalendarSync).toBe(false);
    expect(cloned.recurrence).toBeNull();
  });

  it("copies steps with isCompleted=false", async () => {
    vi.mocked(taskRepo.findById).mockResolvedValue(makeTask({ id: "t1" }));
    vi.mocked(taskRepo.findMinSortOrder).mockResolvedValue(0);
    vi.mocked(taskRepo.create).mockImplementation(async (data) => ({
      ...makeTask({}),
      ...data,
      id: data.id ?? "new-id",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    vi.mocked(stepRepo.findByTask).mockResolvedValue([
      { id: "s1", taskId: "t1", title: "Step A", isCompleted: true, sortOrder: 0 },
      { id: "s2", taskId: "t1", title: "Step B", isCompleted: false, sortOrder: 1 },
    ]);
    vi.mocked(stepRepo.create).mockImplementation(async (data) => ({
      id: "new-step",
      ...data,
      isCompleted: false,
    }));

    await service.clone("t1", "user-1");

    expect(stepRepo.create).toHaveBeenCalledTimes(2);
    expect(stepRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Step A", sortOrder: 0 }),
    );
    expect(stepRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Step B", sortOrder: 1 }),
    );
  });

  it("throws when task not found", async () => {
    vi.mocked(taskRepo.findById).mockResolvedValue(undefined);
    await expect(service.clone("nope", "user-1")).rejects.toThrow("Task not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: FAIL — `service.clone is not a function`

- [ ] **Step 3: Implement clone method**

In `src/domain/services/task.service.ts`, add after the `delete` method (around line 175):

```typescript
async clone(id: string, userId: string): Promise<Task> {
  const task = await this.taskRepo.findById(id, userId);
  if (!task) throw new Error("Task not found");
  if (!this.stepRepo) throw new Error("StepRepository not configured");

  const minSort = await this.taskRepo.findMinSortOrder(task.listId);
  const sortOrder = (minSort ?? 1) - 1;

  const cloned = await this.taskRepo.create({
    userId,
    listId: task.listId,
    title: task.title,
    notes: task.notes,
    dueDate: null,
    dueDateEnd: null,
    reminderAt: null,
    recurrence: null,
    locationId: task.locationId,
    locationRadius: task.locationRadius,
    deviceContext: task.deviceContext,
    sortOrder,
  });

  const steps = await this.stepRepo.findByTask(id);
  for (const step of steps) {
    await this.stepRepo.create({
      taskId: cloned.id,
      title: step.title,
      sortOrder: step.sortOrder,
    });
  }

  return cloned;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat(tasks): add clone method to TaskService (TDD)"
```

---

### Task 2: GraphQL mutation + tag copying

**Files:**
- Modify: `src/server/graphql/types/task.ts` (add cloneTask mutation)

- [ ] **Step 1: Add cloneTask mutation**

In `src/server/graphql/types/task.ts`, add after the `deleteTask` mutation (around line 345):

```typescript
builder.mutationField("cloneTask", (t) =>
  t.field({
    type: TaskType,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const cloned = await ctx.services.task.clone(args.id, ctx.userId!);
      // Copy tags via TagService
      const tags = await ctx.services.tag.getByTask(args.id);
      for (const tag of tags) {
        await ctx.services.tag.addToTask(cloned.id, tag.id, ctx.userId!);
      }
      return cloned;
    },
  }),
);
```

- [ ] **Step 2: Commit**

```bash
git add src/server/graphql/types/task.ts
git commit -m "feat(tasks): add cloneTask GraphQL mutation with tag copying"
```

---

### Task 3: GraphQL client operation + codegen

**Files:**
- Modify: `src/graphql/mutations/tasks.graphql` (add CloneTask mutation)

- [ ] **Step 1: Add CloneTask mutation**

In `src/graphql/mutations/tasks.graphql`, add at the end of file:

```graphql
mutation CloneTask($id: String!) {
  cloneTask(id: $id) {
    id
    listId
    title
    notes
    isCompleted
    dueDate
    dueDateEnd
    sortOrder
    createdAt
    forceCalendarSync
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/graphql/mutations/tasks.graphql
git commit -m "feat(tasks): add CloneTask client mutation"
```

---

### Task 4: i18n translations

**Files:**
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/types.ts`

- [ ] **Step 1: Add Czech translation**

Add to the `tasks` section:

```typescript
cloneTask: "Klonovat úkol",
```

- [ ] **Step 2: Add English translation**

Add to the `tasks` section:

```typescript
cloneTask: "Clone task",
```

- [ ] **Step 3: Add to i18n type**

Add `cloneTask: string;` to the `tasks` section in `src/lib/i18n/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts src/lib/i18n/types.ts
git commit -m "feat(tasks): add cloneTask i18n translations"
```

---

### Task 5: UI — clone button in detail panel

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx` (add clone handler + button)

- [ ] **Step 1: Add inline CLONE_TASK mutation**

Near the top of the file, after the existing gql mutations (around line 85):

```typescript
const CLONE_TASK = gql`
  ${APP_TASK_FIELDS}
  mutation CloneTask($id: String!) {
    cloneTask(id: $id) {
      ...AppTaskFields
    }
  }
`;
```

- [ ] **Step 2: Add useMutation hook**

Inside the component function, alongside other mutation hooks:

```typescript
const [cloneTask] = useMutation(CLONE_TASK);
```

- [ ] **Step 3: Add handleClone function**

After the `handleDelete` function. Pattern: write optimistic task to cache immediately (like `task-input.tsx`), fire mutation, update callback reconciles with server data, then navigate to new task:

```typescript
async function handleClone() {
  const tempId = crypto.randomUUID();

  // Build optimistic task matching full AppTaskFields shape
  const optimisticTask = {
    __typename: "Task" as const,
    id: tempId,
    listId: task.listId,
    locationId: task.locationId,
    locationRadius: task.locationRadius,
    title: task.title,
    notes: task.notes,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    dueDateEnd: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: task.deviceContext,
    sortOrder: -1,
    createdAt: new Date().toISOString(),
    steps: (task.steps ?? []).map((s: { title: string; sortOrder: number }) => ({
      __typename: "Step" as const,
      id: crypto.randomUUID(),
      taskId: tempId,
      title: s.title,
      isCompleted: false,
      sortOrder: s.sortOrder,
    })),
    tags: task.tags ?? [],
    location: task.location ?? null,
    list: task.list ?? { __typename: "List" as const, id: task.listId, name: "" },
    blockedByTaskId: null,
    blockedByTask: null,
    blockedByTaskIsCompleted: null,
    dependentTaskCount: 0,
    attachments: [],
    aiAnalysis: null,
    isGoogleCalendarEvent: false,
    isSharedTo: false,
    isSharedFrom: false,
    shareCompletionMode: null,
    shareCompletionAction: null,
    shareCompletionListId: null,
    forceCalendarSync: false,
  };

  // Write optimistic data immediately
  const existing = apolloClient.cache.readQuery<GetAppDataResult>({ query: GET_APP_DATA });
  if (existing) {
    apolloClient.cache.writeQuery({
      query: GET_APP_DATA,
      data: {
        ...existing,
        activeTasks: [optimisticTask, ...existing.activeTasks],
        lists: existing.lists.map((list: { id: string; taskCount: number; visibleTaskCount: number }) =>
          list.id === task.listId
            ? { ...list, taskCount: list.taskCount + 1, visibleTaskCount: list.visibleTaskCount + 1 }
            : list,
        ),
      },
    });
  }

  // Navigate to optimistic task immediately
  const params = new URLSearchParams(searchParams.toString());
  params.set("task", tempId);
  router.push(`?${params.toString()}`, { scroll: false });

  // Fire mutation — update callback replaces optimistic data with server response
  const { data } = await cloneTask({
    variables: { id: taskId },
    update(cache, { data }) {
      if (!data?.cloneTask) return;
      const current = cache.readQuery<GetAppDataResult>({ query: GET_APP_DATA });
      if (!current) return;
      // Remove optimistic entry, add real one
      cache.writeQuery({
        query: GET_APP_DATA,
        data: {
          ...current,
          activeTasks: [
            data.cloneTask,
            ...current.activeTasks.filter((t: { id: string }) => t.id !== tempId),
          ],
        },
      });
    },
  });

  // Navigate to real task ID
  if (data?.cloneTask?.id) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("task", data.cloneTask.id);
    router.push(`?${p.toString()}`, { scroll: false });
  }
}
```

- [ ] **Step 4: Add Clone button to the UI**

Find where the action buttons are rendered in the detail panel body (in the `space-y-1` div with actions like TaskDates, TaskRecurrence, etc.). Add the clone button there:

```tsx
<Button
  variant="ghost"
  className="w-full justify-start gap-2"
  onClick={handleClone}
>
  <Copy className="h-4 w-4" />
  {t("tasks.cloneTask")}
</Button>
```

Add `Copy` to the Lucide import at the top of the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat(tasks): add clone button in task detail panel"
```

---

### Task 6: Verify end-to-end + run checks

- [ ] **Step 1: Run all tests**

Run: `yarn test`
Expected: all PASS

- [ ] **Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `yarn lint && yarn format:check`
Expected: no new errors

- [ ] **Step 4: Fix any issues**

If any check fails, fix and re-run.

- [ ] **Step 5: Final commit if needed**

```bash
git commit -m "fix(tasks): address lint/type issues in cloneTask"
```
