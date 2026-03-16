# Google Calendar Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bidirectional synchronization of tasks with Google Calendar — push task changes to Google Calendar events, pull Google Calendar changes back to tasks via webhooks.

**Architecture:** Direct Google Calendar API integration. OAuth re-consent adds `calendar.events` scope. A new `GoogleCalendarService` handles all API calls (token refresh, event CRUD). Push is triggered fire-and-forget from `task.service.ts` after create/update/delete. Pull uses Google Push Notifications (webhooks) with incremental `syncToken`. Watch channels are registered when sync is enabled and renewed via cron.

**Tech Stack:** Next.js 16, Drizzle ORM (PostgreSQL), Pothos GraphQL, Apollo Client v4, Auth.js v5 (Google OAuth), Vitest, Google Calendar API v3

---

## Task 1: DB Schema — Add Google Calendar Columns

**Files:**
- Modify: `src/server/db/schema/auth.ts`
- Modify: `src/server/db/schema/calendar-sync.ts`

**Step 1: Add columns to users table**

In `src/server/db/schema/auth.ts`, add these columns to the `users` table definition (after `calendarSyncDateRange`):

```typescript
googleCalendarEnabled: boolean("google_calendar_enabled").notNull().default(false),
googleCalendarDirection: text("google_calendar_direction").default("both"), // 'both' | 'push' | 'pull'
googleCalendarId: text("google_calendar_id").default("primary"),
googleCalendarSyncToken: text("google_calendar_sync_token"),
googleCalendarChannelId: text("google_calendar_channel_id"),
googleCalendarChannelExpiry: timestamp("google_calendar_channel_expiry", { mode: "date" }),
```

**Step 2: Add column to calendar_sync table**

In `src/server/db/schema/calendar-sync.ts`, add after the `etag` column:

```typescript
googleCalendarEventId: text("google_calendar_event_id"),
```

**Step 3: Push schema to local DB**

Run: `yarn db:push`
Expected: Schema changes applied successfully

**Step 4: Commit**

```bash
git add src/server/db/schema/auth.ts src/server/db/schema/calendar-sync.ts
git commit -m "feat(gcal): add google calendar columns to users and calendar_sync"
```

---

## Task 2: Domain Entities — Extend User and CalendarSync

**Files:**
- Modify: `src/domain/entities/user.ts`
- Modify: `src/domain/entities/calendar-sync.ts`

**Step 1: Extend User entity**

In `src/domain/entities/user.ts`, add to the `User` interface (after `calendarSyncDateRange`):

```typescript
googleCalendarEnabled: boolean;
googleCalendarDirection: string | null;
googleCalendarId: string | null;
googleCalendarSyncToken: string | null;
googleCalendarChannelId: string | null;
googleCalendarChannelExpiry: Date | null;
```

**Step 2: Extend CalendarSync entity**

In `src/domain/entities/calendar-sync.ts`, add to the `CalendarSync` interface:

```typescript
googleCalendarEventId: string | null;
```

**Step 3: Update all test helpers that create User or CalendarSync mocks**

Add default values to `makeUser()` / `makeTask()` factories in these test files:
- `src/domain/services/__tests__/ai.service.test.ts`
- `src/domain/services/__tests__/auth.service.test.ts`
- `src/domain/services/__tests__/user.service.test.ts`
- `src/domain/services/__tests__/calendar.service.test.ts`

For User mocks, add:
```typescript
googleCalendarEnabled: false,
googleCalendarDirection: "both",
googleCalendarId: "primary",
googleCalendarSyncToken: null,
googleCalendarChannelId: null,
googleCalendarChannelExpiry: null,
```

For CalendarSync mocks (in `makeSyncRepo` return and test data), add:
```typescript
googleCalendarEventId: null,
```

**Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/domain/entities/user.ts src/domain/entities/calendar-sync.ts src/domain/services/__tests__/
git commit -m "feat(gcal): extend User and CalendarSync entities with google calendar fields"
```

---

## Task 3: User Repository — Google Calendar Settings CRUD

**Files:**
- Modify: `src/domain/repositories/user.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-user.repository.ts`
- Modify: `src/domain/services/user.service.ts`
- Test: `src/domain/services/__tests__/user.service.test.ts`

**Step 1: Add methods to IUserRepository interface**

In `src/domain/repositories/user.repository.ts`, add:

```typescript
updateGoogleCalendarEnabled(userId: string, enabled: boolean): Promise<void>;
getGoogleCalendarEnabled(userId: string): Promise<boolean>;
updateGoogleCalendarDirection(userId: string, direction: string): Promise<void>;
getGoogleCalendarDirection(userId: string): Promise<string>;
updateGoogleCalendarSyncToken(userId: string, syncToken: string | null): Promise<void>;
updateGoogleCalendarChannel(userId: string, channelId: string | null, expiry: Date | null): Promise<void>;
getGoogleCalendarSettings(userId: string): Promise<{
  enabled: boolean;
  direction: string;
  calendarId: string;
  syncToken: string | null;
  channelId: string | null;
  channelExpiry: Date | null;
}>;
findUsersWithExpiringChannels(before: Date): Promise<Array<{ id: string; googleCalendarChannelId: string }>>;
```

**Step 2: Implement in DrizzleUserRepository**

In `src/infrastructure/persistence/drizzle-user.repository.ts`, add:

```typescript
async updateGoogleCalendarEnabled(userId: string, enabled: boolean): Promise<void> {
  await this.db.update(schema.users).set({ googleCalendarEnabled: enabled }).where(eq(schema.users.id, userId));
}

async getGoogleCalendarEnabled(userId: string): Promise<boolean> {
  const user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { googleCalendarEnabled: true } });
  return user?.googleCalendarEnabled ?? false;
}

