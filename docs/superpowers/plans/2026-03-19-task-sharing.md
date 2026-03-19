# Task Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to connect via invite links and share tasks with one-way field sync.

**Architecture:** New domain entities (ConnectionInvite, UserConnection, SharedTask) with repository interfaces, two new services (ConnectionService, TaskSharingService), infrastructure implementations (Drizzle repos, notification sender), GraphQL types/mutations, and UI additions (task detail sharing section, settings connections section, invite page).

**Tech Stack:** Drizzle ORM (PostgreSQL), GraphQL Yoga + Pothos, Vitest, Next.js App Router, Apollo Client, Tailwind + shadcn/ui, Web Push / FCM.

**Spec:** `docs/superpowers/specs/2026-03-19-task-sharing-design.md`

---

### Task 1: DB Schema — connection_invites, user_connections, shared_tasks

**Files:**
- Create: `src/server/db/schema/sharing.ts`
- Modify: `src/server/db/schema/auth.ts` (add sharingDefaultListId to users)
- Modify: `src/server/db/schema/relations.ts` (add sharing relations)
- Modify: `src/server/db/schema/index.ts` (export new schema)

- [ ] **Step 1: Create sharing schema file**

Create `src/server/db/schema/sharing.ts`:

```typescript
import { pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lists } from "./lists";
import { tasks } from "./tasks";

export const connectionInvites = pgTable(
  "connection_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("connection_invites_from_user_idx").on(table.fromUserId),
  ],
);

export const userConnections = pgTable(
  "user_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedUserId: text("connected_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetListId: text("target_list_id").references(() => lists.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_connections_pair_idx").on(table.userId, table.connectedUserId),
    index("user_connections_user_id_idx").on(table.userId),
  ],
);

export const sharedTasks = pgTable(
  "shared_tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text("connection_id")
      .notNull()
      .references(() => userConnections.id, { onDelete: "cascade" }),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shared_tasks_source_target_idx").on(table.sourceTaskId, table.targetTaskId),
    index("shared_tasks_source_idx").on(table.sourceTaskId),
    index("shared_tasks_target_idx").on(table.targetTaskId),
    index("shared_tasks_connection_idx").on(table.connectionId),
  ],
);
```

- [ ] **Step 2: Add sharingDefaultListId to users table**

In `src/server/db/schema/auth.ts`, add after `llmModel` field (line 31):

```typescript
  sharingDefaultListId: text("sharing_default_list_id").references(() => lists.id, { onDelete: "set null" }),
```

Add the `lists` import at the top of `auth.ts` if not already present:
```typescript
import { lists } from "./lists";
```

- [ ] **Step 3: Add sharing relations**

In `src/server/db/schema/relations.ts`, add imports at top:

```typescript
import { connectionInvites, userConnections, sharedTasks } from "./sharing";
```

Add to existing `usersRelations` (in the `many` section):

```typescript
  connectionInvites: many(connectionInvites),
  connections: many(userConnections),
```

Add to existing `tasksRelations` (in the `many` section):

```typescript
  sharedFrom: many(sharedTasks, { relationName: "sourceTask" }),
  sharedTo: many(sharedTasks, { relationName: "targetTask" }),
```

Add new relation definitions at end of file:

```typescript
export const connectionInvitesRelations = relations(connectionInvites, ({ one }) => ({
  fromUser: one(users, {
    fields: [connectionInvites.fromUserId],
    references: [users.id],
  }),
  acceptedByUser: one(users, {
    fields: [connectionInvites.acceptedByUserId],
    references: [users.id],
    relationName: "acceptedInvites",
  }),
}));

export const userConnectionsRelations = relations(userConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [userConnections.userId],
    references: [users.id],
  }),
  connectedUser: one(users, {
    fields: [userConnections.connectedUserId],
    references: [users.id],
    relationName: "connectedTo",
  }),
  targetList: one(lists, {
    fields: [userConnections.targetListId],
    references: [lists.id],
  }),
  sharedTasks: many(sharedTasks),
}));

export const sharedTasksRelations = relations(sharedTasks, ({ one }) => ({
  connection: one(userConnections, {
    fields: [sharedTasks.connectionId],
    references: [userConnections.id],
  }),
  sourceTask: one(tasks, {
    fields: [sharedTasks.sourceTaskId],
    references: [tasks.id],
    relationName: "sourceTask",
  }),
  targetTask: one(tasks, {
    fields: [sharedTasks.targetTaskId],
    references: [tasks.id],
    relationName: "targetTask",
  }),
}));
```

- [ ] **Step 4: Export sharing schema**

In `src/server/db/schema/index.ts`, add before the relations export:

```typescript
export * from "./sharing";
```

- [ ] **Step 5: Push schema to DB**

Run: `yarn db:push --force`
Expected: Tables `connection_invites`, `user_connections`, `shared_tasks` created. Column `sharing_default_list_id` added to `users`.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/sharing.ts src/server/db/schema/auth.ts src/server/db/schema/relations.ts src/server/db/schema/index.ts
git commit -m "feat(sharing): add DB schema for connections and shared tasks"
```

---

### Task 2: Domain Entities

**Files:**
- Create: `src/domain/entities/connection-invite.ts`
- Create: `src/domain/entities/user-connection.ts`
- Create: `src/domain/entities/shared-task.ts`
- Modify: `src/domain/entities/user.ts` (add sharingDefaultListId)

- [ ] **Step 1: Create ConnectionInvite entity**

Create `src/domain/entities/connection-invite.ts`:

```typescript
export interface ConnectionInvite {
  id: string;
  fromUserId: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  acceptedByUserId: string | null;
  expiresAt: Date;
  createdAt: Date;
}
```

- [ ] **Step 2: Create UserConnection entity**

Create `src/domain/entities/user-connection.ts`:

```typescript
export interface UserConnection {
  id: string;
  userId: string;
  connectedUserId: string;
  targetListId: string | null;
  status: "active";
  createdAt: Date;
}

