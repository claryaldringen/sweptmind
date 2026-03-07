# Device Context + "Tady & ted" Design

## Summary

Add device context (`phone` | `computer`) to lists, tasks, and tags. Replace the default "Tasks" list with a smart "Tady & ted" view that aggregates tasks matching the current device and/or nearby location. Extend the Nearby page with the same tag/list-based location matching.

## Database Changes

Add `device_context` column (text, nullable, values: `'phone'` | `'computer'` | `null`) to:

- **`lists`** table
- **`tasks`** table
- **`tags`** table

Add `location_id` (FK to `locations`, nullable) to:

- **`tags`** table (lists and tasks already have it)

No new tables.

## Device Detection

Client-side only. Reuse existing `useMediaQuery("(min-width: 768px)")`:

- Below 768px = `phone`
- 768px and above = `computer`

Exposed via a `useDeviceContext()` hook returning `'phone' | 'computer'`.

## "Tady & ted" Smart View

Replaces the default `isDefault` "Tasks" list. A task appears in this view if **any** of these match:

1. Task's own `deviceContext` matches current device
2. Task's own `locationId` is nearby
3. Task's list has matching `deviceContext`
4. Task's list has matching `locationId`
5. Any of task's tags has matching `deviceContext`
6. Any of task's tags has matching `locationId`

Location has higher priority than device context in sort order.

Tasks without any context (no device, no location on task/list/tags) do NOT appear in this view.

## Nearby Page Extension

Currently shows only tasks with their own `locationId` nearby. Extended to also include tasks where:

- Task's list has `locationId` nearby
- Any of task's tags has `locationId` nearby

Same union logic as "Tady & ted" but limited to location context.

## GraphQL Changes

### Type extensions

- `List` type: add `deviceContext: String`
- `Task` type: add `deviceContext: String`
- `Tag` type: add `deviceContext: String`, `locationId: String`, `location: Location`

### New query

```graphql
contextTasks(
  deviceContext: String
  latitude: Float
  longitude: Float
  radius: Float
): [Task!]!
```

### Mutation extensions

- `UpdateListInput`: add `deviceContext: String`
- `UpdateTaskInput`: add `deviceContext: String`
- `UpdateTagInput`: add `deviceContext: String`, `locationId: String`

## UI Changes

### Sidebar

- Default list icon: `Zap` instead of `Home`, label "Tady & ted"
- Lists matching current context (device or location) get visual highlight (subtle background tint)

### "Tady & ted" page

- Shows aggregated tasks from all context-matching sources
- Tasks grouped by source list
- Each task shows list name (like Planned/Nearby views)

### Context picker on entities

- List detail: device context dropdown/badge (next to existing location picker)
- Task detail: device context dropdown/badge
- Tag detail: device context dropdown/badge + location picker (new)

### Nearby page

- Extended query to include tag/list-based location matches

## i18n

New keys: `context.hereAndNow`, `context.phone`, `context.computer`, `context.deviceContext`, `context.noContext`

## Domain Layer

- `TaskService`: new method `getContextTasks(userId, deviceContext, latitude?, longitude?, radius?)`
- `TagService`: support `locationId` in create/update
- Entity interfaces updated with `deviceContext` field
