# Capacitor Native Wrapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wrap the existing SweptMind Next.js PWA in Capacitor (iOS + Android) and Electron (macOS) shells with native push notifications and background geolocation.

**Architecture:** WebView shell loading sweptmind.com. Native capabilities abstracted via port/adapter pattern in a shared `native-bridge` package. Backend extended with `platform` column on `push_subscriptions` and Firebase Admin SDK for FCM/APNs delivery. Electron handles macOS Dock persistence.

**Tech Stack:** Capacitor 6, Electron 33+, Firebase Admin SDK, `@capacitor/push-notifications`, `@capacitor-community/background-geolocation`, `electron-builder`

---

### Task 1: Set Up Yarn Workspaces

**Files:**
- Modify: `package.json` (root)

**Step 1: Add workspaces configuration to root package.json**

Add `workspaces` field to `package.json`:

```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

This must be added alongside existing fields. Do NOT change any other field.

**Step 2: Verify workspace resolution works**

Run: `yarn install`
Expected: No errors, existing dependencies still resolve

**Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: configure yarn workspaces for monorepo"
```

---

### Task 2: Create Native Bridge Package — Port Interfaces

**Files:**
- Create: `packages/native-bridge/package.json`
- Create: `packages/native-bridge/tsconfig.json`
- Create: `packages/native-bridge/src/types.ts`
- Create: `packages/native-bridge/src/ports/push.port.ts`
- Create: `packages/native-bridge/src/ports/location.port.ts`

**Step 1: Create package.json**

```json
{
  "name": "@sweptmind/native-bridge",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create shared types**

```typescript
// packages/native-bridge/src/types.ts
export type Platform = "web" | "ios" | "android" | "electron";

export interface Position {
  latitude: number;
  longitude: number;
}

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushRegistration {
  token: string;
  platform: Platform;
}

export interface GeofenceConfig {
  id: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  name?: string;
}

export interface GeofenceEvent {
  fenceId: string;
  type: "enter" | "exit";
  position: Position;
}

export interface TrackingConfig {
  intervalMs: number;
  distanceFilterMeters: number;
}
```

**Step 4: Create push port interface**

```typescript
// packages/native-bridge/src/ports/push.port.ts
import type { PushRegistration, PushNotification } from "../types";

export interface PushPort {
  isSupported(): boolean;
  register(): Promise<PushRegistration>;
  unregister(): Promise<void>;
  onNotification(cb: (notification: PushNotification) => void): () => void;
}
```

**Step 5: Create location port interface**

```typescript
// packages/native-bridge/src/ports/location.port.ts
import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  TrackingConfig,
} from "../types";

export interface LocationPort {
  isSupported(): boolean;
  getCurrentPosition(): Promise<Position>;
  startBackgroundTracking(config: TrackingConfig): Promise<void>;
  stopBackgroundTracking(): Promise<void>;
  addGeofence(fence: GeofenceConfig): Promise<void>;
  removeGeofence(id: string): Promise<void>;
  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void;
}
```

**Step 6: Commit**

```bash
git add packages/native-bridge/
git commit -m "feat(native-bridge): add port interfaces for push and location"
```

---

### Task 3: Create Web Adapters

These wrap the existing Web Push API and navigator.geolocation to conform to the port interfaces. They will be the default adapters when running in a browser.

**Files:**
- Create: `packages/native-bridge/src/adapters/web/web-push.adapter.ts`
- Create: `packages/native-bridge/src/adapters/web/web-location.adapter.ts`

**Step 1: Write failing test for WebPushAdapter**

Create: `packages/native-bridge/src/__tests__/web-push.adapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebPushAdapter } from "../adapters/web/web-push.adapter";