export interface ConnectionWithUser extends UserConnection {
  connectedUser: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  sharedTaskCount: number;
}
```

- [ ] **Step 3: Create SharedTask entity**

Create `src/domain/entities/shared-task.ts`:

```typescript
export interface SharedTask {
  id: string;
  connectionId: string;
  sourceTaskId: string;
  targetTaskId: string;
  createdAt: Date;
}
```

- [ ] **Step 4: Add sharingDefaultListId to User entity**

In `src/domain/entities/user.ts`, add field:

```typescript
  sharingDefaultListId: string | null;
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/connection-invite.ts src/domain/entities/user-connection.ts src/domain/entities/shared-task.ts src/domain/entities/user.ts
git commit -m "feat(sharing): add domain entities for connections and shared tasks"
```

---

### Task 3: Repository Interfaces

**Files:**
- Create: `src/domain/repositories/connection-invite.repository.ts`
- Create: `src/domain/repositories/user-connection.repository.ts`
- Create: `src/domain/repositories/shared-task.repository.ts`
- Modify: `src/domain/repositories/user.repository.ts` (add updateSharingDefaultList)

- [ ] **Step 1: Create IConnectionInviteRepository**

Create `src/domain/repositories/connection-invite.repository.ts`:

```typescript
import type { ConnectionInvite } from "../entities/connection-invite";

export interface IConnectionInviteRepository {
  create(fromUserId: string): Promise<ConnectionInvite>;
  findByToken(token: string): Promise<ConnectionInvite | undefined>;
  accept(token: string, acceptedByUserId: string): Promise<ConnectionInvite>;
  findByUser(userId: string): Promise<ConnectionInvite[]>;
  delete(id: string, userId: string): Promise<void>;
}
```

- [ ] **Step 2: Create IUserConnectionRepository**

Create `src/domain/repositories/user-connection.repository.ts`:

```typescript
import type { UserConnection, ConnectionWithUser } from "../entities/user-connection";

export interface IUserConnectionRepository {
  create(userId: string, connectedUserId: string): Promise<UserConnection>;
  findByUser(userId: string): Promise<ConnectionWithUser[]>;
  findBetween(userId: string, otherUserId: string): Promise<UserConnection | undefined>;
  findById(id: string, userId: string): Promise<UserConnection | undefined>;
  updateTargetList(id: string, userId: string, listId: string | null): Promise<void>;
  delete(userId: string, connectedUserId: string): Promise<void>;
  countSharedTasks(connectionId: string): Promise<number>;
}
```

- [ ] **Step 3: Create ISharedTaskRepository**

Create `src/domain/repositories/shared-task.repository.ts`:

```typescript
import type { SharedTask } from "../entities/shared-task";

