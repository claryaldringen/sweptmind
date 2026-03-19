# Device Context + "Tady & ted" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add device context (`phone`/`computer`) to lists, tasks, and tags; replace default "Tasks" with a smart "Tady & ted" view aggregating context-matched tasks; extend Nearby page with tag/list location matching.

**Architecture:** Add `deviceContext` text column to lists, tasks, tags tables and `locationId` FK to tags. Create new `contextTasks` query that unions tasks matching device or location context through the task itself, its list, or its tags. Client detects device via existing `useMediaQuery` breakpoint.

**Tech Stack:** Drizzle ORM (schema), Pothos (GraphQL types), Vitest (tests), React (UI)

---

### Task 1: Add `deviceContext` column to DB schema (lists, tasks, tags) + `locationId` to tags

**Files:**
- Modify: `src/server/db/schema/lists.ts`
- Modify: `src/server/db/schema/tasks.ts`
- Modify: `src/server/db/schema/tags.ts`

**Step 1: Add `deviceContext` to lists schema**

In `src/server/db/schema/lists.ts`, add after the `isDefault` column:

```typescript
deviceContext: text("device_context"), // 'phone' | 'computer' | null
```

**Step 2: Add `deviceContext` to tasks schema**

In `src/server/db/schema/tasks.ts`, add after `recurrence`:

```typescript
deviceContext: text("device_context"), // 'phone' | 'computer' | null
```

**Step 3: Add `deviceContext` and `locationId` to tags schema**

In `src/server/db/schema/tags.ts`, import `locations` from `./locations` and add after `color`:

```typescript
deviceContext: text("device_context"), // 'phone' | 'computer' | null
locationId: text("location_id").references(() => locations.id, {
  onDelete: "set null",
}),
```

**Step 4: Push schema to DB**

Run: `yarn db:push`
Expected: Schema changes applied successfully

**Step 5: Commit**

```bash
git add src/server/db/schema/lists.ts src/server/db/schema/tasks.ts src/server/db/schema/tags.ts
git commit -m "feat: add deviceContext column to lists, tasks, tags and locationId to tags"
```

---

### Task 2: Update domain entities and DTOs

**Files:**
- Modify: `src/domain/entities/list.ts`
- Modify: `src/domain/entities/task.ts`
- Modify: `src/domain/entities/tag.ts`

**Step 1: Add `deviceContext` to List entity**

In `src/domain/entities/list.ts`, add to `List` interface after `locationId`:

```typescript
deviceContext: string | null;
```

Add to `UpdateListInput` after `locationId`:

```typescript
deviceContext?: string | null;
```

**Step 2: Add `deviceContext` to Task entity**

In `src/domain/entities/task.ts`, add to `Task` interface after `recurrence`:

```typescript
deviceContext: string | null;
```

Add to `CreateTaskInput` after `locationId`:

```typescript
deviceContext?: string | null;
```

Add to `UpdateTaskInput` after `locationId`:

```typescript
deviceContext?: string | null;
```

**Step 3: Add `deviceContext` and `locationId` to Tag entity**

In `src/domain/entities/tag.ts`, add to `Tag` interface after `color`:

```typescript
deviceContext: string | null;
locationId: string | null;
```

Add to `CreateTagInput` after `color`:

```typescript
deviceContext?: string | null;
locationId?: string | null;
```

Add to `UpdateTagInput` after `color`:

```typescript
deviceContext?: string | null;
locationId?: string | null;
```

**Step 4: Commit**

```bash
git add src/domain/entities/list.ts src/domain/entities/task.ts src/domain/entities/tag.ts
git commit -m "feat: add deviceContext to List, Task, Tag entities"
```

---

### Task 3: Update domain services to handle `deviceContext`

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/domain/services/tag.service.ts`
- Modify: `src/domain/services/list.service.ts`

**Step 1: Update TaskService.create and TaskService.update**

In `TaskService.create`, add to the `taskRepo.create` call:

```typescript
deviceContext: input.deviceContext ?? null,
```

In `TaskService.update`, add before the `return this.taskRepo.update` line:

```typescript
if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;
```

**Step 2: Update TagService.update and TagService.create**

In `TagService.create`, add to the `tagRepo.create` call:

```typescript
deviceContext: input.deviceContext ?? null,
locationId: input.locationId ?? null,
```

In `TagService.update`, add to the updates block:

```typescript
if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;
if (input.locationId !== undefined) updates.locationId = input.locationId ?? null;
```

**Step 3: Update ListService.update** (check `src/domain/services/list.service.ts`)

Add to the updates block in ListService.update:

```typescript
if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;
```

**Step 4: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/tag.service.ts src/domain/services/list.service.ts
git commit -m "feat: handle deviceContext in domain services"
```