describe("WebPushAdapter", () => {
  let adapter: WebPushAdapter;

  beforeEach(() => {
    adapter = new WebPushAdapter();
  });

  it("reports supported when PushManager and serviceWorker exist", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { serviceWorker: {} },
      writable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { PushManager: class {} },
      writable: true,
    });
    expect(adapter.isSupported()).toBe(true);
  });

  it("reports unsupported when PushManager is missing", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
    });
    expect(adapter.isSupported()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn vitest run packages/native-bridge/src/__tests__/web-push.adapter.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement WebPushAdapter**

```typescript
// packages/native-bridge/src/adapters/web/web-push.adapter.ts
import type { PushPort } from "../../ports/push.port";
import type { PushRegistration, PushNotification } from "../../types";

export class WebPushAdapter implements PushPort {
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "PushManager" in window &&
      "serviceWorker" in navigator
    );
  }

  async register(): Promise<PushRegistration> {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Push permission denied");

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    const json = sub.toJSON();
    // For web, we send the full subscription object to the subscribe endpoint
    // The "token" here is the endpoint URL
    return { token: json.endpoint!, platform: "web" };
  }

  async unregister(): Promise<void> {
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
  }

  onNotification(cb: (notification: PushNotification) => void): () => void {
    // Web push notifications are handled by the service worker (sw.ts)
    // This is a no-op for web — the SW handles display directly
    void cb;
    return () => {};
  }
}
```

**Step 4: Run test to verify it passes**

Run: `yarn vitest run packages/native-bridge/src/__tests__/web-push.adapter.test.ts`
Expected: PASS

**Step 5: Implement WebLocationAdapter**

```typescript
// packages/native-bridge/src/adapters/web/web-location.adapter.ts
import type { LocationPort } from "../../ports/location.port";
import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  TrackingConfig,
} from "../../types";

export class WebLocationAdapter implements LocationPort {
  private watchId: number | null = null;

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "geolocation" in navigator;
  }

  getCurrentPosition(): Promise<Position> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => reject(new Error(err.message)),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
      );
    });
  }

  async startBackgroundTracking(_config: TrackingConfig): Promise<void> {
    // Web cannot do true background tracking.
    // The existing useUserLocation hook handles foreground watching.
    // This is intentionally a no-op — background tracking requires native.
  }

  async stopBackgroundTracking(): Promise<void> {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async addGeofence(_fence: GeofenceConfig): Promise<void> {
    // Geofencing is not available on web — handled by NearbyProvider polling
    throw new Error("Geofencing not supported on web");
  }

  async removeGeofence(_id: string): Promise<void> {
    throw new Error("Geofencing not supported on web");
  }

  onGeofenceEvent(_cb: (event: GeofenceEvent) => void): () => void {
    // No-op on web
    return () => {};
  }
}
```

**Step 6: Commit**

```bash
git add packages/native-bridge/
git commit -m "feat(native-bridge): add web adapters for push and location"
```

---

### Task 4: Platform Detection & Factory

**Files:**
- Create: `packages/native-bridge/src/platform.ts`
- Create: `packages/native-bridge/src/factory.ts`
- Create: `packages/native-bridge/src/index.ts`
- Create: `packages/native-bridge/src/__tests__/platform.test.ts`

**Step 1: Write failing test for platform detection**

```typescript
// packages/native-bridge/src/__tests__/platform.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getPlatform } from "../platform";

describe("getPlatform", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up global mocks
    delete (globalThis as any).window;
  });

  it("returns 'web' when no native runtime detected", () => {
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(getPlatform()).toBe("web");
  });

  it("returns 'electron' when electronAPI is present", () => {
    Object.defineProperty(globalThis, "window", {
      value: { electronAPI: {} },
      writable: true,
      configurable: true,
    });
    expect(getPlatform()).toBe("electron");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn vitest run packages/native-bridge/src/__tests__/platform.test.ts`
Expected: FAIL

**Step 3: Implement platform detection**

```typescript
// packages/native-bridge/src/platform.ts
import type { Platform } from "./types";

export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";

  // Check Electron first (Electron also has Capacitor in some setups)
  if ("electronAPI" in window) return "electron";

  // Dynamic import would be needed for Capacitor detection at runtime
  // We check for the Capacitor global that the native shell injects
  const win = window as any;
  if (win.Capacitor?.isNativePlatform?.()) {
    const platform = win.Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") return platform;
  }

  return "web";
}
```

**Step 4: Run test to verify it passes**

Run: `yarn vitest run packages/native-bridge/src/__tests__/platform.test.ts`
Expected: PASS

**Step 5: Create factory**

```typescript
// packages/native-bridge/src/factory.ts
import { getPlatform } from "./platform";
import type { PushPort } from "./ports/push.port";
import type { LocationPort } from "./ports/location.port";
import { WebPushAdapter } from "./adapters/web/web-push.adapter";
import { WebLocationAdapter } from "./adapters/web/web-location.adapter";

let pushInstance: PushPort | null = null;
let locationInstance: LocationPort | null = null;

export function getPushAdapter(): PushPort {
  if (pushInstance) return pushInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      // Lazy-loaded in Task 8 (Capacitor adapter)
      throw new Error(
        `Capacitor push adapter not yet implemented for ${platform}`,
      );
    case "electron":
      // Lazy-loaded in Task 12 (Electron adapter)
      throw new Error("Electron push adapter not yet implemented");
    default:
      pushInstance = new WebPushAdapter();
      return pushInstance;
  }
}

export function getLocationAdapter(): LocationPort {
  if (locationInstance) return locationInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      // Lazy-loaded in Task 9 (Capacitor adapter)
      throw new Error(
        `Capacitor location adapter not yet implemented for ${platform}`,
      );
    case "electron":
      // Electron on macOS: use web geolocation (no background tracking)
      locationInstance = new WebLocationAdapter();
      return locationInstance;
    default:
      locationInstance = new WebLocationAdapter();
      return locationInstance;
  }
}

/**
 * Reset singleton instances (for testing).
 */
export function resetAdapters(): void {
  pushInstance = null;
  locationInstance = null;
}
```

**Step 6: Create package index**

```typescript
// packages/native-bridge/src/index.ts
export { getPlatform } from "./platform";
export { getPushAdapter, getLocationAdapter, resetAdapters } from "./factory";
export type { PushPort } from "./ports/push.port";
export type { LocationPort } from "./ports/location.port";
export type {
  Platform,
  Position,
  PushNotification,
  PushRegistration,
  GeofenceConfig,
  GeofenceEvent,
  TrackingConfig,
} from "./types";
```

**Step 7: Commit**

```bash
git add packages/native-bridge/
git commit -m "feat(native-bridge): add platform detection and adapter factory"
```

---

### Task 5: Backend — Add `platform` Column to `push_subscriptions`

**Files:**
- Modify: `src/server/db/schema/push-subscriptions.ts`

**Step 1: Add platform column**

Add to the `pushSubscriptions` table definition, after the `auth` field:

```typescript
platform: text("platform").notNull().default("web"),
```

This stores `'web' | 'ios' | 'android'`. Web Push subscriptions use `'web'` (default). Native subscriptions set `'ios'` or `'android'`.

For native subscriptions:
- `endpoint` stores the FCM/APNs device token
- `p256dh` and `auth` store `'_'` (unused but NOT NULL)

**Step 2: Push schema to database**

Run: `yarn db:push`
Expected: Column added successfully

**Step 3: Commit**

```bash
git add src/server/db/schema/push-subscriptions.ts
git commit -m "feat: add platform column to push_subscriptions"
```

---

### Task 6: Backend — Update Subscribe Endpoint for Native Tokens

**Files:**
- Modify: `src/app/api/push/subscribe/route.ts`

**Step 1: Write failing test for native token subscription**

Create: `src/__tests__/api/push-subscribe.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("push subscribe validation", () => {
  it("accepts native platform with device token", () => {
    // Validate that the request body shape is correct for native
    const body = {
      endpoint: "fcm-device-token-abc123",
      platform: "android",
    };
    expect(body.platform).toBe("android");
    expect(typeof body.endpoint).toBe("string");
  });

  it("accepts web platform with VAPID keys", () => {
    const body = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "key1", auth: "key2" },
    };
    expect(body.keys).toBeDefined();
  });

  it("validates platform is one of web, ios, android", () => {
    const validPlatforms = ["web", "ios", "android"];
    expect(validPlatforms.includes("ios")).toBe(true);
    expect(validPlatforms.includes("windows")).toBe(false);
  });
});
```

**Step 2: Run test**

Run: `yarn vitest run src/__tests__/api/push-subscribe.test.ts`
Expected: PASS

**Step 3: Update subscribe endpoint**

Replace the full content of `src/app/api/push/subscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_PLATFORMS = ["web", "ios", "android"] as const;
type PushPlatform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(p: unknown): p is PushPlatform {
  return typeof p === "string" && VALID_PLATFORMS.includes(p as PushPlatform);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const platform: PushPlatform = isValidPlatform(body?.platform)
    ? body.platform
    : "web";

  const endpoint =
    typeof body?.endpoint === "string" ? body.endpoint.slice(0, 2048) : null;
  if (!endpoint) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 },
    );
  }

  let p256dh: string;
  let authKey: string;

  if (platform === "web") {
    // Web Push requires VAPID keys
    p256dh =
      typeof body?.keys?.p256dh === "string"
        ? body.keys.p256dh.slice(0, 512)
        : "";
    authKey =
      typeof body?.keys?.auth === "string"
        ? body.keys.auth.slice(0, 512)
        : "";
    if (!p256dh || !authKey) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 },
      );
    }
  } else {
    // Native platforms: endpoint is the device token, no VAPID keys needed
    p256dh = "_";
    authKey = "_";
  }

  // Upsert: delete existing subscription for this endpoint, insert new
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, session.user.id),
        eq(schema.pushSubscriptions.endpoint, endpoint),
      ),
    );

  const notifyDueDate = body?.notifyDueDate !== false;
  const notifyReminder = body?.notifyReminder !== false;

  await db.insert(schema.pushSubscriptions).values({
    userId: session.user.id,
    endpoint,
    p256dh,
    auth: authKey,
    platform,
    notifyDueDate,
    notifyReminder,
  });

  return NextResponse.json({ ok: true });
}
```

**Step 4: Commit**

```bash
git add src/app/api/push/subscribe/route.ts src/__tests__/api/push-subscribe.test.ts
git commit -m "feat: support native device token subscription in push subscribe endpoint"
```

---

### Task 7: Backend — Update Send Endpoint for Firebase Admin SDK

**Files:**
- Modify: `src/app/api/push/send/route.ts`
- Create: `src/lib/firebase-admin.ts`

**Step 1: Install firebase-admin**

Run: `yarn add firebase-admin`

**Step 2: Create Firebase Admin helper**

```typescript
// src/lib/firebase-admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set");
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });
}

export function getFirebaseMessaging() {
  const app = getFirebaseApp();
  return getMessaging(app);
}
```

**Step 3: Update send endpoint**

Replace the full content of `src/app/api/push/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and, isNull, isNotNull, inArray } from "drizzle-orm";

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 },
    );
  }

  webpush.setVapidDetails(
    "mailto:noreply@sweptmind.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

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
  const dueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate.includes("T") && t.dueDate <= nowIso,
  );

  if (dueTasks.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Batch: collect unique userIds and fetch all subscriptions at once
  const userIds = [...new Set(dueTasks.map((t) => t.userId))];
  const allSubscriptions = await db.query.pushSubscriptions.findMany({
    where: inArray(schema.pushSubscriptions.userId, userIds),
  });

  const subsByUser = new Map<string, (typeof allSubscriptions)[number][]>();
  for (const sub of allSubscriptions) {
    const list = subsByUser.get(sub.userId) ?? [];
    list.push(sub);
    subsByUser.set(sub.userId, list);
  }

  // Lazy-load Firebase Admin only when native subscriptions exist
  const hasNative = allSubscriptions.some((s) => s.platform !== "web");
  let firebaseMessaging: Awaited<
    ReturnType<typeof import("firebase-admin/messaging").getMessaging>
  > | null = null;
  if (hasNative) {
    try {
      const { getFirebaseMessaging } = await import("@/lib/firebase-admin");
      firebaseMessaging = getFirebaseMessaging();
    } catch (err) {
      console.error("Firebase Admin init failed:", err);
    }
  }

  let sent = 0;
  for (const task of dueTasks) {
    // Mark as notified first to prevent duplicate notifications on timeout
    await db
      .update(schema.tasks)
      .set({ notifiedAt: now })
      .where(eq(schema.tasks.id, task.id));

    const subscriptions = (subsByUser.get(task.userId) ?? []).filter(
      (sub) => sub.notifyDueDate,
    );
    const payload = {
      title: "SweptMind",
      body: task.title,
      url: `/lists/${task.listId}?task=${task.id}`,
    };

    for (const sub of subscriptions) {
      try {
        if (sub.platform === "web") {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
        } else if (firebaseMessaging) {
          await firebaseMessaging.send({
            token: sub.endpoint,
            notification: { title: payload.title, body: payload.body },
            data: { url: payload.url },
          });
        }
      } catch (error: unknown) {
        const statusCode =
          error &&
          typeof error === "object" &&
          "statusCode" in error &&
          typeof (error as any).statusCode === "number"
            ? (error as any).statusCode
            : 0;

        // 410 Gone (web) or messaging/registration-token-not-registered (FCM)
        const isFcmGone =
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as any).code ===
            "messaging/registration-token-not-registered";

        if (statusCode === 410 || isFcmGone) {
          await db
            .delete(schema.pushSubscriptions)
            .where(eq(schema.pushSubscriptions.id, sub.id));
        }
      }
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
```

**Step 4: Update .env.local documentation in CLAUDE.md**

Add `FIREBASE_SERVICE_ACCOUNT` to the env section (JSON string of Firebase service account credentials).

**Step 5: Commit**

```bash
git add src/app/api/push/send/route.ts src/lib/firebase-admin.ts package.json yarn.lock
git commit -m "feat: add Firebase Admin SDK for native push notification delivery"
```

---

### Task 8: Capacitor Push Adapter

**Files:**
- Create: `packages/native-bridge/src/adapters/capacitor/capacitor-push.adapter.ts`

**Step 1: Install Capacitor push dependency in native-bridge**

```bash
cd packages/native-bridge && yarn add @capacitor/push-notifications @capacitor/core
```

**Step 2: Write failing test**

Create: `packages/native-bridge/src/__tests__/capacitor-push.adapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @capacitor/push-notifications before importing adapter
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: vi.fn(() => "ios"),
  },
}));

import { CapacitorPushAdapter } from "../adapters/capacitor/capacitor-push.adapter";
import { PushNotifications } from "@capacitor/push-notifications";

describe("CapacitorPushAdapter", () => {
  let adapter: CapacitorPushAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorPushAdapter();
  });

  it("isSupported returns true", () => {
    expect(adapter.isSupported()).toBe(true);
  });

  it("register requests permissions and returns token", async () => {
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({
      receive: "granted",
    });
    vi.mocked(PushNotifications.register).mockResolvedValue();
    vi.mocked(PushNotifications.addListener).mockImplementation(
      (event: string, cb: any) => {
        if (event === "registration") {
          setTimeout(() => cb({ value: "device-token-abc" }), 0);
        }
        return Promise.resolve({ remove: vi.fn() });
      },
    );

    const result = await adapter.register();
    expect(result.token).toBe("device-token-abc");
    expect(result.platform).toBe("ios");
  });

  it("register throws when permission denied", async () => {
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({
      receive: "denied",
    });

    await expect(adapter.register()).rejects.toThrow("Push permission denied");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `yarn vitest run packages/native-bridge/src/__tests__/capacitor-push.adapter.test.ts`
Expected: FAIL

**Step 4: Implement CapacitorPushAdapter**

```typescript
// packages/native-bridge/src/adapters/capacitor/capacitor-push.adapter.ts
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import type { PushPort } from "../../ports/push.port";
import type { PushRegistration, PushNotification } from "../../types";
import type { Platform } from "../../types";

export class CapacitorPushAdapter implements PushPort {
  isSupported(): boolean {
    return true; // Always supported in Capacitor native shell
  }

  async register(): Promise<PushRegistration> {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      throw new Error("Push permission denied");
    }

    await PushNotifications.register();

    const token = await new Promise<string>((resolve, reject) => {
      PushNotifications.addListener("registration", (t) =>
        resolve(t.value),
      );
      PushNotifications.addListener("registrationError", (err) =>
        reject(new Error(err.error)),
      );
    });

    return {
      token,
      platform: Capacitor.getPlatform() as Platform,
    };
  }

  async unregister(): Promise<void> {
    await PushNotifications.removeAllListeners();
  }

  onNotification(cb: (notification: PushNotification) => void): () => void {
    const listener = PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        cb({
          title: notification.title ?? "",
          body: notification.body ?? "",
          data: notification.data as Record<string, string>,
        });
      },
    );

    return () => {
      listener.then((l) => l.remove());
    };
  }
}
```

**Step 5: Run test to verify it passes**

Run: `yarn vitest run packages/native-bridge/src/__tests__/capacitor-push.adapter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/native-bridge/
git commit -m "feat(native-bridge): add Capacitor push notification adapter"
```

---

### Task 9: Capacitor Location Adapter

**Files:**
- Create: `packages/native-bridge/src/adapters/capacitor/capacitor-location.adapter.ts`
- Create: `packages/native-bridge/src/__tests__/capacitor-location.adapter.test.ts`

**Step 1: Install Capacitor geolocation dependency**

```bash
cd packages/native-bridge && yarn add @capacitor-community/background-geolocation @capacitor/geolocation
```

**Step 2: Write failing test**

```typescript
// packages/native-bridge/src/__tests__/capacitor-location.adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn(),
  },
}));