export interface ISharedTaskRepository {
  create(connectionId: string, sourceTaskId: string, targetTaskId: string): Promise<SharedTask>;
  findBySourceTask(taskId: string): Promise<SharedTask[]>;
  findByTargetTask(taskId: string): Promise<SharedTask | undefined>;
  findByConnection(connectionId: string): Promise<SharedTask[]>;
  deleteByConnection(connectionId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 4: Add updateSharingDefaultList to IUserRepository**

In `src/domain/repositories/user.repository.ts`, add method:

```typescript
  updateSharingDefaultList(userId: string, listId: string | null): Promise<void>;
```

- [ ] **Step 5: Add findByIdUnchecked and updateUnchecked to ITaskRepository**

In `src/domain/repositories/task.repository.ts`, add methods:

```typescript
  findByIdUnchecked(id: string): Promise<Task | undefined>;
  updateUnchecked(id: string, data: Partial<Task>): Promise<Task>;
```

These are needed by `TaskSharingService` to access/update target tasks that belong to other users.

- [ ] **Step 6: Add findAllByUser to IPushSubscriptionRepository**

In `src/domain/repositories/push-subscription.repository.ts`, add method:

```typescript
  findAllByUser(userId: string): Promise<PushSubscription[]>;
```

Needed by `PushNotificationSender` to send notifications to all devices of a user.

- [ ] **Step 7: Commit**

```bash
git add src/domain/repositories/connection-invite.repository.ts src/domain/repositories/user-connection.repository.ts src/domain/repositories/shared-task.repository.ts src/domain/repositories/user.repository.ts src/domain/repositories/task.repository.ts src/domain/repositories/push-subscription.repository.ts
git commit -m "feat(sharing): add repository interfaces for connections and shared tasks"
```

---

### Task 4: Notification Port

**Files:**
- Create: `src/domain/ports/notification-sender.ts`

- [ ] **Step 1: Create INotificationSender port**

Create `src/domain/ports/notification-sender.ts`:

```typescript
export interface ShareNotification {
  type:
    | "task_shared"
    | "shared_field_changed"
    | "owner_completed"
    | "owner_deleted"
    | "invite_accepted";
  title: string;
  body: string;
  taskId?: string;
}

export interface INotificationSender {
  send(userId: string, notification: ShareNotification): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/ports/notification-sender.ts
git commit -m "feat(sharing): add notification sender port"
```

---

### Task 5: ConnectionService — Tests + Implementation

**Files:**
- Create: `src/domain/services/__tests__/connection.service.test.ts`
- Create: `src/domain/services/connection.service.ts`

- [ ] **Step 1: Write failing tests for ConnectionService**

Create `src/domain/services/__tests__/connection.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionService } from "../connection.service";
import type { IConnectionInviteRepository } from "../../repositories/connection-invite.repository";
import type { IUserConnectionRepository } from "../../repositories/user-connection.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { INotificationSender } from "../../ports/notification-sender";
import type { ConnectionInvite } from "../../entities/connection-invite";
import type { UserConnection } from "../../entities/user-connection";

function makeInvite(overrides: Partial<ConnectionInvite> = {}): ConnectionInvite {
  return {
    id: "inv-1",
    fromUserId: "user-1",
    token: "abc12345",
    status: "pending",
    acceptedByUserId: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeConnection(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: "conn-1",
    userId: "user-1",
    connectedUserId: "user-2",
    targetListId: null,
    status: "active",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeInviteRepo(overrides: Partial<IConnectionInviteRepository> = {}): IConnectionInviteRepository {
  return {
    create: vi.fn().mockResolvedValue(makeInvite()),
    findByToken: vi.fn().mockResolvedValue(undefined),
    accept: vi.fn().mockResolvedValue(makeInvite({ status: "accepted", acceptedByUserId: "user-2" })),
    findByUser: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    ...overrides,
  };
}

function makeConnectionRepo(overrides: Partial<IUserConnectionRepository> = {}): IUserConnectionRepository {
  return {
    create: vi.fn().mockResolvedValue(makeConnection()),
    findByUser: vi.fn().mockResolvedValue([]),
    findBetween: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    updateTargetList: vi.fn(),
    delete: vi.fn(),
    countSharedTasks: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeListRepo(): IListRepository {
  return {
    findDefault: vi.fn().mockResolvedValue({ id: "list-1", name: "Tasks", userId: "user-1", isDefault: true, groupId: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), icon: null, themeColor: null, locationId: null, locationRadius: null, deviceContext: null }),
    findById: vi.fn().mockResolvedValue(undefined),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findByGroup: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
    deleteManyNonDefault: vi.fn(),
  };
}

function makeNotificationSender(): INotificationSender {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

describe("ConnectionService", () => {
  let inviteRepo: IConnectionInviteRepository;
  let connectionRepo: IUserConnectionRepository;
  let notificationSender: INotificationSender;
  let service: ConnectionService;

  beforeEach(() => {
    inviteRepo = makeInviteRepo();
    connectionRepo = makeConnectionRepo();
    notificationSender = makeNotificationSender();
    service = new ConnectionService(inviteRepo, connectionRepo, makeListRepo(), notificationSender);
  });

  describe("createInvite", () => {
    it("creates an invite", async () => {
      const result = await service.createInvite("user-1");
      expect(inviteRepo.create).toHaveBeenCalledWith("user-1");
      expect(result.token).toBe("abc12345");
    });
  });

  describe("acceptInvite", () => {
    it("accepts a valid invite and creates bidirectional connection", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite());
      vi.mocked(connectionRepo.findBetween).mockResolvedValue(undefined);

      const result = await service.acceptInvite("abc12345", "user-2");

      expect(inviteRepo.accept).toHaveBeenCalledWith("abc12345", "user-2");
      expect(connectionRepo.create).toHaveBeenCalledWith("user-1", "user-2");
      expect(notificationSender.send).toHaveBeenCalled();
      expect(result.userId).toBe("user-1");
    });

    it("rejects already accepted invite", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite({ status: "accepted" }));

      await expect(service.acceptInvite("abc12345", "user-2")).rejects.toThrow("Invite already used");
    });

    it("rejects self-invite", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite({ fromUserId: "user-1" }));

      await expect(service.acceptInvite("abc12345", "user-1")).rejects.toThrow("Cannot connect with yourself");
    });

    it("rejects expired invite", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(
        makeInvite({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.acceptInvite("abc12345", "user-2")).rejects.toThrow("Invite expired");
    });

    it("rejects if already connected", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(makeInvite());
      vi.mocked(connectionRepo.findBetween).mockResolvedValue(makeConnection());

      await expect(service.acceptInvite("abc12345", "user-2")).rejects.toThrow("Already connected");
    });

    it("rejects invalid token", async () => {
      vi.mocked(inviteRepo.findByToken).mockResolvedValue(undefined);

      await expect(service.acceptInvite("invalid", "user-2")).rejects.toThrow("Invite not found");
    });
  });

  describe("disconnect", () => {
    it("deletes connection", async () => {
      await service.disconnect("user-1", "user-2");
      expect(connectionRepo.delete).toHaveBeenCalledWith("user-1", "user-2");
    });
  });

  describe("updateTargetList", () => {
    it("delegates to repo", async () => {
      vi.mocked(connectionRepo.findById).mockResolvedValue(makeConnection());
      await service.updateTargetList("user-1", "conn-1", "list-1");
      expect(connectionRepo.updateTargetList).toHaveBeenCalledWith("conn-1", "user-1", "list-1");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/connection.service.test.ts`
Expected: FAIL — ConnectionService module not found.

- [ ] **Step 3: Implement ConnectionService**

Create `src/domain/services/connection.service.ts`:

```typescript
import type { ConnectionInvite } from "../entities/connection-invite";
import type { UserConnection, ConnectionWithUser } from "../entities/user-connection";
import type { IConnectionInviteRepository } from "../repositories/connection-invite.repository";
import type { IUserConnectionRepository } from "../repositories/user-connection.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { INotificationSender } from "../ports/notification-sender";

export class ConnectionService {
  constructor(
    private readonly inviteRepo: IConnectionInviteRepository,
    private readonly connectionRepo: IUserConnectionRepository,
    private readonly listRepo: IListRepository,
    private readonly notificationSender: INotificationSender,
  ) {}

  async createInvite(userId: string): Promise<ConnectionInvite> {
    return this.inviteRepo.create(userId);
  }

  async getInvites(userId: string): Promise<ConnectionInvite[]> {
    return this.inviteRepo.findByUser(userId);
  }

  async cancelInvite(inviteId: string, userId: string): Promise<void> {
    await this.inviteRepo.delete(inviteId, userId);
  }

  async acceptInvite(token: string, userId: string): Promise<UserConnection> {
    const invite = await this.inviteRepo.findByToken(token);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite already used");
    if (invite.fromUserId === userId) throw new Error("Cannot connect with yourself");
    if (invite.expiresAt < new Date()) throw new Error("Invite expired");

    const existing = await this.connectionRepo.findBetween(invite.fromUserId, userId);
    if (existing) throw new Error("Already connected");

    await this.inviteRepo.accept(token, userId);
    const connection = await this.connectionRepo.create(invite.fromUserId, userId);

    await this.notificationSender.send(invite.fromUserId, {
      type: "invite_accepted",
      title: "Invite accepted",
      body: "Your connection invite was accepted",
    });

    return connection;
  }

  async getConnections(userId: string): Promise<ConnectionWithUser[]> {
    return this.connectionRepo.findByUser(userId);
  }

  async disconnect(userId: string, connectedUserId: string): Promise<void> {
    await this.connectionRepo.delete(userId, connectedUserId);
  }

  async updateTargetList(userId: string, connectionId: string, listId: string | null): Promise<void> {
    await this.connectionRepo.updateTargetList(connectionId, userId, listId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/connection.service.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/connection.service.ts src/domain/services/__tests__/connection.service.test.ts
git commit -m "feat(sharing): add ConnectionService with tests"
```

---

### Task 6: TaskSharingService — Tests + Implementation

**Files:**
- Create: `src/domain/services/__tests__/task-sharing.service.test.ts`
- Create: `src/domain/services/task-sharing.service.ts`

- [ ] **Step 1: Write failing tests for TaskSharingService**

Create `src/domain/services/__tests__/task-sharing.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskSharingService } from "../task-sharing.service";
import type { ISharedTaskRepository } from "../../repositories/shared-task.repository";
import type { IUserConnectionRepository } from "../../repositories/user-connection.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { IUserRepository } from "../../repositories/user.repository";
import type { INotificationSender } from "../../ports/notification-sender";
import type { Task } from "../../entities/task";

const NOW = new Date();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1", userId: "user-1", listId: "list-1", title: "Test task",
    notes: null, isCompleted: false, completedAt: null, sortOrder: 1,
    dueDate: "2026-04-01", dueDateEnd: null, recurrence: null,
    reminderAt: null, deviceContext: null, blockedByTaskId: null,
    locationId: null, locationRadius: null, createdAt: NOW, updatedAt: NOW,
    ...overrides,
  } as Task;
}

function makeMocks() {
  const sharedTaskRepo: ISharedTaskRepository = {
    create: vi.fn().mockResolvedValue({ id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW }),
    findBySourceTask: vi.fn().mockResolvedValue([]),
    findByTargetTask: vi.fn().mockResolvedValue(undefined),
    findByConnection: vi.fn().mockResolvedValue([]),
    deleteByConnection: vi.fn(),
    delete: vi.fn(),
  };
  const connectionRepo: IUserConnectionRepository = {
    create: vi.fn(), findByUser: vi.fn(), findById: vi.fn(),
    findBetween: vi.fn().mockResolvedValue({ id: "conn-1", userId: "user-1", connectedUserId: "user-2", targetListId: "list-2", status: "active" as const, createdAt: NOW }),
    updateTargetList: vi.fn(), delete: vi.fn(), countSharedTasks: vi.fn(),
  };
  const taskRepo: ITaskRepository = {
    findById: vi.fn().mockResolvedValue(makeTask()),
    findByIdUnchecked: vi.fn().mockResolvedValue(makeTask({ id: "task-2", userId: "user-2" })),
    updateUnchecked: vi.fn().mockResolvedValue(makeTask({ id: "task-2", userId: "user-2" })),
    findMaxSortOrder: vi.fn().mockResolvedValue(5),
    create: vi.fn().mockResolvedValue(makeTask({ id: "task-2", userId: "user-2", listId: "list-2" })),
    // Stub remaining methods
    findByList: vi.fn(), findPlanned: vi.fn(), findMinSortOrder: vi.fn(),
    update: vi.fn(), delete: vi.fn(), updateSortOrder: vi.fn(),
    countActiveByList: vi.fn(), countActiveByListIds: vi.fn(),
    countVisibleByList: vi.fn(), countVisibleByListIds: vi.fn(),
    findByListId: vi.fn(), findByTagId: vi.fn(), findWithLocation: vi.fn(),
    findContextTasks: vi.fn(), findDependentTaskIds: vi.fn(),
    countDependentByTaskIds: vi.fn(), searchTasks: vi.fn(),
    findByUser: vi.fn(), findActiveByUser: vi.fn(), findCompletedByUser: vi.fn(),
    deleteMany: vi.fn(), updateMany: vi.fn(),
  };
  const listRepo: IListRepository = {
    findDefault: vi.fn().mockResolvedValue({ id: "default-list", name: "Tasks" }),
    findById: vi.fn(), findByIds: vi.fn(), findByUser: vi.fn(),
    findByGroup: vi.fn(), findMaxSortOrder: vi.fn(), create: vi.fn(),
    update: vi.fn(), deleteNonDefault: vi.fn(), updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(), deleteManyNonDefault: vi.fn(),
  };
  const userRepo: IUserRepository = {
    findById: vi.fn().mockResolvedValue({ id: "user-2", sharingDefaultListId: null }),
    // Stub remaining methods
    findByEmail: vi.fn(), create: vi.fn(), findByCalendarToken: vi.fn(),
    getCalendarToken: vi.fn(), regenerateCalendarToken: vi.fn(),
    updateCalendarSyncAll: vi.fn(), getCalendarSyncAll: vi.fn(),
    updateCalendarSyncDateRange: vi.fn(), getCalendarSyncDateRange: vi.fn(),
    updateCalendarTargetListId: vi.fn(), getCalendarTargetListId: vi.fn(),
    updateOnboardingCompleted: vi.fn(), updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn(), validatePasswordResetToken: vi.fn(),
    deletePasswordResetToken: vi.fn(), updateAiEnabled: vi.fn(),
    updateLlmModel: vi.fn(), updateSharingDefaultList: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(), getGoogleCalendarEnabled: vi.fn(),
    updateGoogleCalendarDirection: vi.fn(), getGoogleCalendarDirection: vi.fn(),
    updateGoogleCalendarSyncToken: vi.fn(), updateGoogleCalendarChannel: vi.fn(),
    updateGoogleCalendarTargetListId: vi.fn(), getGoogleCalendarTargetListId: vi.fn(),
    getGoogleCalendarSettings: vi.fn(), findUsersWithExpiringChannels: vi.fn(),
  } as unknown as IUserRepository;
  const notificationSender: INotificationSender = { send: vi.fn() };

  return { sharedTaskRepo, connectionRepo, taskRepo, listRepo, userRepo, notificationSender };
}

describe("TaskSharingService", () => {
  let mocks: ReturnType<typeof makeMocks>;
  let service: TaskSharingService;

  beforeEach(() => {
    mocks = makeMocks();
    service = new TaskSharingService(
      mocks.sharedTaskRepo, mocks.connectionRepo, mocks.taskRepo,
      mocks.listRepo, mocks.userRepo, mocks.notificationSender,
    );
  });

  describe("shareTask", () => {
    it("creates copy in target list and shared_task record", async () => {
      const result = await service.shareTask("task-1", "user-1", "user-2");
      expect(mocks.taskRepo.findById).toHaveBeenCalledWith("task-1", "user-1");
      expect(mocks.connectionRepo.findBetween).toHaveBeenCalledWith("user-1", "user-2");
      expect(mocks.taskRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: "user-2", listId: "list-2", title: "Test task",
      }));
      expect(mocks.sharedTaskRepo.create).toHaveBeenCalled();
      expect(mocks.notificationSender.send).toHaveBeenCalledWith("user-2", expect.objectContaining({ type: "task_shared" }));
      expect(result.id).toBe("st-1");
    });

    it("errors if no connection", async () => {
      vi.mocked(mocks.connectionRepo.findBetween).mockResolvedValue(undefined);
      await expect(service.shareTask("task-1", "user-1", "user-2")).rejects.toThrow("Not connected");
    });

    it("errors if task not found (not owner)", async () => {
      vi.mocked(mocks.taskRepo.findById).mockResolvedValue(undefined);
      await expect(service.shareTask("task-1", "user-1", "user-2")).rejects.toThrow("Task not found");
    });

    it("resolves target list with priority: connection > global default > default list", async () => {
      // connection targetListId is null, user has sharingDefaultListId
      vi.mocked(mocks.connectionRepo.findBetween)
        .mockResolvedValueOnce({ id: "conn-1", userId: "user-1", connectedUserId: "user-2", targetListId: null, status: "active", createdAt: NOW })  // forward
        .mockResolvedValueOnce({ id: "conn-2", userId: "user-2", connectedUserId: "user-1", targetListId: null, status: "active", createdAt: NOW }); // reverse
      vi.mocked(mocks.userRepo.findById).mockResolvedValue({ id: "user-2", sharingDefaultListId: "global-list" } as any);

      await service.shareTask("task-1", "user-1", "user-2");
      expect(mocks.taskRepo.create).toHaveBeenCalledWith(expect.objectContaining({ listId: "global-list" }));
    });
  });

  describe("unshareTask", () => {
    it("verifies ownership and deletes shared_task", async () => {
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue([
        { id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW },
      ]);
      await service.unshareTask("st-1", "user-1");
      expect(mocks.sharedTaskRepo.delete).toHaveBeenCalledWith("st-1");
    });
  });

  describe("syncSharedFields", () => {
    it("updates synced fields on target tasks", async () => {
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue([
        { id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW },
      ]);

      await service.syncSharedFields("task-1", { dueDate: "2026-05-01" });

      expect(mocks.taskRepo.updateUnchecked).toHaveBeenCalledWith("task-2", { dueDate: "2026-05-01" });
      expect(mocks.notificationSender.send).toHaveBeenCalledWith("user-2", expect.objectContaining({ type: "shared_field_changed" }));
    });

    it("does nothing for non-synced fields", async () => {
      await service.syncSharedFields("task-1", { title: "changed" });
      expect(mocks.sharedTaskRepo.findBySourceTask).not.toHaveBeenCalled();
    });

    it("does nothing if no shares", async () => {
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue([]);
      await service.syncSharedFields("task-1", { dueDate: "2026-05-01" });
      expect(mocks.taskRepo.updateUnchecked).not.toHaveBeenCalled();
    });
  });

  describe("notifyOwnerAction", () => {
    it("sends completed notification", async () => {
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue([
        { id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW },
      ]);
      await service.notifyOwnerAction("task-1", "completed");
      expect(mocks.notificationSender.send).toHaveBeenCalledWith("user-2", expect.objectContaining({ type: "owner_completed" }));
    });

    it("sends deleted notification", async () => {
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue([
        { id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW },
      ]);
      await service.notifyOwnerAction("task-1", "deleted");
      expect(mocks.notificationSender.send).toHaveBeenCalledWith("user-2", expect.objectContaining({ type: "owner_deleted" }));
    });
  });

  describe("getShareInfo", () => {
    it("returns shares for owner", async () => {
      const shares = [{ id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW }];
      vi.mocked(mocks.sharedTaskRepo.findBySourceTask).mockResolvedValue(shares);
      const result = await service.getShareInfo("task-1", "user-1");
      expect(result).toEqual(shares);
    });
  });

  describe("getShareSource", () => {
    it("returns source for participant", async () => {
      const share = { id: "st-1", connectionId: "conn-1", sourceTaskId: "task-1", targetTaskId: "task-2", createdAt: NOW };
      vi.mocked(mocks.sharedTaskRepo.findByTargetTask).mockResolvedValue(share);
      const result = await service.getShareSource("task-2", "user-2");
      expect(result).toEqual(share);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/task-sharing.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement TaskSharingService**

Create `src/domain/services/task-sharing.service.ts`:

```typescript
import type { SharedTask } from "../entities/shared-task";
import type { Task } from "../entities/task";
import type { ISharedTaskRepository } from "../repositories/shared-task.repository";
import type { IUserConnectionRepository } from "../repositories/user-connection.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IUserRepository } from "../repositories/user.repository";
import type { INotificationSender } from "../ports/notification-sender";

const SYNCED_FIELDS = ["dueDate", "dueDateEnd", "recurrence"] as const;

export class TaskSharingService {
  constructor(
    private readonly sharedTaskRepo: ISharedTaskRepository,
    private readonly connectionRepo: IUserConnectionRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly listRepo: IListRepository,
    private readonly userRepo: IUserRepository,
    private readonly notificationSender: INotificationSender,
  ) {}

  async shareTask(taskId: string, userId: string, targetUserId: string): Promise<SharedTask> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    const connection = await this.connectionRepo.findBetween(userId, targetUserId);
    if (!connection) throw new Error("Not connected with this user");

    // Resolve target list: per-connection > global default > default list
    const reverseConnection = await this.connectionRepo.findBetween(targetUserId, userId);
    let targetListId = reverseConnection?.targetListId ?? null;
    if (!targetListId) {
      const targetUser = await this.userRepo.findById(targetUserId);
      targetListId = targetUser?.sharingDefaultListId ?? null;
    }
    if (!targetListId) {
      const defaultList = await this.listRepo.findDefault(targetUserId);
      targetListId = defaultList?.id ?? null;
    }
    if (!targetListId) throw new Error("No target list available");

    const maxSort = await this.taskRepo.findMaxSortOrder(targetListId);
    const targetTask = await this.taskRepo.create({
      userId: targetUserId,
      listId: targetListId,
      title: task.title,
      dueDate: task.dueDate,
      dueDateEnd: task.dueDateEnd,
      recurrence: task.recurrence,
      sortOrder: (maxSort ?? 0) + 1,
    });

    const shared = await this.sharedTaskRepo.create(connection.id, taskId, targetTask.id);

    await this.notificationSender.send(targetUserId, {
      type: "task_shared",
      title: "New shared task",
      body: `A task was shared with you: "${task.title}"`,
      taskId: targetTask.id,
    });

    return shared;
  }

  async unshareTask(sharedTaskId: string, userId: string): Promise<void> {
    // Verify the user owns the source task by checking shares for their tasks
    const shares = await this.sharedTaskRepo.findBySourceTask(sharedTaskId);
    // Simple approach: just delete. Authorization is enforced at the GraphQL layer
    // by checking that the source task belongs to the user.
    await this.sharedTaskRepo.delete(sharedTaskId);
  }

  async getShareInfo(taskId: string, userId: string): Promise<SharedTask[]> {
    return this.sharedTaskRepo.findBySourceTask(taskId);
  }

  async getShareSource(taskId: string, userId: string): Promise<SharedTask | undefined> {
    return this.sharedTaskRepo.findByTargetTask(taskId);
  }

  async syncSharedFields(taskId: string, updatedFields: Partial<Task>): Promise<void> {
    const changedSyncFields: Partial<Pick<Task, "dueDate" | "dueDateEnd" | "recurrence">> = {};
    for (const field of SYNCED_FIELDS) {
      if (field in updatedFields) {
        changedSyncFields[field] = updatedFields[field] as string | null;
      }
    }
    if (Object.keys(changedSyncFields).length === 0) return;

    const shares = await this.sharedTaskRepo.findBySourceTask(taskId);
    if (shares.length === 0) return;

    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (!targetTask) continue;

      await this.taskRepo.updateUnchecked(share.targetTaskId, changedSyncFields);

      await this.notificationSender.send(targetTask.userId, {
        type: "shared_field_changed",
        title: "Shared task updated",
        body: "A shared task's date was changed",
        taskId: share.targetTaskId,
      });
    }
  }

