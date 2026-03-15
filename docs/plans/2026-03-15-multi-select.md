# Multi-Select Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multi-selection of tasks, lists, and subtasks with bulk actions, context menu, and multi-drag support.

**Architecture:** Three independent React selection contexts (task, list, step) sharing a generic `useSelectionBehavior` hook. Backend bulk mutations through domain services → Drizzle repositories → GraphQL. Context menu (radix-ui) for bulk actions. Multi-drag via @dnd-kit DragOverlay with count badge.

**Tech Stack:** React 19, Next.js 16, Apollo Client v4, @dnd-kit, GraphQL Yoga + Pothos, Drizzle ORM, Vitest, Radix UI Context Menu

**Free mode feature** — no premium gating.

---

### Task 1: `useSelectionBehavior` hook

Generic hook for selection logic: click, shift+click, cmd+click, escape, select all.

**Files:**
- Create: `src/hooks/use-selection-behavior.ts`
- Test: `src/hooks/__tests__/use-selection-behavior.test.ts`

**Step 1: Write the test file**

Create `src/hooks/__tests__/use-selection-behavior.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelectionBehavior } from "../use-selection-behavior";

const items = ["a", "b", "c", "d", "e"];

function useHook() {
  return useSelectionBehavior(items);
}

describe("useSelectionBehavior", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(useHook);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("plain click selects single item and deselects others", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("b", {}));
    expect([...result.current.selectedIds]).toEqual(["b"]);
    act(() => result.current.handleClick("d", {}));
    expect([...result.current.selectedIds]).toEqual(["d"]);
  });

  it("cmd/ctrl+click toggles item in selection", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("a", { metaKey: true }));
    act(() => result.current.handleClick("c", { metaKey: true }));
    expect([...result.current.selectedIds]).toEqual(["a", "c"]);
    act(() => result.current.handleClick("a", { metaKey: true }));
    expect([...result.current.selectedIds]).toEqual(["c"]);
  });

  it("shift+click selects range from anchor", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("b", {}));
    act(() => result.current.handleClick("d", { shiftKey: true }));
    expect([...result.current.selectedIds]).toEqual(["b", "c", "d"]);
  });

  it("shift+click selects range in reverse direction", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("d", {}));
    act(() => result.current.handleClick("b", { shiftKey: true }));
    expect([...result.current.selectedIds]).toEqual(["b", "c", "d"]);
  });

  it("clear() empties selection", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("a", {}));
    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("selectAll() selects all items", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.selectAll());
    expect([...result.current.selectedIds]).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("removeFromSelection removes specific ids", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.selectAll());
    act(() => result.current.removeFromSelection(["b", "d"]));
    expect([...result.current.selectedIds]).toEqual(["a", "c", "e"]);
  });

  it("isMultiSelect returns true when 2+ selected", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("a", {}));
    expect(result.current.isMultiSelect).toBe(false);
    act(() => result.current.handleClick("b", { metaKey: true }));
    expect(result.current.isMultiSelect).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test src/hooks/__tests__/use-selection-behavior.test.ts`
Expected: FAIL — module not found

**Step 3: Write the hook**

Create `src/hooks/use-selection-behavior.ts`:

```typescript
import { useCallback, useRef, useState } from "react";

interface ClickModifiers {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

export interface SelectionBehavior {
  selectedIds: Set<string>;
  isMultiSelect: boolean;
  handleClick: (id: string, modifiers: ClickModifiers) => void;
  clear: () => void;
  selectAll: () => void;
  removeFromSelection: (ids: string[]) => void;
}

export function useSelectionBehavior(orderedIds: string[]): SelectionBehavior {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (id: string, modifiers: ClickModifiers) => {
      const isMeta = modifiers.metaKey || modifiers.ctrlKey;

      if (modifiers.shiftKey && anchorRef.current) {
        const anchorIdx = orderedIds.indexOf(anchorRef.current);
        const targetIdx = orderedIds.indexOf(id);
        if (anchorIdx === -1 || targetIdx === -1) return;
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        setSelectedIds(new Set(orderedIds.slice(start, end + 1)));
      } else if (isMeta) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        anchorRef.current = id;
      } else {
        setSelectedIds(new Set([id]));
        anchorRef.current = id;
      }
    },
    [orderedIds],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(orderedIds));
  }, [orderedIds]);

  const removeFromSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  return {
    selectedIds,
    isMultiSelect: selectedIds.size >= 2,
    handleClick,
    clear,
    selectAll,
    removeFromSelection,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test src/hooks/__tests__/use-selection-behavior.test.ts`
Expected: PASS — all 9 tests

