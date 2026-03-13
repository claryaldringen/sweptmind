# SweptMind Premium Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add freemium model with Stripe + FIO bank payments and file attachments as the first premium feature.

**Architecture:** Extend clean architecture with new domain entities (Subscription, BankPayment, TaskAttachment), repository interfaces, and services. Stripe handles card payments via Checkout Sessions + webhooks. FIO bank handles CZK payments via QR codes + cron polling. Vercel Blob stores file attachments. Premium status is computed from active subscription and checked in domain services.

**Tech Stack:** Stripe SDK, FIO banka API, Vercel Blob, Drizzle ORM, GraphQL Yoga + Pothos, Apollo Client, qrcode (SPAYD generation)

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Stripe, Vercel Blob, and QR code packages**

Run:
```bash
yarn add stripe @vercel/blob qrcode
yarn add -D @types/qrcode
```

**Step 2: Verify installation**

Run: `yarn typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add stripe, vercel blob, and qrcode dependencies"
```

---

### Task 2: Database Schema — Subscriptions & Bank Payments

**Files:**
- Create: `src/server/db/schema/subscriptions.ts`
- Modify: `src/server/db/schema/relations.ts`

**Step 1: Create subscriptions schema**

Create `src/server/db/schema/subscriptions.ts`:

```typescript
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "expired",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "monthly",
  "yearly",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "stripe",
  "bank_transfer",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    plan: subscriptionPlanEnum("plan").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_stripe_customer_id_idx").on(table.stripeCustomerId),
    index("subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId,
    ),
  ],
);

export const bankPayments = pgTable(
  "bank_payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("CZK"),
    variableSymbol: text("variable_symbol").notNull(),
    fioTransactionId: text("fio_transaction_id").notNull().unique(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bank_payments_user_id_idx").on(table.userId),
    index("bank_payments_variable_symbol_idx").on(table.variableSymbol),
    index("bank_payments_fio_transaction_id_idx").on(table.fioTransactionId),
  ],
);
```

**Step 2: Add relations**

In `src/server/db/schema/relations.ts`, add:

```typescript
import { subscriptions, bankPayments } from "./subscriptions";

// Add to existing usersRelations:
// subscriptions: many(subscriptions),
// bankPayments: many(bankPayments),

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const bankPaymentsRelations = relations(bankPayments, ({ one }) => ({
  user: one(users, {
    fields: [bankPayments.userId],
    references: [users.id],
  }),
}));
```

**Step 3: Export from schema index**

Ensure `subscriptions.ts` is exported from the schema barrel file (if one exists), or add the import to `relations.ts` and any schema index.

**Step 4: Push schema to DB**

Run: `yarn db:push`
Expected: Tables `subscriptions` and `bank_payments` created

**Step 5: Commit**

```bash
git add src/server/db/schema/subscriptions.ts src/server/db/schema/relations.ts
git commit -m "feat: add subscriptions and bank_payments DB schema"
```

---

### Task 3: Database Schema — Task Attachments

**Files:**
- Create: `src/server/db/schema/attachments.ts`
- Modify: `src/server/db/schema/relations.ts`

**Step 1: Create attachments schema**

Create `src/server/db/schema/attachments.ts`:

```typescript
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    blobUrl: text("blob_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("task_attachments_task_id_idx").on(table.taskId)],
);
```

**Step 2: Add relations in `relations.ts`**

```typescript
import { taskAttachments } from "./attachments";

// Add to existing tasksRelations:
// attachments: many(taskAttachments),

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
}));
```

**Step 3: Push schema to DB**

Run: `yarn db:push`
Expected: Table `task_attachments` created

**Step 4: Commit**

```bash
git add src/server/db/schema/attachments.ts src/server/db/schema/relations.ts
git commit -m "feat: add task_attachments DB schema"
```

---

### Task 4: Domain Entities — Subscription, BankPayment, TaskAttachment

**Files:**
- Create: `src/domain/entities/subscription.ts`
- Create: `src/domain/entities/bank-payment.ts`
- Create: `src/domain/entities/task-attachment.ts`

**Step 1: Create Subscription entity**

Create `src/domain/entities/subscription.ts`:

```typescript
export interface Subscription {
  id: string;
  userId: string;
  status: "active" | "canceled" | "past_due" | "expired";
  plan: "monthly" | "yearly";
  paymentMethod: "stripe" | "bank_transfer";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  userId: string;
  plan: "monthly" | "yearly";
  paymentMethod: "stripe" | "bank_transfer";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}
```

**Step 2: Create BankPayment entity**

Create `src/domain/entities/bank-payment.ts`:

```typescript
export interface BankPayment {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  variableSymbol: string;
  fioTransactionId: string;
  receivedAt: Date;
  createdAt: Date;
}
```

**Step 3: Create TaskAttachment entity**

Create `src/domain/entities/task-attachment.ts`:

```typescript
export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blobUrl: string;
  createdAt: Date;
}

export interface CreateAttachmentInput {
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blobUrl: string;
}
```

**Step 4: Commit**

```bash
git add src/domain/entities/subscription.ts src/domain/entities/bank-payment.ts src/domain/entities/task-attachment.ts
git commit -m "feat: add Subscription, BankPayment, TaskAttachment domain entities"
```

---

### Task 5: Domain Repositories — Subscription & Attachment

**Files:**
- Create: `src/domain/repositories/subscription.repository.ts`
- Create: `src/domain/repositories/attachment.repository.ts`

**Step 1: Create ISubscriptionRepository**

Create `src/domain/repositories/subscription.repository.ts`:

```typescript
import type { Subscription, CreateSubscriptionInput } from "../entities/subscription";

export interface ISubscriptionRepository {
  findActiveByUser(userId: string): Promise<Subscription | undefined>;
  findByStripeCustomerId(customerId: string): Promise<Subscription | undefined>;
  findByStripeSubscriptionId(subscriptionId: string): Promise<Subscription | undefined>;
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  updateStatus(
    id: string,
    status: Subscription["status"],
    periodEnd?: Date,
  ): Promise<Subscription>;
  updateStripeIds(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<Subscription>;
}
```

**Step 2: Create IAttachmentRepository**

Create `src/domain/repositories/attachment.repository.ts`:

```typescript
import type { TaskAttachment, CreateAttachmentInput } from "../entities/task-attachment";

export interface IAttachmentRepository {
  findByTaskId(taskId: string): Promise<TaskAttachment[]>;
  findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAttachment[]>>;
  findById(id: string): Promise<TaskAttachment | undefined>;
  create(input: CreateAttachmentInput): Promise<TaskAttachment>;
  delete(id: string): Promise<void>;
  getTotalSizeByUser(userId: string): Promise<number>;
}
```

**Step 3: Commit**

```bash
git add src/domain/repositories/subscription.repository.ts src/domain/repositories/attachment.repository.ts
git commit -m "feat: add subscription and attachment repository interfaces"
```

---

### Task 6: Domain Service — SubscriptionService

**Files:**
- Create: `src/domain/services/subscription.service.ts`
- Test: `src/domain/services/__tests__/subscription.service.test.ts`

**Step 1: Write the failing test**

Create `src/domain/services/__tests__/subscription.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionService } from "../subscription.service";
import type { ISubscriptionRepository } from "../../repositories/subscription.repository";
import type { Subscription } from "../../entities/subscription";

function mockRepo(): ISubscriptionRepository {
  return {
    findActiveByUser: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    findByStripeSubscriptionId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateStripeIds: vi.fn(),
  };
}

function activeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    userId: "user-1",
    status: "active",
    plan: "monthly",
    paymentMethod: "stripe",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    currentPeriodStart: new Date("2026-03-01"),
    currentPeriodEnd: new Date("2026-04-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SubscriptionService", () => {
  let repo: ISubscriptionRepository;
  let service: SubscriptionService;

  beforeEach(() => {
    repo = mockRepo();
    service = new SubscriptionService(repo);
  });

  describe("isPremium", () => {
    it("returns true when user has active subscription with future periodEnd", async () => {
      const sub = activeSubscription({
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });
      vi.mocked(repo.findActiveByUser).mockResolvedValue(sub);

      const result = await service.isPremium("user-1");
      expect(result).toBe(true);
    });

    it("returns false when no subscription exists", async () => {
      vi.mocked(repo.findActiveByUser).mockResolvedValue(undefined);

      const result = await service.isPremium("user-1");
      expect(result).toBe(false);
    });

    it("returns false when subscription period has ended", async () => {
      const sub = activeSubscription({
        currentPeriodEnd: new Date(Date.now() - 86400000),
      });
      vi.mocked(repo.findActiveByUser).mockResolvedValue(sub);

      const result = await service.isPremium("user-1");
      expect(result).toBe(false);
    });
  });

  describe("activateBankTransfer", () => {
    it("creates monthly subscription for 49 CZK", async () => {
      const sub = activeSubscription({ paymentMethod: "bank_transfer" });
      vi.mocked(repo.create).mockResolvedValue(sub);

      await service.activateBankTransfer("user-1", 49);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          plan: "monthly",
          paymentMethod: "bank_transfer",
        }),
      );
    });

    it("creates yearly subscription for 490 CZK", async () => {
      const sub = activeSubscription({ paymentMethod: "bank_transfer", plan: "yearly" });
      vi.mocked(repo.create).mockResolvedValue(sub);

      await service.activateBankTransfer("user-1", 490);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          plan: "yearly",
          paymentMethod: "bank_transfer",
        }),
      );
    });

    it("throws for invalid amount", async () => {
      await expect(service.activateBankTransfer("user-1", 100)).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/subscription.service.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement SubscriptionService**

Create `src/domain/services/subscription.service.ts`:

```typescript
import type { Subscription } from "../entities/subscription";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";

const MONTHLY_CZK = 49;
const YEARLY_CZK = 490;

export class SubscriptionService {
  constructor(private readonly subscriptionRepo: ISubscriptionRepository) {}

  async isPremium(userId: string): Promise<boolean> {
    const sub = await this.subscriptionRepo.findActiveByUser(userId);
    if (!sub) return false;
    return sub.currentPeriodEnd > new Date();
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    return this.subscriptionRepo.findActiveByUser(userId);
  }

