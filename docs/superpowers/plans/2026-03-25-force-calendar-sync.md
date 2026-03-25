# Force Calendar Sync — Per-Task Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-task `forceCalendarSync` boolean flag that overrides global sync scope, with a UI toggle in the task detail panel.

**Architecture:** New boolean column on tasks table, checked early in both sync-scope methods (`taskMatchesSyncScope` and `getSyncableTasks`). Sync scope matching computed on client side using existing `calendarSyncAll`/`calendarSyncDateRange` queries (avoids N+1 on server). UI button visible only when task has a dueDate but doesn't match the global scope. Toggle-off triggers calendar event deletion for tasks outside global scope.

**Tech Stack:** Drizzle ORM, Pothos GraphQL, Apollo Client, React (Lucide icons)

---

### Task 1: DB schema + Domain entity

**Files:**
- Modify: `src/server/db/schema/tasks.ts:31` (add column near other booleans)
- Modify: `src/domain/entities/task.ts:1-23` (Task interface) and `src/domain/entities/task.ts:46-61` (UpdateTaskInput interface)

- [ ] **Step 1: Add `forceCalendarSync` column to DB schema**

In `src/server/db/schema/tasks.ts`, add after `isCompleted` column (line 31):

```typescript
forceCalendarSync: boolean("force_calendar_sync").notNull().default(false),
```

- [ ] **Step 2: Add `forceCalendarSync` to Task interface**

In `src/domain/entities/task.ts`, add to `Task` interface (before closing brace):

```typescript
forceCalendarSync: boolean;
```

- [ ] **Step 3: Add `forceCalendarSync` to UpdateTaskInput interface**

In `src/domain/entities/task.ts`, add to `UpdateTaskInput` interface (before closing brace):

```typescript
forceCalendarSync?: boolean | null;
```

- [ ] **Step 4: Push schema to DB**

Run: `yarn db:push`
Expected: schema changes applied successfully

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema/tasks.ts src/domain/entities/task.ts
git commit -m "feat(calendar): add forceCalendarSync field to task schema and entity"
```

---

### Task 2: Zod validator + Task service + toggle-off cleanup

**Files:**
- Modify: `src/lib/graphql-validators.ts:21-36` (updateTaskSchema)
- Modify: `src/domain/services/task.service.ts:105-164` (update method)

- [ ] **Step 1: Add `forceCalendarSync` to Zod validator**

In `src/lib/graphql-validators.ts`, add to `updateTaskSchema` z.object (before closing):

```typescript
forceCalendarSync: z.boolean().nullish(),
```

- [ ] **Step 2: Add `forceCalendarSync` handling to task.service.ts update()**

In `src/domain/services/task.service.ts`, add after line 149 (after `blockedByTaskId` handling):

```typescript
if (input.forceCalendarSync !== undefined)
  updates.forceCalendarSync = input.forceCalendarSync ?? false;