async updateGoogleCalendarDirection(userId: string, direction: string): Promise<void> {
  await this.db.update(schema.users).set({ googleCalendarDirection: direction }).where(eq(schema.users.id, userId));
}

async getGoogleCalendarDirection(userId: string): Promise<string> {
  const user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { googleCalendarDirection: true } });
  return user?.googleCalendarDirection ?? "both";
}

async updateGoogleCalendarSyncToken(userId: string, syncToken: string | null): Promise<void> {
  await this.db.update(schema.users).set({ googleCalendarSyncToken: syncToken }).where(eq(schema.users.id, userId));
}

async updateGoogleCalendarChannel(userId: string, channelId: string | null, expiry: Date | null): Promise<void> {
  await this.db.update(schema.users).set({ googleCalendarChannelId: channelId, googleCalendarChannelExpiry: expiry }).where(eq(schema.users.id, userId));
}

async getGoogleCalendarSettings(userId: string) {
  const user = await this.db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      googleCalendarEnabled: true,
      googleCalendarDirection: true,
      googleCalendarId: true,
      googleCalendarSyncToken: true,
      googleCalendarChannelId: true,
      googleCalendarChannelExpiry: true,
    },
  });
  return {
    enabled: user?.googleCalendarEnabled ?? false,
    direction: user?.googleCalendarDirection ?? "both",
    calendarId: user?.googleCalendarId ?? "primary",
    syncToken: user?.googleCalendarSyncToken ?? null,
    channelId: user?.googleCalendarChannelId ?? null,
    channelExpiry: user?.googleCalendarChannelExpiry ?? null,
  };
}

async findUsersWithExpiringChannels(before: Date) {
  const result = await this.db.query.users.findMany({
    where: and(
      eq(schema.users.googleCalendarEnabled, true),
      lt(schema.users.googleCalendarChannelExpiry, before),
    ),
    columns: { id: true, googleCalendarChannelId: true },
  });
  return result.filter((u) => u.googleCalendarChannelId !== null) as Array<{ id: string; googleCalendarChannelId: string }>;
}
```

Note: Import `lt` from `drizzle-orm` alongside existing `eq`, `and`, `gt`.

**Step 3: Add pass-through methods to UserService**

In `src/domain/services/user.service.ts`, add:

```typescript
async updateGoogleCalendarEnabled(userId: string, enabled: boolean): Promise<void> {
  await this.userRepo.updateGoogleCalendarEnabled(userId, enabled);
}

async getGoogleCalendarEnabled(userId: string): Promise<boolean> {
  return this.userRepo.getGoogleCalendarEnabled(userId);
}

async updateGoogleCalendarDirection(userId: string, direction: string): Promise<void> {
  await this.userRepo.updateGoogleCalendarDirection(userId, direction);
}

async getGoogleCalendarDirection(userId: string): Promise<string> {
  return this.userRepo.getGoogleCalendarDirection(userId);
}

async getGoogleCalendarSettings(userId: string) {
  return this.userRepo.getGoogleCalendarSettings(userId);
}
```

**Step 4: Write tests for UserService**

In `src/domain/services/__tests__/user.service.test.ts`, add test cases:

```typescript
describe("google calendar settings", () => {
  it("updateGoogleCalendarEnabled delegates to repo", async () => {
    await service.updateGoogleCalendarEnabled("user-1", true);
    expect(repo.updateGoogleCalendarEnabled).toHaveBeenCalledWith("user-1", true);
  });

  it("getGoogleCalendarEnabled delegates to repo", async () => {
    vi.mocked(repo.getGoogleCalendarEnabled).mockResolvedValue(true);
    const result = await service.getGoogleCalendarEnabled("user-1");
    expect(result).toBe(true);
  });

  it("updateGoogleCalendarDirection delegates to repo", async () => {
    await service.updateGoogleCalendarDirection("user-1", "push");
    expect(repo.updateGoogleCalendarDirection).toHaveBeenCalledWith("user-1", "push");
  });

  it("getGoogleCalendarDirection delegates to repo", async () => {
    vi.mocked(repo.getGoogleCalendarDirection).mockResolvedValue("pull");
    const result = await service.getGoogleCalendarDirection("user-1");
    expect(result).toBe("pull");
  });
});
```

Also update `makeRepo()` in the test file to include the new mocked methods:
```typescript
updateGoogleCalendarEnabled: vi.fn(),
getGoogleCalendarEnabled: vi.fn().mockResolvedValue(false),
updateGoogleCalendarDirection: vi.fn(),
getGoogleCalendarDirection: vi.fn().mockResolvedValue("both"),
updateGoogleCalendarSyncToken: vi.fn(),
updateGoogleCalendarChannel: vi.fn(),
getGoogleCalendarSettings: vi.fn().mockResolvedValue({
  enabled: false, direction: "both", calendarId: "primary",
  syncToken: null, channelId: null, channelExpiry: null,
}),
findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
```

**Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/domain/repositories/user.repository.ts src/infrastructure/persistence/drizzle-user.repository.ts src/domain/services/user.service.ts src/domain/services/__tests__/user.service.test.ts
git commit -m "feat(gcal): add user repository methods for google calendar settings"
```

---

## Task 4: CalendarSync Repository — Google Calendar Event ID

**Files:**
- Modify: `src/domain/repositories/calendar-sync.repository.ts`
- Modify: `src/infrastructure/persistence/drizzle-calendar-sync.repository.ts`

**Step 1: Add methods to ICalendarSyncRepository**

In `src/domain/repositories/calendar-sync.repository.ts`, add:

```typescript
findByGoogleEventId(userId: string, eventId: string): Promise<CalendarSync | undefined>;
updateGoogleEventId(id: string, googleEventId: string | null): Promise<void>;
```