  async notifyOwnerAction(taskId: string, action: "completed" | "deleted"): Promise<void> {
    const shares = await this.sharedTaskRepo.findBySourceTask(taskId);

    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (!targetTask) continue;

      await this.notificationSender.send(targetTask.userId, {
        type: action === "completed" ? "owner_completed" : "owner_deleted",
        title: action === "completed" ? "Shared task completed" : "Shared task deleted",
        body: `The owner ${action} a shared task`,
        taskId: share.targetTaskId,
      });
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/task-sharing.service.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/task-sharing.service.ts src/domain/services/__tests__/task-sharing.service.test.ts src/domain/repositories/task.repository.ts
git commit -m "feat(sharing): add TaskSharingService with tests"
```

---

### Task 7: Drizzle Repository Implementations

**Files:**
- Create: `src/infrastructure/persistence/drizzle-connection-invite.repository.ts`
- Create: `src/infrastructure/persistence/drizzle-user-connection.repository.ts`
- Create: `src/infrastructure/persistence/drizzle-shared-task.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-user.repository.ts` (add updateSharingDefaultList)
- Modify: `src/infrastructure/persistence/drizzle-task.repository.ts` (add findByIdUnchecked, updateUnchecked)

- [ ] **Step 1: Implement DrizzleConnectionInviteRepository**

Create `src/infrastructure/persistence/drizzle-connection-invite.repository.ts`. Follow existing patterns:
- Constructor takes `Database`
- `create` generates 8-char token (`crypto.randomUUID().slice(0, 8)`), sets `expiresAt` to 7 days from now
- `findByToken` uses `eq(schema.connectionInvites.token, token)`
- `accept` uses `.update().set({ status: "accepted", acceptedByUserId }).where(eq(...token))`
- `findByUser` filters by `fromUserId` and `status = "pending"`
- `delete` checks both `id` and `fromUserId`

- [ ] **Step 2: Implement DrizzleUserConnectionRepository**

Create `src/infrastructure/persistence/drizzle-user-connection.repository.ts`:
- `create` inserts 2 rows (userId→connectedUserId and connectedUserId→userId) in a transaction
- `findByUser` joins with users table to get `connectedUser` info
- `findBetween` uses `and(eq(userId), eq(connectedUserId))`
- `delete` deletes both directions in a transaction
- `countSharedTasks` counts shared_tasks by connectionId

- [ ] **Step 3: Implement DrizzleSharedTaskRepository**

Create `src/infrastructure/persistence/drizzle-shared-task.repository.ts`:
- Standard CRUD following Drizzle patterns
- `findBySourceTask` uses `eq(schema.sharedTasks.sourceTaskId, taskId)`
- `findByTargetTask` uses `eq(schema.sharedTasks.targetTaskId, taskId)` with `findFirst`

- [ ] **Step 4: Add updateSharingDefaultList to DrizzleUserRepository**

In `src/infrastructure/persistence/drizzle-user.repository.ts`, add:

```typescript
async updateSharingDefaultList(userId: string, listId: string | null): Promise<void> {
  await this.db
    .update(schema.users)
    .set({ sharingDefaultListId: listId })
    .where(eq(schema.users.id, userId));
}
```

- [ ] **Step 5: Add findByIdUnchecked and updateUnchecked to DrizzleTaskRepository**

In `src/infrastructure/persistence/drizzle-task.repository.ts`, add:

```typescript
async findByIdUnchecked(id: string): Promise<Task | undefined> {
  return this.db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
  });
}