**Step 5: Commit**

```bash
git add src/hooks/use-selection-behavior.ts src/hooks/__tests__/use-selection-behavior.test.ts
git commit -m "feat: add useSelectionBehavior hook with tests"
```

---

### Task 2: `TaskSelectionProvider` context

Context provider wrapping `useSelectionBehavior` for tasks. Provides selection state to task-item components.

**Files:**
- Create: `src/components/providers/task-selection-provider.tsx`
- Modify: `src/components/layout/app-shell.tsx` (wrap with provider)

**Step 1: Create the provider**

Create `src/components/providers/task-selection-provider.tsx`:

```typescript
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useSelectionBehavior,
  type SelectionBehavior,
} from "@/hooks/use-selection-behavior";

const TaskSelectionContext = createContext<SelectionBehavior | null>(null);

export function TaskSelectionProvider({
  taskIds,
  children,
}: {
  taskIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(taskIds);

  return (
    <TaskSelectionContext.Provider value={selection}>
      {children}
    </TaskSelectionContext.Provider>
  );
}

export function useTaskSelection(): SelectionBehavior {
  const ctx = useContext(TaskSelectionContext);
  if (!ctx) throw new Error("useTaskSelection must be inside TaskSelectionProvider");
  return ctx;
}

export function useTaskSelectionOptional(): SelectionBehavior | null {
  return useContext(TaskSelectionContext);
}
```

**Step 2: Wire into the app**

The `TaskSelectionProvider` needs the current list of task IDs. It should wrap the task list area. The best place to add it is inside each page that renders tasks, passing the current task IDs. However, since tasks come from `AppDataProvider` and are filtered per page, the provider should be placed inside the list pages.

The simpler approach: place the provider inside `sortable-task-list.tsx` and `task-list.tsx` since they receive the `tasks` array and know the IDs.

Modify `src/components/tasks/sortable-task-list.tsx` — wrap the component body with `TaskSelectionProvider`:

At the top, add import:
```typescript
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";
```

Wrap the returned JSX's `SortableContext` section with `TaskSelectionProvider`:
```typescript
const taskIds = useMemo(() => nonDepartingTasks.map(t => t.id), [nonDepartingTasks]);

return (
  <TaskSelectionProvider taskIds={taskIds}>
    {/* existing JSX */}
  </TaskSelectionProvider>
);
```

Similarly modify `src/components/tasks/task-list.tsx` — wrap with `TaskSelectionProvider`:
```typescript
import { TaskSelectionProvider } from "@/components/providers/task-selection-provider";

const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);

return (
  <TaskSelectionProvider taskIds={taskIds}>
    {/* existing JSX */}
  </TaskSelectionProvider>
);
```

**Step 3: Run `yarn check`**

Run: `yarn check`
Expected: PASS — no type errors

**Step 4: Commit**

```bash
git add src/components/providers/task-selection-provider.tsx src/components/tasks/sortable-task-list.tsx src/components/tasks/task-list.tsx
git commit -m "feat: add TaskSelectionProvider context"
```

---

### Task 3: Task visual selection + click handling

Modify task-item to show selected state and handle modifier clicks.

**Files:**
- Modify: `src/components/tasks/task-item.tsx`

**Step 1: Add selection handling to TaskItem**

Import selection hook:
```typescript
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";
```

Inside the `TaskItem` component, add:
```typescript
const taskSelection = useTaskSelectionOptional();
const isSelected = taskSelection?.selectedIds.has(task.id) ?? false;
```

**Step 2: Modify the click handler**

Currently, clicking a task opens the detail panel via `router.push`. Modify the click handler (the `<div>` wrapping the task row, around line 332) to check for modifier keys:

```typescript
const handleRowClick = (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.preventDefault();
    taskSelection?.handleClick(task.id, {
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
    });
    return;
  }
  // Original behavior: clear selection and open detail panel
  taskSelection?.clear();
  router.push(`?task=${task.id}`, { scroll: false });
};
```

Replace the existing `onClick` on the task row `<div>` with `handleRowClick`.

**Step 3: Add visual selected state**

Add a selected background class to the task row `<div>`:
```typescript
className={cn(
  // existing classes...
  isSelected && "bg-accent",
)}
```