**Step 2: Implement in DrizzleCalendarSyncRepository**

In `src/infrastructure/persistence/drizzle-calendar-sync.repository.ts`, add:

```typescript
async findByGoogleEventId(userId: string, eventId: string): Promise<CalendarSync | undefined> {
  return this.db.query.calendarSync.findFirst({
    where: and(
      eq(schema.calendarSync.userId, userId),
      eq(schema.calendarSync.googleCalendarEventId, eventId),
    ),
  });
}

async updateGoogleEventId(id: string, googleEventId: string | null): Promise<void> {
  await this.db.update(schema.calendarSync)
    .set({ googleCalendarEventId: googleEventId })
    .where(eq(schema.calendarSync.id, id));
}
```

**Step 3: Update test mocks in `calendar.service.test.ts`**

Add to `makeSyncRepo()`:
```typescript
findByGoogleEventId: vi.fn().mockResolvedValue(undefined),
updateGoogleEventId: vi.fn().mockResolvedValue(undefined),
```

**Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/domain/repositories/calendar-sync.repository.ts src/infrastructure/persistence/drizzle-calendar-sync.repository.ts src/domain/services/__tests__/calendar.service.test.ts
git commit -m "feat(gcal): add google event ID methods to calendar sync repository"
```

---

## Task 5: Google Calendar API Client — Token Refresh & Event CRUD

**Files:**
- Create: `src/infrastructure/google-calendar/google-calendar-client.ts`
- Test: `src/domain/services/__tests__/google-calendar.service.test.ts`

This is the low-level HTTP client for Google Calendar API. No domain logic — just API calls and token refresh.

**Step 1: Create the client**

Create `src/infrastructure/google-calendar/google-calendar-client.ts`:

```typescript
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq, and } from "drizzle-orm";

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  status?: string;
}

interface GoogleEventsListResponse {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

async function getTokensForUser(userId: string): Promise<GoogleTokens | null> {
  const account = await db.query.accounts.findFirst({
    where: and(
      eq(schema.accounts.userId, userId),
      eq(schema.accounts.provider, "google"),
    ),
  });
  if (!account?.access_token || !account?.refresh_token) return null;
  return {
    accessToken: account.access_token,
    refreshToken: account.refresh_token,
    expiresAt: account.expires_at ?? 0,
  };
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const expiresIn = data.expires_in as number;

  await db.update(schema.accounts)
    .set({
      access_token: newAccessToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    })
    .where(and(
      eq(schema.accounts.userId, userId),
      eq(schema.accounts.provider, "google"),
    ));

  return newAccessToken;
}

async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getTokensForUser(userId);
  if (!tokens) throw new Error("No Google account linked");

  const now = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt > now + 60) {
    return tokens.accessToken;
  }

  return refreshAccessToken(userId, tokens.refreshToken);
}

async function calendarFetch(userId: string, path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = await getValidAccessToken(userId);
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const tokens = await getTokensForUser(userId);
    if (!tokens) throw new Error("No Google account linked");
    const newToken = await refreshAccessToken(userId, tokens.refreshToken);
    return fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  return res;
}