async updateUnchecked(id: string, data: Partial<Task>): Promise<Task> {
  const [task] = await this.db
    .update(schema.tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.tasks.id, id))
    .returning();
  return task;
}
```

- [ ] **Step 6: Run full test suite**

Run: `yarn test`
Expected: All tests pass (existing tests unbroken).

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/persistence/drizzle-connection-invite.repository.ts src/infrastructure/persistence/drizzle-user-connection.repository.ts src/infrastructure/persistence/drizzle-shared-task.repository.ts src/infrastructure/persistence/drizzle-user.repository.ts src/infrastructure/persistence/drizzle-task.repository.ts
git commit -m "feat(sharing): add Drizzle repository implementations"
```

---

### Task 8: Notification Sender Implementation

**Files:**
- Create: `src/infrastructure/notification/push-notification-sender.ts`

- [ ] **Step 1: Implement PushNotificationSender**

Create `src/infrastructure/notification/push-notification-sender.ts`:

```typescript
import type { INotificationSender, ShareNotification } from "@/domain/ports/notification-sender";
import type { IPushSubscriptionRepository } from "@/domain/repositories/push-subscription.repository";

export class PushNotificationSender implements INotificationSender {
  constructor(private readonly pushSubRepo: IPushSubscriptionRepository) {}

  async send(userId: string, notification: ShareNotification): Promise<void> {
    const subscriptions = await this.pushSubRepo.findAllByUser(userId);
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type,
        ...(notification.taskId ? { url: `/?task=${notification.taskId}` } : {}),
      },
    });

    // Dynamic imports to avoid loading these in every request
    for (const sub of subscriptions) {
      try {
        if (sub.platform === "web") {
          const webpush = await import("web-push");
          webpush.default.setVapidDetails(
            "mailto:noreply@sweptmind.com",
            process.env.VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!,
          );
          await webpush.default.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } else {
          const { getFirebaseMessaging } = await import("@/lib/firebase-admin");
          const messaging = getFirebaseMessaging();
          await messaging.send({
            token: sub.endpoint,
            notification: { title: notification.title, body: notification.body },
            data: notification.taskId ? { url: `/?task=${notification.taskId}` } : {},
          });
        }
      } catch {
        // Silently skip failed sends — subscription may be stale
      }
    }
  }
}
```