**Step 4: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/tasks/task-item.tsx
git commit -m "feat: add multi-select click handling and visual state to TaskItem"
```

---

### Task 4: Backend — repository interfaces for bulk operations

Add bulk methods to the domain repository interfaces.

**Files:**
- Modify: `src/domain/repositories/task.repository.ts`
- Modify: `src/domain/repositories/list.repository.ts`
- Modify: `src/domain/repositories/step.repository.ts`

**Step 1: Add bulk methods to ITaskRepository**

In `src/domain/repositories/task.repository.ts`, add to the `ITaskRepository` interface:

```typescript
deleteMany(ids: string[], userId: string): Promise<void>;
updateMany(ids: string[], userId: string, data: Partial<Task>): Promise<void>;
```

**Step 2: Add bulk method to IListRepository**

In `src/domain/repositories/list.repository.ts`, add to the `IListRepository` interface:

```typescript
deleteManyNonDefault(ids: string[], userId: string): Promise<void>;
```

**Step 3: Add bulk method to IStepRepository**

In `src/domain/repositories/step.repository.ts`, add to the `IStepRepository` interface:

```typescript
deleteMany(ids: string[]): Promise<void>;
```

**Step 4: Run `yarn typecheck`**

Run: `yarn typecheck`
Expected: FAIL — implementations don't have the new methods yet (will fix in Task 5)

**Step 5: Commit**

```bash
git add src/domain/repositories/task.repository.ts src/domain/repositories/list.repository.ts src/domain/repositories/step.repository.ts
git commit -m "feat: add bulk operation methods to repository interfaces"
```

---

### Task 5: Backend — Drizzle repository implementations

Implement the bulk methods in the Drizzle repositories.

**Files:**
- Modify: `src/infrastructure/persistence/drizzle-task.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-list.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-step.repository.ts`

**Step 1: Implement `deleteMany` in DrizzleTaskRepository**

In `src/infrastructure/persistence/drizzle-task.repository.ts`, add method:

```typescript
async deleteMany(ids: string[], userId: string): Promise<void> {
  if (ids.length === 0) return;
  await this.db
    .delete(schema.tasks)
    .where(and(inArray(schema.tasks.id, ids), eq(schema.tasks.userId, userId)));
}
```

**Step 2: Implement `updateMany` in DrizzleTaskRepository**

```typescript
async updateMany(ids: string[], userId: string, data: Partial<Task>): Promise<void> {
  if (ids.length === 0) return;
  await this.db
    .update(schema.tasks)
    .set(data)
    .where(and(inArray(schema.tasks.id, ids), eq(schema.tasks.userId, userId)));
}
```

**Step 3: Implement `deleteManyNonDefault` in DrizzleListRepository**

In `src/infrastructure/persistence/drizzle-list.repository.ts`, add:

```typescript
async deleteManyNonDefault(ids: string[], userId: string): Promise<void> {
  if (ids.length === 0) return;
  await this.db
    .delete(schema.lists)
    .where(
      and(
        inArray(schema.lists.id, ids),
        eq(schema.lists.userId, userId),
        eq(schema.lists.isDefault, false),
      ),
    );
}
```

**Step 4: Implement `deleteMany` in DrizzleStepRepository**

In `src/infrastructure/persistence/drizzle-step.repository.ts`, add:

```typescript
async deleteMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await this.db.delete(schema.steps).where(inArray(schema.steps.id, ids));
}
```

Note: `inArray` is already imported in all three files.

**Step 5: Run `yarn typecheck`**

Run: `yarn typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/infrastructure/persistence/drizzle-task.repository.ts src/infrastructure/persistence/drizzle-list.repository.ts src/infrastructure/persistence/drizzle-step.repository.ts
git commit -m "feat: implement bulk repository methods in Drizzle"
```

---

### Task 6: Backend — domain services with bulk methods

Add bulk operation methods to the domain services.

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/domain/services/list.service.ts`
- Modify: `src/domain/services/step.service.ts`

**Step 1: Add bulk methods to TaskService**

In `src/domain/services/task.service.ts`, add:

```typescript
async deleteMany(ids: string[], userId: string): Promise<boolean> {
  await this.taskRepo.deleteMany(ids, userId);
  return true;
}

async updateMany(
  ids: string[],
  userId: string,
  input: Partial<Pick<Task, "listId" | "dueDate" | "reminderAt" | "recurrence" | "deviceContext">>,
): Promise<boolean> {
  const data: Partial<Task> = {};
  if (input.listId !== undefined) data.listId = input.listId;
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate;
    data.reminderAt = computeDefaultReminder(input.dueDate);
  }
  if (input.recurrence !== undefined) data.recurrence = input.recurrence;
  if (input.deviceContext !== undefined) data.deviceContext = input.deviceContext;
  await this.taskRepo.updateMany(ids, userId, data);
  return true;
}

async setManyCompleted(ids: string[], userId: string, isCompleted: boolean): Promise<boolean> {
  await this.taskRepo.updateMany(ids, userId, {
    isCompleted,
    completedAt: isCompleted ? new Date() : null,
  });
  return true;
}
```

