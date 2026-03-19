# Task Sharing — Design Spec

## Overview

Users can connect with each other via invite links and share tasks. A shared task creates a linked copy in the recipient's list. Each user controls their own title, notes, and list placement. Time-related fields (dueDate, dueDateEnd, recurrence) synchronize one-way from the owner. Notifications inform participants of changes.

## Decisions

- **Connection method:** User generates a shareable link/code, sends it themselves (messenger, email, etc.). Recipient clicks and confirms in-app.
- **Sharing model:** Linked copy — each participant has their own task (own title, notes, list, tags, steps, attachments, reminderAt). Owner's dueDate, dueDateEnd, and recurrence sync one-way to participants.
- **Owner completion/deletion:** Participant receives a notification and decides what to do with their copy. No automatic cascade.
- **Re-sharing:** Only the owner can share. Participants cannot share the task further.
- **Disconnect:** Hard disconnect — connection is removed, all shared tasks between the two users become independent (no deletion, sync stops). No notification.
- **MVP scope includes:** Invite link system, user connections with per-connection target list, task sharing from detail panel, field sync, push notifications, shared badge on task list, settings UI for connections, invite page.
- **MVP excludes:** In-app user search, bulk sharing, list sharing, change history.

## Data Model

### New Tables

#### `connection_invites`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| fromUserId | TEXT | FK → users, CASCADE DELETE |
| token | TEXT | UNIQUE, 8 characters |
| status | TEXT | 'pending' \| 'accepted' \| 'expired' |
| acceptedByUserId | TEXT | FK → users, SET NULL, nullable |
| expiresAt | TIMESTAMP | NOT NULL |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW |

#### `user_connections`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| userId | TEXT | FK → users, CASCADE DELETE |
| connectedUserId | TEXT | FK → users, CASCADE DELETE |
| targetListId | TEXT | FK → lists, nullable |
| status | TEXT | 'active' |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW |

- UNIQUE constraint on `(userId, connectedUserId)`
- Each connection creates 2 rows (bidirectional) — each user has their own row with their own targetListId.

