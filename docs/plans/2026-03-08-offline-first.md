# Offline-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make SweptMind fully offline-capable — all UI interactions instant, mutations queued and replayed on reconnect, cache persisted to IndexedDB.

**Architecture:** Apollo Client with IndexedDB-backed cache persistence via `idb-keyval`, client-generated UUIDs via `crypto.randomUUID()`, a mutation queue stored in IndexedDB with automatic FIFO replay on reconnect (2s debounce), and optimistic cache updates on all mutations. Conflict resolution: last-write-wins.

**Tech Stack:** `idb-keyval` (IndexedDB wrapper), Apollo Client v4, `crypto.randomUUID()`, `react-resizable-panels`

---

### Task 1: Switch Apollo Cache persistence from localStorage to IndexedDB

**Files:**
- Modify: `src/lib/apollo/client.ts`
- Modify: `package.json`

**Step 1: Install idb-keyval**

```bash
yarn add idb-keyval
```

**Step 2: Replace apollo3-cache-persist storage backend**

In `src/lib/apollo/client.ts`, replace the entire `apollo3-cache-persist` block (lines 48-61) with an IndexedDB-backed persistence using `idb-keyval`.

`apollo3-cache-persist` accepts any object implementing `getItem(key)`, `setItem(key, value)`, `removeItem(key)`. Create a thin adapter around `idb-keyval`:

```typescript
import { get, set, del } from "idb-keyval";

class IdbStorageAdapter {
  async getItem(key: string) {
    return (await get(key)) ?? null;
  }
  async setItem(key: string, value: string) {
    await set(key, value);
  }
  async removeItem(key: string) {
    await del(key);
  }
}
```

Replace the localStorage persistence call:

```typescript
// OLD:
import("apollo3-cache-persist")
  .then(({ persistCache, LocalStorageWrapper }) =>
    persistCache({
      cache,
      storage: new LocalStorageWrapper(window.localStorage),
      maxSize: 1048576 * 5,
    }),
  )

// NEW:
import("apollo3-cache-persist")
  .then(({ persistCache }) =>
    persistCache({
      cache,
      storage: new IdbStorageAdapter(),
      maxSize: false, // no size limit for IndexedDB
    }),
  )
```

**Step 3: Remove old localStorage migration**

No migration needed — old localStorage data will be ignored. Apollo will simply rebuild cache from server on first load.

**Step 4: Verify it works**

```bash
yarn build
yarn dev
```

Open the app, check DevTools → Application → IndexedDB → should see `keyval-store` with Apollo cache data. Verify tasks load and persist across page reloads.

**Step 5: Commit**

```bash
git add src/lib/apollo/client.ts package.json yarn.lock
git commit -m "feat: switch Apollo cache persistence from localStorage to IndexedDB"
```

---

### Task 2: Add client-generated UUID support to server

**Files:**
- Modify: `src/server/graphql/types/task.ts` — add optional `id` to `CreateTaskInput`
- Modify: `src/server/graphql/types/step.ts` — add optional `id` to `CreateStepInput`
- Modify: `src/server/graphql/types/list.ts` — add optional `id` to `CreateListInput`
- Modify: `src/server/graphql/types/location.ts` — add optional `id` to `CreateLocationInput`
- Modify: `src/server/graphql/types/tag.ts` — add optional `id` to `CreateTagInput`
- Modify: `src/domain/services/task.service.ts` — pass through `id`
- Modify: `src/domain/services/step.service.ts` — pass through `id`
- Modify: `src/domain/services/list.service.ts` — pass through `id`
- Modify: `src/domain/services/location.service.ts` — pass through `id`
- Modify: `src/domain/services/tag.service.ts` — pass through `id`

**Step 1: Add optional `id` field to each Pothos CreateInput**

For each GraphQL type file, add `id` as an optional string field in the create input. Example for task (`src/server/graphql/types/task.ts`):

