# PWA Mobile App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SweptMind into a fully installable PWA with responsive mobile UI, offline support, and push notifications.

**Architecture:** Serwist service worker for caching/push, Apollo cache persistence for offline, Sheet-based sidebar drawer on mobile, Web Push API with Vercel Cron for reminders.

**Tech Stack:** Serwist (SW), apollo3-cache-persist (offline), web-push (notifications), shadcn Sheet (mobile drawer)

**Design doc:** `docs/plans/2026-03-07-pwa-mobile-design.md`

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install PWA, offline, and push packages**

```bash
yarn add @serwist/next serwist web-push apollo3-cache-persist localforage
yarn add -D @types/web-push
```

**Step 2: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add serwist, web-push, apollo3-cache-persist dependencies"
```

---

### Task 2: PWA Manifest + Viewport + Icons

**Files:**
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-512-maskable.png`
- Create: `public/icons/apple-touch-icon.png`

**Step 1: Create manifest**

Create `src/app/manifest.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SweptMind",
    short_name: "SweptMind",
    description: "GTD-inspired task management",
    start_url: "/lists",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

**Step 2: Add viewport and apple meta to layout.tsx**

In `src/app/layout.tsx`, add viewport export and update metadata:

```typescript
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Add to existing metadata:
export const metadata: Metadata = {
  // ... existing fields ...
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SweptMind",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};
```

**Step 3: Generate placeholder icons**

Create simple placeholder PNG icons. Use a script or manually create solid-color squares with "SM" text. The files needed are:
- `public/icons/icon-192.png` (192x192)
- `public/icons/icon-512.png` (512x512)
- `public/icons/icon-512-maskable.png` (512x512, with safe area padding)
- `public/icons/apple-touch-icon.png` (180x180)

For now, you can copy a simple placeholder or generate them with ImageMagick:

```bash
mkdir -p public/icons
# Create simple colored squares as placeholders
convert -size 192x192 xc:"#09090b" -fill white -gravity center -pointsize 48 -annotate 0 "SM" public/icons/icon-192.png
convert -size 512x512 xc:"#09090b" -fill white -gravity center -pointsize 128 -annotate 0 "SM" public/icons/icon-512.png
convert -size 512x512 xc:"#09090b" -fill white -gravity center -pointsize 128 -annotate 0 "SM" public/icons/icon-512-maskable.png
convert -size 180x180 xc:"#09090b" -fill white -gravity center -pointsize 48 -annotate 0 "SM" public/icons/apple-touch-icon.png
```

If ImageMagick is not installed, create any 4 PNG files of the right sizes. They're placeholders.

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/manifest.ts src/app/layout.tsx public/icons/
git commit -m "feat(pwa): add web app manifest, viewport config, and app icons"
```

---

### Task 3: Service Worker (Serwist)

**Files:**
- Create: `src/app/sw.ts`
- Modify: `next.config.ts`

**Step 1: Create service worker**

Create `src/app/sw.ts`:

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "SweptMind", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

// Click on notification → open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

serwist.addEventListeners();
```

**Step 2: Configure next.config.ts**

Modify `next.config.ts`:

```typescript
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ... existing security headers ...
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
```

**Important:** Keep all existing headers. Only wrap the export with `withSerwist()`.

**Step 3: Add `/public/sw.js` to `.gitignore`**

The service worker is generated at build time. Add to `.gitignore`:

```
# Serwist generated service worker
public/sw.js
public/sw.js.map
public/swe-worker-*.js
public/swe-worker-*.js.map
```

**Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: No errors (sw.ts uses web worker types).

If TypeScript complains about ServiceWorkerGlobalScope, add `"webworker"` to `lib` in a separate tsconfig for the SW, or add `/// <reference lib="webworker" />` at the top of sw.ts.

**Step 5: Commit**

```bash
git add src/app/sw.ts next.config.ts .gitignore
git commit -m "feat(pwa): add Serwist service worker with push notification handler"
```

---

### Task 4: Responsive UI — Mobile Sidebar Drawer

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Refactor AppShell for mobile drawer**

Replace `src/components/layout/app-shell.tsx`:

```typescript
"use client";

import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TaskDndProvider } from "@/components/providers/task-dnd-provider";
import { ListsProvider } from "@/components/providers/lists-provider";
import { NearbyProvider } from "@/components/providers/nearby-provider";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface SidebarContextType {
  close: () => void;
}

const SidebarContext = createContext<SidebarContextType>({ close: () => {} });
export const useSidebarContext = () => useContext(SidebarContext);

export function AppShell({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <TaskDndProvider>
      <ListsProvider>
        <NearbyProvider>
          <SidebarContext.Provider value={{ close }}>
            <div className="flex h-dvh overflow-hidden">
              {isDesktop ? (
                <Sidebar />
              ) : (
                <>
                  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
                      <Sidebar />
                    </SheetContent>
                  </Sheet>
                </>
              )}
              <div className="flex flex-1 flex-col overflow-hidden">
                {!isDesktop && (
                  <header className="bg-background flex items-center border-b px-4 py-2">
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                      <Menu className="h-5 w-5" />
                    </Button>
                    <span className="ml-2 text-lg font-semibold">SweptMind</span>
                  </header>
                )}
                <main className="flex flex-1 overflow-hidden">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
              </div>
            </div>
          </SidebarContext.Provider>
        </NearbyProvider>
      </ListsProvider>
    </TaskDndProvider>
  );
}
```

Key changes:
- `h-screen` → `h-dvh` (dynamic viewport height, better on mobile)
- Desktop: renders `<Sidebar />` directly (unchanged)
- Mobile: renders `<Sheet side="left">` with `<Sidebar />` inside
- Mobile header with hamburger button
- `SidebarContext` with `close()` for sidebar to close after navigation

**Step 2: Add auto-close on navigation to Sidebar**

In `src/components/layout/sidebar.tsx`, import and use the context:

```typescript
import { useSidebarContext } from "@/components/layout/app-shell";
```

Inside the `Sidebar` function, after the existing hooks:

```typescript
const { close: closeSidebar } = useSidebarContext();
```

Then in every `<Link>` onClick or navigation handler, call `closeSidebar()`. Specifically:
- Smart list links (Planned, Nearby): wrap in `onClick` that also calls `closeSidebar()`
- Default list link: same
- Custom list links (SortableListItem): same
- Tag links (SidebarTagItem): same

For Link components, add `onClick={closeSidebar}` — this won't prevent navigation, just closes the drawer.

**Step 3: Fix sidebar height in Sheet**

The sidebar has `h-full` which works when it's a direct child of the flex container. Inside a Sheet, it should still work, but verify the sidebar doesn't have issues. The `<aside>` should use `h-full` to fill the Sheet content.

**Step 4: Run typecheck**

Run: `yarn typecheck`

**Step 5: Test visually**

Run: `yarn dev` and resize browser to mobile width. Verify:
- Hamburger button appears below 768px
- Clicking it opens sidebar as a left drawer
- Clicking a list closes the drawer and navigates
- On desktop (>768px), sidebar is still fixed

**Step 6: Commit**

```bash
git add src/components/layout/app-shell.tsx src/components/layout/sidebar.tsx
git commit -m "feat(pwa): responsive sidebar drawer on mobile with hamburger menu"
```

---

### Task 5: Offline — Apollo Cache Persistence + Retry Link

**Files:**
- Modify: `src/lib/apollo/client.ts`
- Modify: `src/lib/apollo/provider.tsx`

**Step 1: Add cache persistence and retry link to Apollo client**

Modify `src/lib/apollo/client.ts`:

```typescript
import { HttpLink } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";

export function makeClient() {
  const errorLink = new ErrorLink(({ error }) => {
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({ message }) => {
        console.error(`[GraphQL error]: ${message}`);
      });
    } else {
      console.error(`[Network error]: ${error}`);
    }
  });

  const retryLink = new RetryLink({
    delay: { initial: 1000, max: 10000, jitter: true },
    attempts: { max: 5, retryIf: (error) => !!error },
  });

  const httpLink = new HttpLink({
    uri: "/api/graphql",
    fetchOptions: { cache: "default" },
  });

  const cache = new InMemoryCache();

  const client = new ApolloClient({
    cache,
    link: errorLink.concat(retryLink).concat(httpLink),
  });

  // Persist cache to IndexedDB (client-side only)
  if (typeof window !== "undefined") {
    import("apollo3-cache-persist").then(({ persistCache, LocalStorageWrapper }) => {
      persistCache({
        cache,
        storage: new LocalStorageWrapper(window.localStorage),
        maxSize: 1048576 * 5, // 5 MB
        debug: process.env.NODE_ENV === "development",
      });
    });
  }

  return client;
}
```

Note: Using `localStorage` instead of `localforage` for simplicity — it's synchronous and avoids async initialization issues with `ApolloNextAppProvider`. The 5MB limit is fine for a task manager. If needed, switch to IndexedDB via `localforage` later.

**Step 2: Run typecheck**

Run: `yarn typecheck`

**Step 3: Commit**

```bash
git add src/lib/apollo/client.ts
git commit -m "feat(pwa): add Apollo cache persistence and retry link for offline support"
```

---

### Task 6: Offline Indicator

**Files:**
- Create: `src/components/layout/offline-indicator.tsx`
- Modify: `src/components/layout/app-shell.tsx`

**Step 1: Create offline indicator component**

Create `src/components/layout/offline-indicator.tsx`:

```typescript
"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

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

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 px-4 py-1.5 text-center text-sm font-medium text-white">
      <WifiOff className="mr-2 inline h-4 w-4" />
      {t("common.offline")}
    </div>
  );
}
```

**Step 2: Add to AppShell**

In `src/components/layout/app-shell.tsx`, import and add before the main content:

```typescript
import { OfflineIndicator } from "@/components/layout/offline-indicator";

// Inside the JSX, before <main>:
<OfflineIndicator />
```

**Step 3: Add i18n key**

In `en.ts` add to `common`:
```typescript
offline: "You're offline — changes will sync when you reconnect",
```

In `cs.ts` add to `common`:
```typescript
offline: "Jsi offline — změny se synchronizují po připojení",
```

In `types.ts`, add `offline: string;` to common section.

**Step 4: Commit**

```bash
git add src/components/layout/offline-indicator.tsx src/components/layout/app-shell.tsx src/lib/i18n/
git commit -m "feat(pwa): add offline indicator banner"
```

---

### Task 7: DB Schema — Push subscriptions + notifiedAt

**Files:**
- Create: `src/server/db/schema/push-subscriptions.ts`
- Modify: `src/server/db/schema/tasks.ts`
- Modify: `src/server/db/schema/relations.ts`
- Modify: `src/server/db/schema/index.ts`

**Step 1: Create push_subscriptions table**

Create `src/server/db/schema/push-subscriptions.ts`:

```typescript
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
]);
```

**Step 2: Add notifiedAt to tasks**

In `src/server/db/schema/tasks.ts`, add after `recurrence`:

```typescript
notifiedAt: timestamp("notified_at", { mode: "date" }),
```

**Step 3: Add relations**

In `src/server/db/schema/relations.ts`, import `pushSubscriptions` and add:

```typescript
pushSubscriptions: many(pushSubscriptions),
```
to `usersRelations`.

Add:
```typescript
export const pushSubscriptionRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));
```

**Step 4: Export**

In `src/server/db/schema/index.ts`: `export * from "./push-subscriptions";`

**Step 5: Push schema**

Run: `yarn db:push`

**Step 6: Commit**

```bash
git add src/server/db/schema/
git commit -m "feat(push): add push_subscriptions table and notifiedAt column"
```

---

### Task 8: Push — Subscribe/Unsubscribe API routes

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`
- Create: `src/app/api/push/unsubscribe/route.ts`

**Step 1: Create subscribe endpoint**

Create `src/app/api/push/subscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint, keys } = await request.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Upsert: delete existing subscription for this endpoint, insert new
  await db.delete(schema.pushSubscriptions).where(
    and(
      eq(schema.pushSubscriptions.userId, session.user.id),
      eq(schema.pushSubscriptions.endpoint, endpoint),
    ),
  );

  await db.insert(schema.pushSubscriptions).values({
    userId: session.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });

  return NextResponse.json({ ok: true });
}
```

**Step 2: Create unsubscribe endpoint**

Create `src/app/api/push/unsubscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await request.json();
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await db.delete(schema.pushSubscriptions).where(
    and(
      eq(schema.pushSubscriptions.userId, session.user.id),
      eq(schema.pushSubscriptions.endpoint, endpoint),
    ),
  );

  return NextResponse.json({ ok: true });
}
```

**Step 3: Run typecheck**

Run: `yarn typecheck`

**Step 4: Commit**

```bash
git add src/app/api/push/
git commit -m "feat(push): add subscribe and unsubscribe API routes"
```

---

### Task 9: Push — Send notifications (Vercel Cron)

**Files:**
- Create: `src/app/api/push/send/route.ts`
- Modify: `vercel.json` (or create if not exists)

**Step 1: Create send endpoint**

Create `src/app/api/push/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and, isNull, isNotNull, lte } from "drizzle-orm";