export async function insertEvent(
  userId: string,
  calendarId: string,
  event: GoogleCalendarEvent,
): Promise<GoogleCalendarEvent> {
  const res = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Insert event failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function patchEvent(
  userId: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEvent>,
): Promise<GoogleCalendarEvent> {
  const res = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Patch event failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteEvent(
  userId: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${res.status}`);
  }
}

export async function listEvents(
  userId: string,
  calendarId: string,
  syncToken?: string,
): Promise<GoogleEventsListResponse> {
  const params = new URLSearchParams();
  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    params.set("maxResults", "2500");
    params.set("singleEvents", "true");
  }

  const res = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);

  if (res.status === 410 && syncToken) {
    // Sync token expired — full sync needed
    return listEvents(userId, calendarId);
  }

  if (!res.ok) throw new Error(`List events failed: ${res.status}`);
  return res.json();
}

export async function watchEvents(
  userId: string,
  calendarId: string,
  channelId: string,
  webhookUrl: string,
): Promise<{ expiration: string }> {
  const res = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
    method: "POST",
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
    }),
  });
  if (!res.ok) throw new Error(`Watch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function stopChannel(
  userId: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const res = await calendarFetch(userId, "/channels/stop", {
    method: "POST",
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Stop channel failed: ${res.status}`);
  }
}

export type { GoogleCalendarEvent, GoogleEventsListResponse, GoogleTokens };
```

**Step 2: Commit**

```bash
git add src/infrastructure/google-calendar/google-calendar-client.ts
git commit -m "feat(gcal): add Google Calendar API client with token refresh"
```

---

## Task 6: Google Calendar Domain Service — Push Logic

**Files:**
- Create: `src/domain/services/google-calendar.service.ts`
- Create: `src/domain/services/__tests__/google-calendar.service.test.ts`
- Modify: `src/infrastructure/container.ts`

**Step 1: Define the port interface for the Google Calendar client**

At the top of the new service file, define an interface so the service stays framework-agnostic:

Create `src/domain/ports/google-calendar-client.ts`:

```typescript
export interface GoogleCalendarEventData {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  status?: string;
}

export interface IGoogleCalendarClient {
  insertEvent(userId: string, calendarId: string, event: GoogleCalendarEventData): Promise<GoogleCalendarEventData>;
  patchEvent(userId: string, calendarId: string, eventId: string, event: Partial<GoogleCalendarEventData>): Promise<GoogleCalendarEventData>;
  deleteEvent(userId: string, calendarId: string, eventId: string): Promise<void>;
  listEvents(userId: string, calendarId: string, syncToken?: string): Promise<{ items: GoogleCalendarEventData[]; nextSyncToken?: string }>;
  watchEvents(userId: string, calendarId: string, channelId: string, webhookUrl: string): Promise<{ expiration: string }>;
  stopChannel(userId: string, channelId: string, resourceId: string): Promise<void>;
}
```

**Step 2: Create GoogleCalendarService**

Create `src/domain/services/google-calendar.service.ts`:

```typescript
import type { Task } from "@/domain/entities/task";
import type { ICalendarSyncRepository } from "@/domain/repositories/calendar-sync.repository";
import type { IUserRepository } from "@/domain/repositories/user.repository";
import type { IGoogleCalendarClient, GoogleCalendarEventData } from "@/domain/ports/google-calendar-client";

export class GoogleCalendarService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly syncRepo: ICalendarSyncRepository,
    private readonly gcalClient: IGoogleCalendarClient,
  ) {}

  async pushTask(userId: string, task: Task): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "pull") return;

    const event = this.taskToEvent(task);
    const syncEntry = await this.syncRepo.findByTaskId(task.id);

    if (syncEntry?.googleCalendarEventId) {
      const updated = await this.gcalClient.patchEvent(
        userId,
        settings.calendarId,
        syncEntry.googleCalendarEventId,
        event,
      );
      await this.syncRepo.updateEtag(syncEntry.id, `"${task.updatedAt.getTime()}"`);
      return;
    }

    const created = await this.gcalClient.insertEvent(userId, settings.calendarId, event);
    if (!created.id) return;

    const entry = await this.syncRepo.upsert({
      userId,
      taskId: task.id,
      icalUid: created.id,
      etag: `"${task.updatedAt.getTime()}"`,
    });
    await this.syncRepo.updateGoogleEventId(entry.id, created.id);
  }

  async deleteTaskEvent(userId: string, taskId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "pull") return;

    const syncEntry = await this.syncRepo.findByTaskId(taskId);
    if (!syncEntry?.googleCalendarEventId) return;

    try {
      await this.gcalClient.deleteEvent(userId, settings.calendarId, syncEntry.googleCalendarEventId);
    } catch {
      // Event may already be deleted
    }
    await this.syncRepo.deleteByTaskId(taskId);
  }

  async pullChanges(userId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled || settings.direction === "push") return;

    const response = await this.gcalClient.listEvents(
      userId,
      settings.calendarId,
      settings.syncToken ?? undefined,
    );

    for (const event of response.items) {
      if (!event.id) continue;

      const syncEntry = await this.syncRepo.findByGoogleEventId(userId, event.id);

      if (event.status === "cancelled") {
        if (syncEntry) {
          await this.syncRepo.deleteByTaskId(syncEntry.taskId);
        }
        continue;
      }

      // Event exists in our system — update task
      // Event doesn't exist — skip (we only pull changes to tasks we pushed)
      // Full bidirectional import of new external events is out of scope for v1
      if (syncEntry) {
        // Update will be handled by the caller (task.service) via syncEntry.taskId
        // Store the event data for the caller to process
      }
    }

    if (response.nextSyncToken) {
      await this.userRepo.updateGoogleCalendarSyncToken(userId, response.nextSyncToken);
    }
  }

  async registerWatch(userId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.enabled) return;

    const channelId = crypto.randomUUID();
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL}/api/google-calendar/webhook`;

    const result = await this.gcalClient.watchEvents(
      userId,
      settings.calendarId,
      channelId,
      webhookUrl,
    );

    const expiry = new Date(parseInt(result.expiration));
    await this.userRepo.updateGoogleCalendarChannel(userId, channelId, expiry);
  }

  async stopWatch(userId: string): Promise<void> {
    const settings = await this.userRepo.getGoogleCalendarSettings(userId);
    if (!settings.channelId) return;

    try {
      await this.gcalClient.stopChannel(userId, settings.channelId, settings.calendarId);
    } catch {
      // Channel may already be expired
    }
    await this.userRepo.updateGoogleCalendarChannel(userId, null, null);
  }

  private taskToEvent(task: Task): GoogleCalendarEventData {
    const hasTime = task.dueDate?.includes("T");

    let start: GoogleCalendarEventData["start"];
    let end: GoogleCalendarEventData["end"];

    if (hasTime) {
      start = { dateTime: new Date(task.dueDate!).toISOString() };
      if (task.dueDateEnd) {
        end = { dateTime: new Date(task.dueDateEnd).toISOString() };
      } else {
        // Default: 1 hour duration
        const endDate = new Date(task.dueDate!);
        endDate.setHours(endDate.getHours() + 1);
        end = { dateTime: endDate.toISOString() };
      }
    } else {
      // All-day event
      start = { date: task.dueDate! };
      if (task.dueDateEnd) {
        // Google Calendar all-day end is exclusive
        const endDate = new Date(task.dueDateEnd);
        endDate.setDate(endDate.getDate() + 1);
        end = { date: endDate.toISOString().split("T")[0] };
      } else {
        const endDate = new Date(task.dueDate!);
        endDate.setDate(endDate.getDate() + 1);
        end = { date: endDate.toISOString().split("T")[0] };
      }
    }

    return {
      summary: task.title,
      description: task.notes ?? undefined,
      start,
      end,
    };
  }
}
```

**Step 3: Write tests**

Create `src/domain/services/__tests__/google-calendar.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleCalendarService } from "../google-calendar.service";
import type { ICalendarSyncRepository } from "@/domain/repositories/calendar-sync.repository";
import type { IUserRepository } from "@/domain/repositories/user.repository";
import type { IGoogleCalendarClient } from "@/domain/ports/google-calendar-client";
import type { Task } from "@/domain/entities/task";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    listId: "list-1",
    locationId: null,
    locationRadius: null,
    title: "Test Task",
    notes: null,
    isCompleted: false,
    completedAt: null,
    dueDate: "2026-03-15T14:30",
    dueDateEnd: null,
    reminderAt: null,
    recurrence: null,
    deviceContext: null,
    blockedByTaskId: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const defaultSettings = {
  enabled: true,
  direction: "both",
  calendarId: "primary",
  syncToken: null,
  channelId: null,
  channelExpiry: null,
};

function makeUserRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    findByCalendarToken: vi.fn(),
    getCalendarToken: vi.fn(),
    regenerateCalendarToken: vi.fn(),
    updateCalendarSyncAll: vi.fn(),
    getCalendarSyncAll: vi.fn(),
    updateCalendarSyncDateRange: vi.fn(),
    getCalendarSyncDateRange: vi.fn(),
    updateOnboardingCompleted: vi.fn(),
    updatePassword: vi.fn(),
    createPasswordResetToken: vi.fn(),
    validatePasswordResetToken: vi.fn(),
    deletePasswordResetToken: vi.fn(),
    updateLlmConfig: vi.fn(),
    updateGoogleCalendarEnabled: vi.fn(),
    getGoogleCalendarEnabled: vi.fn(),
    updateGoogleCalendarDirection: vi.fn(),
    getGoogleCalendarDirection: vi.fn(),
    updateGoogleCalendarSyncToken: vi.fn(),
    updateGoogleCalendarChannel: vi.fn(),
    getGoogleCalendarSettings: vi.fn().mockResolvedValue(defaultSettings),
    findUsersWithExpiringChannels: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeSyncRepo(overrides: Partial<ICalendarSyncRepository> = {}): ICalendarSyncRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByTaskId: vi.fn().mockResolvedValue(undefined),
    findByIcalUid: vi.fn().mockResolvedValue(undefined),
    findByGoogleEventId: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue({
      id: "sync-1", userId: "user-1", taskId: "task-1",
      icalUid: "uid-1", etag: "etag-1", lastSyncedAt: new Date(),
      googleCalendarEventId: null,
    }),
    updateEtag: vi.fn(),
    updateGoogleEventId: vi.fn(),
    deleteByTaskId: vi.fn(),
    deleteByIcalUid: vi.fn(),
    ...overrides,
  };
}

function makeGcalClient(overrides: Partial<IGoogleCalendarClient> = {}): IGoogleCalendarClient {
  return {
    insertEvent: vi.fn().mockResolvedValue({ id: "gcal-event-1", summary: "Test" }),
    patchEvent: vi.fn().mockResolvedValue({ id: "gcal-event-1", summary: "Test" }),
    deleteEvent: vi.fn(),
    listEvents: vi.fn().mockResolvedValue({ items: [], nextSyncToken: "token-1" }),
    watchEvents: vi.fn().mockResolvedValue({ expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000) }),
    stopChannel: vi.fn(),
    ...overrides,
  };
}