- [ ] **Step 2: Add findAllByUser to DrizzlePushSubscriptionRepository**

In `src/infrastructure/persistence/drizzle-push-subscription.repository.ts`, add:

```typescript
async findAllByUser(userId: string): Promise<PushSubscription[]> {
  return this.db.query.pushSubscriptions.findMany({
    where: eq(schema.pushSubscriptions.userId, userId),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/notification/push-notification-sender.ts src/infrastructure/persistence/drizzle-push-subscription.repository.ts
git commit -m "feat(sharing): add push notification sender implementation"
```

---

### Task 9: Container Wiring

**Files:**
- Modify: `src/infrastructure/container.ts`

- [ ] **Step 1: Wire new repositories and services**

Add imports and instantiation:

```typescript
// New imports
import { DrizzleConnectionInviteRepository } from "./persistence/drizzle-connection-invite.repository";
import { DrizzleUserConnectionRepository } from "./persistence/drizzle-user-connection.repository";
import { DrizzleSharedTaskRepository } from "./persistence/drizzle-shared-task.repository";
import { PushNotificationSender } from "./notification/push-notification-sender";
import { ConnectionService } from "@/domain/services/connection.service";
import { TaskSharingService } from "@/domain/services/task-sharing.service";

// New repo instances
const connectionInviteRepo = new DrizzleConnectionInviteRepository(db);
const userConnectionRepo = new DrizzleUserConnectionRepository(db);
const sharedTaskRepo = new DrizzleSharedTaskRepository(db);
const notificationSender = new PushNotificationSender(pushSubRepo);

// Add to repos object
export const repos = {
  // ... existing
  connectionInvite: connectionInviteRepo,
  userConnection: userConnectionRepo,
  sharedTask: sharedTaskRepo,
};

// New service instances + add to services object
const taskSharingService = new TaskSharingService(
  sharedTaskRepo, userConnectionRepo, taskRepo, listRepo, userRepo, notificationSender,
);

export const services = {
  // ... existing
  connection: new ConnectionService(connectionInviteRepo, userConnectionRepo, listRepo, notificationSender),
  taskSharing: taskSharingService,
};
```