webpush.setVapidDetails(
  "mailto:noreply@sweptmind.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

  // Find tasks with dueDate (with time) <= now, not completed, not yet notified
  const tasks = await db.query.tasks.findMany({
    where: and(
      isNotNull(schema.tasks.dueDate),
      eq(schema.tasks.isCompleted, false),
      isNull(schema.tasks.notifiedAt),
    ),
  });

  // Filter: only tasks with exact time, and that time has passed
  const dueTasks = tasks.filter((t) => t.dueDate && t.dueDate.includes("T") && t.dueDate <= nowIso);

  let sent = 0;
  for (const task of dueTasks) {
    // Get user's push subscriptions
    const subscriptions = await db.query.pushSubscriptions.findMany({
      where: eq(schema.pushSubscriptions.userId, task.userId),
    });

    const payload = JSON.stringify({
      title: "SweptMind",
      body: task.title,
      url: `/lists/${task.listId}?task=${task.id}`,
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (error: unknown) {
        // 410 Gone = subscription expired, clean up
        if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode: number }).statusCode === 410) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
        }
      }
    }

    // Mark as notified
    await db.update(schema.tasks).set({ notifiedAt: now }).where(eq(schema.tasks.id, task.id));
    sent++;
  }

  return NextResponse.json({ sent });
}
```

**Step 2: Create vercel.json for cron**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/push/send",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Step 3: Add env vars note**

The following environment variables are needed:
- `VAPID_PUBLIC_KEY` — generate with `npx web-push generate-vapid-keys`
- `VAPID_PRIVATE_KEY` — from same command
- `CRON_SECRET` — random string for cron auth (Vercel sets this automatically)

**Step 4: Run typecheck**

Run: `yarn typecheck`

**Step 5: Commit**

```bash
git add src/app/api/push/send/ vercel.json
git commit -m "feat(push): add cron-triggered push notification sender"
```

---

### Task 10: Push — Settings UI + i18n

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/lib/i18n/dictionaries/en.ts`
- Modify: `src/lib/i18n/dictionaries/cs.ts`
- Modify: `src/lib/i18n/types.ts`