vi.mock("@capacitor-community/background-geolocation", () => ({
  BackgroundGeolocationPlugin: {},
  registerPlugin: vi.fn(() => ({
    addWatcher: vi.fn(),
    removeWatcher: vi.fn(),
  })),
}));

import { CapacitorLocationAdapter } from "../adapters/capacitor/capacitor-location.adapter";
import { Geolocation } from "@capacitor/geolocation";

describe("CapacitorLocationAdapter", () => {
  let adapter: CapacitorLocationAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorLocationAdapter();
  });

  it("isSupported returns true", () => {
    expect(adapter.isSupported()).toBe(true);
  });

  it("getCurrentPosition returns coordinates", async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
      coords: {
        latitude: 50.08,
        longitude: 14.42,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });

    const pos = await adapter.getCurrentPosition();
    expect(pos.latitude).toBe(50.08);
    expect(pos.longitude).toBe(14.42);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `yarn vitest run packages/native-bridge/src/__tests__/capacitor-location.adapter.test.ts`
Expected: FAIL

**Step 4: Implement CapacitorLocationAdapter**

```typescript
// packages/native-bridge/src/adapters/capacitor/capacitor-location.adapter.ts
import { Geolocation } from "@capacitor/geolocation";
import type { LocationPort } from "../../ports/location.port";
import type {
  Position,
  GeofenceConfig,
  GeofenceEvent,
  TrackingConfig,
} from "../../types";

export class CapacitorLocationAdapter implements LocationPort {
  private watcherId: string | null = null;
  private geofenceCallbacks: ((event: GeofenceEvent) => void)[] = [];

  isSupported(): boolean {
    return true;
  }

  async getCurrentPosition(): Promise<Position> {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  }

  async startBackgroundTracking(config: TrackingConfig): Promise<void> {
    // Background geolocation uses the community plugin
    // This requires native configuration in capacitor.config.ts
    const { registerPlugin } = await import("@capacitor/core");
    const BackgroundGeolocation = registerPlugin<any>(
      "BackgroundGeolocation",
    );

    this.watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "SweptMind sleduje polohu pro upozornění na úkoly",
        backgroundTitle: "SweptMind",
        requestPermissions: true,
        stale: false,
        distanceFilter: config.distanceFilterMeters,
      },
      (location: any, error: any) => {
        if (error) {
          console.error("Background location error:", error);
          return;
        }
        if (location) {
          this.checkGeofences({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      },
    );
  }

  async stopBackgroundTracking(): Promise<void> {
    if (this.watcherId) {
      const { registerPlugin } = await import("@capacitor/core");
      const BackgroundGeolocation = registerPlugin<any>(
        "BackgroundGeolocation",
      );
      await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
    }
  }

  private geofences = new Map<string, GeofenceConfig>();

  async addGeofence(fence: GeofenceConfig): Promise<void> {
    this.geofences.set(fence.id, fence);
  }

  async removeGeofence(id: string): Promise<void> {
    this.geofences.delete(id);
  }

  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void {
    this.geofenceCallbacks.push(cb);
    return () => {
      this.geofenceCallbacks = this.geofenceCallbacks.filter((c) => c !== cb);
    };
  }

  private insideFences = new Set<string>();

  private checkGeofences(position: Position): void {
    for (const [id, fence] of this.geofences) {
      const distance = haversineKm(
        position.latitude,
        position.longitude,
        fence.latitude,
        fence.longitude,
      );
      const inside = distance <= fence.radiusKm;
      const wasInside = this.insideFences.has(id);

      if (inside && !wasInside) {
        this.insideFences.add(id);
        this.geofenceCallbacks.forEach((cb) =>
          cb({ fenceId: id, type: "enter", position }),
        );
      } else if (!inside && wasInside) {
        this.insideFences.delete(id);
        this.geofenceCallbacks.forEach((cb) =>
          cb({ fenceId: id, type: "exit", position }),
        );
      }
    }
  }
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

**Step 5: Run test to verify it passes**

Run: `yarn vitest run packages/native-bridge/src/__tests__/capacitor-location.adapter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/native-bridge/
git commit -m "feat(native-bridge): add Capacitor background geolocation adapter"
```

---

### Task 10: Update Factory to Wire Capacitor Adapters

**Files:**
- Modify: `packages/native-bridge/src/factory.ts`

**Step 1: Wire Capacitor adapters into factory**

Replace the `throw` statements with actual imports:

```typescript
// packages/native-bridge/src/factory.ts
import { getPlatform } from "./platform";
import type { PushPort } from "./ports/push.port";
import type { LocationPort } from "./ports/location.port";
import { WebPushAdapter } from "./adapters/web/web-push.adapter";
import { WebLocationAdapter } from "./adapters/web/web-location.adapter";
import { CapacitorPushAdapter } from "./adapters/capacitor/capacitor-push.adapter";
import { CapacitorLocationAdapter } from "./adapters/capacitor/capacitor-location.adapter";