  async activateBankTransfer(userId: string, amountCzk: number): Promise<Subscription> {
    let plan: "monthly" | "yearly";
    if (amountCzk === MONTHLY_CZK) {
      plan = "monthly";
    } else if (amountCzk === YEARLY_CZK) {
      plan = "yearly";
    } else {
      throw new Error(`Invalid payment amount: ${amountCzk} CZK`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    return this.subscriptionRepo.create({
      userId,
      plan,
      paymentMethod: "bank_transfer",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  }

  async handleStripeSubscriptionUpdate(
    stripeSubscriptionId: string,
    status: Subscription["status"],
    periodEnd: Date,
  ): Promise<void> {
    const sub = await this.subscriptionRepo.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!sub) return;
    await this.subscriptionRepo.updateStatus(sub.id, status, periodEnd);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test src/domain/services/__tests__/subscription.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/services/subscription.service.ts src/domain/services/__tests__/subscription.service.test.ts
git commit -m "feat: add SubscriptionService with isPremium and bank transfer activation"
```

---

### Task 7: Domain Service — AttachmentService

**Files:**
- Create: `src/domain/services/attachment.service.ts`
- Test: `src/domain/services/__tests__/attachment.service.test.ts`

**Step 1: Write the failing test**

Create `src/domain/services/__tests__/attachment.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttachmentService } from "../attachment.service";
import type { IAttachmentRepository } from "../../repositories/attachment.repository";
import type { ITaskRepository } from "../../repositories/task.repository";
import type { ISubscriptionRepository } from "../../repositories/subscription.repository";
import type { Subscription } from "../../entities/subscription";

function mockAttachmentRepo(): IAttachmentRepository {
  return {
    findByTaskId: vi.fn().mockResolvedValue([]),
    findByTaskIds: vi.fn().mockResolvedValue(new Map()),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getTotalSizeByUser: vi.fn().mockResolvedValue(0),
  };
}

function mockTaskRepo(): Partial<ITaskRepository> {
  return {
    findById: vi.fn(),
  };
}

function mockSubRepo(): ISubscriptionRepository {
  return {
    findActiveByUser: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    findByStripeSubscriptionId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateStripeIds: vi.fn(),
  };
}

function premiumSub(): Subscription {
  return {
    id: "sub-1",
    userId: "user-1",
    status: "active",
    plan: "monthly",
    paymentMethod: "stripe",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("AttachmentService", () => {
  let attachmentRepo: IAttachmentRepository;
  let taskRepo: Partial<ITaskRepository>;
  let subRepo: ISubscriptionRepository;
  let service: AttachmentService;

  beforeEach(() => {
    attachmentRepo = mockAttachmentRepo();
    taskRepo = mockTaskRepo();
    subRepo = mockSubRepo();
    service = new AttachmentService(
      attachmentRepo,
      taskRepo as ITaskRepository,
      subRepo,
    );
  });

  describe("getByTaskId", () => {
    it("returns attachments for any user (free or premium)", async () => {
      const attachments = [
        { id: "a1", taskId: "t1", fileName: "test.pdf", fileSize: 1000, mimeType: "application/pdf", blobUrl: "https://blob/test.pdf", createdAt: new Date() },
      ];
      vi.mocked(attachmentRepo.findByTaskId).mockResolvedValue(attachments);
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });

      const result = await service.getByTaskId("t1", "user-1");
      expect(result).toEqual(attachments);
    });

    it("throws when task doesn't belong to user", async () => {
      vi.mocked(taskRepo.findById as any).mockResolvedValue(undefined);

      await expect(service.getByTaskId("t1", "user-1")).rejects.toThrow("Task not found");
    });
  });

  describe("upload", () => {
    it("throws when user is not premium", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });

      await expect(
        service.upload("user-1", {
          taskId: "t1",
          fileName: "test.pdf",
          fileSize: 1000,
          mimeType: "application/pdf",
          blobUrl: "https://blob/test.pdf",
        }),
      ).rejects.toThrow("Premium subscription required");
    });

    it("throws when file exceeds 10 MB", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(premiumSub());
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });

      await expect(
        service.upload("user-1", {
          taskId: "t1",
          fileName: "large.bin",
          fileSize: 11 * 1024 * 1024,
          mimeType: "application/octet-stream",
          blobUrl: "https://blob/large.bin",
        }),
      ).rejects.toThrow("File size exceeds 10 MB");
    });

    it("throws when total storage exceeds 1 GB", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(premiumSub());
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });
      vi.mocked(attachmentRepo.getTotalSizeByUser).mockResolvedValue(1024 * 1024 * 1024);