Find the `CreateTaskInput` definition and add:

```typescript
id: t.string({ required: false }),
```

Do the same for `CreateStepInput`, `CreateListInput`, `CreateLocationInput`, `CreateTagInput`.

**Step 2: Pass `id` through services to repositories**

In each service's `create` method, include the optional `id` if provided. Example for `src/domain/services/task.service.ts`:

```typescript
// In the create method, add id to the object passed to taskRepo.create:
return this.taskRepo.create({
  ...(input.id ? { id: input.id } : {}),
  userId,
  listId: input.listId,
  // ... rest unchanged
});
```

Do the same for `step.service.ts`, `list.service.ts`, `location.service.ts`, `tag.service.ts`.

The repository and DB schema already support this — Drizzle's `$defaultFn` only generates an ID when none is provided.

**Step 3: Verify**

```bash
yarn build
yarn test
```

**Step 4: Commit**

```bash
git add src/server/graphql/types/ src/domain/services/
git commit -m "feat: accept optional client-generated UUID in all create inputs"
```

---

### Task 3: Use client-generated UUIDs in task creation

**Files:**
- Modify: `src/components/tasks/task-input.tsx`
- Modify: `src/graphql/mutations/tasks.graphql` (if the mutation input schema changed)

**Step 1: Replace temp ID with real UUID**

In `src/components/tasks/task-input.tsx`, change the task creation flow:

```typescript
// OLD:
const tempId = `temp-${Date.now()}`;

// NEW:
const id = crypto.randomUUID();
```

Then use this `id` everywhere `tempId` was used:
- In the `writeFragment` call: `id: id` instead of `id: tempId`
- In the `cache.modify` filter: compare against `id` instead of `tempId`
- In the mutation variables: `{ input: { id, listId, title: trimmed } }`

**Step 2: Simplify the update callback**

Since the client and server now use the same ID, the `update` callback no longer needs to swap temp→real. It just needs to ensure the returned data is written to cache (which Apollo does automatically for matching IDs). The entire `update` callback can be removed.

The `onError` callback should still remove the optimistic entry from cache.

Updated `handleSubmit`:

```typescript
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const trimmed = title.trim();
  if (!trimmed) return;
  setTitle("");

  const id = crypto.randomUUID();

  client.cache.writeFragment({
    data: {
      __typename: "Task",
      id,
      listId,
      locationId: null,
      title: trimmed,
      notes: null,
      isCompleted: false,
      dueDate: null,
      reminderAt: null,
      recurrence: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      steps: [],
      tags: [],
      location: null,
    },
    fragment: TASK_FRAGMENT,
  });

  client.cache.modify({
    fields: {
      tasksByList(existing = [], { storeFieldName }) {
        if (!storeFieldName.includes(listId)) return existing;
        const newRef = { __ref: `Task:${id}` };
        return position === "top" ? [newRef, ...existing] : [...existing, newRef];
      },
    },
  });

  createTask({
    variables: { input: { id, listId, title: trimmed } },
    onError() {
      client.cache.evict({ id: client.cache.identify({ __typename: "Task", id }) });
      client.cache.modify({
        fields: {
          tasksByList(existing = [], { readField }) {
            return existing.filter(
              (ref: Reference | StoreObject | undefined) => readField("id", ref) !== id,
            );
          },
        },
      });
      client.cache.gc();
    },
  });
}
```

**Step 3: Verify**

```bash
yarn build
yarn dev
```

Create a task, verify it appears immediately and the ID doesn't change after server response.

**Step 4: Commit**

```bash
git add src/components/tasks/task-input.tsx
git commit -m "feat: use client-generated UUID for task creation"
```

---

### Task 4: Use client-generated UUID for step creation

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Step 1: Replace temp step ID with real UUID**

In the `createStep` mutation setup, change the optimistic response:

```typescript
const [createStep] = useMutation<CreateStepData>(CREATE_STEP, {
  optimisticResponse: ({ input }) => ({
    createStep: {
      __typename: "Step" as const,
      id: input.id, // use client-generated UUID
      taskId: input.taskId,
      title: input.title,
      isCompleted: false,
      sortOrder: data?.task?.steps?.length ?? 0,
    },
  }),
  // update callback stays the same — it adds the step ref to the task's steps array
  update(cache, { data }) { /* ... unchanged ... */ },
});
```

And in `handleAddStep`:

```typescript
async function handleAddStep(title: string) {
  if (!task) return;
  await createStep({
    variables: { input: { id: crypto.randomUUID(), taskId: task.id, title } },
  });
}
```

**Step 2: Verify**

```bash
yarn build
yarn dev
```

Add a step, verify it appears immediately with a real UUID.

**Step 3: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: use client-generated UUID for step creation"
```

---

### Task 5: Create mutation queue with IndexedDB persistence

**Files:**
- Create: `src/lib/apollo/mutation-queue.ts`
- Create: `src/lib/apollo/mutation-queue.test.ts`

**Step 1: Write the test**

Create `src/lib/apollo/mutation-queue.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MutationQueue, type QueuedMutation } from "./mutation-queue";

// Mock idb-keyval
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: (key: string) => Promise.resolve(store.get(key)),
  set: (key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); },
  del: (key: string) => { store.delete(key); return Promise.resolve(); },
}));