**Step 1: Add i18n keys**

In `types.ts`, add `push` section to Dictionary:

```typescript
push: {
  title: string;
  description: string;
  enable: string;
  enabled: string;
  disabled: string;
  unsupported: string;
  subscribeFailed: string;
};
```

In `en.ts`:

```typescript
push: {
  title: "Push Notifications",
  description: "Get reminders for tasks with a specific time.",
  enable: "Enable notifications",
  enabled: "Notifications enabled",
  disabled: "Notifications disabled",
  unsupported: "Push notifications are not supported in this browser.",
  subscribeFailed: "Failed to enable notifications. Please try again.",
},
```

In `cs.ts`:

```typescript
push: {
  title: "Push notifikace",
  description: "Dostávej připomínky na úkoly s přesným časem.",
  enable: "Zapnout notifikace",
  enabled: "Notifikace zapnuty",
  disabled: "Notifikace vypnuty",
  unsupported: "Tento prohlížeč nepodporuje push notifikace.",
  subscribeFailed: "Nepodařilo se zapnout notifikace. Zkus to znovu.",
},
```

**Step 2: Add Push section to Settings**

In `src/app/(app)/settings/page.tsx`, add a Push Notifications section after the Calendar section. Add state and handler:

```typescript
const [pushEnabled, setPushEnabled] = useState(false);
const [pushSupported, setPushSupported] = useState(true);
const [pushLoading, setPushLoading] = useState(false);

useEffect(() => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    setPushSupported(false);
    return;
  }
  navigator.serviceWorker.ready.then((reg) => {
    reg.pushManager.getSubscription().then((sub) => {
      setPushEnabled(!!sub);
    });
  });
}, []);

const handlePushToggle = async (checked: boolean) => {
  setPushLoading(true);
  try {
    if (checked) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushEnabled(true);
    } else {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
    }
  } catch {
    console.error("Push subscription failed");
  } finally {
    setPushLoading(false);
  }
};
```