      await expect(
        service.upload("user-1", {
          taskId: "t1",
          fileName: "test.pdf",
          fileSize: 1000,
          mimeType: "application/pdf",
          blobUrl: "https://blob/test.pdf",
        }),
      ).rejects.toThrow("Storage limit exceeded");
    });

    it("creates attachment when premium and within limits", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(premiumSub());
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });
      vi.mocked(attachmentRepo.getTotalSizeByUser).mockResolvedValue(0);
      const attachment = {
        id: "a1", taskId: "t1", fileName: "test.pdf", fileSize: 1000,
        mimeType: "application/pdf", blobUrl: "https://blob/test.pdf", createdAt: new Date(),
      };
      vi.mocked(attachmentRepo.create).mockResolvedValue(attachment);

      const result = await service.upload("user-1", {
        taskId: "t1",
        fileName: "test.pdf",
        fileSize: 1000,
        mimeType: "application/pdf",
        blobUrl: "https://blob/test.pdf",
      });
      expect(result).toEqual(attachment);
    });
  });

  describe("download", () => {
    it("throws when user is not premium", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(undefined);
      vi.mocked(attachmentRepo.findById).mockResolvedValue({
        id: "a1", taskId: "t1", fileName: "test.pdf", fileSize: 1000,
        mimeType: "application/pdf", blobUrl: "https://blob/test.pdf", createdAt: new Date(),
      });
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });

      await expect(service.download("a1", "user-1")).rejects.toThrow("Premium subscription required");
    });

    it("returns blob URL when premium", async () => {
      vi.mocked(subRepo.findActiveByUser).mockResolvedValue(premiumSub());
      vi.mocked(attachmentRepo.findById).mockResolvedValue({
        id: "a1", taskId: "t1", fileName: "test.pdf", fileSize: 1000,
        mimeType: "application/pdf", blobUrl: "https://blob/test.pdf", createdAt: new Date(),
      });
      vi.mocked(taskRepo.findById as any).mockResolvedValue({ id: "t1", userId: "user-1" });

      const url = await service.download("a1", "user-1");
      expect(url).toBe("https://blob/test.pdf");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test src/domain/services/__tests__/attachment.service.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement AttachmentService**

Create `src/domain/services/attachment.service.ts`:

```typescript
import type { TaskAttachment, CreateAttachmentInput } from "../entities/task-attachment";
import type { IAttachmentRepository } from "../repositories/attachment.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { ISubscriptionRepository } from "../repositories/subscription.repository";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_STORAGE = 1024 * 1024 * 1024; // 1 GB

export class AttachmentService {
  constructor(
    private readonly attachmentRepo: IAttachmentRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
  ) {}

  private async isPremium(userId: string): Promise<boolean> {
    const sub = await this.subscriptionRepo.findActiveByUser(userId);
    if (!sub) return false;
    return sub.currentPeriodEnd > new Date();
  }

  private async verifyTaskOwnership(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");
  }

  async getByTaskId(taskId: string, userId: string): Promise<TaskAttachment[]> {
    await this.verifyTaskOwnership(taskId, userId);
    return this.attachmentRepo.findByTaskId(taskId);
  }

  async upload(userId: string, input: CreateAttachmentInput): Promise<TaskAttachment> {
    await this.verifyTaskOwnership(input.taskId, userId);

    if (!(await this.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    if (input.fileSize > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 10 MB");
    }

    const totalSize = await this.attachmentRepo.getTotalSizeByUser(userId);
    if (totalSize + input.fileSize > MAX_TOTAL_STORAGE) {
      throw new Error("Storage limit exceeded");
    }

    return this.attachmentRepo.create(input);
  }

  async download(attachmentId: string, userId: string): Promise<string> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    await this.verifyTaskOwnership(attachment.taskId, userId);

    if (!(await this.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    return attachment.blobUrl;
  }

  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    await this.verifyTaskOwnership(attachment.taskId, userId);

    if (!(await this.isPremium(userId))) {
      throw new Error("Premium subscription required");
    }

    await this.attachmentRepo.delete(attachmentId);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/services/__tests__/attachment.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/services/attachment.service.ts src/domain/services/__tests__/attachment.service.test.ts
git commit -m "feat: add AttachmentService with premium gating and storage limits"
```

---

### Task 8: Infrastructure — Drizzle Repository Implementations

**Files:**
- Create: `src/infrastructure/persistence/drizzle-subscription.repository.ts`
- Create: `src/infrastructure/persistence/drizzle-attachment.repository.ts`

**Step 1: Implement DrizzleSubscriptionRepository**

Create `src/infrastructure/persistence/drizzle-subscription.repository.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import type { ISubscriptionRepository } from "@/domain/repositories/subscription.repository";
import type { Subscription, CreateSubscriptionInput } from "@/domain/entities/subscription";
import { subscriptions } from "@/server/db/schema/subscriptions";
import type { Database } from "@/server/db";

export class DrizzleSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: Database) {}

  async findActiveByUser(userId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
      ),
    });
  }

  async findByStripeCustomerId(customerId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeCustomerId, customerId),
    });
  }

  async findByStripeSubscriptionId(subscriptionId: string): Promise<Subscription | undefined> {
    return this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, subscriptionId),
    });
  }

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const [sub] = await this.db
      .insert(subscriptions)
      .values(input)
      .returning();
    return sub;
  }

  async updateStatus(
    id: string,
    status: Subscription["status"],
    periodEnd?: Date,
  ): Promise<Subscription> {
    const data: Record<string, unknown> = { status };
    if (periodEnd) data.currentPeriodEnd = periodEnd;

    const [sub] = await this.db
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.id, id))
      .returning();
    return sub;
  }

  async updateStripeIds(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<Subscription> {
    const [sub] = await this.db
      .update(subscriptions)
      .set({ stripeCustomerId, stripeSubscriptionId })
      .where(eq(subscriptions.id, id))
      .returning();
    return sub;
  }
}
```

**Step 2: Implement DrizzleAttachmentRepository**

Create `src/infrastructure/persistence/drizzle-attachment.repository.ts`:

```typescript
import { eq, inArray, sql, asc } from "drizzle-orm";
import type { IAttachmentRepository } from "@/domain/repositories/attachment.repository";
import type { TaskAttachment, CreateAttachmentInput } from "@/domain/entities/task-attachment";
import { taskAttachments } from "@/server/db/schema/attachments";
import { tasks } from "@/server/db/schema/tasks";
import type { Database } from "@/server/db";

export class DrizzleAttachmentRepository implements IAttachmentRepository {
  constructor(private readonly db: Database) {}

  async findByTaskId(taskId: string): Promise<TaskAttachment[]> {
    return this.db.query.taskAttachments.findMany({
      where: eq(taskAttachments.taskId, taskId),
      orderBy: asc(taskAttachments.createdAt),
    });
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, TaskAttachment[]>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.db.query.taskAttachments.findMany({
      where: inArray(taskAttachments.taskId, taskIds),
      orderBy: asc(taskAttachments.createdAt),
    });
    const map = new Map<string, TaskAttachment[]>();
    for (const id of taskIds) map.set(id, []);
    for (const row of rows) map.get(row.taskId)!.push(row);
    return map;
  }

  async findById(id: string): Promise<TaskAttachment | undefined> {
    return this.db.query.taskAttachments.findFirst({
      where: eq(taskAttachments.id, id),
    });
  }

  async create(input: CreateAttachmentInput): Promise<TaskAttachment> {
    const [attachment] = await this.db
      .insert(taskAttachments)
      .values(input)
      .returning();
    return attachment;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(taskAttachments).where(eq(taskAttachments.id, id));
  }

  async getTotalSizeByUser(userId: string): Promise<number> {
    const result = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${taskAttachments.fileSize}), 0)` })
      .from(taskAttachments)
      .innerJoin(tasks, eq(taskAttachments.taskId, tasks.id))
      .where(eq(tasks.userId, userId));
    return Number(result[0]?.total ?? 0);
  }
}
```

**Step 3: Commit**

```bash
git add src/infrastructure/persistence/drizzle-subscription.repository.ts src/infrastructure/persistence/drizzle-attachment.repository.ts
git commit -m "feat: add Drizzle implementations for subscription and attachment repositories"
```

---

### Task 9: Wire Up Container

**Files:**
- Modify: `src/infrastructure/container.ts`

**Step 1: Add new repos and services to container**

Add to `src/infrastructure/container.ts`:

```typescript
import { DrizzleSubscriptionRepository } from "./persistence/drizzle-subscription.repository";
import { DrizzleAttachmentRepository } from "./persistence/drizzle-attachment.repository";
import { SubscriptionService } from "@/domain/services/subscription.service";
import { AttachmentService } from "@/domain/services/attachment.service";