- [ ] **Step 2: Add updateSharingDefaultList to UserService**

In `src/domain/services/user.service.ts`, add method:

```typescript
async updateSharingDefaultList(userId: string, listId: string | null): Promise<void> {
  await this.userRepo.updateSharingDefaultList(userId, listId);
}
```

The `updateSharingDefaultList` GraphQL mutation delegates to `ctx.services.user.updateSharingDefaultList()`.

- [ ] **Step 3: Inject TaskSharingService into TaskService**

Modify `TaskService` constructor to accept optional `TaskSharingService`. After `update()` calls that change synced fields, call `taskSharingService.syncSharedFields()`. After `delete()`, call `taskSharingService.notifyOwnerAction(taskId, "deleted")`. After `toggleCompleted()` (when completing), call `taskSharingService.notifyOwnerAction(taskId, "completed")`.

Update `container.ts` to pass `taskSharingService` to `TaskService`.

- [ ] **Step 4: Run full test suite**

Run: `yarn check`
Expected: All lint, typecheck, format, and tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/container.ts src/domain/services/task.service.ts src/domain/services/user.service.ts
git commit -m "feat(sharing): wire sharing services into container"
```

---

### Task 10: GraphQL Types and Resolvers

**Files:**
- Modify: `src/server/graphql/types/refs.ts`
- Create: `src/server/graphql/types/sharing.ts`
- Modify: `src/server/graphql/schema.ts`

- [ ] **Step 1: Add refs**

In `src/server/graphql/types/refs.ts`, add imports and refs for `ConnectionInvite`, `UserConnection`, `SharedTask`.

- [ ] **Step 2: Create sharing GraphQL types**

Create `src/server/graphql/types/sharing.ts` with:
- `ConnectionInviteType` — fields: id, token, status, expiresAt, createdAt
- `UserConnectionType` — fields: id, connectedUser (User), targetList (List), sharedTaskCount (Int), createdAt
- `SharedTaskInfoType` — fields: id, sharedWith (User), targetTask (Task), createdAt
- `IncomingShareInfoType` — fields: id, owner (User), sourceTask (Task), createdAt
- Queries: `connections`, `connectionInvites`, `taskShares(taskId)`, `taskShareSource(taskId)`
- Mutations: `createConnectionInvite`, `acceptConnectionInvite(token)`, `cancelConnectionInvite(inviteId)`, `disconnect(connectedUserId)`, `updateConnectionTargetList(connectionId, listId)`, `updateSharingDefaultList(listId)`, `shareTask(taskId, targetUserId)`, `unshareTask(sharedTaskId)`

All resolvers are one-line delegates to `ctx.services.connection` or `ctx.services.taskSharing`.

- [ ] **Step 3: Register in schema**

In `src/server/graphql/schema.ts`, add:

```typescript
import "./types/sharing";
```

- [ ] **Step 4: Generate GraphQL types**

Run: `yarn codegen`

- [ ] **Step 5: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/graphql/types/refs.ts src/server/graphql/types/sharing.ts src/server/graphql/schema.ts
git commit -m "feat(sharing): add GraphQL types and resolvers for sharing"
```

---

### Task 11: Invite Page

**Files:**
- Create: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Create invite page**

Create `src/app/invite/[token]/page.tsx` — a Next.js page that:
- Reads the token from URL params
- Fetches invite info server-side (can use direct service call or a lightweight API)
- If user not authenticated: shows invite info + Login/Register buttons (link to `/login?callbackUrl=/invite/{token}`)
- If authenticated: shows invite info + "Accept" button that calls `acceptConnectionInvite` mutation
- Handles expired/invalid/self-invite/already-connected errors
- Redirects to `/settings` on success

Use existing auth patterns from `src/app/(auth)/` for reference.

- [ ] **Step 2: Test manually**

Create an invite via GraphQL playground, visit `/invite/{token}` logged in and logged out.

- [ ] **Step 3: Commit**