describe("GoogleCalendarService", () => {
  let userRepo: IUserRepository;
  let syncRepo: ICalendarSyncRepository;
  let gcalClient: IGoogleCalendarClient;
  let service: GoogleCalendarService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    syncRepo = makeSyncRepo();
    gcalClient = makeGcalClient();
    service = new GoogleCalendarService(userRepo, syncRepo, gcalClient);
  });

  describe("pushTask", () => {
    it("skips when google calendar is disabled", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings, enabled: false,
      });
      await service.pushTask("user-1", makeTask());
      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });

    it("skips when direction is pull-only", async () => {
      vi.mocked(userRepo.getGoogleCalendarSettings).mockResolvedValue({
        ...defaultSettings, direction: "pull",
      });
      await service.pushTask("user-1", makeTask());
      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });

    it("creates new event when no sync entry exists", async () => {
      await service.pushTask("user-1", makeTask());
      expect(gcalClient.insertEvent).toHaveBeenCalledWith(
        "user-1",
        "primary",
        expect.objectContaining({ summary: "Test Task" }),
      );
      expect(syncRepo.upsert).toHaveBeenCalled();
      expect(syncRepo.updateGoogleEventId).toHaveBeenCalledWith("sync-1", "gcal-event-1");
    });

    it("patches existing event when sync entry has googleCalendarEventId", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue({
        id: "sync-1", userId: "user-1", taskId: "task-1",
        icalUid: "uid-1", etag: "etag-1", lastSyncedAt: new Date(),
        googleCalendarEventId: "gcal-event-existing",
      });
      await service.pushTask("user-1", makeTask());
      expect(gcalClient.patchEvent).toHaveBeenCalledWith(
        "user-1", "primary", "gcal-event-existing",
        expect.objectContaining({ summary: "Test Task" }),
      );
      expect(gcalClient.insertEvent).not.toHaveBeenCalled();
    });
  });

  describe("deleteTaskEvent", () => {
    it("deletes event and sync entry", async () => {
      vi.mocked(syncRepo.findByTaskId).mockResolvedValue({
        id: "sync-1", userId: "user-1", taskId: "task-1",
        icalUid: "uid-1", etag: "etag-1", lastSyncedAt: new Date(),
        googleCalendarEventId: "gcal-event-1",
      });
      await service.deleteTaskEvent("user-1", "task-1");
      expect(gcalClient.deleteEvent).toHaveBeenCalledWith("user-1", "primary", "gcal-event-1");
      expect(syncRepo.deleteByTaskId).toHaveBeenCalledWith("task-1");
    });

    it("skips when no sync entry", async () => {
      await service.deleteTaskEvent("user-1", "task-1");
      expect(gcalClient.deleteEvent).not.toHaveBeenCalled();
    });
  });
});
```

**Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass

**Step 5: Wire into container**

In `src/infrastructure/container.ts`, add import and instantiation:

```typescript
import { GoogleCalendarService } from "@/domain/services/google-calendar.service";
import * as googleCalendarClient from "@/infrastructure/google-calendar/google-calendar-client";
```

Add to the services object:

```typescript
googleCalendar: new GoogleCalendarService(userRepo, calendarSyncRepo, googleCalendarClient),
```

**Step 6: Commit**

```bash
git add src/domain/ports/google-calendar-client.ts src/domain/services/google-calendar.service.ts src/domain/services/__tests__/google-calendar.service.test.ts src/infrastructure/container.ts
git commit -m "feat(gcal): add GoogleCalendarService with push/pull/watch logic"
```

---

## Task 7: Integrate Push into TaskService

**Files:**
- Modify: `src/domain/services/task.service.ts`
- Modify: `src/infrastructure/container.ts`

**Step 1: Add optional GoogleCalendarService dependency to TaskService**

In `src/domain/services/task.service.ts`, add to constructor:

```typescript
constructor(
  private readonly taskRepo: ITaskRepository,
  private readonly listRepo: IListRepository | null = null,
  private readonly stepRepo: IStepRepository | null = null,
  private readonly googleCalendarService?: { pushTask(userId: string, task: Task): Promise<void>; deleteTaskEvent(userId: string, taskId: string): Promise<void> },
)
```

**Step 2: Add fire-and-forget push calls**

After task creation in `create()` method (after the `return` statement preparation but before returning):

```typescript
// Fire-and-forget Google Calendar push
if (this.googleCalendarService && created.dueDate) {
  this.googleCalendarService.pushTask(userId, created).catch(() => {});
}
return created;
```

After task update in `update()` method:

```typescript
if (this.googleCalendarService && updated.dueDate) {
  this.googleCalendarService.pushTask(userId, updated).catch(() => {});
} else if (this.googleCalendarService && !updated.dueDate) {
  this.googleCalendarService.deleteTaskEvent(userId, id).catch(() => {});
}
return updated;
```

After task delete in `delete()` method:

```typescript
if (this.googleCalendarService) {
  this.googleCalendarService.deleteTaskEvent(userId, id).catch(() => {});
}
```

After `toggleCompleted` (the task may need updating in calendar):

```typescript
if (this.googleCalendarService && toggled.dueDate) {
  this.googleCalendarService.pushTask(userId, toggled).catch(() => {});
}
```

**Step 3: Update container wiring**

In `src/infrastructure/container.ts`, change:

```typescript
const taskService = new TaskService(taskRepo, listRepo, stepRepo);
```

to:

```typescript
const googleCalendarService = new GoogleCalendarService(userRepo, calendarSyncRepo, googleCalendarClient);
const taskService = new TaskService(taskRepo, listRepo, stepRepo, googleCalendarService);
```

And update the services object to use the already-created instance:

```typescript
googleCalendar: googleCalendarService,
```

**Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass (TaskService tests don't pass googleCalendarService, so it's undefined and push calls are skipped)

**Step 5: Commit**

```bash
git add src/domain/services/task.service.ts src/infrastructure/container.ts
git commit -m "feat(gcal): integrate push to Google Calendar on task changes"
```

---

## Task 8: Webhook Endpoint — Receive Google Push Notifications

**Files:**
- Create: `src/app/api/google-calendar/webhook/route.ts`

**Step 1: Create the webhook handler**

Create `src/app/api/google-calendar/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { services } from "@/infrastructure/container";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
  }

  // Ignore sync messages (initial verification)
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  // Find user by channel ID
  const user = await db.query.users.findFirst({
    where: eq(schema.users.googleCalendarChannelId, channelId),
    columns: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  }

  try {
    await services.googleCalendar.pullChanges(user.id);
  } catch (error) {
    console.error("Google Calendar pull failed:", error);
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/google-calendar/webhook/route.ts
git commit -m "feat(gcal): add webhook endpoint for Google Push Notifications"
```

---

## Task 9: OAuth Re-consent — Add calendar.events Scope

**Files:**
- Create: `src/app/api/google-calendar/connect/route.ts`
- Create: `src/app/api/google-calendar/callback/route.ts`

The standard Auth.js Google provider doesn't include calendar scope. We need a separate OAuth flow for re-consent.

**Step 1: Create connect endpoint (initiates OAuth with calendar scope)**

Create `src/app/api/google-calendar/connect/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: `${process.env.AUTH_URL}/api/google-calendar/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state: session.user.id,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
```

**Step 2: Create callback endpoint (exchanges code for tokens)**

Create `src/app/api/google-calendar/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { services } from "@/infrastructure/container";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        redirect_uri: `${process.env.AUTH_URL}/api/google-calendar/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
    }

    const tokens = await tokenRes.json();

    // Update the existing Google account with new tokens that include calendar scope
    await db.update(schema.accounts)
      .set({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        scope: tokens.scope,
      })
      .where(and(
        eq(schema.accounts.userId, userId),
        eq(schema.accounts.provider, "google"),
      ));

    // Enable Google Calendar sync
    await services.user.updateGoogleCalendarEnabled(userId, true);

    // Register watch for push notifications
    await services.googleCalendar.registerWatch(userId);

    // Do initial sync to get syncToken
    await services.googleCalendar.pullChanges(userId);

    return NextResponse.redirect(new URL("/settings?gcal=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/google-calendar/connect/route.ts src/app/api/google-calendar/callback/route.ts
git commit -m "feat(gcal): add OAuth re-consent flow for calendar.events scope"
```

---

## Task 10: GraphQL Types — Google Calendar Settings

**Files:**
- Modify: `src/server/graphql/types/calendar.ts`

**Step 1: Add queries and mutations**

In `src/server/graphql/types/calendar.ts`, add:

```typescript
builder.queryField("googleCalendarEnabled", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getGoogleCalendarEnabled(ctx.userId!);
    },
  }),
);