describe("MutationQueue", () => {
  let queue: MutationQueue;

  beforeEach(() => {
    store.clear();
    queue = new MutationQueue();
  });

  it("enqueues and dequeues mutations in FIFO order", async () => {
    await queue.enqueue({ operationName: "CreateTask", variables: { id: "1" }, documentStr: "mutation { ... }" });
    await queue.enqueue({ operationName: "UpdateTask", variables: { id: "2" }, documentStr: "mutation { ... }" });

    const all = await queue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].operationName).toBe("CreateTask");
    expect(all[1].operationName).toBe("UpdateTask");
  });

  it("removes a mutation after successful replay", async () => {
    await queue.enqueue({ operationName: "CreateTask", variables: { id: "1" }, documentStr: "mutation { ... }" });
    const all = await queue.getAll();
    await queue.remove(all[0].id);
    expect(await queue.getAll()).toHaveLength(0);
  });

  it("persists across instances", async () => {
    await queue.enqueue({ operationName: "CreateTask", variables: { id: "1" }, documentStr: "mutation { ... }" });
    const queue2 = new MutationQueue();
    const all = await queue2.getAll();
    expect(all).toHaveLength(1);
  });

  it("returns pending count", async () => {
    expect(await queue.count()).toBe(0);
    await queue.enqueue({ operationName: "A", variables: {}, documentStr: "" });
    expect(await queue.count()).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
yarn test src/lib/apollo/mutation-queue.test.ts
```

Expected: FAIL — module not found

**Step 3: Implement MutationQueue**

Create `src/lib/apollo/mutation-queue.ts`:

```typescript
import { get, set } from "idb-keyval";

const QUEUE_KEY = "sweptmind-mutation-queue";

export interface QueuedMutation {
  id: string;
  operationName: string;
  variables: Record<string, unknown>;
  documentStr: string;
  timestamp: number;
}

interface EnqueueInput {
  operationName: string;
  variables: Record<string, unknown>;
  documentStr: string;
}

export class MutationQueue {
  private async load(): Promise<QueuedMutation[]> {
    return (await get(QUEUE_KEY)) ?? [];
  }

  private async save(queue: QueuedMutation[]): Promise<void> {
    await set(QUEUE_KEY, queue);
  }

  async enqueue(input: EnqueueInput): Promise<QueuedMutation> {
    const queue = await this.load();
    const entry: QueuedMutation = {
      id: crypto.randomUUID(),
      ...input,
      timestamp: Date.now(),
    };
    queue.push(entry);
    await this.save(queue);
    return entry;
  }

  async remove(id: string): Promise<void> {
    const queue = await this.load();
    await this.save(queue.filter((m) => m.id !== id));
  }

  async getAll(): Promise<QueuedMutation[]> {
    return this.load();
  }

  async count(): Promise<number> {
    return (await this.load()).length;
  }

  async clear(): Promise<void> {
    await this.save([]);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
yarn test src/lib/apollo/mutation-queue.test.ts
```

Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add src/lib/apollo/mutation-queue.ts src/lib/apollo/mutation-queue.test.ts
git commit -m "feat: add IndexedDB-backed mutation queue"
```

---

### Task 6: Create SyncManager

**Files:**
- Create: `src/lib/apollo/sync-manager.ts`

**Step 1: Implement SyncManager**

Create `src/lib/apollo/sync-manager.ts`:

```typescript
import type { ApolloClient, NormalizedCacheObject, DocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { MutationQueue } from "./mutation-queue";

export type SyncState = "idle" | "syncing" | "error";

type Listener = (state: SyncState, pendingCount: number) => void;

export class SyncManager {
  private queue = new MutationQueue();
  private client: ApolloClient<NormalizedCacheObject> | null = null;
  private state: SyncState = "idle";
  private listeners = new Set<Listener>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  attach(client: ApolloClient<NormalizedCacheObject>) {
    this.client = client;

    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.scheduleReplay();
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  get online() {
    return this.isOnline;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.queue.count().then((count) => {
      this.listeners.forEach((fn) => fn(this.state, count));
    });
  }

  private setState(s: SyncState) {
    this.state = s;
    this.notify();
  }

  async enqueue(
    operationName: string,
    documentStr: string,
    variables: Record<string, unknown>,
  ): Promise<void> {
    await this.queue.enqueue({ operationName, variables, documentStr });
    this.notify();

    if (this.isOnline) {
      this.scheduleReplay();
    }
  }

  private scheduleReplay() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.replay(), 2000);
  }

  private async replay() {
    if (!this.client || this.state === "syncing") return;

    const pending = await this.queue.getAll();
    if (pending.length === 0) return;

    this.setState("syncing");

    for (const mutation of pending) {
      try {
        await this.client.mutate({
          mutation: gql(mutation.documentStr),
          variables: mutation.variables,
        });
        await this.queue.remove(mutation.id);
        this.notify();
      } catch (err) {
        console.error(`[SyncManager] Failed to replay ${mutation.operationName}:`, err);
        this.setState("error");
        // Stop replaying on first failure — will retry on next reconnect
        return;
      }
    }

    // After successful replay, refetch key queries to pull remote changes
    try {
      await this.client.refetchQueries({ include: "active" });
    } catch {
      // Non-critical — stale data will be updated on next interaction
    }

    this.setState("idle");
  }

  async getPendingCount(): Promise<number> {
    return this.queue.count();
  }
}

// Singleton
export const syncManager = new SyncManager();
```

**Step 2: Verify**

```bash
yarn build
```

**Step 3: Commit**

```bash
git add src/lib/apollo/sync-manager.ts
git commit -m "feat: add SyncManager with debounced reconnect replay"
```

---

### Task 7: Integrate SyncManager with Apollo Client

**Files:**
- Modify: `src/lib/apollo/client.ts` — attach SyncManager, add offline-aware Apollo Link
- Modify: `src/lib/apollo/provider.tsx` — provide sync context

**Step 1: Create offline-aware Apollo Link**

In `src/lib/apollo/client.ts`, add a custom Apollo Link that intercepts mutations. When online, mutations go through normally. When offline, mutations are enqueued to the queue and the link returns the optimistic data (no network call).

```typescript
import { ApolloLink } from "@apollo/client";
import { print } from "graphql";
import { syncManager } from "./sync-manager";

const offlineLink = new ApolloLink((operation, forward) => {
  // Only intercept mutations
  const definition = operation.query.definitions[0];
  const isMutation =
    definition.kind === "OperationDefinition" && definition.operation === "mutation";

  if (!isMutation) return forward(operation);

  // Always enqueue mutation for offline safety
  const documentStr = print(operation.query);
  const operationName = operation.operationName || "UnknownMutation";

  syncManager.enqueue(operationName, documentStr, operation.variables);

  if (syncManager.online) {
    // Online: also send via network (normal flow)
    return forward(operation);
  }

  // Offline: return empty successful response
  // (optimistic cache updates already happened via Apollo's optimisticResponse)
  return new Observable((observer) => {
    observer.next({ data: null });
    observer.complete();
  });
});
```

Then add `offlineLink` to the link chain before `retryLink`:

```typescript
link: errorLink.concat(offlineLink).concat(retryLink).concat(httpLink),
```

Also attach the client to syncManager after creation:

```typescript
syncManager.attach(client as unknown as ApolloClient<NormalizedCacheObject>);
```

**Step 2: Create SyncContext provider**

Create or modify `src/lib/apollo/provider.tsx` to expose sync state:

```typescript
"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { ApolloNextAppProvider } from "@apollo/client-integration-nextjs";
import { makeClient } from "./client";
import { syncManager, type SyncState } from "./sync-manager";

interface SyncContextType {
  syncState: SyncState;
  pendingCount: number;
}

const SyncContext = createContext<SyncContextType>({
  syncState: "idle",
  pendingCount: 0,
});

export const useSyncState = () => useContext(SyncContext);

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    return syncManager.subscribe((state, count) => {
      setSyncState(state);
      setPendingCount(count);
    });
  }, []);

  return (
    <SyncContext.Provider value={{ syncState, pendingCount }}>
      <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
    </SyncContext.Provider>
  );
}
```

**Step 3: Verify**

```bash
yarn build
```

**Step 4: Commit**

```bash
git add src/lib/apollo/client.ts src/lib/apollo/provider.tsx
git commit -m "feat: integrate SyncManager with Apollo Client link chain"
```

---

### Task 8: Replace refetchQueries with optimistic cache updates

This is the largest task. Every mutation using `refetchQueries` needs to switch to direct cache manipulation.

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx` — createTag, createLocation, deleteLocation
- Modify: `src/components/lists/create-list-dialog.tsx` — createList
- Modify: `src/components/layout/sidebar.tsx` — updateTag, reorderLists, updateList, deleteList
- Modify: `src/app/(app)/lists/[listId]/page.tsx` — updateList, deleteList, createLocation, deleteLocation
- Modify: `src/app/(app)/tags/[tagId]/page.tsx` — updateTag, createLocation, deleteLocation

**Pattern for each replacement:**

Instead of `refetchQueries: [{ query: GET_SOMETHING }]`, add an `update` callback that writes the result directly to cache. For creates, append to the relevant query's cached array. For deletes, filter it out. For updates, Apollo handles it automatically (same ID = same cache entry).

**Step 1: Fix createTag in task-detail-panel.tsx**

```typescript
// OLD:
const [createTag] = useMutation<{ createTag: TaskTag }>(CREATE_TAG, {
  refetchQueries: [{ query: GET_TAGS }],
});

// NEW:
const [createTag] = useMutation<{ createTag: TaskTag }>(CREATE_TAG, {
  update(cache, { data }) {
    if (!data?.createTag) return;
    cache.modify({
      fields: {
        tags(existing = []) {
          const newRef = cache.writeFragment({
            data: data.createTag,
            fragment: gql`fragment NewTag on Tag { id name color }`,
          });
          return [...existing, newRef];
        },
      },
    });
  },
});
```

**Step 2: Fix createLocation and deleteLocation in task-detail-panel.tsx**

```typescript
// createLocation:
const [createLocation] = useMutation<{ createLocation: TaskLocation }>(CREATE_LOCATION, {
  update(cache, { data }) {
    if (!data?.createLocation) return;
    cache.modify({
      fields: {
        locations(existing = []) {
          const newRef = cache.writeFragment({
            data: data.createLocation,
            fragment: gql`fragment NewLocation on Location { id name latitude longitude address }`,
          });
          return [...existing, newRef];
        },
      },
    });
  },
});

// deleteLocation:
const [deleteLocation] = useMutation<{ deleteLocation: boolean }>(DELETE_LOCATION, {
  update(cache, _result, { variables }) {
    if (!variables?.id) return;
    cache.evict({ id: cache.identify({ __typename: "Location", id: variables.id }) });
    cache.gc();
  },
});
```

**Step 3: Fix createList in create-list-dialog.tsx**

```typescript
const [createList, { loading }] = useMutation<CreateListData>(CREATE_LIST, {
  update(cache, { data }) {
    if (!data?.createList) return;
    cache.modify({
      fields: {
        lists(existing = []) {
          const newRef = cache.writeFragment({
            data: data.createList,
            fragment: gql`
              fragment NewList on List {
                id name icon themeColor isDefault sortOrder groupId taskCount
              }
            `,
          });
          return [...existing, newRef];
        },
      },
    });
  },
});
```

**Step 4: Fix sidebar mutations**

In `src/components/layout/sidebar.tsx`:

- `updateTag` — remove `refetchQueries`. Apollo auto-updates cache for same ID.
- `updateList` — remove `refetchQueries`. Apollo auto-updates cache for same ID.
- `reorderLists` — remove `refetchQueries`. Local state already handles UI. The mutation returns `boolean`, and list order is managed by local dnd state.
- `deleteList` — already uses `cache.evict()`, just verify no `refetchQueries`.

```typescript
// updateTag:
const [updateTag] = useMutation(UPDATE_TAG);
// updateList:
const [updateList] = useMutation(UPDATE_LIST);
// reorderLists:
const [reorderLists] = useMutation(REORDER_LISTS);
```

**Step 5: Fix lists/[listId]/page.tsx mutations**

- `updateList` — remove `refetchQueries`
- `deleteList` — replace `refetchQueries` with `cache.evict()` + `cache.gc()`
- `createLocation` — same pattern as task-detail-panel
- `deleteLocation` — same pattern as task-detail-panel

**Step 6: Fix tags/[tagId]/page.tsx mutations**

- `updateTag` — remove `refetchQueries`
- `createLocation` — same pattern
- `deleteLocation` — same pattern

**Step 7: Verify**

```bash
yarn build
yarn dev
```

Test: create a tag, create a location, delete a location, create a list — all should update UI immediately without network refetch.

**Step 8: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx src/components/lists/create-list-dialog.tsx src/components/layout/sidebar.tsx src/app/\(app\)/lists/\[listId\]/page.tsx src/app/\(app\)/tags/\[tagId\]/page.tsx
git commit -m "feat: replace all refetchQueries with optimistic cache updates"
```

---

### Task 9: Upgrade OfflineIndicator

**Files:**
- Modify: `src/components/layout/offline-indicator.tsx`

**Step 1: Show sync state and pending count**

```typescript
"use client";

import { useSyncExternalStore } from "react";
import { WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useSyncState } from "@/lib/apollo/provider";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { t } = useTranslations();
  const { syncState, pendingCount } = useSyncState();

  if (isOnline && syncState === "idle") return null;

  if (isOnline && syncState === "syncing") {
    return (
      <div className="bg-blue-500 px-4 py-1.5 text-center text-sm font-medium text-white">
        <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
        {t("common.syncing", { count: pendingCount })}
      </div>
    );
  }

  if (isOnline && syncState === "error") {
    return (
      <div className="bg-red-500 px-4 py-1.5 text-center text-sm font-medium text-white">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        {t("common.syncError")}
      </div>
    );
  }

  return (
    <div className="bg-yellow-500 px-4 py-1.5 text-center text-sm font-medium text-white">
      <WifiOff className="mr-2 inline h-4 w-4" />
      {t("common.offline")}
      {pendingCount > 0 && ` · ${t("common.pendingChanges", { count: pendingCount })}`}
    </div>
  );
}
```

**Step 2: Add i18n strings**

In `src/lib/i18n/dictionaries/cs.ts` and `en.ts`, add:

```typescript
// cs:
syncing: "Synchronizuji... ({count})",
syncError: "Synchronizace selhala",
pendingChanges: "{count} neuložených změn",

// en:
syncing: "Syncing... ({count})",
syncError: "Sync failed",
pendingChanges: "{count} pending changes",
```

**Step 3: Verify**

```bash
yarn build
```

**Step 4: Commit**

```bash
git add src/components/layout/offline-indicator.tsx src/lib/i18n/
git commit -m "feat: upgrade OfflineIndicator with sync state and pending count"
```

---

### Task 10: Add optimistic responses to remaining mutations

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx` — updateTask
- Modify: `src/components/tasks/task-item.tsx` — updateTask, deleteTask

Currently `updateTask` has no optimistic response. The mutation returns updated fields, but the UI waits for the server. Add optimistic responses so updates are instant.

**Step 1: Add optimistic response to updateTask in task-detail-panel.tsx**

This is tricky because `updateTask` is called with different inputs (title, notes, dueDate, etc.). Use a function-based `optimisticResponse`:

When calling `updateTask`, the caller already has the current task data and the new value. Apollo will merge the optimistic response with the cache entry by ID. So we just need to return the fields that are being updated.

No changes to the mutation hook itself needed — instead, add `optimisticResponse` at the call site for each `updateTask({ variables: ... })` call. But this would be too invasive.

Simpler approach: since `updateTask` returns fields that match the cache key (same `id`), Apollo automatically updates the cache when the response arrives. The lag is just the network round-trip. For offline-first, the critical path is that the mutation is **queued** (handled by SyncManager in Task 7), and the cache is updated **optimistically**.

Add a wrapper that writes to cache immediately before calling the mutation:

```typescript
function handleUpdateTask(input: Record<string, unknown>) {
  if (!task) return;
  // Optimistic: write directly to cache
  client.cache.modify({
    id: client.cache.identify({ __typename: "Task", id: task.id }),
    fields: Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, () => value]),
    ),
  });
  // Fire mutation (will be queued if offline)
  updateTask({ variables: { id: task.id, input } });
}
```

Then replace all `updateTask({ variables: { id: task.id, input: { ... } } })` calls with `handleUpdateTask({ ... })`.

**Step 2: Do the same in task-item.tsx for updateTask**

The pattern is the same — write to cache immediately, then fire mutation.

**Step 3: Verify**

```bash
yarn build
yarn dev
```

Test: edit a task title in the detail panel, change due date — should update instantly without waiting for server.

**Step 4: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx src/components/tasks/task-item.tsx
git commit -m "feat: add optimistic cache writes for all updateTask calls"
```

---

### Task 11: End-to-end offline verification

**Step 1: Build and start dev server**

```bash
yarn build
yarn dev
```

**Step 2: Test offline flow**

1. Open app, let it load fully
2. In DevTools → Network → set "Offline"
3. Create a task → should appear immediately
4. Toggle a task completed → should toggle immediately
5. Edit task title → should update immediately
6. Check DevTools → Application → IndexedDB → `keyval-store` → verify mutation queue has entries
7. Go back online (uncheck "Offline")
8. Wait 2-3 seconds → OfflineIndicator should show "Syncing..."
9. After sync → indicator disappears
10. Refresh page → all changes should be persisted

**Step 3: Run full test suite**

```bash
yarn check
```

Expected: All checks pass (lint, format, typecheck, test).

**Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: offline-first edge cases"
```