// In repos section:
const subscriptionRepo = new DrizzleSubscriptionRepository(db);
const attachmentRepo = new DrizzleAttachmentRepository(db);

// In services section:
const subscriptionService = new SubscriptionService(subscriptionRepo);
const attachmentService = new AttachmentService(attachmentRepo, taskRepo, subscriptionRepo);

// Add to exports:
export const repos = {
  // ... existing repos
  subscription: subscriptionRepo,
  attachment: attachmentRepo,
};

export const services = {
  // ... existing services
  subscription: subscriptionService,
  attachment: attachmentService,
};
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/infrastructure/container.ts
git commit -m "feat: wire subscription and attachment repos/services into container"
```

---

### Task 10: GraphQL — Subscription Type & Mutations

**Files:**
- Modify: `src/server/graphql/types/refs.ts`
- Create: `src/server/graphql/types/subscription.ts`
- Modify: `src/server/graphql/schema.ts`
- Modify: `src/server/graphql/types/user.ts`

**Step 1: Add SubscriptionRef to refs.ts**

In `src/server/graphql/types/refs.ts`, add:

```typescript
import type { Subscription } from "@/domain/entities/subscription";

export const SubscriptionRef = builder.objectRef<Subscription>("Subscription");
```

**Step 2: Create subscription GraphQL type**

Create `src/server/graphql/types/subscription.ts`:

```typescript
import { builder } from "../builder";
import { SubscriptionRef } from "./refs";

export const SubscriptionType = SubscriptionRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    status: t.exposeString("status"),
    plan: t.exposeString("plan"),
    paymentMethod: t.exposeString("paymentMethod"),
    currentPeriodEnd: t.field({
      type: "String",
      resolve: (sub) => sub.currentPeriodEnd.toISOString(),
    }),
    createdAt: t.field({
      type: "String",
      resolve: (sub) => sub.createdAt.toISOString(),
    }),
  }),
});

// Query: get current subscription
builder.queryField("subscription", (t) =>
  t.field({
    type: SubscriptionRef,
    nullable: true,
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.subscription.getSubscription(ctx.userId!);
    },
  }),
);

// Mutation: create Stripe checkout session
builder.mutationField("createCheckoutSession", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      plan: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price:
              args.plan === "yearly"
                ? process.env.STRIPE_PRICE_YEARLY_ID!
                : process.env.STRIPE_PRICE_MONTHLY_ID!,
            quantity: 1,
          },
        ],
        metadata: { userId: ctx.userId! },
        success_url: `${process.env.AUTH_URL}/settings?checkout=success`,
        cancel_url: `${process.env.AUTH_URL}/settings?checkout=cancel`,
        automatic_tax: { enabled: true },
      });

      return session.url;
    },
  }),
);

// Mutation: create Stripe customer portal session
builder.mutationField("createCustomerPortalSession", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      const sub = await ctx.services.subscription.getSubscription(ctx.userId!);
      if (!sub?.stripeCustomerId) {
        throw new Error("No Stripe subscription found");
      }

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${process.env.AUTH_URL}/settings`,
      });

      return session.url;
    },
  }),
);

// Mutation: generate bank transfer QR data
builder.mutationField("generateBankTransferQR", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      plan: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const amount = args.plan === "yearly" ? 490 : 49;
      const accountNumber = process.env.FIO_ACCOUNT_NUMBER!;
      const userId = ctx.userId!;

      // SPAYD format: https://qr-platba.cz/pro-vyvojare/specifikace-formatu/
      const spayd = [
        "SPD*1.0",
        `ACC:${accountNumber}`,
        `AM:${amount}.00`,
        "CC:CZK",
        `X-VS:${userId.replace(/-/g, "").slice(0, 10)}`,
        "MSG:SweptMind Premium",
      ].join("*");

      const QRCode = (await import("qrcode")).default;
      return QRCode.toDataURL(spayd);
    },
  }),
);
```

**Step 3: Add isPremium to User type**

In `src/server/graphql/types/user.ts`, add a field:

```typescript
isPremium: t.field({
  type: "Boolean",
  resolve: async (user, _args, ctx) => {
    return ctx.services.subscription.isPremium(user.id);
  },
}),
```

**Step 4: Register in schema.ts**

In `src/server/graphql/schema.ts`, add:

```typescript
import "./types/subscription";
```

**Step 5: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/graphql/types/refs.ts src/server/graphql/types/subscription.ts src/server/graphql/schema.ts src/server/graphql/types/user.ts
git commit -m "feat: add subscription GraphQL type, checkout, portal, and QR mutations"
```

---

### Task 11: GraphQL — Attachment Type & Mutations

**Files:**
- Modify: `src/server/graphql/types/refs.ts`
- Create: `src/server/graphql/types/attachment.ts`
- Modify: `src/server/graphql/types/task.ts`
- Modify: `src/server/graphql/schema.ts`

**Step 1: Add AttachmentRef to refs.ts**

In `src/server/graphql/types/refs.ts`, add:

```typescript
import type { TaskAttachment } from "@/domain/entities/task-attachment";

export const AttachmentRef = builder.objectRef<TaskAttachment>("TaskAttachment");
```

**Step 2: Create attachment GraphQL type**

Create `src/server/graphql/types/attachment.ts`:

```typescript
import { builder } from "../builder";
import { AttachmentRef } from "./refs";

export const AttachmentType = AttachmentRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    taskId: t.exposeString("taskId"),
    fileName: t.exposeString("fileName"),
    fileSize: t.exposeInt("fileSize"),
    mimeType: t.exposeString("mimeType"),
    createdAt: t.field({
      type: "String",
      resolve: (a) => a.createdAt.toISOString(),
    }),
  }),
});