builder.queryField("googleCalendarDirection", (t) =>
  t.string({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      return ctx.services.user.getGoogleCalendarDirection(ctx.userId!);
    },
  }),
);

builder.mutationField("updateGoogleCalendarDirection", (t) =>
  t.string({
    authScopes: { authenticated: true },
    args: { direction: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await ctx.services.user.updateGoogleCalendarDirection(ctx.userId!, args.direction);
      return args.direction;
    },
  }),
);

builder.mutationField("disconnectGoogleCalendar", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      await ctx.services.googleCalendar.stopWatch(ctx.userId!);
      await ctx.services.user.updateGoogleCalendarEnabled(ctx.userId!, false);
      await ctx.services.user.updateGoogleCalendarSyncToken(ctx.userId!, null);
      return true;
    },
  }),
);
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: No errors (services.googleCalendar is now in the container)

**Step 3: Commit**

```bash
git add src/server/graphql/types/calendar.ts
git commit -m "feat(gcal): add GraphQL queries and mutations for google calendar settings"
```

---

## Task 11: Cron Job — Watch Channel Renewal

**Files:**
- Create: `src/app/api/cron/renew-google-watches/route.ts`
- Modify: `vercel.json`

**Step 1: Create the cron endpoint**

Create `src/app/api/cron/renew-google-watches/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { repos, services } from "@/infrastructure/container";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Renew watches expiring in the next 2 days
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 2);

  const users = await repos.user.findUsersWithExpiringChannels(threshold);
  let renewed = 0;

  for (const user of users) {
    try {
      await services.googleCalendar.stopWatch(user.id);
      await services.googleCalendar.registerWatch(user.id);
      renewed++;
    } catch (error) {
      console.error(`Failed to renew watch for user ${user.id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, renewed });
}
```

**Step 2: Add cron to vercel.json**

In `vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/renew-google-watches",
  "schedule": "0 3 * * *"
}
```

This runs at 3 AM UTC daily.

**Step 3: Commit**

```bash
git add src/app/api/cron/renew-google-watches/route.ts vercel.json
git commit -m "feat(gcal): add cron job for watch channel renewal"
```

---

## Task 12: i18n — Translations

**Files:**
- Modify: `src/lib/i18n/types.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/dictionaries/en.ts`

**Step 1: Add translation keys to types**

In `src/lib/i18n/types.ts`, add to the `calendar` section of the `Dictionary` interface:

```typescript
googleCalendarTitle: string;
googleCalendarDescription: string;
googleCalendarConnect: string;
googleCalendarDisconnect: string;
googleCalendarConnected: string;
googleCalendarNotConnected: string;
googleCalendarDirection: string;
googleCalendarDirectionBoth: string;
googleCalendarDirectionPush: string;
googleCalendarDirectionPull: string;
googleCalendarConnectSuccess: string;
googleCalendarConnectError: string;
```

**Step 2: Add Czech translations**

In `src/lib/i18n/dictionaries/cs.ts`, add to the `calendar` object:

```typescript
googleCalendarTitle: "Google Calendar",
googleCalendarDescription: "Synchronizuj úkoly s Google Kalendářem. Změny se projeví i v Apple Kalendáři propojeném s Google.",
googleCalendarConnect: "Připojit Google Calendar",
googleCalendarDisconnect: "Odpojit Google Calendar",
googleCalendarConnected: "Připojeno",
googleCalendarNotConnected: "Nepřipojeno",
googleCalendarDirection: "Směr synchronizace",
googleCalendarDirectionBoth: "Obousměrný",
googleCalendarDirectionPush: "Jen odesílat (push)",
googleCalendarDirectionPull: "Jen přijímat (pull)",
googleCalendarConnectSuccess: "Google Calendar úspěšně připojen",
googleCalendarConnectError: "Připojení ke Google Calendar selhalo",
```

**Step 3: Add English translations**

In `src/lib/i18n/dictionaries/en.ts`, add to the `calendar` object:

```typescript
googleCalendarTitle: "Google Calendar",
googleCalendarDescription: "Sync tasks with Google Calendar. Changes will also appear in Apple Calendar connected to Google.",
googleCalendarConnect: "Connect Google Calendar",
googleCalendarDisconnect: "Disconnect Google Calendar",
googleCalendarConnected: "Connected",
googleCalendarNotConnected: "Not connected",
googleCalendarDirection: "Sync direction",
googleCalendarDirectionBoth: "Bidirectional",
googleCalendarDirectionPush: "Push only",
googleCalendarDirectionPull: "Pull only",
googleCalendarConnectSuccess: "Google Calendar connected successfully",
googleCalendarConnectError: "Failed to connect Google Calendar",
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat(gcal): add i18n translations for google calendar sync"
```

---

## Task 13: Settings UI — Google Calendar Section

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add GraphQL operations**

Add to the existing GraphQL constants at the top of the file:

```typescript
const GOOGLE_CALENDAR_ENABLED = gql`
  query GoogleCalendarEnabled {
    googleCalendarEnabled
  }
`;

