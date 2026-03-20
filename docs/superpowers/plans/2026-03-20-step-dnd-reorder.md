# DnD Reorder pro Subtasky (Steps)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umožnit přetahování subtasků (steps) v detailu tasku pro změnu jejich pořadí.

**Architecture:** Rozšíření existujícího DnD patternu (tasks používají `@dnd-kit/sortable`) na steps. Backend: nová `reorderSteps` mutace → `StepService.reorder()` → bulk update `sortOrder`. Frontend: `@dnd-kit` v `TaskSteps` komponentě, celý řádek je draggable.

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, GraphQL (Pothos), Apollo Client, Drizzle ORM

---

### Task 1: Backend — `reorderSteps` service metoda + repository

**Files:**
- Modify: `src/domain/repositories/step.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-step.repository.ts`
- Modify: `src/domain/services/step.service.ts`
- Modify: `src/domain/entities/task.ts` (ReorderItem reuse)
- Test: `src/domain/services/__tests__/step.service.test.ts`

- [ ] **Step 1: Přidat `updateSortOrder` do IStepRepository**

V `src/domain/repositories/step.repository.ts` přidat metodu:

```typescript
updateSortOrder(id: string, sortOrder: number): Promise<void>;
```

- [ ] **Step 2: Implementovat `updateSortOrder` v DrizzleStepRepository**

V `src/infrastructure/persistence/drizzle-step.repository.ts` přidat:

```typescript
async updateSortOrder(id: string, sortOrder: number): Promise<void> {
  await this.db
    .update(schema.steps)
    .set({ sortOrder })
    .where(eq(schema.steps.id, id));
}
```

Poznámka: Steps nemají userId filtr na úrovni DB — autorizace se řeší v service vrstvě přes taskRepo.

- [ ] **Step 3: Přidat `reorder` do StepService**

V `src/domain/services/step.service.ts` přidat metodu:

```typescript
async reorder(userId: string, taskId: string, items: { id: string; sortOrder: number }[]): Promise<boolean> {
  const task = await this.taskRepo.findById(taskId, userId);
  if (!task) throw new Error("Task not found");
  for (const item of items) {
    await this.stepRepo.updateSortOrder(item.id, item.sortOrder);
  }
  return true;
}
```

- [ ] **Step 4: Napsat test pro `reorder`**

V `src/domain/services/__tests__/step.service.test.ts` přidat test:

```typescript
describe("reorder", () => {
  it("aktualizuje sortOrder pro každou položku", async () => {
    taskRepo.findById.mockResolvedValue({ id: "task-1", userId: "user-1" } as any);

    await service.reorder("user-1", "task-1", [
      { id: "step-a", sortOrder: 1 },
      { id: "step-b", sortOrder: 0 },
    ]);

    expect(stepRepo.updateSortOrder).toHaveBeenCalledTimes(2);
    expect(stepRepo.updateSortOrder).toHaveBeenCalledWith("step-a", 1);
    expect(stepRepo.updateSortOrder).toHaveBeenCalledWith("step-b", 0);
  });

  it("vyhodí chybu pokud task nepatří uživateli", async () => {
    taskRepo.findById.mockResolvedValue(undefined);

    await expect(
      service.reorder("user-1", "task-1", [{ id: "step-a", sortOrder: 0 }]),
    ).rejects.toThrow("Task not found");
  });
});
```

Mock pro `updateSortOrder` přidat do setup step repository mocku.

- [ ] **Step 5: Spustit testy**

Run: `yarn test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/repositories/step.repository.ts src/infrastructure/persistence/drizzle-step.repository.ts src/domain/services/step.service.ts src/domain/services/__tests__/step.service.test.ts
git commit -m "feat(steps): add reorder service method and repository support"
```

---

### Task 2: Backend — GraphQL `reorderSteps` mutace

**Files:**
- Modify: `src/server/graphql/types/step.ts`
- Modify: `src/graphql/mutations/steps.graphql`

- [ ] **Step 1: Přidat `ReorderStepInput` a `reorderSteps` mutaci v Pothos**

V `src/server/graphql/types/step.ts` přidat:

```typescript
const ReorderStepInput = builder.inputType("ReorderStepInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    sortOrder: t.int({ required: true }),
  }),
});

builder.mutationField("reorderSteps", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      input: t.arg({ type: [ReorderStepInput], required: true }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.step.reorder(ctx.userId!, args.taskId, args.input),
  }),
);
```