// Mutation: upload attachment (server-side Vercel Blob)
builder.mutationField("uploadAttachment", (t) =>
  t.field({
    type: AttachmentRef,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      fileName: t.arg.string({ required: true }),
      fileSize: t.arg.int({ required: true }),
      mimeType: t.arg.string({ required: true }),
      fileBase64: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { put } = await import("@vercel/blob");

      const buffer = Buffer.from(args.fileBase64, "base64");

      const blob = await put(
        `attachments/${ctx.userId}/${args.taskId}/${args.fileName}`,
        buffer,
        {
          access: "public",
          contentType: args.mimeType,
        },
      );

      return ctx.services.attachment.upload(ctx.userId!, {
        taskId: args.taskId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        blobUrl: blob.url,
      });
    },
  }),
);

// Mutation: delete attachment
builder.mutationField("deleteAttachment", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const attachment = await ctx.services.attachment.download(args.id, ctx.userId!);

      const { del } = await import("@vercel/blob");
      await del(attachment);

      await ctx.services.attachment.deleteAttachment(args.id, ctx.userId!);
      return true;
    },
  }),
);

// Query: download attachment URL
builder.queryField("attachmentDownloadUrl", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      return ctx.services.attachment.download(args.id, ctx.userId!);
    },
  }),
);
```

**Step 3: Add attachments field to Task type**

In `src/server/graphql/types/task.ts`, add a field to TaskType:

```typescript
attachments: t.field({
  type: [AttachmentRef],
  resolve: async (task, _args, ctx) => {
    return ctx.loaders.attachmentsByTaskId.load(task.id);
  },
}),
```

Add the dataloader in `src/server/graphql/context.ts`:

```typescript
attachmentsByTaskId: new DataLoader(async (taskIds: readonly string[]) => {
  const map = await repos.attachment.findByTaskIds([...taskIds]);
  return taskIds.map((id) => map.get(id) ?? []);
}),
```

**Step 4: Register in schema.ts**

In `src/server/graphql/schema.ts`, add:

```typescript
import "./types/attachment";
```

**Step 5: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/graphql/types/refs.ts src/server/graphql/types/attachment.ts src/server/graphql/types/task.ts src/server/graphql/schema.ts src/server/graphql/context.ts
git commit -m "feat: add attachment GraphQL type with upload, download, and delete mutations"
```

---

### Task 12: Stripe Webhook Handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Step 1: Create Stripe webhook route**

Create `src/app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { repos, services } from "@/infrastructure/container";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription || !session.customer) break;

      const stripeSubscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
      );

      const sub = await repos.subscription.create({
        userId,
        plan: stripeSubscription.items.data[0]?.plan?.interval === "year" ? "yearly" : "monthly",
        paymentMethod: "stripe",
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) break;

      const stripeSubscription = await stripe.subscriptions.retrieve(
        invoice.subscription as string,
      );

      await services.subscription.handleStripeSubscriptionUpdate(
        invoice.subscription as string,
        "active",
        new Date(stripeSubscription.current_period_end * 1000),
      );
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.cancel_at_period_end ? "canceled" : "active";

      await services.subscription.handleStripeSubscriptionUpdate(
        sub.id,
        status,
        new Date(sub.current_period_end * 1000),
      );
      break;
    }

    case "customer.subscription.deleted": {
      await services.subscription.handleStripeSubscriptionUpdate(
        (event.data.object as Stripe.Subscription).id,
        "expired",
        new Date(),
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: add Stripe webhook handler for subscription lifecycle"
```

---

### Task 13: FIO Bank Payment Cron Job

**Files:**
- Create: `src/app/api/cron/check-payments/route.ts`
- Modify: `vercel.json`

**Step 1: Create FIO cron route**