const GOOGLE_CALENDAR_DIRECTION = gql`
  query GoogleCalendarDirection {
    googleCalendarDirection
  }
`;

const UPDATE_GOOGLE_CALENDAR_DIRECTION = gql`
  mutation UpdateGoogleCalendarDirection($direction: String!) {
    updateGoogleCalendarDirection(direction: $direction)
  }
`;

const DISCONNECT_GOOGLE_CALENDAR = gql`
  mutation DisconnectGoogleCalendar {
    disconnectGoogleCalendar
  }
`;
```

**Step 2: Add hooks and state**

Inside the Settings component, add:

```typescript
const { data: gcalEnabledData, refetch: refetchGcalEnabled } = useQuery<{ googleCalendarEnabled: boolean }>(GOOGLE_CALENDAR_ENABLED);
const { data: gcalDirectionData } = useQuery<{ googleCalendarDirection: string }>(GOOGLE_CALENDAR_DIRECTION);
const [updateGcalDirection] = useMutation(UPDATE_GOOGLE_CALENDAR_DIRECTION);
const [disconnectGcal] = useMutation(DISCONNECT_GOOGLE_CALENDAR);
const gcalEnabled = gcalEnabledData?.googleCalendarEnabled ?? false;
const gcalDirection = gcalDirectionData?.googleCalendarDirection ?? "both";
```

Add URL param detection for success/error toast (in a useEffect):

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const gcalStatus = params.get("gcal");
  if (gcalStatus === "connected") {
    refetchGcalEnabled();
    // Show success toast if using sonner
  } else if (gcalStatus === "error") {
    // Show error toast
  }
  // Clean up URL
  if (gcalStatus) {
    window.history.replaceState({}, "", "/settings");
  }
}, [refetchGcalEnabled]);
```