---

### Task 4: Add `contextTasks` repository method and extend `findWithLocation`

**Files:**
- Modify: `src/domain/repositories/task.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-task.repository.ts`

**Step 1: Add `findContextTasks` to ITaskRepository interface**

In `src/domain/repositories/task.repository.ts`, add:

```typescript
findContextTasks(
  userId: string,
  deviceContext: string | null,
  locationIds: string[],
): Promise<Task[]>;
```

**Step 2: Implement in DrizzleTaskRepository**

In `src/infrastructure/persistence/drizzle-task.repository.ts`, add:

```typescript
async findContextTasks(
  userId: string,
  deviceContext: string | null,
  locationIds: string[],
): Promise<Task[]> {
  // 1. Find lists matching device or location context
  const contextListConditions = [];
  if (deviceContext) {
    contextListConditions.push(eq(schema.lists.deviceContext, deviceContext));
  }
  if (locationIds.length > 0) {
    contextListConditions.push(inArray(schema.lists.locationId, locationIds));
  }

  let contextListIds: string[] = [];
  if (contextListConditions.length > 0) {
    const contextLists = await this.db.query.lists.findMany({
      where: and(eq(schema.lists.userId, userId), or(...contextListConditions)),
      columns: { id: true },
    });
    contextListIds = contextLists.map((l) => l.id);
  }

  // 2. Find tags matching device or location context
  const contextTagConditions = [];
  if (deviceContext) {
    contextTagConditions.push(eq(schema.tags.deviceContext, deviceContext));
  }
  if (locationIds.length > 0) {
    contextTagConditions.push(inArray(schema.tags.locationId, locationIds));
  }

  let contextTagTaskIds: string[] = [];
  if (contextTagConditions.length > 0) {
    const contextTags = await this.db.query.tags.findMany({
      where: and(eq(schema.tags.userId, userId), or(...contextTagConditions)),
      columns: { id: true },
    });
    const contextTagIds = contextTags.map((t) => t.id);
    if (contextTagIds.length > 0) {
      const tagTaskRows = await this.db.query.taskTags.findMany({
        where: inArray(schema.taskTags.tagId, contextTagIds),
        columns: { taskId: true },
      });
      contextTagTaskIds = tagTaskRows.map((r) => r.taskId);
    }
  }

  // 3. Build task conditions: direct match OR list match OR tag match
  const taskConditions = [];
  if (deviceContext) {
    taskConditions.push(eq(schema.tasks.deviceContext, deviceContext));
  }
  if (locationIds.length > 0) {
    taskConditions.push(inArray(schema.tasks.locationId, locationIds));
  }
  if (contextListIds.length > 0) {
    taskConditions.push(inArray(schema.tasks.listId, contextListIds));
  }
  if (contextTagTaskIds.length > 0) {
    taskConditions.push(inArray(schema.tasks.id, contextTagTaskIds));
  }

  if (taskConditions.length === 0) return [];

  return this.db.query.tasks.findMany({
    where: and(
      eq(schema.tasks.userId, userId),
      eq(schema.tasks.isCompleted, false),
      or(...taskConditions),
    ),
    orderBy: asc(schema.tasks.sortOrder),
  });
}
```

**Step 3: Extend `findWithLocation` to include tag-based location matches**

Update the existing `findWithLocation` method to also find tasks whose tags have a `locationId`:

```typescript
async findWithLocation(userId: string, opts?: PaginationOpts): Promise<Task[]> {
  // Find list IDs that have a location
  const locatedLists = await this.db.query.lists.findMany({
    where: and(eq(schema.lists.userId, userId), isNotNull(schema.lists.locationId)),
    columns: { id: true },
  });
  const locatedListIds = locatedLists.map((l) => l.id);

  // Find task IDs from tags that have a location
  const locatedTags = await this.db.query.tags.findMany({
    where: and(eq(schema.tags.userId, userId), isNotNull(schema.tags.locationId)),
    columns: { id: true },
  });
  let locatedTagTaskIds: string[] = [];
  if (locatedTags.length > 0) {
    const tagTaskRows = await this.db.query.taskTags.findMany({
      where: inArray(schema.taskTags.tagId, locatedTags.map((t) => t.id)),
      columns: { taskId: true },
    });
    locatedTagTaskIds = tagTaskRows.map((r) => r.taskId);
  }

  const orConditions = [isNotNull(schema.tasks.locationId)];
  if (locatedListIds.length > 0) {
    orConditions.push(inArray(schema.tasks.listId, locatedListIds));
  }
  if (locatedTagTaskIds.length > 0) {
    orConditions.push(inArray(schema.tasks.id, locatedTagTaskIds));
  }

  return this.db.query.tasks.findMany({
    where: and(
      eq(schema.tasks.userId, userId),
      eq(schema.tasks.isCompleted, false),
      or(...orConditions),
    ),
    orderBy: asc(schema.tasks.sortOrder),
    ...(opts?.limit != null && { limit: opts.limit }),
    ...(opts?.offset != null && { offset: opts.offset }),
  });
}
```

**Step 4: Commit**

```bash
git add src/domain/repositories/task.repository.ts src/infrastructure/persistence/drizzle-task.repository.ts
git commit -m "feat: add contextTasks repository method, extend findWithLocation for tags"
```

---