**Step 2: Add bulk method to ListService**

In `src/domain/services/list.service.ts`, add:

```typescript
async deleteMany(ids: string[], userId: string): Promise<boolean> {
  await this.listRepo.deleteManyNonDefault(ids, userId);
  return true;
}
```

**Step 3: Add bulk method to StepService**

In `src/domain/services/step.service.ts`, add:

```typescript
async deleteMany(userId: string, ids: string[]): Promise<boolean> {
  // Verify ownership: load steps, check tasks belong to user
  for (const id of ids) {
    const step = await this.stepRepo.findById(id);
    if (!step) throw new Error("Step not found");
    const task = await this.taskRepo.findById(step.taskId, userId);
    if (!task) throw new Error("Step not found");
  }
  await this.stepRepo.deleteMany(ids);
  return true;
}
```

**Step 4: Run `yarn typecheck`**

Run: `yarn typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/list.service.ts src/domain/services/step.service.ts
git commit -m "feat: add bulk operation methods to domain services"
```

---

### Task 7: Backend — domain service tests for bulk operations

Add tests for the new bulk service methods.

**Files:**
- Modify: `src/domain/services/__tests__/task.service.test.ts`

**Step 1: Add tests for bulk operations**

Add these tests inside the existing `describe("TaskService")` block in `src/domain/services/__tests__/task.service.test.ts`:

```typescript
describe("deleteMany", () => {
  it("smaže více úkolů najednou", async () => {
    vi.mocked(repo.deleteMany).mockResolvedValue(undefined);

    const result = await service.deleteMany(["task-1", "task-2"], "user-1");

    expect(result).toBe(true);
    expect(repo.deleteMany).toHaveBeenCalledWith(["task-1", "task-2"], "user-1");
  });
});

describe("updateMany", () => {
  it("aktualizuje listId pro více úkolů", async () => {
    vi.mocked(repo.updateMany).mockResolvedValue(undefined);

    const result = await service.updateMany(["task-1", "task-2"], "user-1", { listId: "list-2" });

    expect(result).toBe(true);
    expect(repo.updateMany).toHaveBeenCalledWith(
      ["task-1", "task-2"],
      "user-1",
      expect.objectContaining({ listId: "list-2" }),
    );
  });

  it("nastaví reminderAt při změně dueDate", async () => {
    vi.mocked(repo.updateMany).mockResolvedValue(undefined);

    await service.updateMany(["task-1"], "user-1", { dueDate: "2026-03-20" });

    expect(repo.updateMany).toHaveBeenCalledWith(
      ["task-1"],
      "user-1",
      expect.objectContaining({
        dueDate: "2026-03-20",
        reminderAt: expect.any(String),
      }),
    );
  });
});

describe("setManyCompleted", () => {
  it("označí více úkolů jako dokončené", async () => {
    vi.mocked(repo.updateMany).mockResolvedValue(undefined);

    const result = await service.setManyCompleted(["task-1", "task-2"], "user-1", true);

    expect(result).toBe(true);
    expect(repo.updateMany).toHaveBeenCalledWith(
      ["task-1", "task-2"],
      "user-1",
      expect.objectContaining({
        isCompleted: true,
        completedAt: expect.any(Date),
      }),
    );
  });

  it("označí více úkolů jako nedokončené", async () => {
    vi.mocked(repo.updateMany).mockResolvedValue(undefined);

    await service.setManyCompleted(["task-1"], "user-1", false);

    expect(repo.updateMany).toHaveBeenCalledWith(
      ["task-1"],
      "user-1",
      expect.objectContaining({
        isCompleted: false,
        completedAt: null,
      }),
    );
  });
});
```

**Important:** The `makeRepo` function needs `deleteMany` and `updateMany` mocks added:

```typescript
deleteMany: vi.fn(),
updateMany: vi.fn(),
```

**Step 2: Run tests**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/domain/services/__tests__/task.service.test.ts
git commit -m "test: add bulk operation tests for TaskService"
```

---

### Task 8: Backend — GraphQL bulk mutations

Add GraphQL mutations for bulk operations.

**Files:**
- Modify: `src/server/graphql/types/task.ts`
- Modify: `src/server/graphql/types/list.ts`
- Modify: `src/server/graphql/types/step.ts`

**Step 1: Add bulk task mutations**

In `src/server/graphql/types/task.ts`, after the existing `reorderTasks` mutation, add:

```typescript
const BulkTaskUpdateInput = builder.inputType("BulkTaskUpdateInput", {
  fields: (t) => ({
    listId: t.string(),
    dueDate: t.string(),
    recurrence: t.string(),
    deviceContext: t.string(),
  }),
});

