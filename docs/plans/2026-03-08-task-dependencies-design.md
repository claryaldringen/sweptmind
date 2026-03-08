# Task Dependencies Design

**Goal:** Task can depend on completion of another task. Dependent task appears in "Future" section until the blocking task is completed.

**Architecture:** Single nullable FK `blockedByTaskId` on `tasks` table. Circular dependency prevention in service layer. Fulltext search for selecting blocking task with tag-based prioritization. Offline-first via Apollo optimistic updates.

---

## DB Schema

Add to `tasks` table (`src/server/db/schema/tasks.ts`):
- `blockedByTaskId` — nullable `text`, FK to `tasks.id`, ON DELETE SET NULL

Self-referential relations:
- `blockedByTask` — many-to-one (this task is blocked by another)
- `dependentTasks` — one-to-many (tasks that depend on this task)

## Entity

Add to `Task` entity (`src/domain/entities/task.ts`):
- `blockedByTaskId: string | null`

## Repository

Extend `ITaskRepository` (`src/domain/repositories/task.repository.ts`):
- Existing methods return `blockedByTaskId`
- `findDependentTaskIds(taskId: string): Promise<string[]>` — IDs of tasks blocked by given task
- `searchTasks(userId: string, query: string, excludeCompleted: boolean, prioritizeTagIds?: string[]): Promise<Task[]>` — fulltext search

## Service

**TaskService:**
- `setDependency(taskId, blockedByTaskId)` — set/remove dependency
  - Circular check: follow `blockedByTaskId` chain from blocker, reject if it leads back to `taskId`
- `getDependentCount(taskId): Promise<number>` — for badge display

**Task Visibility (`task-visibility.ts`):**
- Extend `isFutureTask()`: task is future if `blockedByTaskId` is set AND blocking task is NOT completed
- Extended task type gets optional `blockedByTaskIsCompleted?: boolean` field, populated by GraphQL resolver

**On blocking task completion:** No special action needed — `blockedByTaskIsCompleted` changes to `true`, `isFutureTask()` stops filtering the dependent task.

**On blocking task deletion:** DB ON DELETE SET NULL clears `blockedByTaskId` automatically, dependent task unblocks.

## GraphQL API

**Task type extensions:**
- `blockedByTaskId: String`
- `blockedByTask: Task` — resolved relation
- `blockedByTaskIsCompleted: Boolean` — for client-side visibility
- `dependentTaskCount: Int` — badge count

**Mutation:**
- `UpdateTaskInput` gets `blockedByTaskId: String` (nullable)

**New query:**
- `searchTasks(query: String!, tagIds: [String!]): [Task!]!`
  - Filters `isCompleted = false` only
  - `tagIds` for prioritization (same-tag tasks first)
  - Returns task title + list name

**Dataloader:**
- `dependentTaskCountLoader` — batch loader for N+1 prevention

## Offline Strategy

- **Search:** Online uses DB fulltext. Offline fallback searches Apollo cache locally via `searchTasksOffline(cache, query, tagIds)`.
- **Set dependency:** Optimistic update writes `blockedByTaskId` + `blockedByTask` to cache immediately. Task moves to Future section before server response.
- **Complete blocking task:** Optimistic update on `isCompleted` → `blockedByTaskIsCompleted` recalculates → dependent task unblocks in UI.
- **Delete blocking task:** Optimistic `cache.modify` sets `blockedByTaskId: null` on dependent tasks.
- **Retry link:** Mutations queue offline, send on reconnect.

## UI

**Detail panel (`task-detail-panel.tsx`):**
- New "Dependency" section at the end (after Notes, before Actions)
- No dependency: "Add dependency" button → opens Command dialog (shadcn `<Command>`)
- Command dialog:
  - Text input for fulltext search
  - Results: same-tag tasks first, then others
  - Each result shows task title + list name
  - Excludes current task and completed tasks
- Has dependency: shows blocking task name (click opens its detail via `?task=<id>`) + ✕ remove button

**Task item (`task-item.tsx`):**
- Blocked task: Lock icon (Lucide `Lock`) next to title
- Blocking task: Link icon + dependent count badge (Lucide `Link`)

**Task list visibility:**
- Blocked tasks (with incomplete blocker) appear in "Future" section via existing `isFutureTask()` logic

## i18n

- cs: "Závislost", "Přidat závislost", "Závisí na", "Blokuje X tasků", "Cyklická závislost není povolena"
- en: "Dependency", "Add dependency", "Depends on", "Blocks X tasks", "Circular dependency not allowed"

## Constraints

- One dependency per task (single `blockedByTaskId`)
- Circular dependencies forbidden (service-level check)
- Deletion of blocking task auto-removes dependency (DB SET NULL)
- Visual indicators on both blocking and blocked tasks (list + detail)