### Task 5: Add `getContextTasks` to TaskService with tests

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/domain/services/__tests__/task.service.test.ts`

**Step 1: Write failing test**

Add to `src/domain/services/__tests__/task.service.test.ts`:

```typescript
describe("getContextTasks", () => {
  it("delegates to taskRepo.findContextTasks", async () => {
    const mockTasks = [{ id: "t1", title: "Test" }] as Task[];
    mockTaskRepo.findContextTasks = vi.fn().mockResolvedValue(mockTasks);

    const result = await service.getContextTasks("user1", "phone", ["loc1"]);

    expect(mockTaskRepo.findContextTasks).toHaveBeenCalledWith("user1", "phone", ["loc1"]);
    expect(result).toEqual(mockTasks);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: FAIL — `getContextTasks` does not exist

**Step 3: Implement `getContextTasks` in TaskService**

Add to `src/domain/services/task.service.ts`:

```typescript
async getContextTasks(
  userId: string,
  deviceContext: string | null,
  nearbyLocationIds: string[],
): Promise<Task[]> {
  return this.taskRepo.findContextTasks(userId, deviceContext, nearbyLocationIds);
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat: add getContextTasks to TaskService with test"
```

---

### Task 6: Update Zod validators and GraphQL schema

**Files:**
- Modify: `src/lib/graphql-validators.ts`
- Modify: `src/server/graphql/types/task.ts`
- Modify: `src/server/graphql/types/list.ts`
- Modify: `src/server/graphql/types/tag.ts`

**Step 1: Add `deviceContext` to Zod validators**

In `src/lib/graphql-validators.ts`:

```typescript
// Add this constant near the top
const deviceContextEnum = z.enum(["phone", "computer"]).nullish();
```

Add `deviceContext: deviceContextEnum` to: `createTaskSchema`, `updateTaskSchema`, `updateListSchema`, `createTagSchema`, `updateTagSchema`.

Add `locationId: z.string().uuid().nullish()` to: `createTagSchema`, `updateTagSchema`.

**Step 2: Add `deviceContext` to GraphQL Task type and inputs**

In `src/server/graphql/types/task.ts`:

Add to `TaskType` fields:
```typescript
deviceContext: t.exposeString("deviceContext", { nullable: true }),
```

Add to `CreateTaskInput` fields:
```typescript
deviceContext: t.string(),
```

Add to `UpdateTaskInput` fields:
```typescript
deviceContext: t.string(),
```

Add `contextTasks` query:
```typescript
builder.queryField("contextTasks", (t) =>
  t.field({
    type: [TaskType],
    authScopes: { authenticated: true },
    args: {
      deviceContext: t.arg.string({ required: false }),
      nearbyLocationIds: t.arg.stringList({ required: false }),
    },
    resolve: async (_root, args, ctx) =>
      ctx.services.task.getContextTasks(
        ctx.userId!,
        args.deviceContext ?? null,
        args.nearbyLocationIds ?? [],
      ),
  }),
);
```

**Step 3: Add `deviceContext` to GraphQL List type and inputs**

In `src/server/graphql/types/list.ts`:

Add to `ListType` fields:
```typescript
deviceContext: t.exposeString("deviceContext", { nullable: true }),
```

Add to `UpdateListInput` fields:
```typescript
deviceContext: t.string(),
```

**Step 4: Add `deviceContext` and `locationId` to GraphQL Tag type and inputs**

In `src/server/graphql/types/tag.ts`, import `LocationRef` from refs.

Add to `TagType` fields:
```typescript
deviceContext: t.exposeString("deviceContext", { nullable: true }),
locationId: t.exposeString("locationId", { nullable: true }),
location: t.field({
  type: LocationRef,
  nullable: true,
  resolve: async (tag, _args, ctx) => {
    if (!tag.locationId) return null;
    return ctx.loaders.locationById.load(tag.locationId);
  },
}),
```

Add to `CreateTagInput` and `UpdateTagInput` fields:
```typescript
deviceContext: t.string(),
locationId: t.string(),
```

**Step 5: Commit**

```bash
git add src/lib/graphql-validators.ts src/server/graphql/types/task.ts src/server/graphql/types/list.ts src/server/graphql/types/tag.ts
git commit -m "feat: add deviceContext to GraphQL schema and validators"
```

---

### Task 7: Add `useDeviceContext` hook

**Files:**
- Create: `src/hooks/use-device-context.ts`

**Step 1: Create the hook**

```typescript
import { useMediaQuery } from "./use-media-query";

export type DeviceContext = "phone" | "computer";

export function useDeviceContext(): DeviceContext {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return isDesktop ? "computer" : "phone";
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-device-context.ts
git commit -m "feat: add useDeviceContext hook"
```

---

### Task 8: Add i18n keys

**Files:**
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/types.ts`

**Step 1: Add context keys to both dictionaries**

Add to `en.ts`:
```typescript
context: {
  hereAndNow: "Here & Now",
  phone: "Phone",
  computer: "Computer",
  deviceContext: "Device",
  noContext: "No context",
  selectDevice: "Select device context",
},
```

Add to `cs.ts`:
```typescript
context: {
  hereAndNow: "Tady & ted",
  phone: "Telefon",
  computer: "Pocitac",
  deviceContext: "Zarizeni",
  noContext: "Bez kontextu",
  selectDevice: "Vybrat kontext zarizeni",
},
```

**Step 2: Update types**

Add `context` section to the `Dictionary` type in `src/lib/i18n/types.ts`.

**Step 3: Update sidebar label**

Change `sidebar.tasks` from `"Tasks"` to use context key, or rename it. Also update the sidebar `Home` label to `"Tady & ted"` / `"Here & Now"`.

**Step 4: Commit**

```bash
git add src/lib/i18n/
git commit -m "feat: add i18n keys for device context"
```

---

### Task 9: Replace default "Tasks" with "Tady & ted" view

**Files:**
- Create: `src/app/(app)/context/page.tsx` (or modify existing default list rendering)
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Update sidebar to show "Tady & ted" instead of default Tasks**

In `src/components/layout/sidebar.tsx`:
- Import `Zap` from lucide-react (replace `Home` usage for default list)
- Change the `DroppableDefaultList` to link to `/context` instead of `/lists/${defaultList.id}`
- Change the icon from `Home` to `Zap`
- Change the label from `"Tasks"` to `t("context.hereAndNow")`
- Add visual highlighting to lists matching current device context (use `useDeviceContext` hook)

**Step 2: Create the "Tady & ted" page**

Create `src/app/(app)/context/page.tsx`:

```typescript
"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, Zap } from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { useDeviceContext } from "@/hooks/use-device-context";
import { useNearby } from "@/components/providers/nearby-provider";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const CONTEXT_TASKS = gql`
  query ContextTasks($deviceContext: String, $nearbyLocationIds: [String!]) {
    contextTasks(deviceContext: $deviceContext, nearbyLocationIds: $nearbyLocationIds) {
      id
      listId
      locationId
      title
      notes
      isCompleted
      dueDate
      reminderAt
      recurrence
      deviceContext
      sortOrder
      createdAt
      steps { id taskId title isCompleted sortOrder }
      tags { id name color }
      list { id name }
      location { id name latitude longitude }
    }
  }
`;

export default function ContextPage() {
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const deviceContext = useDeviceContext();
  const { nearbyLocationIds } = useNearby();
  const { data, loading } = useQuery(CONTEXT_TASKS, {
    variables: { deviceContext, nearbyLocationIds: nearbyLocationIds ?? [] },
  });

  const tasks = data?.contextTasks ?? [];

  return (
    <div className="relative flex flex-1">
      <div className="flex flex-1 flex-col">
        <div className="px-6 pt-8 pb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {!isDesktop && (
              <Button variant="ghost" size="icon" onClick={openSidebar} className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Zap className="h-7 w-7 text-yellow-500" />
            {t("context.hereAndNow")}
          </h1>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
            <Zap className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-center text-sm">
              {t("context.noContext")}
            </p>
          </div>
        ) : (
          <TaskList tasks={tasks} showListName />
        )}
      </div>
      <TaskDetailPanel />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/context/page.tsx src/components/layout/sidebar.tsx
git commit -m "feat: add Tady & ted context page, update sidebar"
```

---

### Task 10: Add NearbyProvider `nearbyLocationIds` helper

**Files:**
- Modify: `src/components/providers/nearby-provider.tsx`

**Step 1: Expose `nearbyLocationIds` from NearbyProvider**

The `contextTasks` query needs a list of location IDs that are nearby. Add to the NearbyProvider:

- Query all user locations
- Filter by `isNearby(lat, lng)`
- Expose `nearbyLocationIds: string[]` in the context value

This allows the "Tady & ted" page to pass nearby location IDs to the backend query.

**Step 2: Commit**

```bash
git add src/components/providers/nearby-provider.tsx
git commit -m "feat: expose nearbyLocationIds from NearbyProvider"
```

---

### Task 11: Add device context picker UI to entity detail panels

**Files:**
- Modify: `src/components/tasks/detail/task-detail-panel.tsx` (or relevant detail component)
- Modify: `src/app/(app)/lists/[listId]/page.tsx`
- Modify: `src/app/(app)/tags/[tagId]/page.tsx`

**Step 1: Create a shared DeviceContextPicker component**

Create `src/components/ui/device-context-picker.tsx`:

A small dropdown/badge component that lets users pick `phone`, `computer`, or clear. Uses `Smartphone` and `Monitor` icons from lucide-react.

**Step 2: Add DeviceContextPicker to task detail panel**

In the task detail panel, add the picker below existing fields. Wire it to the `updateTask` mutation with `deviceContext` field.

**Step 3: Add DeviceContextPicker to list detail page**

In `src/app/(app)/lists/[listId]/page.tsx`, add the picker in the header area next to the location badge. Wire to `updateList` mutation.

**Step 4: Add DeviceContextPicker and location picker to tag detail page**

In `src/app/(app)/tags/[tagId]/page.tsx`, add both the device context picker and location picker (reuse the pattern from list page).

**Step 5: Commit**

```bash
git add src/components/ui/device-context-picker.tsx src/components/tasks/detail/ src/app/\(app\)/lists/ src/app/\(app\)/tags/
git commit -m "feat: add device context picker to task, list, and tag detail views"
```

---

### Task 12: Add sidebar context highlighting

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Highlight lists matching current device context**

In `src/components/layout/sidebar.tsx`:
- Import `useDeviceContext`
- In `SortableListItem` and `DroppableDefaultList`, check if `list.deviceContext` matches current device
- Apply a subtle highlight class (similar to existing `isNearby` highlight but with a different color, e.g. blue/purple tint)
- Also highlight if list matches location context (already done via `isNearby`)

**Step 2: Highlight tags matching current device context**

In `SidebarTagItem`, check if `tag.deviceContext` matches current device and apply similar highlight.

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: highlight context-matching lists and tags in sidebar"
```

---

### Task 13: Update GraphQL queries to include `deviceContext` field

**Files:**
- Modify: `src/graphql/queries/lists.graphql`
- Modify: `src/graphql/queries/tasks.graphql`

**Step 1: Add `deviceContext` to list queries**

In list queries, add `deviceContext` field so the sidebar can read it.

**Step 2: Add `deviceContext` to task queries**

In task queries and mutations, add `deviceContext` field.

**Step 3: Run codegen**

Run: `yarn codegen`

**Step 4: Commit**

```bash
git add src/graphql/
git commit -m "feat: add deviceContext to GraphQL client queries"
```

---

### Task 14: Run full verification

**Step 1: Run all checks**

Run: `yarn check`
Expected: All lint, format, typecheck, and tests pass

**Step 2: Fix any issues found**

**Step 3: Final commit if needed**