- [ ] **Step 2: Přidat klientskou mutaci**

V `src/graphql/mutations/steps.graphql` přidat:

```graphql
mutation ReorderSteps($taskId: String!, $input: [ReorderStepInput!]!) {
  reorderSteps(taskId: $taskId, input: $input)
}
```

- [ ] **Step 3: Regenerovat GraphQL typy**

Run: `yarn codegen`
Expected: Generuje bez chyb

- [ ] **Step 4: Commit**

```bash
git add src/server/graphql/types/step.ts src/graphql/mutations/steps.graphql src/__generated__/
git commit -m "feat(steps): add reorderSteps GraphQL mutation"
```

---

### Task 3: Frontend — DnD v TaskSteps komponentě

**Files:**
- Modify: `src/components/tasks/detail/task-steps.tsx`
- Modify: `src/components/tasks/task-detail-panel.tsx`

- [ ] **Step 1: Přidat `onReorderSteps` prop do `TaskSteps`**

V `src/components/tasks/detail/task-steps.tsx`:

1. Přidat `sortOrder` do `StepItem` interface:
```typescript
interface StepItem {
  id: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}
```

2. Přidat prop do `TaskStepsProps`:
```typescript
onReorderSteps: (items: { id: string; sortOrder: number }[]) => void;
```

- [ ] **Step 2: Přidat DnD context a sortable do TaskSteps**

Přepsat `TaskSteps` komponentu s `@dnd-kit/sortable`:

```typescript
import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

V `TaskSteps`:
- Track `orderedIds` state (jako `SortableTaskList`)
- Sync s props `steps` pokud se neliší
- `DndContext` s `closestCenter` collision detection
- `SortableContext` s `verticalListSortingStrategy`
- `PointerSensor` s `activationConstraint: { distance: 5 }` (menší než u tasks — steps jsou menší)
- `KeyboardSensor`
- Na `onDragEnd`: `arrayMove` → mapovat na `{ id, sortOrder: i }` → volat `onReorderSteps`

- [ ] **Step 3: Udělat StepRow sortable**

V `StepRow` přidat `useSortable` hook:

```typescript
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: step.id,
});

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
};
```

Aplikovat na root `<div>` elementu `StepRow`: `ref={setNodeRef}`, `style`, `{...attributes}`, `{...listeners}`.

Přidat `cursor-grab` class na root div a `cursor-grabbing` při isDragging.

- [ ] **Step 4: Přidat reorder mutaci do TaskDetailPanel**

V `src/components/tasks/task-detail-panel.tsx`:

1. Přidat GQL mutation:
```typescript
const REORDER_STEPS = gql`
  mutation ReorderSteps($taskId: String!, $input: [ReorderStepInput!]!) {
    reorderSteps(taskId: $taskId, input: $input)
  }
`;
```

2. Přidat mutation hook a handler:
```typescript
const [reorderSteps] = useMutation(REORDER_STEPS);

function handleReorderSteps(items: { id: string; sortOrder: number }[]) {
  if (!task) return;
  reorderSteps({
    variables: { taskId: task.id, input: items },
    optimisticResponse: { reorderSteps: true },
    update(cache) {
      for (const { id, sortOrder } of items) {
        cache.modify({
          id: cache.identify({ __typename: "Step", id }),
          fields: { sortOrder: () => sortOrder },
        });
      }
    },
  });
}
```

3. Předat prop do `TaskSteps`:
```tsx
<TaskSteps
  steps={task.steps ?? []}
  onAddStep={handleAddStep}
  onToggleStep={(id) => toggleStep({ variables: { id } })}
  onUpdateStepTitle={(id, title) => updateStepTitle({ variables: { id, title } })}
  onDeleteStep={(id) => deleteStep({ variables: { id } })}
  onReorderSteps={handleReorderSteps}
  addStepLabel={t("tasks.addStep")}
/>
```

- [ ] **Step 5: Otestovat manuálně**

1. Otevřít detail tasku se stepy
2. Chytit step a přetáhnout na jinou pozici
3. Ověřit že se pořadí změní okamžitě (optimistic)
4. Refreshnout stránku — pořadí musí zůstat

- [ ] **Step 6: Commit**

```bash
git add src/components/tasks/detail/task-steps.tsx src/components/tasks/task-detail-panel.tsx
git commit -m "feat(steps): add drag-and-drop reordering for subtasks"
```