JSX (after Calendar section):

```tsx
{/* Push Notifications */}
<div>
  <h2 className="mb-3 text-lg font-semibold">{t("push.title")}</h2>
  <p className="text-muted-foreground mb-3 text-xs">{t("push.description")}</p>
  {pushSupported ? (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm">
        {pushEnabled ? t("push.enabled") : t("push.disabled")}
      </p>
      <Switch
        checked={pushEnabled}
        onCheckedChange={handlePushToggle}
        disabled={pushLoading}
      />
    </div>
  ) : (
    <p className="text-muted-foreground text-sm">{t("push.unsupported")}</p>
  )}
</div>
```

**Step 3: Add VAPID public key env var**

Add to `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
```

Generate keys: `npx web-push generate-vapid-keys`

**Step 4: Run typecheck**

Run: `yarn typecheck`

**Step 5: Commit**

```bash
git add src/app/(app)/settings/page.tsx src/lib/i18n/
git commit -m "feat(push): add push notification toggle in Settings"
```

---

### Task 11: Final Verification

**Step 1: Run all checks**

```bash
yarn check
```

Expected: lint + format + typecheck + test all pass.

**Step 2: Test PWA installability**

```bash
yarn build && yarn start
```

Open in Chrome, check:
- Application tab → Manifest loads correctly
- Service Worker registered
- "Install app" button appears in address bar
- Install → opens as standalone app

**Step 3: Test mobile responsive**

- Resize to mobile → hamburger menu appears
- Click hamburger → sidebar drawer opens
- Click a list → drawer closes, navigates
- Task detail panel works

**Step 4: Test offline**

- Open app, load some data
- Go offline (DevTools → Network → Offline)
- Reload → data appears from cache
- Go back online → app reconnects

**Step 5: Test push (requires VAPID keys)**

- Enable push in Settings
- Create a task with dueDate in the past
- Call `POST /api/push/send` with proper CRON_SECRET
- Notification appears

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(pwa): complete PWA implementation with offline support and push notifications"
```