builder.mutationField("deleteTasks", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.task.deleteMany(args.ids, ctx.userId!),
  }),
);

builder.mutationField("updateTasks", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      ids: t.arg.stringList({ required: true }),
      input: t.arg({ type: BulkTaskUpdateInput, required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.updateMany(args.ids, ctx.userId!, args.input),
  }),
);

builder.mutationField("setTasksCompleted", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      ids: t.arg.stringList({ required: true }),
      isCompleted: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.setManyCompleted(args.ids, ctx.userId!, args.isCompleted),
  }),
);
```

**Step 2: Add bulk list mutation**

In `src/server/graphql/types/list.ts`, after the existing `reorderLists` mutation, add:

```typescript
builder.mutationField("deleteLists", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.list.deleteMany(args.ids, ctx.userId!),
  }),
);
```

**Step 3: Add bulk step mutation**

In `src/server/graphql/types/step.ts`, after `toggleStepCompleted`, add:

```typescript
builder.mutationField("deleteSteps", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_root, args, ctx) => ctx.services.step.deleteMany(ctx.userId!, args.ids),
  }),
);
```

**Step 4: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/graphql/types/task.ts src/server/graphql/types/list.ts src/server/graphql/types/step.ts
git commit -m "feat: add bulk GraphQL mutations (deleteTasks, updateTasks, setTasksCompleted, deleteLists, deleteSteps)"
```

---

### Task 9: Context menu — bulk task actions

Modify the task-item context menu to show bulk actions when multiple tasks are selected.

**Files:**
- Modify: `src/components/tasks/task-item.tsx`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/types.ts`

**Step 1: Add i18n keys**

In `src/lib/i18n/types.ts`, add to the `Dictionary` interface under a suitable section:

```typescript
bulkDelete: string;
bulkComplete: string;
bulkUncomplete: string;
bulkMoveTo: string;
bulkSetDueDate: string;
bulkSelectedCount: string;
```

In `src/lib/i18n/dictionaries/cs.ts`:
```typescript
bulkDelete: "Smazat vybrané",
bulkComplete: "Označit jako dokončené",
bulkUncomplete: "Označit jako nedokončené",
bulkMoveTo: "Přesunout do",
bulkSetDueDate: "Nastavit datum",
bulkSelectedCount: "{{count}} vybráno",
```

In `src/lib/i18n/dictionaries/en.ts`:
```typescript
bulkDelete: "Delete selected",
bulkComplete: "Mark as completed",
bulkUncomplete: "Mark as not completed",
bulkMoveTo: "Move to",
bulkSetDueDate: "Set due date",
bulkSelectedCount: "{{count}} selected",
```

**Step 2: Add bulk mutations to task-item.tsx**

Add GraphQL mutation definitions at the top of `task-item.tsx`:

```typescript
const DELETE_TASKS = gql`
  mutation DeleteTasks($ids: [String!]!) {
    deleteTasks(ids: $ids)
  }
`;

const UPDATE_TASKS = gql`
  mutation UpdateTasks($ids: [String!]!, $input: BulkTaskUpdateInput!) {
    updateTasks(ids: $ids, input: $input)
  }
`;

const SET_TASKS_COMPLETED = gql`
  mutation SetTasksCompleted($ids: [String!]!, $isCompleted: Boolean!) {
    setTasksCompleted(ids: $ids, isCompleted: $isCompleted)
  }
`;
```

**Step 3: Modify context menu to be bulk-aware**

Inside the `TaskItem` component:

1. Get the selection context and hook up mutations:
```typescript
const [deleteTasks] = useMutation(DELETE_TASKS);
const [updateTasks] = useMutation(UPDATE_TASKS);
const [setTasksCompleted] = useMutation(SET_TASKS_COMPLETED);