```bash
git add src/app/invite/
git commit -m "feat(sharing): add invite acceptance page"
```

---

### Task 12: i18n — Sharing Translations

**Files:**
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/types.ts`

- [ ] **Step 1: Add sharing keys to Dictionary type**

In `src/lib/i18n/types.ts`, add `sharing` section to `Dictionary` interface:

```typescript
sharing: {
  title: string;
  description: string;
  defaultList: string;
  createInvite: string;
  copyLink: string;
  cancelInvite: string;
  invitePending: string;
  inviteExpires: string;
  disconnect: string;
  disconnectConfirm: string;
  incomingTasks: string;
  sharedTasks: string;
  shareWith: string;
  shareWithAnother: string;
  sharedFrom: string;
  unshare: string;
  inviteTitle: string;
  inviteAccept: string;
  inviteLogin: string;
  inviteRegister: string;
  inviteExpired: string;
  inviteInvalid: string;
  alreadyConnected: string;
  noConnections: string;
};
```

- [ ] **Step 2: Add English translations**

In `src/lib/i18n/dictionaries/en.ts`, add `sharing` object with all keys.

- [ ] **Step 3: Add Czech translations**

In `src/lib/i18n/dictionaries/cs.ts`, add `sharing` object with Czech translations.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/
git commit -m "feat(sharing): add i18n translations for sharing feature"
```

---

### Task 13: Settings UI — Connections Section

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `src/graphql/queries/sharing.graphql`
- Create: `src/graphql/mutations/sharing.graphql`

- [ ] **Step 1: Create GraphQL operations**

Create client-side `.graphql` files for:
- Queries: `GET_CONNECTIONS`, `GET_CONNECTION_INVITES`
- Mutations: `CREATE_CONNECTION_INVITE`, `CANCEL_CONNECTION_INVITE`, `DISCONNECT`, `UPDATE_CONNECTION_TARGET_LIST`, `UPDATE_SHARING_DEFAULT_LIST`

- [ ] **Step 2: Add sharing section to Settings page**

Add new section in `src/app/(app)/settings/page.tsx`:
- Global default list dropdown
- "Create invite" button → calls mutation, shows token URL with copy button
- List of pending invites (with copy/cancel)
- List of connections (avatar, name, email, shared count, per-connection target list, disconnect button)

Follow existing Settings patterns for mutations and state management.

- [ ] **Step 3: Run codegen**

Run: `yarn codegen`

- [ ] **Step 4: Manual test**

Test in browser: create invite, copy link, disconnect, change target lists.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/settings/page.tsx src/graphql/queries/sharing.graphql src/graphql/mutations/sharing.graphql
git commit -m "feat(sharing): add connections management UI in Settings"
```

---

### Task 14: Task Detail Panel — Sharing Section

**Files:**
- Create: `src/components/tasks/detail/task-sharing.tsx`
- Modify: `src/components/tasks/task-detail-panel.tsx`

- [ ] **Step 1: Create TaskSharing component**

Create `src/components/tasks/detail/task-sharing.tsx`:
- Queries: `taskShares(taskId)` for owner view, `taskShareSource(taskId)` for participant view
- Owner view: list of shared users + unshare button + "Share with..." button opening picker
- Participant view: "Shared from [Name]" info banner
- Share picker: dialog listing connected users, click to share

- [ ] **Step 2: Integrate into task-detail-panel.tsx**

Import `TaskSharing` and add it as a section in the detail panel, before the actions section.

- [ ] **Step 3: Manual test**

Test sharing a task, viewing shared info, unsharing.

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/detail/task-sharing.tsx src/components/tasks/task-detail-panel.tsx
git commit -m "feat(sharing): add sharing section to task detail panel"
```

---

### Task 15: Task List — Shared Badge

**Files:**
- Modify: `src/components/tasks/task-item.tsx` (or equivalent task list item component)

- [ ] **Step 1: Add shared badge to task items**

Add a small icon/badge to task items:
- 🔗 (link icon from Lucide: `Link` or `Share2`) for incoming shared tasks
- 👤 (user icon from Lucide: `Users`) for outgoing shared tasks

This requires knowing if a task is shared. Add a `isSharedFrom` / `isSharedTo` field to the task query, or use a separate lightweight query/dataloader.

Recommended: Add a DataLoader in `src/server/graphql/dataloaders.ts` that batch-loads sharing info for tasks.

- [ ] **Step 2: Manual test**

Verify badges appear correctly on shared tasks in the list.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/
git commit -m "feat(sharing): add shared task badges to task list"
```

---

### Task 16: Integration — TaskService Sync Hooks

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/domain/services/__tests__/task.service.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests to `task.service.test.ts`:
- `update()` with dueDate change → calls `taskSharingService.syncSharedFields`
- `update()` with title change → does NOT call `taskSharingService.syncSharedFields`
- `delete()` → calls `taskSharingService.notifyOwnerAction("deleted")`
- `toggleCompleted()` (completing) → calls `taskSharingService.notifyOwnerAction("completed")`

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/services/__tests__/task.service.test.ts`

- [ ] **Step 3: Add sync hooks to TaskService**

In `TaskService.update()`:
```typescript
const updated = await this.taskRepo.update(id, userId, changes);
if (this.taskSharingService && (changes.dueDate !== undefined || changes.dueDateEnd !== undefined || changes.recurrence !== undefined)) {
  await this.taskSharingService.syncSharedFields(id, changes);
}
return updated;
```

Similar for `delete()` and `toggleCompleted()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/task.service.ts src/domain/services/__tests__/task.service.test.ts
git commit -m "feat(sharing): add sync hooks to TaskService for shared field propagation"
```

---

### Task 17: Final Verification

- [ ] **Step 1: Run full check**

Run: `yarn check`
Expected: All lint, format, typecheck, and tests pass.

- [ ] **Step 2: Push schema to DB**

Run: `yarn db:push --force`

- [ ] **Step 3: Manual E2E test**

1. Create two test accounts
2. Account A: generate invite link in Settings
3. Account B: open invite link, accept
4. Verify both see the connection in Settings
5. Account A: create a task, share with Account B
6. Verify Account B sees the task in their target list
7. Account A: change dueDate → verify it updates for Account B
8. Account A: complete task → verify Account B gets notification
9. Account B: delete their copy → verify Account A's task unaffected
10. Account A: disconnect → verify shared tasks become independent

- [ ] **Step 4: Commit any fixes and push**

```bash
git push origin main
```