**Step 3: Add UI section**

After the existing calendar section (after `syncDateRange` toggle, around line 1170), add:

```tsx
{/* Google Calendar */}
<Separator className="my-4" />
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-medium">{t("calendar.googleCalendarTitle")}</h3>
      <p className="text-muted-foreground text-xs">{t("calendar.googleCalendarDescription")}</p>
    </div>
    <span className={cn("text-xs font-medium", gcalEnabled ? "text-green-600" : "text-muted-foreground")}>
      {gcalEnabled ? t("calendar.googleCalendarConnected") : t("calendar.googleCalendarNotConnected")}
    </span>
  </div>

  {!gcalEnabled ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => { window.location.href = "/api/google-calendar/connect"; }}
    >
      {t("calendar.googleCalendarConnect")}
    </Button>
  ) : (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">{t("calendar.googleCalendarDirection")}</p>
        <select
          value={gcalDirection}
          onChange={async (e) => {
            const direction = e.target.value;
            await updateGcalDirection({
              variables: { direction },
              optimisticResponse: { updateGoogleCalendarDirection: direction },
            });
          }}
          className="border-input bg-background ring-offset-background focus:ring-ring flex h-8 rounded-md border px-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          <option value="both">{t("calendar.googleCalendarDirectionBoth")}</option>
          <option value="push">{t("calendar.googleCalendarDirectionPush")}</option>
          <option value="pull">{t("calendar.googleCalendarDirectionPull")}</option>
        </select>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="text-red-500 hover:text-red-600"
        onClick={async () => {
          await disconnectGcal();
          await refetchGcalEnabled();
        }}
      >
        {t("calendar.googleCalendarDisconnect")}
      </Button>
    </>
  )}
</div>
```

**Step 4: Run typecheck and dev server**

Run: `yarn typecheck`
Expected: No errors

Run: `yarn dev`
Expected: Settings page renders with Google Calendar section

**Step 5: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat(gcal): add Google Calendar settings UI with connect/disconnect"
```

---

## Task 14: Environment Variables & Final Wiring

**Files:**
- Modify: `.env.local` (local only, not committed)

**Step 1: Verify environment variables**

Ensure these are set (most already exist from Google OAuth):
- `AUTH_GOOGLE_ID` — already set
- `AUTH_GOOGLE_SECRET` — already set
- `AUTH_URL` — already set (e.g., `https://sweptmind.com` or `http://localhost:3006`)
- `CRON_SECRET` — already set (Vercel auto-provides)

No new env vars needed — the feature uses existing Google OAuth credentials.

**Step 2: Add Google Calendar callback to Google Cloud Console**

In the Google Cloud Console for the project:
- Go to OAuth 2.0 Client IDs
- Add `https://sweptmind.com/api/google-calendar/callback` to Authorized redirect URIs
- Add `http://localhost:3006/api/google-calendar/callback` for local development

**Step 3: Run full check suite**

Run: `yarn check`
Expected: All lint, format, typecheck, and tests pass

**Step 4: Push DB schema to local**

Run: `yarn db:push`
Expected: Schema up to date

**Step 5: Final commit if any formatting fixes needed**

```bash
git add -A
git commit -m "feat(gcal): finalize google calendar sync integration"
```

---

## Summary of All Tasks

| # | Task | Key Files |
|---|------|-----------|
| 1 | DB Schema | `schema/auth.ts`, `schema/calendar-sync.ts` |
| 2 | Domain Entities | `entities/user.ts`, `entities/calendar-sync.ts` |
| 3 | User Repository | `user.repository.ts`, `drizzle-user.repository.ts`, `user.service.ts` |
| 4 | CalendarSync Repository | `calendar-sync.repository.ts`, `drizzle-calendar-sync.repository.ts` |
| 5 | Google Calendar API Client | `google-calendar-client.ts` |
| 6 | Google Calendar Service | `google-calendar.service.ts`, `container.ts` |
| 7 | TaskService Integration | `task.service.ts`, `container.ts` |
| 8 | Webhook Endpoint | `api/google-calendar/webhook/route.ts` |
| 9 | OAuth Re-consent | `api/google-calendar/connect/route.ts`, `callback/route.ts` |
| 10 | GraphQL Types | `types/calendar.ts` |
| 11 | Cron Job | `api/cron/renew-google-watches/route.ts`, `vercel.json` |
| 12 | i18n | `types.ts`, `cs.ts`, `en.ts` |
| 13 | Settings UI | `settings/page.tsx` |
| 14 | Env & Final Wiring | Google Cloud Console, `yarn check` |