Create `src/app/api/cron/check-payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bankPayments } from "@/server/db/schema/subscriptions";
import { users } from "@/server/db/schema/auth";
import { eq } from "drizzle-orm";
import { services } from "@/infrastructure/container";

const FIO_API_BASE = "https://fioapi.fio.cz/v1/rest";
const MONTHLY_CZK = 49;
const YEARLY_CZK = 490;

interface FioTransaction {
  column22: { value: number; id: number }; // amount
  column0: { value: string }; // date
  column5: { value: string | null }; // variable symbol
  column17: { value: number }; // transaction ID
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.FIO_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "FIO_API_TOKEN not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${FIO_API_BASE}/last/${token}/transactions.json`);
    if (!res.ok) {
      return NextResponse.json({ error: "FIO API error" }, { status: 502 });
    }

    const data = await res.json();
    const transactions: FioTransaction[] =
      data?.accountStatement?.transactionList?.transaction ?? [];

    let processed = 0;

    for (const tx of transactions) {
      const amount = tx.column22?.value;
      const variableSymbol = tx.column5?.value;
      const fioTransactionId = String(tx.column17?.value);

      if (!variableSymbol || (amount !== MONTHLY_CZK && amount !== YEARLY_CZK)) {
        continue;
      }

      // Check if already processed
      const existing = await db.query.bankPayments.findFirst({
        where: eq(bankPayments.fioTransactionId, fioTransactionId),
      });
      if (existing) continue;

      // Find user by variable symbol (first 10 chars of UUID without dashes)
      const allUsers = await db.query.users.findMany();
      const matchedUser = allUsers.find(
        (u) => u.id.replace(/-/g, "").slice(0, 10) === variableSymbol,
      );
      if (!matchedUser) continue;

      // Record payment
      await db.insert(bankPayments).values({
        userId: matchedUser.id,
        amount: String(amount),
        currency: "CZK",
        variableSymbol,
        fioTransactionId,
        receivedAt: new Date(tx.column0.value),
      });

      // Activate subscription
      await services.subscription.activateBankTransfer(matchedUser.id, amount);
      processed++;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error("FIO cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

**Step 2: Add cron schedule to vercel.json**

In `vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/check-payments",
  "schedule": "*/30 * * * *"
}
```

This checks every 30 minutes.

**Step 3: Commit**

```bash
git add src/app/api/cron/check-payments/route.ts vercel.json
git commit -m "feat: add FIO bank payment cron job for CZK subscriptions"
```

---

### Task 14: Client GraphQL Operations

**Files:**
- Create: `src/graphql/queries/subscription.graphql`
- Create: `src/graphql/mutations/subscription.graphql`
- Create: `src/graphql/mutations/attachments.graphql`

**Step 1: Create subscription query**

Create `src/graphql/queries/subscription.graphql`:

```graphql
query GetSubscription {
  subscription {
    id
    status
    plan
    paymentMethod
    currentPeriodEnd
    createdAt
  }
}

query GetMe {
  me {
    id
    name
    email
    image
    isPremium
    createdAt
  }
}
```

Note: Update the existing `GetMe` query to include `isPremium`. If it already exists in `tasks.graphql`, modify it there instead.

**Step 2: Create subscription mutations**

Create `src/graphql/mutations/subscription.graphql`:

```graphql
mutation CreateCheckoutSession($plan: String!) {
  createCheckoutSession(plan: $plan)
}

mutation CreateCustomerPortalSession {
  createCustomerPortalSession
}

mutation GenerateBankTransferQR($plan: String!) {
  generateBankTransferQR(plan: $plan)
}
```

**Step 3: Create attachment mutations**

Create `src/graphql/mutations/attachments.graphql`:

```graphql
mutation UploadAttachment(
  $taskId: String!
  $fileName: String!
  $fileSize: Int!
  $mimeType: String!
  $fileBase64: String!
) {
  uploadAttachment(
    taskId: $taskId
    fileName: $fileName
    fileSize: $fileSize
    mimeType: $mimeType
    fileBase64: $fileBase64
  ) {
    id
    taskId
    fileName
    fileSize
    mimeType
    createdAt
  }
}

mutation DeleteAttachment($id: String!) {
  deleteAttachment(id: $id)
}

query AttachmentDownloadUrl($id: String!) {
  attachmentDownloadUrl(id: $id)
}
```

**Step 4: Generate TypeScript types**

Run: `yarn codegen`
Expected: PASS

**Step 5: Commit**

```bash
git add src/graphql/queries/subscription.graphql src/graphql/mutations/subscription.graphql src/graphql/mutations/attachments.graphql
git commit -m "feat: add client GraphQL operations for subscriptions and attachments"
```

---

### Task 15: i18n — Translation Keys

**Files:**
- Modify: `src/lib/i18n/types.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`

**Step 1: Add translation keys to types**

In `src/lib/i18n/types.ts`, add a new section to `Dictionary`:

```typescript
premium: {
  title: string;
  subtitle: string;
  currentPlan: string;
  freePlan: string;
  premiumPlan: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyDiscount: string;
  upgrade: string;
  manageSubscription: string;
  cancelledInfo: string;
  features: string;
  attachments: string;
  attachmentsDesc: string;
  payByCard: string;
  payByTransfer: string;
  scanQR: string;
  scanQRDesc: string;
  uploadFile: string;
  deleteFile: string;
  downloadFile: string;
  premiumRequired: string;
  premiumRequiredDesc: string;
  storageUsed: string;
  fileTooLarge: string;
  storageFull: string;
};
```

**Step 2: Add English translations**

In `src/lib/i18n/dictionaries/en.ts`:

```typescript
premium: {
  title: "Premium",
  subtitle: "Unlock advanced features",
  currentPlan: "Current plan",
  freePlan: "Free",
  premiumPlan: "Premium",
  monthlyPrice: "€2/month",
  yearlyPrice: "€20/year",
  yearlyDiscount: "2 months free",
  upgrade: "Upgrade to Premium",
  manageSubscription: "Manage subscription",
  cancelledInfo: "Your subscription ends on {date}",
  features: "Premium features",
  attachments: "File attachments",
  attachmentsDesc: "Attach files to your tasks (up to 10 MB each, 1 GB total)",
  payByCard: "Pay by card",
  payByTransfer: "Pay by bank transfer",
  scanQR: "Scan QR code",
  scanQRDesc: "Scan with your banking app to pay",
  uploadFile: "Add attachment",
  deleteFile: "Delete",
  downloadFile: "Download",
  premiumRequired: "Premium feature",
  premiumRequiredDesc: "Upgrade to Premium to upload and download attachments",
  storageUsed: "{used} of {total} used",
  fileTooLarge: "File is too large (max 10 MB)",
  storageFull: "Storage limit reached (1 GB)",
},
```

**Step 3: Add Czech translations**

In `src/lib/i18n/dictionaries/cs.ts`:

```typescript
premium: {
  title: "Premium",
  subtitle: "Odemkněte pokročilé funkce",
  currentPlan: "Aktuální plán",
  freePlan: "Zdarma",
  premiumPlan: "Premium",
  monthlyPrice: "49 Kč/měsíc",
  yearlyPrice: "490 Kč/rok",
  yearlyDiscount: "2 měsíce zdarma",
  upgrade: "Upgradovat na Premium",
  manageSubscription: "Spravovat předplatné",
  cancelledInfo: "Vaše předplatné končí {date}",
  features: "Premium funkce",
  attachments: "Přílohy souborů",
  attachmentsDesc: "Přikládejte soubory k úkolům (max 10 MB na soubor, 1 GB celkem)",
  payByCard: "Platba kartou",
  payByTransfer: "Platba převodem",
  scanQR: "Naskenujte QR kód",
  scanQRDesc: "Naskenujte v bankovní aplikaci",
  uploadFile: "Přidat přílohu",
  deleteFile: "Smazat",
  downloadFile: "Stáhnout",
  premiumRequired: "Premium funkce",
  premiumRequiredDesc: "Upgradujte na Premium pro nahrávání a stahování příloh",
  storageUsed: "{used} z {total} využito",
  fileTooLarge: "Soubor je příliš velký (max 10 MB)",
  storageFull: "Úložiště je plné (1 GB)",
},
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/en.ts src/lib/i18n/dictionaries/cs.ts
git commit -m "feat: add i18n translations for premium features"
```

---

### Task 16: UI — Premium Section in Settings

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add premium/subscription management section**

Add a new section to the Settings page (before the existing sections) that shows:

- **Free users:** "Upgrade to Premium" card with:
  - Feature list (attachments)
  - Price options: monthly / yearly with discount badge
  - Two payment buttons: "Pay by card" (Stripe Checkout) / "Pay by transfer" (shows QR)
  - QR code modal when bank transfer selected

- **Premium users:** Subscription status card with:
  - Current plan + expiry date
  - "Manage subscription" button (Stripe Portal) or renewal info for bank transfers
  - Storage usage bar

Use the `useGetSubscriptionQuery` and `useCreateCheckoutSessionMutation` from generated types.

Pattern to follow: Look at existing Settings sections for layout patterns (labels, buttons, descriptions). Use `useTranslations()` for all strings. Use `useMutation` with loading states.

**Step 2: Run typecheck and dev server**

Run: `yarn typecheck`
Run: `yarn dev` and test in browser

**Step 3: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat: add premium subscription section to settings page"
```

---

### Task 17: UI — Attachments in Task Detail Panel

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Step 1: Add attachments section to task detail panel**

Add a new section in the task detail panel (after notes, before steps or after tags) that shows:

- **List of existing attachments:** File icon (based on mimeType), fileName, fileSize (formatted), delete button (premium only)
- **Upload button:** "Add attachment" with file input (premium only). Convert file to base64, call `uploadAttachment` mutation.
- **Download:** Click on attachment name to download (premium only). Calls `attachmentDownloadUrl` query, then `window.open(url)`.
- **Free user overlay:** When not premium, show the list of attachments (greyed out) with a lock icon and "Upgrade to Premium" CTA link to `/settings`.

Use drag & drop with `onDrop` handler + hidden `<input type="file">` for upload.

Pattern: Follow existing task-detail-panel sections (notes, steps, tags) for layout. Use `useTranslations()` for strings. Use Apollo `useMutation` with optimistic updates for upload/delete.

The `attachments` field is already on the Task type (added in Task 11), so it comes with the task query automatically.

**Step 2: Run typecheck and dev server**

Run: `yarn typecheck`
Run: `yarn dev` and test in browser

**Step 3: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx
git commit -m "feat: add file attachments UI to task detail panel"
```

---

### Task 18: Attachment Icon in Task List

**Files:**
- Modify: `src/components/tasks/task-item.tsx`

**Step 1: Add attachment indicator**

In the task item component, add a small paperclip icon (from Lucide: `Paperclip`) next to the task title when the task has attachments (`task.attachments.length > 0`).

```typescript
import { Paperclip } from "lucide-react";

// In the task item render, near the title:
{task.attachments && task.attachments.length > 0 && (
  <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
)}
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/tasks/task-item.tsx
git commit -m "feat: show paperclip icon on tasks with attachments"
```

---

### Task 19: Update TaskFields Fragment

**Files:**
- Modify: `src/graphql/queries/tasks.graphql`

**Step 1: Add attachments to TaskFields fragment**

In the `TaskFields` fragment, add:

```graphql
fragment TaskFields on Task {
  # ... existing fields
  attachments {
    id
    taskId
    fileName
    fileSize
    mimeType
    createdAt
  }
}
```

**Step 2: Regenerate types**

Run: `yarn codegen`
Expected: PASS

**Step 3: Commit**

```bash
git add src/graphql/queries/tasks.graphql
git commit -m "feat: add attachments to TaskFields GraphQL fragment"
```

---

### Task 20: Update GetMe Query with isPremium

**Files:**
- Modify: `src/graphql/queries/tasks.graphql` (or wherever GetMe is defined)

**Step 1: Add isPremium to GetMe**

```graphql
query GetMe {
  me {
    id
    name
    email
    image
    isPremium
    createdAt
  }
}
```

**Step 2: Regenerate types**

Run: `yarn codegen`
Expected: PASS

**Step 3: Commit**

```bash
git add src/graphql/queries/tasks.graphql
git commit -m "feat: add isPremium to GetMe query"
```

---

### Task 21: Environment Variables & Documentation

**Files:**
- Modify: `CLAUDE.md` (env section)

**Step 1: Update CLAUDE.md env section**

Add to the env section in `CLAUDE.md`:

```
STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRICE_MONTHLY_ID, STRIPE_PRICE_YEARLY_ID,
FIO_API_TOKEN, FIO_ACCOUNT_NUMBER
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Stripe and FIO env variables to CLAUDE.md"
```

---

### Task 22: Final Integration Test

**Step 1: Run full check suite**

Run: `yarn check`
Expected: lint, format, typecheck, tests all PASS

**Step 2: Test manually in dev**

Run: `yarn dev`

Test flow:
1. Open Settings → see Premium section with upgrade options
2. Free user: open task detail → see "Premium required" on attachments
3. (After Stripe setup) Checkout flow → becomes premium → upload file → see in task list → download
4. (After FIO setup) QR code displays → scan → cron processes → premium activated

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for premium features"
```