const selectedIds = taskSelection?.selectedIds ?? new Set();
const isBulkMode = isSelected && selectedIds.size >= 2;
const bulkIds = [...selectedIds];
```

2. When right-clicking on a selected item in bulk mode, show bulk context menu items instead of single-item ones. When right-clicking on a non-selected item, reset selection to just that item.

Add an `onContextMenu` handler to the task row `<div>`:
```typescript
const handleContextMenu = (e: React.MouseEvent) => {
  if (!isSelected && taskSelection) {
    // Right-click on unselected item: select only this one
    taskSelection.handleClick(task.id, {});
  }
};
```

3. Inside the existing `<ContextMenuContent>`, conditionally render bulk or single-item actions:

```typescript
{isBulkMode ? (
  <>
    <ContextMenuLabel>
      {t("bulkSelectedCount", { count: String(selectedIds.size) })}
    </ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => {
      setTasksCompleted({ variables: { ids: bulkIds, isCompleted: true } });
      // Optimistic: evict tasks from cache or update
      for (const id of bulkIds) {
        cache.modify({
          id: cache.identify({ __typename: "Task", id }),
          fields: { isCompleted: () => true, completedAt: () => new Date().toISOString() },
        });
      }
      taskSelection?.clear();
    }}>
      <Check className="mr-2 h-4 w-4" />
      {t("bulkComplete")}
    </ContextMenuItem>
    <ContextMenuItem onClick={() => {
      setTasksCompleted({ variables: { ids: bulkIds, isCompleted: false } });
      for (const id of bulkIds) {
        cache.modify({
          id: cache.identify({ __typename: "Task", id }),
          fields: { isCompleted: () => false, completedAt: () => null },
        });
      }
      taskSelection?.clear();
    }}>
      <RotateCcw className="mr-2 h-4 w-4" />
      {t("bulkUncomplete")}
    </ContextMenuItem>
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <ArrowRight className="mr-2 h-4 w-4" />
        {t("bulkMoveTo")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        {lists.map((list) => (
          <ContextMenuItem
            key={list.id}
            onClick={() => {
              updateTasks({ variables: { ids: bulkIds, input: { listId: list.id } } });
              for (const id of bulkIds) {
                cache.modify({
                  id: cache.identify({ __typename: "Task", id }),
                  fields: { listId: () => list.id },
                });
              }
              taskSelection?.clear();
            }}
          >
            {list.name}
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
    <ContextMenuSeparator />
    <ContextMenuItem
      variant="destructive"
      onClick={() => {
        deleteTasks({ variables: { ids: bulkIds } });
        for (const id of bulkIds) {
          cache.evict({ id: cache.identify({ __typename: "Task", id }) });
        }
        cache.gc();
        taskSelection?.clear();
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {t("bulkDelete")}
    </ContextMenuItem>
  </>
) : (
  /* existing single-item context menu content */
)}
```

The `cache` variable is available via `useApolloClient()`:
```typescript
const { cache } = useApolloClient();
```

Import `useApolloClient` from `@apollo/client/react`.

The `lists` variable is available via `useAppData()`:
```typescript
const { lists } = useAppData();
```

**Step 4: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/tasks/task-item.tsx src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts src/lib/i18n/types.ts
git commit -m "feat: add bulk context menu actions for multi-selected tasks"
```

---

### Task 10: Detail panel auto-close on multi-select

Close the task detail panel when 2+ tasks are selected.

**Files:**
- Modify: `src/components/layout/resizable-task-layout.tsx` (or the page that manages the detail panel)

**Step 1: Add auto-close logic**

The detail panel is opened via URL search param `?task=<id>`. When multi-selecting, we need to remove this param.

In the component that renders the task list (the list page at `src/app/(app)/lists/[listId]/page.tsx` or similar), or directly in `TaskItem`'s `handleRowClick`:

The simplest approach: in the `handleRowClick` of `task-item.tsx`, when doing multi-select (shift/cmd click), also remove the `?task` search param if present:

```typescript
const handleRowClick = (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.preventDefault();
    taskSelection?.handleClick(task.id, {
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
    });
    // Close detail panel when multi-selecting
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("task")) {
      params.delete("task");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    return;
  }
  taskSelection?.clear();
  router.push(`?task=${task.id}`, { scroll: false });
};
```

Note: `searchParams` is available via `useSearchParams()` from `next/navigation` — check if it's already imported in task-item.tsx (it likely is since the detail panel uses URL params).

**Step 2: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/tasks/task-item.tsx
git commit -m "feat: auto-close detail panel on multi-select"
```

---

### Task 11: Keyboard shortcuts (Escape, Cmd+A)

Add global keyboard shortcuts for selection management.

**Files:**
- Modify: `src/hooks/use-keyboard-shortcuts.ts`

**Step 1: Add Escape and Cmd+A handlers**

In `src/hooks/use-keyboard-shortcuts.ts`, the hook takes a `router` parameter. It needs access to the task selection context.

Import and use `useTaskSelectionOptional`:

```typescript
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";
```

Inside the hook:
```typescript
const taskSelection = useTaskSelectionOptional();
```

In the `keydown` event handler, add:

```typescript
// Escape: clear selection
if (e.key === "Escape" && taskSelection && taskSelection.selectedIds.size > 0) {
  e.preventDefault();
  taskSelection.clear();
  return;
}

// Cmd/Ctrl+A: select all tasks (only when not in input/textarea)
if ((e.metaKey || e.ctrlKey) && e.key === "a" && taskSelection) {
  e.preventDefault();
  taskSelection.selectAll();
  return;
}
```

The existing check for `input`/`textarea`/`[contenteditable]` (line 12 in current code) should prevent these from firing when typing.

**Step 2: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/use-keyboard-shortcuts.ts
git commit -m "feat: add Escape and Cmd+A keyboard shortcuts for selection"
```

---

### Task 12: `ListSelectionProvider` + visual selection + context menu

Add multi-select for lists in the sidebar. Only bulk delete action.

**Files:**
- Create: `src/components/providers/list-selection-provider.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/types.ts`

**Step 1: Create the provider**

Create `src/components/providers/list-selection-provider.tsx`:

```typescript
"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useSelectionBehavior,
  type SelectionBehavior,
} from "@/hooks/use-selection-behavior";

const ListSelectionContext = createContext<SelectionBehavior | null>(null);

export function ListSelectionProvider({
  listIds,
  children,
}: {
  listIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(listIds);
  return (
    <ListSelectionContext.Provider value={selection}>
      {children}
    </ListSelectionContext.Provider>
  );
}

export function useListSelection(): SelectionBehavior {
  const ctx = useContext(ListSelectionContext);
  if (!ctx) throw new Error("useListSelection must be inside ListSelectionProvider");
  return ctx;
}

export function useListSelectionOptional(): SelectionBehavior | null {
  return useContext(ListSelectionContext);
}
```

**Step 2: Wire into sidebar.tsx**

In `src/components/layout/sidebar.tsx`:

1. Import `ListSelectionProvider` and `useListSelection`
2. Wrap the sortable list section with `ListSelectionProvider`, passing the list IDs
3. Add modifier click handling to `SortableListItem`:
   - Check shift/cmd keys in onClick
   - Add `bg-accent` class for selected state
4. Add bulk context menu on right-click when multiple selected:
   - Show `DELETE_LISTS` mutation option
   - Optimistic cache eviction

Add i18n keys:
```typescript
// cs.ts
bulkDeleteLists: "Smazat vybrané seznamy",

// en.ts
bulkDeleteLists: "Delete selected lists",
```

Add the `DELETE_LISTS` mutation:
```typescript
const DELETE_LISTS = gql`
  mutation DeleteLists($ids: [String!]!) {
    deleteLists(ids: $ids)
  }
`;
```

**Step 3: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/providers/list-selection-provider.tsx src/components/layout/sidebar.tsx src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts src/lib/i18n/types.ts
git commit -m "feat: add multi-select for lists with bulk delete"
```

---

### Task 13: `StepSelectionProvider` + visual selection + context menu

Add multi-select for subtasks in the detail panel. Only bulk delete action.

**Files:**
- Create: `src/components/providers/step-selection-provider.tsx`
- Modify: `src/components/tasks/detail/task-steps.tsx`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/types.ts`

**Step 1: Create the provider**

Create `src/components/providers/step-selection-provider.tsx`:

```typescript
"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useSelectionBehavior,
  type SelectionBehavior,
} from "@/hooks/use-selection-behavior";

const StepSelectionContext = createContext<SelectionBehavior | null>(null);

export function StepSelectionProvider({
  stepIds,
  children,
}: {
  stepIds: string[];
  children: ReactNode;
}) {
  const selection = useSelectionBehavior(stepIds);
  return (
    <StepSelectionContext.Provider value={selection}>
      {children}
    </StepSelectionContext.Provider>
  );
}

export function useStepSelection(): SelectionBehavior {
  const ctx = useContext(StepSelectionContext);
  if (!ctx) throw new Error("useStepSelection must be inside StepSelectionProvider");
  return ctx;
}

export function useStepSelectionOptional(): SelectionBehavior | null {
  return useContext(StepSelectionContext);
}
```

**Step 2: Wire into task-steps.tsx**

In `src/components/tasks/detail/task-steps.tsx`:

1. Import `StepSelectionProvider`, `useStepSelection`
2. Wrap steps list with `StepSelectionProvider`, passing step IDs
3. Add modifier click handling to step items
4. Add `bg-accent` class for selected state
5. Add bulk context menu with `DELETE_STEPS` mutation:

```typescript
const DELETE_STEPS = gql`
  mutation DeleteSteps($ids: [String!]!) {
    deleteSteps(ids: $ids)
  }
`;
```

Add i18n keys:
```typescript
// cs.ts
bulkDeleteSteps: "Smazat vybrané podúkoly",

// en.ts
bulkDeleteSteps: "Delete selected subtasks",
```

**Step 3: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/providers/step-selection-provider.tsx src/components/tasks/detail/task-steps.tsx src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts src/lib/i18n/types.ts
git commit -m "feat: add multi-select for subtasks with bulk delete"
```

---

### Task 14: Bulk drag & drop

Enable dragging multiple selected tasks at once.

**Files:**
- Modify: `src/components/providers/task-dnd-provider.tsx`
- Modify: `src/components/tasks/sortable-task-item.tsx`
- Modify: `src/components/tasks/sortable-task-list.tsx`

**Step 1: Modify DragOverlay for multi-drag**

In `src/components/providers/task-dnd-provider.tsx`:

1. Import `useTaskSelectionOptional`:
```typescript
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";
```

2. In the component, get the selection:
```typescript
const taskSelection = useTaskSelectionOptional();
```

3. Track how many items are being dragged. In `handleDragStart`, check if the dragged item is selected:
```typescript
const [dragCount, setDragCount] = useState(0);

// In handleDragStart:
const isSelected = taskSelection?.selectedIds.has(active.id as string) ?? false;
const count = isSelected ? taskSelection!.selectedIds.size : 1;
setDragCount(count);

// If dragging an unselected item, clear selection
if (!isSelected && taskSelection) {
  taskSelection.clear();
}
```

4. Update the `DragOverlay` to show count badge:
```typescript
<DragOverlay>
  {activeInfo ? (
    <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 shadow-lg border">
      <span className="truncate text-sm">{activeInfo.title}</span>
      {dragCount > 1 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          +{dragCount - 1}
        </span>
      )}
    </div>
  ) : null}
</DragOverlay>
```

**Step 2: Handle multi-drag in `handleDragEnd`**

In `handleDragEnd`, when a selected task is dragged to a list (task → list drop), move all selected tasks:

```typescript
// In the task → list section of handleDragEnd:
if (activeInfo.type === "task" && overListId) {
  const idsToMove = taskSelection?.selectedIds.has(activeInfo.id)
    ? [...taskSelection.selectedIds]
    : [activeInfo.id];

  for (const id of idsToMove) {
    updateTask({ variables: { id, input: { listId: overListId } } });
    // Optimistic cache update
    cache.modify({
      id: cache.identify({ __typename: "Task", id }),
      fields: { listId: () => overListId },
    });
  }
  taskSelection?.clear();
}
```

**Step 3: Reduce opacity of selected non-dragged items**

In `src/components/tasks/sortable-task-item.tsx`, when a drag is active and the item is selected but not the one being dragged, reduce opacity:

```typescript
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";
import { useDndContext } from "@dnd-kit/core";

// Inside the component:
const taskSelection = useTaskSelectionOptional();
const { active } = useDndContext();
const isSelected = taskSelection?.selectedIds.has(task.id) ?? false;
const isDraggedElsewhere = active && active.id !== task.id && isSelected;

// In the style/className:
style={{
  ...style,
  opacity: isDraggedElsewhere ? 0.4 : isDragging ? 0.5 : 1,
}}
```

**Step 4: Run `yarn check`**

Run: `yarn check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/providers/task-dnd-provider.tsx src/components/tasks/sortable-task-item.tsx src/components/tasks/sortable-task-list.tsx
git commit -m "feat: add bulk drag & drop for multi-selected tasks"
```

---

### Task 15: Final integration test

Run full check suite and verify everything works together.

**Step 1: Run full check**

Run: `yarn check`
Expected: PASS — lint, format, typecheck, tests all green

**Step 2: Manual testing checklist**

- [ ] Click task → selects one, opens detail panel
- [ ] Cmd+click → toggles task in/out of selection
- [ ] Shift+click → selects range from anchor
- [ ] 2+ selected → detail panel closes
- [ ] Right-click on selected → bulk context menu with count header
- [ ] Bulk delete → removes all selected from cache
- [ ] Bulk complete → marks all as done
- [ ] Bulk move → moves all to target list
- [ ] Escape → clears selection
- [ ] Cmd+A → selects all visible tasks
- [ ] Drag selected task → DragOverlay shows "+N" badge
- [ ] Drop selected tasks on list → all move to that list
- [ ] Right-click on unselected item → resets selection, shows single-item menu
- [ ] List multi-select in sidebar → bulk delete works
- [ ] Step multi-select in detail panel → bulk delete works

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for multi-select feature"
```