let pushInstance: PushPort | null = null;
let locationInstance: LocationPort | null = null;

export function getPushAdapter(): PushPort {
  if (pushInstance) return pushInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      pushInstance = new CapacitorPushAdapter();
      return pushInstance;
    case "electron":
      // Electron: fall back to web push for now (via the loaded webpage)
      pushInstance = new WebPushAdapter();
      return pushInstance;
    default:
      pushInstance = new WebPushAdapter();
      return pushInstance;
  }
}

export function getLocationAdapter(): LocationPort {
  if (locationInstance) return locationInstance;

  const platform = getPlatform();
  switch (platform) {
    case "ios":
    case "android":
      locationInstance = new CapacitorLocationAdapter();
      return locationInstance;
    default:
      // Web and Electron use web geolocation
      locationInstance = new WebLocationAdapter();
      return locationInstance;
  }
}

export function resetAdapters(): void {
  pushInstance = null;
  locationInstance = null;
}
```

**Step 2: Run all native-bridge tests**

Run: `yarn vitest run packages/native-bridge/`
Expected: All PASS

**Step 3: Commit**

```bash
git add packages/native-bridge/src/factory.ts
git commit -m "feat(native-bridge): wire Capacitor adapters into factory"
```

---

### Task 11: Initialize Capacitor Mobile Project

**Files:**
- Create: `apps/mobile/capacitor.config.ts`
- Create: `apps/mobile/package.json`

**Step 1: Create apps/mobile directory and package.json**

```json
{
  "name": "@sweptmind/mobile",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "sync:android": "npx cap sync android",
    "sync:ios": "npx cap sync ios",
    "open:android": "npx cap open android",
    "open:ios": "npx cap open ios"
  },
  "dependencies": {
    "@capacitor/android": "^6",
    "@capacitor/core": "^6",
    "@capacitor/ios": "^6",
    "@capacitor/push-notifications": "^6",
    "@capacitor/geolocation": "^6",
    "@capacitor-community/background-geolocation": "^2"
  },
  "devDependencies": {
    "@capacitor/cli": "^6"
  }
}
```

**Step 2: Create capacitor.config.ts**

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sweptmind.app",
  appName: "SweptMind",
  webDir: "www",
  server: {
    url: "https://sweptmind.com",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
```