```

- [ ] **Step 3: Add toggle-off cleanup logic**

In `src/domain/services/task.service.ts`, update the post-update Google Calendar sync block (lines 153-157). Replace:

```typescript
if (this.googleCalendarService && updated.dueDate) {
  this.googleCalendarService.pushTask(userId, updated).catch(() => {});
} else if (this.googleCalendarService && !updated.dueDate) {
  this.googleCalendarService.deleteTaskEvent(userId, id).catch(() => {});
}
```

With:

```typescript
if (this.googleCalendarService) {
  if (updated.dueDate) {
    this.googleCalendarService.pushTask(userId, updated).catch(() => {});
  } else {
    this.googleCalendarService.deleteTaskEvent(userId, id).catch(() => {});
  }
  // When forceCalendarSync is toggled off, pushTask will re-evaluate scope
  // and deleteTaskEvent will be called by the sync service if task is out of scope
}
```

Note: `pushTask` already calls `taskMatchesSyncScope` internally (line 65-68 of google-calendar.service.ts). When `forceCalendarSync` is `false` and the task doesn't match global scope, `pushTask` will skip the sync. The sync service's periodic full-sync handles orphan cleanup by comparing synced tasks against `getSyncableTasks()` results and deleting events for tasks no longer in scope.

- [ ] **Step 4: Commit**

```bash
git add src/lib/graphql-validators.ts src/domain/services/task.service.ts
git commit -m "feat(calendar): handle forceCalendarSync in validator and task service"
```

---

### Task 3: Domain services — sync scope logic (TDD)

**Files:**
- Modify: `src/domain/services/google-calendar.service.ts:233-239` (taskMatchesSyncScope)
- Modify: `src/domain/services/calendar.service.ts:14-27` (getSyncableTasks)
- Modify: `src/domain/services/__tests__/google-calendar.service.test.ts` (makeTask + tests)
- Modify: `src/domain/services/__tests__/calendar.service.test.ts` (makeTask + tests)

- [ ] **Step 1: Add `forceCalendarSync: false` to makeTask in google-calendar tests**

In `src/domain/services/__tests__/google-calendar.service.test.ts`, add to the makeTask factory return object:

```typescript
forceCalendarSync: false,
```

- [ ] **Step 2: Write failing test for taskMatchesSyncScope with forceCalendarSync**

In the same test file, add test (near existing sync scope tests). The test uses `pushTask` which internally calls `taskMatchesSyncScope`. Default settings have `syncAll: false` and `syncDateRange: false`, so a date-only task without `forceCalendarSync` would be filtered out:

```typescript
it("syncs date-only task when forceCalendarSync is true", async () => {
  const task = makeTask({ dueDate: "2026-03-15", forceCalendarSync: true });
  await service.pushTask("user-1", task);
  expect(mockInsertEvent).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/google-calendar.service.test.ts`
Expected: FAIL — date-only task without time is filtered out by current scope logic

- [ ] **Step 4: Update taskMatchesSyncScope**

In `src/domain/services/google-calendar.service.ts`, update method (line 233-239):

```typescript
private taskMatchesSyncScope(task: Task, syncAll: boolean, syncDateRange: boolean): boolean {
  if (task.forceCalendarSync && task.dueDate) return true;
  if (!task.dueDate) return false;
  if (syncAll) return true;
  const hasTime = task.dueDate.includes("T");
  if (hasTime) return true;
  return syncDateRange && task.dueDateEnd != null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/domain/services/__tests__/google-calendar.service.test.ts`
Expected: PASS

- [ ] **Step 6: Add `forceCalendarSync: false` to makeTask in calendar service tests**

In `src/domain/services/__tests__/calendar.service.test.ts`, add to the makeTask factory return object:

```typescript
forceCalendarSync: false,
```

- [ ] **Step 7: Write failing test for getSyncableTasks with forceCalendarSync**

```typescript
it("includes date-only task with forceCalendarSync=true even when syncAll=false", async () => {
  const tasks = [
    makeTask({ id: "1", dueDate: "2026-03-15", forceCalendarSync: true }),
    makeTask({ id: "2", dueDate: "2026-03-15", forceCalendarSync: false }),
  ];
  vi.mocked(taskRepo.findPlanned).mockResolvedValue(tasks);
  const result = await service.getSyncableTasks("user-1", false);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe("1");
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/calendar.service.test.ts`
Expected: FAIL

- [ ] **Step 9: Update getSyncableTasks**

In `src/domain/services/calendar.service.ts`, update method (lines 14-27):

```typescript
async getSyncableTasks(
  userId: string,
  syncAll: boolean,
  syncDateRange: boolean = false,
): Promise<Task[]> {
  const tasks = await this.taskRepo.findPlanned(userId);
  if (syncAll) {
    return tasks.filter((t) => t.dueDate != null);
  }
  return tasks.filter(
    (t) =>
      (t.forceCalendarSync && t.dueDate != null) ||
      (t.dueDate != null && (t.dueDate.includes("T") || (syncDateRange && t.dueDateEnd != null))),
  );
}
```

Note: When `syncAll=true`, all tasks with dueDate are already included, so `forceCalendarSync` is redundant there — no change needed for that branch.

- [ ] **Step 10: Run all tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/calendar.service.test.ts src/domain/services/__tests__/google-calendar.service.test.ts`
Expected: all PASS

- [ ] **Step 11: Commit**

```bash
git add src/domain/services/google-calendar.service.ts src/domain/services/calendar.service.ts src/domain/services/__tests__/google-calendar.service.test.ts src/domain/services/__tests__/calendar.service.test.ts
git commit -m "feat(calendar): respect forceCalendarSync in sync scope methods (TDD)"
```

---

### Task 4: GraphQL layer

**Files:**
- Modify: `src/server/graphql/types/task.ts:13-42` (TaskType fields)
- Modify: `src/server/graphql/types/task.ts:282-299` (UpdateTaskInput)

- [ ] **Step 1: Add `forceCalendarSync` to TaskType**

In `src/server/graphql/types/task.ts`, add after `deviceContext` field (line 30):

```typescript
forceCalendarSync: t.exposeBoolean("forceCalendarSync"),
```

- [ ] **Step 2: Add `forceCalendarSync` to UpdateTaskInput**

In `src/server/graphql/types/task.ts`, add to UpdateTaskInput fields (after `shareCompletionListId`, line 297):

```typescript
forceCalendarSync: t.boolean({ required: false }),
```

- [ ] **Step 3: Run codegen**

Run: `yarn codegen`
Expected: GraphQL types regenerated successfully

- [ ] **Step 4: Commit**

```bash
git add src/server/graphql/types/task.ts src/__generated__/
git commit -m "feat(calendar): add forceCalendarSync to GraphQL schema"
```

---

### Task 5: GraphQL client operations

**Files:**
- Modify: `src/graphql/queries/tasks.graphql:1-33` (TaskFields fragment)
- Modify: `src/graphql/mutations/tasks.graphql:22-34` (UpdateTask mutation)
- Modify: `src/components/tasks/task-detail-panel.tsx:54-85` (inline UPDATE_TASK)

- [ ] **Step 1: Add field to TaskFields fragment**

In `src/graphql/queries/tasks.graphql`, add before closing brace of fragment (line 33):

```graphql
forceCalendarSync
```

- [ ] **Step 2: Add field to UpdateTask mutation in .graphql file**

In `src/graphql/mutations/tasks.graphql`, add before closing brace (line 33):

```graphql
forceCalendarSync
```

- [ ] **Step 3: Add field to inline UPDATE_TASK in detail panel**

In `src/components/tasks/task-detail-panel.tsx`, add before closing brace of the mutation response (line 82):

```graphql
forceCalendarSync
```

- [ ] **Step 4: Run codegen**

Run: `yarn codegen`
Expected: GraphQL types regenerated

- [ ] **Step 5: Commit**

```bash
git add src/graphql/queries/tasks.graphql src/graphql/mutations/tasks.graphql src/components/tasks/task-detail-panel.tsx src/__generated__/
git commit -m "feat(calendar): add forceCalendarSync to GraphQL client operations"
```

---

### Task 6: i18n translations

**Files:**
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`

- [ ] **Step 1: Add Czech translations**

Add to the `tasks` section of the Czech dictionary:

```typescript
forceCalendarSync: "Přidat do kalendáře",
forceCalendarSyncActive: "Přidáno do kalendáře",
```

- [ ] **Step 2: Add English translations**

Add to the `tasks` section of the English dictionary:

```typescript
forceCalendarSync: "Add to calendar",
forceCalendarSyncActive: "Added to calendar",
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat(calendar): add forceCalendarSync i18n translations"
```

---

### Task 7: UI — toggle button in task detail panel

**Files:**
- Modify: `src/components/tasks/detail/task-dates.tsx` (add calendar sync button)
- Modify: `src/components/tasks/task-detail-panel.tsx` (wire up props)

The button visibility is computed on the client using existing `calendarSyncAll` and `calendarSyncDateRange` queries (already available from Settings/Apollo cache). This avoids a server-side computed field and N+1 queries.

Client-side scope check (mirrors `taskMatchesSyncScope` logic without `forceCalendarSync`):

```typescript
const matchesSyncScope = calendarSyncAll
  || (dueDate?.includes("T") ?? false)
  || (calendarSyncDateRange && dueDateEnd != null);
```

- [ ] **Step 1: Extend TaskDatesProps**

Add to the `TaskDatesProps` interface in `src/components/tasks/detail/task-dates.tsx`:

```typescript
forceCalendarSync?: boolean;
matchesSyncScope?: boolean;
onToggleForceCalendarSync?: () => void;
```

- [ ] **Step 2: Add Lucide imports**

Update the Lucide import at line 4:

```typescript
import { Calendar, Bell, CalendarPlus, CalendarCheck } from "lucide-react";
```

- [ ] **Step 3: Add button after reminder picker**

In the `TaskDates` component, add after the reminder `</ResponsivePicker>` (after line 126), before the closing `</>`:

```tsx
{dueDate && !matchesSyncScope && onToggleForceCalendarSync && (
  <Button
    variant="ghost"
    className={cn(
      "w-full justify-start gap-2",
      forceCalendarSync && "text-blue-500",
    )}
    onClick={onToggleForceCalendarSync}
  >
    {forceCalendarSync ? (
      <CalendarCheck className="h-4 w-4" />
    ) : (
      <CalendarPlus className="h-4 w-4" />
    )}
    {forceCalendarSync
      ? t("tasks.forceCalendarSyncActive")
      : t("tasks.forceCalendarSync")}
  </Button>
)}
```

- [ ] **Step 4: Wire up props in task-detail-panel.tsx**

In `src/components/tasks/task-detail-panel.tsx`, find where `<TaskDates>` is rendered (around line 960-975) and add the new props. The `matchesSyncScope` value should be computed using `calendarSyncAll` and `calendarSyncDateRange` from the existing Apollo cache queries (these are already fetched on the Settings page; use `useQuery` for `calendarSyncAll` and `calendarSyncDateRange` or read from cache):

```tsx
forceCalendarSync={task.forceCalendarSync}
matchesSyncScope={
  calendarSyncAll
  || (task.dueDate?.includes("T") ?? false)
  || (calendarSyncDateRange && task.dueDateEnd != null)
}
onToggleForceCalendarSync={() =>
  optimisticUpdate(
    { forceCalendarSync: !task.forceCalendarSync },
    { forceCalendarSync: !task.forceCalendarSync },
  )
}
```

Note: You'll need to add queries for `calendarSyncAll` and `calendarSyncDateRange` in the detail panel component (or read them from Apollo cache). Check how the Settings page queries these values and reuse the same GQL queries.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/detail/task-dates.tsx src/components/tasks/task-detail-panel.tsx
git commit -m "feat(calendar): add force calendar sync toggle button in task detail"
```

---

### Task 8: Verify end-to-end + run checks

- [ ] **Step 1: Run all tests**

Run: `yarn test`
Expected: all PASS

- [ ] **Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: no errors

- [ ] **Step 3: Run lint + format**

Run: `yarn lint && yarn format:check`
Expected: no errors

- [ ] **Step 4: Fix any issues found**

If any check fails, fix the issue and re-run.

- [ ] **Step 5: Final commit if needed**

```bash
git commit -m "fix(calendar): address lint/type issues in forceCalendarSync"
```