#### `shared_tasks`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PK, UUID |
| connectionId | TEXT | FK → user_connections, CASCADE DELETE |
| sourceTaskId | TEXT | FK → tasks (owner's task), CASCADE DELETE |
| targetTaskId | TEXT | FK → tasks (participant's task), CASCADE DELETE |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW |

- UNIQUE constraint on `(sourceTaskId, targetTaskId)`
- `connectionId` CASCADE: disconnect deletes shared_tasks automatically.
- `sourceTaskId` CASCADE: owner deleting their task cleans up the link. Target task remains independent.
- `targetTaskId` CASCADE: participant deleting their copy cleans up the link. Source task is unaffected. No notification to owner.

### Existing Table Changes

**`users`** — new column:
- `sharingDefaultListId` TEXT FK → lists, nullable — global default list for incoming shared tasks.

**Target list priority:** per-connection `targetListId` > user's `sharingDefaultListId` > user's default list ("Tasks").

### Synchronized Fields (owner → participant, one-way)

- `dueDate`
- `dueDateEnd`
- `recurrence`

### Local Fields (each user's own)

- `title`, `notes`, `listId`, `isCompleted`, `completedAt`, `sortOrder`, `reminderAt`, `deviceContext`, `blockedByTaskId`, `locationId`, `locationRadius`, tags, steps, attachments

## Domain Layer

### New Entities

```typescript
interface ConnectionInvite {
  id: string;
  fromUserId: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  acceptedByUserId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

interface UserConnection {
  id: string;
  userId: string;
  connectedUserId: string;
  targetListId: string | null;
  status: "active";
  createdAt: Date;
}

interface SharedTask {
  id: string;
  connectionId: string;
  sourceTaskId: string;
  targetTaskId: string;
  createdAt: Date;
}
```

### New Repository Interfaces

#### `IConnectionInviteRepository`

- `create(fromUserId: string): Promise<ConnectionInvite>` — generates token, sets expiresAt = now + 7 days
- `findByToken(token: string): Promise<ConnectionInvite | undefined>`
- `accept(token: string, acceptedByUserId: string): Promise<ConnectionInvite>` — sets status to 'accepted'
- `findByUser(userId: string): Promise<ConnectionInvite[]>` — pending invites created by user
- `delete(id: string, userId: string): Promise<void>` — cancel a pending invite

#### `IUserConnectionRepository`

- `create(userId: string, connectedUserId: string): Promise<UserConnection>` — creates both rows
- `findByUser(userId: string): Promise<ConnectionWithUser[]>` — includes connectedUser info and sharedTaskCount
- `findBetween(userId: string, otherUserId: string): Promise<UserConnection | undefined>`
- `findById(id: string, userId: string): Promise<UserConnection | undefined>` — for authorization checks
- `updateTargetList(id: string, userId: string, listId: string | null): Promise<void>`
- `delete(userId: string, connectedUserId: string): Promise<void>` — deletes both rows
- `countSharedTasks(connectionId: string): Promise<number>` — for sharedTaskCount field

#### `ISharedTaskRepository`

- `create(connectionId: string, sourceTaskId: string, targetTaskId: string): Promise<SharedTask>`
- `findBySourceTask(taskId: string): Promise<SharedTask[]>` — who has this task been shared with
- `findByTargetTask(taskId: string): Promise<SharedTask | undefined>` — who shared this task to me
- `findByConnection(connectionId: string): Promise<SharedTask[]>`
- `deleteByConnection(connectionId: string): Promise<void>` — on disconnect
- `delete(id: string): Promise<void>` — unshare single task

### New Services

#### `ConnectionService`

Constructor: `IConnectionInviteRepository`, `IUserConnectionRepository`, `IListRepository`, `INotificationSender`

- `createInvite(userId: string): Promise<ConnectionInvite>`
- `acceptInvite(token: string, userId: string): Promise<UserConnection>` — validates: not self-invite, not expired, not already accepted, not already connected. Creates bidirectional connection. Sends `invite_accepted` notification.
- `getConnections(userId: string): Promise<ConnectionWithUser[]>` — list of connections with user info and shared task count
- `disconnect(userId: string, connectedUserId: string): Promise<void>` — deletes both connection rows. CASCADE on `connectionId` FK automatically cleans up shared_tasks records. Target tasks remain independent.
- `updateTargetList(userId: string, connectionId: string, listId: string | null): Promise<void>`
- `getInvites(userId: string): Promise<ConnectionInvite[]>` — pending invites
- `cancelInvite(inviteId: string, userId: string): Promise<void>`

#### `TaskSharingService`

Constructor: `ISharedTaskRepository`, `IUserConnectionRepository`, `ITaskRepository`, `IListRepository`, `IUserRepository`, `INotificationSender`

- `shareTask(taskId: string, userId: string, targetUserId: string): Promise<SharedTask>` — verifies task ownership, verifies connection exists, resolves target list (per-connection > global default > default list), creates task copy with synced fields, creates shared_task record, sends push notification.
- `unshareTask(sharedTaskId: string, userId: string): Promise<void>` — verifies ownership of source task, deletes shared_task record (target task remains independent).
- `getShareInfo(taskId: string, userId: string): Promise<ShareInfo[]>` — who the task is shared with (for owner view in detail panel).
- `getShareSource(taskId: string, userId: string): Promise<ShareSourceInfo | null>` — who shared this task to me (for participant view).
- `syncSharedFields(taskId: string, updatedFields: Partial<Task>): Promise<void>` — checks if any synced fields (dueDate/dueDateEnd/recurrence) changed, finds all linked target tasks via shared_tasks, batch updates changed synced fields, sends push notifications to participants.
- `notifyOwnerAction(taskId: string, action: "completed" | "deleted"): Promise<void>` — sends push notification to all participants.

### Existing Service Changes

#### `TaskService`

- `update()` — after successful update, if dueDate, dueDateEnd, or recurrence changed, call `TaskSharingService.syncSharedFields(taskId, updatedFields)`.
- `delete()` — before deletion, call `TaskSharingService.notifyOwnerAction(taskId, "deleted")`.
- `toggleCompleted()` — when completing, call `TaskSharingService.notifyOwnerAction(taskId, "completed")`.

#### `UserService`

- `updateSharingDefaultList(userId: string, listId: string | null): Promise<void>` — new method.

## New Domain Port

### `INotificationSender`

```typescript
interface ShareNotification {
  type: "task_shared" | "shared_field_changed" | "owner_completed" | "owner_deleted" | "invite_accepted";
  title: string;
  body: string;
  taskId?: string;
}

interface INotificationSender {
  send(userId: string, notification: ShareNotification): Promise<void>;
}
```

Implementation in infrastructure uses existing push subscription infrastructure (Web Push / FCM / APNs).

## GraphQL API

### New Types

```graphql
type ConnectionInvite {
  id: ID!
  token: String!
  status: String!
  expiresAt: String!
  createdAt: String!
}

type UserConnection {
  id: ID!
  connectedUser: User!
  targetList: List
  sharedTaskCount: Int!
  createdAt: String!
}

type SharedTaskInfo {
  id: ID!
  sharedWith: User!
  targetTask: Task!
  createdAt: String!
}

type IncomingShareInfo {
  id: ID!
  owner: User!
  sourceTask: Task!
  createdAt: String!
}
```

### Queries

```graphql
connections: [UserConnection!]!
connectionInvites: [ConnectionInvite!]!
taskShares(taskId: ID!): [SharedTaskInfo!]!
taskShareSource(taskId: ID!): IncomingShareInfo
```

### Mutations

```graphql
createConnectionInvite: ConnectionInvite!
acceptConnectionInvite(token: String!): UserConnection!
cancelConnectionInvite(inviteId: ID!): Boolean!
disconnect(connectedUserId: ID!): Boolean!
updateConnectionTargetList(connectionId: ID!, listId: ID): Boolean!
updateSharingDefaultList(listId: ID): Boolean!
shareTask(taskId: ID!, targetUserId: ID!): SharedTaskInfo!
unshareTask(sharedTaskId: ID!): Boolean!
```

All mutations require `authScopes: { authenticated: true }`. Resolvers are one-line delegates to services.

## Invite Page

Route: `/invite/[token]` (Next.js App Router page)

- **Unauthenticated:** Shows invite info ("Alice invites you to connect"), Login and Register buttons. After auth, redirects back to accept.
- **Authenticated:** Shows invite info with "Accept" button. Calls `acceptConnectionInvite` mutation. Redirects to Settings on success.
- **Expired/invalid token:** Shows error message.
- **Already connected:** Shows message "Already connected with this user".
- **Self-invite:** Shows error message.

## UI Changes

### Task Detail Panel (`task-detail-panel.tsx`)

New "Sharing" section below existing sections:

**Owner view (task not shared):** "Share with..." button that opens a picker dialog listing connected users.

**Owner view (task shared):** List of users the task is shared with, each with an unshare (✕) button. Plus "Share with another..." button.

**Participant view:** Info banner showing "Shared from [Owner name]" with original task title. Indicates synced fields.

### Task List Items

Small badge icon on shared tasks:
- 🔗 for incoming shared tasks (I'm the participant)
- 👤 for outgoing shared tasks (I'm the owner and shared it)

### Settings Page

New "Sharing" section:
- Global default list selector for incoming shared tasks
- "Create invite" button → generates link, copy to clipboard
- List of pending invites with copy link and cancel buttons
- List of connected users with: avatar, name, email, shared task count, per-connection target list selector, disconnect button

## Push Notifications

| Event | Recipient | Message |
|-------|-----------|---------|
| New shared task | participant | "[Owner] shared a task with you: [title]" |
| Date/time changed | participant | "[Owner] changed the date: [title] → [new date]" |
| Recurrence changed | participant | "[Owner] changed recurrence: [title]" |
| Owner completed task | participant | "[Owner] completed: [title]" |
| Owner deleted task | participant | "[Owner] deleted shared task: [title]" |
| Invite accepted | inviter | "[User] accepted your invite" |

## Disconnect Flow

1. Delete both `user_connections` rows for the connection.
2. CASCADE on `connectionId` automatically deletes `shared_tasks` records. Target tasks remain as independent tasks.
3. No notification sent.

## Participant Deletion Flow

1. Participant deletes their copy of a shared task.
2. Cascade delete on `targetTaskId` removes the `shared_tasks` record automatically.
3. Source task (owner's) is unaffected.
4. No notification to owner.

## Owner Deletion Flow

1. Owner deletes their task.
2. `TaskSharingService.notifyOwnerAction(taskId, "deleted")` sends push to all participants.
3. Cascade delete removes `shared_tasks` records (FK constraint on sourceTaskId).
4. Target tasks remain as independent tasks in participants' lists.

## Testing Strategy

### Unit Tests (Vitest)

**ConnectionService:**
- Create invite (generates token, sets expiresAt)
- Accept invite (creates 2 rows in user_connections, changes status)
- Self-invite → error
- Accept expired invite → error
- Already connected → error
- Disconnect (deletes both rows, disconnects shared tasks)
- Update target list
- Cancel invite

**TaskSharingService:**
- Share task (creates copy in target list, creates shared_tasks record)
- Share without connection → error
- Share non-owned task → error
- Share by participant → error (only owner)
- Unshare (target task becomes independent)
- Sync shared fields (dueDate/dueDateEnd/recurrence → propagated to target tasks)
- Sync non-propagated fields (title, notes, reminderAt → no change)
- Notify on owner completion/deletion

**TaskService.update() extension:**
- Update dueDate on owned task → calls syncSharedFields
- Update title → does not call syncSharedFields

### Not Covered by Unit Tests
- GraphQL resolvers (one-line delegates)
- Drizzle repositories (integration/manual testing)
- UI components (manual testing)