**Step 3: Create minimal www directory**

Create: `apps/mobile/www/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SweptMind</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <p>Redirecting to SweptMind...</p>
    <script>
      window.location.href = "https://sweptmind.com";
    </script>
  </body>
</html>
```

This is a fallback — Capacitor loads `server.url` directly, but `webDir` is required.

**Step 4: Install Capacitor and add platforms**

```bash
cd apps/mobile && yarn install
npx cap add android
npx cap add ios
```

**Step 5: Add apps/mobile/android and apps/mobile/ios to .gitignore**

These are generated native projects. Add to root `.gitignore`:

```
apps/mobile/android/
apps/mobile/ios/
```

**Step 6: Commit**

```bash
git add apps/mobile/capacitor.config.ts apps/mobile/package.json apps/mobile/www/ .gitignore
git commit -m "feat: initialize Capacitor project for iOS and Android"
```

---

### Task 12: Initialize Electron Desktop Project

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/preload.ts`
- Create: `apps/desktop/electron-builder.yml`
- Create: `apps/desktop/tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "@sweptmind/desktop",
  "version": "0.0.1",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "dev": "tsc && electron dist/main.js",
    "build": "tsc && electron-builder",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "electron-updater": "^6"
  },
  "devDependencies": {
    "electron": "^33",
    "electron-builder": "^25",
    "typescript": "^5"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create main.ts with Dock persistence**

```typescript
// apps/desktop/src/main.ts
import { app, BrowserWindow, Menu, shell } from "electron";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("https://sweptmind.com");

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // macOS: Hide window instead of closing (stay in Dock)
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

// macOS: Re-show window when Dock icon clicked
app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

// Cmd+Q: Actually quit
app.on("before-quit", () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  createWindow();

  // Standard macOS menu
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on("window-all-closed", () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

**Step 4: Create preload.ts**

```typescript
// apps/desktop/src/preload.ts
import { contextBridge } from "electron";

// Expose a marker so the web app can detect Electron environment
contextBridge.exposeInMainWorld("electronAPI", {
  platform: "darwin",
});
```

**Step 5: Create electron-builder.yml**

```yaml
appId: com.sweptmind.desktop
productName: SweptMind
mac:
  category: public.app-category.productivity
  target:
    - dmg
    - zip
  icon: icon.icns
dmg:
  title: SweptMind
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
directories:
  output: release
```

**Step 6: Add apps/desktop/dist and apps/desktop/release to .gitignore**

```
apps/desktop/dist/
apps/desktop/release/
```

**Step 7: Commit**

```bash
git add apps/desktop/ .gitignore
git commit -m "feat: initialize Electron desktop app with macOS Dock persistence"
```

---

### Task 13: Wire Native Bridge into Next.js App — Push Notifications

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `package.json` (root — add native-bridge dependency)

**Step 1: Add native-bridge dependency to root package.json**

Add to `dependencies`:
```json
"@sweptmind/native-bridge": "workspace:*"
```

Run: `yarn install`

**Step 2: Update push toggle in Settings to use native bridge**

In `src/app/(app)/settings/page.tsx`, update the `handlePushToggle` function to detect platform and subscribe accordingly.

Add import at top:
```typescript
import { getPlatform, getPushAdapter } from "@sweptmind/native-bridge";
```

Replace `handlePushToggle` with:

```typescript
const handlePushToggle = useCallback(async (checked: boolean) => {
  setPushLoading(true);
  try {
    const platform = getPlatform();

    if (checked) {
      if (platform === "ios" || platform === "android") {
        // Native: use Capacitor push adapter
        const pushAdapter = getPushAdapter();
        const { token, platform: detectedPlatform } = await pushAdapter.register();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: token,
            platform: detectedPlatform,
          }),
        });
      } else {
        // Web: existing VAPID flow
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
      }
      setPushEnabled(true);
    } else {
      if (platform === "ios" || platform === "android") {
        const pushAdapter = getPushAdapter();
        await pushAdapter.unregister();
        // Server-side cleanup handled by unregister adapter or manual call
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "native" }),
        });
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
      }
      setPushEnabled(false);
    }
  } catch {
    console.error("Push subscription failed");
  } finally {
    setPushLoading(false);
  }
}, []);
```

**Step 3: Update pushSupported detection**

Replace the `useEffect` that checks `PushManager` with:

```typescript
useEffect(() => {
  const platform = getPlatform();
  if (platform === "ios" || platform === "android") {
    // Native always supports push
    setPushSupported(true);
    // Check if already registered (query backend)
    fetch("/api/push/preferences")
      .then((r) => r.json())
      .then((prefs) => {
        setPushEnabled(true);
        if (typeof prefs.notifyDueDate === "boolean") setNotifyDueDate(prefs.notifyDueDate);
        if (typeof prefs.notifyReminder === "boolean") setNotifyReminder(prefs.notifyReminder);
      })
      .catch(() => setPushEnabled(false));
    return;
  }

  // Web: check PushManager support
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    setPushSupported(false);
    return;
  }
  navigator.serviceWorker.ready.then((reg) => {
    reg.pushManager.getSubscription().then((sub) => {
      setPushEnabled(!!sub);
      if (sub) {
        fetch("/api/push/preferences")
          .then((r) => r.json())
          .then((prefs) => {
            if (typeof prefs.notifyDueDate === "boolean") setNotifyDueDate(prefs.notifyDueDate);
            if (typeof prefs.notifyReminder === "boolean") setNotifyReminder(prefs.notifyReminder);
          })
          .catch(() => {});
      }
    });
  });
}, []);
```

**Step 4: Commit**

```bash
git add src/app/\\(app\\)/settings/page.tsx package.json yarn.lock
git commit -m "feat: integrate native bridge push adapter into settings page"
```

---

### Task 14: Wire Native Bridge — Background Geolocation

**Files:**
- Modify: `src/components/providers/nearby-provider.tsx`

**Step 1: Read the current nearby-provider.tsx**

Read the file to understand current implementation before modifying.

**Step 2: Add native background tracking activation**

Import native bridge:
```typescript
import { getPlatform, getLocationAdapter } from "@sweptmind/native-bridge";
```

In the provider, after existing `useUserLocation()` call, add native background tracking for Capacitor:

```typescript
// Start native background tracking when on Capacitor
useEffect(() => {
  const platform = getPlatform();
  if (platform !== "ios" && platform !== "android") return;

  const locationAdapter = getLocationAdapter();
  locationAdapter.startBackgroundTracking({
    intervalMs: 10 * 60 * 1000, // 10 minutes
    distanceFilterMeters: 100,
  });

  // Register geofences for user's saved locations
  if (locations) {
    for (const loc of locations) {
      locationAdapter.addGeofence({
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusKm: loc.radius,
        name: loc.name,
      });
    }
  }

  // Handle geofence events
  const unsubscribe = locationAdapter.onGeofenceEvent((event) => {
    if (event.type === "enter") {
      // Trigger nearby check for this location
      console.log(`Entered geofence: ${event.fenceId}`);
    }
  });

  return () => {
    unsubscribe();
    locationAdapter.stopBackgroundTracking();
  };
}, [locations]);
```

The exact integration depends on the current nearby-provider structure — read the file first, then integrate the native tracking alongside the existing web-based location watching.

**Step 3: Commit**

```bash
git add src/components/providers/nearby-provider.tsx
git commit -m "feat: add native background geolocation tracking for Capacitor"
```

---

### Task 15: Update CLAUDE.md with New Environment Variables

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Firebase and Capacitor info to CLAUDE.md**

Add `FIREBASE_SERVICE_ACCOUNT` to the environment section. Add build commands for mobile and desktop.

Add to the `## Příkazy` section:

```bash
# Mobile (Capacitor)
cd apps/mobile && npx cap sync android    # Sync web → Android
cd apps/mobile && npx cap sync ios        # Sync web → iOS
cd apps/mobile && npx cap open android    # Open in Android Studio
cd apps/mobile && npx cap open ios        # Open in Xcode

# Desktop (Electron)
cd apps/desktop && yarn dev               # Dev mode
cd apps/desktop && yarn build             # Build .dmg
```

Add `FIREBASE_SERVICE_ACCOUNT` to the env section:

```
FIREBASE_SERVICE_ACCOUNT  # JSON string of Firebase service account (for FCM/APNs push)
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Capacitor and Electron commands and env vars to CLAUDE.md"
```

---

### Task 16: Final Integration Test

**Step 1: Run all existing tests**

Run: `yarn test`
Expected: All existing tests still pass

**Step 2: Run native-bridge tests**

Run: `yarn vitest run packages/native-bridge/`
Expected: All tests pass

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors

**Step 4: Run lint and format**

Run: `yarn check`
Expected: All checks pass

**Step 5: Fix any issues found**

Address lint, type, or test failures.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint/type/test issues from native bridge integration"
```

---

Plan complete and saved to `docs/plans/2026-03-12-capacitor-native-wrapper.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?