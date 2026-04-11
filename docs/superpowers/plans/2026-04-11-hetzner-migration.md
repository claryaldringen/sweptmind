# Hetzner Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate SweptMind from Vercel to Hetzner VPS with standalone Next.js, local filesystem blob storage, and systemd cron timers.

**Architecture:** Replace Vercel Blob with local filesystem storage behind the existing `IBlobStorage` port. Change upload flow from client-side (Vercel Blob SDK) to server-side (multipart POST to API route). Replace `vercel.json` crons with systemd timers. Deploy as standalone Next.js behind Caddy reverse proxy, managed by pm2.

**Tech Stack:** Next.js standalone, pm2, Caddy, PostgreSQL 16, systemd timers, Node.js `fs/promises`

---

## File Structure

### New files
- `src/infrastructure/blob/local-filesystem-blob-storage.ts` — `IBlobStorage` implementation using `fs/promises`
- `src/infrastructure/blob/__tests__/local-filesystem-blob-storage.test.ts` — Unit tests

### Modified files
- `src/domain/ports/blob-storage.ts` — Add `save()` method to `IBlobStorage` port
- `src/app/api/upload/token/route.ts` — Rewrite to server-side upload endpoint
- `src/components/tasks/detail/task-attachments.tsx` — Replace Vercel Blob client with `fetch POST`
- `src/infrastructure/container.ts` — Swap `VercelBlobStorage` → `LocalFilesystemBlobStorage`
- `next.config.ts` — Add `output: "standalone"`, update CSP headers, remove `VERCEL_GIT_COMMIT_SHA`
- `package.json` — Remove `@vercel/blob`, `@neondatabase/serverless`

### Deleted files
- `src/infrastructure/blob/vercel-blob-storage.ts`
- `vercel.json`

---

### Task 1: Extend IBlobStorage port with `save()` method

**Files:**
- Modify: `src/domain/ports/blob-storage.ts:1-3`

- [ ] **Step 1: Add `save()` to the port interface**

```typescript
export interface IBlobStorage {
  save(path: string, data: Buffer): Promise<string>;
  delete(url: string): Promise<void>;
}
```

`save()` takes a relative path (e.g. `attachments/userId/taskId/file.jpg`) and file data, returns the public URL (e.g. `/uploads/attachments/userId/taskId/file.jpg`).

- [ ] **Step 2: Update VercelBlobStorage to satisfy the interface temporarily**

In `src/infrastructure/blob/vercel-blob-storage.ts`, add a stub so TypeScript doesn't break while we build the replacement:

```typescript
import type { IBlobStorage } from "@/domain/ports/blob-storage";

export class VercelBlobStorage implements IBlobStorage {
  async save(_path: string, _data: Buffer): Promise<string> {
    throw new Error("Not implemented — use Vercel Blob client-side upload");
  }

  async delete(url: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(url);
  }
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `yarn typecheck`
Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add src/domain/ports/blob-storage.ts src/infrastructure/blob/vercel-blob-storage.ts
git commit -m "feat: add save() method to IBlobStorage port"
```

---

### Task 2: Implement LocalFilesystemBlobStorage

**Files:**
- Create: `src/infrastructure/blob/local-filesystem-blob-storage.ts`
- Create: `src/infrastructure/blob/__tests__/local-filesystem-blob-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/blob/__tests__/local-filesystem-blob-storage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalFilesystemBlobStorage } from "../local-filesystem-blob-storage";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile, unlink } from "fs/promises";

describe("LocalFilesystemBlobStorage", () => {
  let storage: LocalFilesystemBlobStorage;
  const basePath = "/opt/sweptmind-uploads";

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new LocalFilesystemBlobStorage(basePath);
  });

  describe("save", () => {
    it("creates directory and writes file, returns public URL", async () => {
      const data = Buffer.from("test data");
      const result = await storage.save("attachments/user-1/task-1/photo.jpg", data);

      expect(mkdir).toHaveBeenCalledWith(
        "/opt/sweptmind-uploads/attachments/user-1/task-1",
        { recursive: true },
      );
      expect(writeFile).toHaveBeenCalledWith(
        "/opt/sweptmind-uploads/attachments/user-1/task-1/photo.jpg",
        data,
      );
      expect(result).toBe("/uploads/attachments/user-1/task-1/photo.jpg");
    });

    it("rejects path traversal attempts", async () => {
      const data = Buffer.from("test");
      await expect(storage.save("../etc/passwd", data)).rejects.toThrow(
        "Invalid path",
      );
      await expect(storage.save("attachments/../../etc/passwd", data)).rejects.toThrow(
        "Invalid path",
      );
    });
  });

  describe("delete", () => {
    it("deletes file by public URL", async () => {
      await storage.delete("/uploads/attachments/user-1/task-1/photo.jpg");

      expect(unlink).toHaveBeenCalledWith(
        "/opt/sweptmind-uploads/attachments/user-1/task-1/photo.jpg",
      );
    });

    it("ignores ENOENT errors (file already gone)", async () => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      vi.mocked(unlink).mockRejectedValueOnce(err);

      await expect(
        storage.delete("/uploads/attachments/user-1/task-1/gone.jpg"),
      ).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/infrastructure/blob/__tests__/local-filesystem-blob-storage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LocalFilesystemBlobStorage**

Create `src/infrastructure/blob/local-filesystem-blob-storage.ts`:

```typescript
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import type { IBlobStorage } from "@/domain/ports/blob-storage";

export class LocalFilesystemBlobStorage implements IBlobStorage {
  constructor(private readonly basePath: string) {}

  async save(relativePath: string, data: Buffer): Promise<string> {
    const resolved = path.resolve(this.basePath, relativePath);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error("Invalid path");
    }

    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, data);

    return `/uploads/${relativePath}`;
  }

  async delete(url: string): Promise<void> {
    // url is either "/uploads/attachments/..." (new) or a full Vercel Blob URL (legacy)
    const relativePath = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : null;
    if (!relativePath) return; // skip legacy Vercel Blob URLs

    const resolved = path.resolve(this.basePath, relativePath);
    if (!resolved.startsWith(this.basePath)) return;

    try {
      await unlink(resolved);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/infrastructure/blob/__tests__/local-filesystem-blob-storage.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/blob/local-filesystem-blob-storage.ts src/infrastructure/blob/__tests__/local-filesystem-blob-storage.test.ts
git commit -m "feat: implement LocalFilesystemBlobStorage with tests"
```

---

### Task 3: Rewrite upload route and client upload flow

**Files:**
- Rewrite: `src/app/api/upload/token/route.ts` → `src/app/api/upload/route.ts`
- Modify: `src/components/tasks/detail/task-attachments.tsx:226-269`
- Modify: `src/infrastructure/container.ts:24,65`

**Design decision:** Server saves file to disk and returns `{ blobUrl }`. Client keeps existing `registerAttachment` GraphQL mutation for DB record + Apollo cache update. This preserves the existing cache update logic cleanly.

- [ ] **Step 1: Wire up LocalFilesystemBlobStorage in container.ts**

In `src/infrastructure/container.ts`:

Replace line 24:
```typescript
import { VercelBlobStorage } from "./blob/vercel-blob-storage";
```
with:
```typescript
import { LocalFilesystemBlobStorage } from "./blob/local-filesystem-blob-storage";
```

Replace line 65:
```typescript
const blobStorage = new VercelBlobStorage();
```
with:
```typescript
const uploadsPath = process.env.UPLOADS_PATH ?? "/opt/sweptmind-uploads";
export const blobStorage = new LocalFilesystemBlobStorage(uploadsPath);
```

- [ ] **Step 2: Create the new upload route**

Delete `src/app/api/upload/token/` directory and create `src/app/api/upload/route.ts`:

```bash
rm -rf src/app/api/upload/token
```

Write `src/app/api/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";
import { blobStorage } from "@/infrastructure/container";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const taskId = formData.get("taskId") as string | null;

  if (!file || !taskId) {
    return NextResponse.json({ error: "Missing file or taskId" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";

  try {
    await services.attachment.validateUpload(session.user.id, taskId, file.size, mimeType);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 },
    );
  }

  const relativePath = `attachments/${session.user.id}/${taskId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const blobUrl = await blobStorage.save(relativePath, buffer);

  return NextResponse.json({ blobUrl });
}
```

- [ ] **Step 3: Replace `uploadFile` in task-attachments.tsx**

Replace the `uploadFile` function (lines 226-269) with:

```typescript
async function uploadFile(file: globalThis.File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("taskId", taskId);

  const { blobUrl } = await new Promise<{ blobUrl: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        updateFileProgress(file.name, (e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || "Upload failed"));
        } catch {
          reject(new Error("Upload failed"));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });

  // Register in DB via GraphQL (preserves existing Apollo cache update)
  await registerAttachment({
    variables: {
      taskId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      blobUrl,
    },
  });
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/container.ts src/app/api/upload/ src/components/tasks/detail/task-attachments.tsx
git commit -m "feat: replace Vercel Blob upload with server-side filesystem upload"
```

---

### Task 4: Update next.config.ts

**Files:**
- Modify: `next.config.ts:4-12,59-64`

- [ ] **Step 1: Add `output: "standalone"` and remove Vercel env var**

In `next.config.ts`, update the config object:

Replace lines 4-13:
```typescript
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@sweptmind/native-bridge", "@sweptmind/capacitor-geofence"],
  turbopack: {},
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
```

with:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@sweptmind/native-bridge", "@sweptmind/capacitor-geofence"],
  turbopack: {},
  env: {
    NEXT_PUBLIC_BUILD_ID: "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
```

- [ ] **Step 2: Update CSP headers**

Replace line 63:
```typescript
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://*.public.blob.vercel-storage.com",
```
with:
```typescript
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com",
```

Replace line 64:
```typescript
              "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.google.com https://photon.komoot.io https://nominatim.openstreetmap.org https://ipwho.is https://get.geojs.io https://ip-api.com https://ipapi.co https://*.public.blob.vercel-storage.com",
```
with:
```typescript
              "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.google.com https://photon.komoot.io https://nominatim.openstreetmap.org https://ipwho.is https://get.geojs.io https://ip-api.com https://ipapi.co",
```

- [ ] **Step 3: Verify build works**

Run: `yarn build`
Expected: PASS — standalone output in `.next/standalone/`

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: add standalone output, update CSP headers for self-hosted"
```

---

### Task 5: Remove Vercel dependencies and cleanup

**Files:**
- Delete: `src/infrastructure/blob/vercel-blob-storage.ts`
- Delete: `vercel.json`
- Modify: `package.json` (remove `@vercel/blob`, `@neondatabase/serverless`)

- [ ] **Step 1: Delete Vercel-specific files**

```bash
rm src/infrastructure/blob/vercel-blob-storage.ts
rm vercel.json
```

- [ ] **Step 2: Remove packages**

```bash
yarn remove @vercel/blob @neondatabase/serverless
```

- [ ] **Step 3: Verify no remaining @vercel/blob imports**

Run: `grep -r "@vercel/blob" src/`
Expected: No output (no remaining imports)

- [ ] **Step 4: Verify build still works**

Run: `yarn build`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `yarn test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Vercel Blob, Neon, and vercel.json"
```

---

### Task 6: Set up Hetzner server — database, directories, Caddy

**Files:** Server-side only (SSH commands)

- [ ] **Step 1: Create PostgreSQL database and user**

```bash
ssh root@204.168.176.128 "sudo -u postgres psql -c \"CREATE USER sweptmind WITH PASSWORD '<generate-secure-password>';\""
ssh root@204.168.176.128 "sudo -u postgres psql -c \"CREATE DATABASE sweptmind OWNER sweptmind;\""
ssh root@204.168.176.128 "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE sweptmind TO sweptmind;\""
```

- [ ] **Step 2: Create app directory and uploads directory**

```bash
ssh root@204.168.176.128 "mkdir -p /opt/sweptmind /opt/sweptmind-uploads"
```

- [ ] **Step 3: Clone the repository**

```bash
ssh root@204.168.176.128 "cd /opt/sweptmind && git clone https://github.com/<user>/sweptmind.git ."
```

Or if the repo is private, set up a deploy key or use HTTPS with token.

- [ ] **Step 4: Create .env.local on the server**

```bash
ssh root@204.168.176.128 "cat > /opt/sweptmind/.env.local << 'ENVEOF'
DATABASE_URL=postgresql://sweptmind:<password>@localhost:5432/sweptmind
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
AUTH_URL=https://sweptmind.com
AUTH_GOOGLE_ID=<from-vercel-env>
AUTH_GOOGLE_SECRET=<from-vercel-env>
AUTH_FACEBOOK_ID=<from-vercel-env>
AUTH_FACEBOOK_SECRET=<from-vercel-env>
VAPID_PUBLIC_KEY=<from-vercel-env>
VAPID_PRIVATE_KEY=<from-vercel-env>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<from-vercel-env>
CRON_SECRET=<generate-with-openssl-rand-base64-32>
FIREBASE_SERVICE_ACCOUNT=<from-vercel-env>
STRIPE_SECRET_KEY=<from-vercel-env>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from-vercel-env>
STRIPE_WEBHOOK_SECRET=<from-vercel-env>
STRIPE_PRICE_MONTHLY_ID=<from-vercel-env>
STRIPE_PRICE_YEARLY_ID=<from-vercel-env>
FIO_API_TOKEN=<from-vercel-env>
FIO_ACCOUNT_NUMBER=<from-vercel-env>
UPLOADS_PATH=/opt/sweptmind-uploads
LLM_PROVIDER=openai
LLM_API_KEY=<from-vercel-env>
LLM_MODEL=gpt-4o-mini
ENVEOF"
```

Note: Copy actual values from Vercel dashboard (`vercel env pull`).

- [ ] **Step 5: Update Caddy config**

Add the SweptMind block to `/etc/caddy/Caddyfile`:

```
sweptmind.com {
    handle /uploads/* {
        root * /opt/sweptmind-uploads
        file_server
    }
    handle {
        reverse_proxy localhost:3005
    }
}
```

Validate and reload:

```bash
ssh root@204.168.176.128 "caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy"
```

- [ ] **Step 6: Commit** (nothing to commit — server-side only)

---

### Task 7: Build and deploy on Hetzner

**Files:** Server-side only

- [ ] **Step 1: Install Node.js dependencies and build**

```bash
ssh root@204.168.176.128 "cd /opt/sweptmind && yarn install --frozen-lockfile && yarn build"
```

- [ ] **Step 2: Push database schema**

```bash
ssh root@204.168.176.128 "cd /opt/sweptmind && yarn db:push"
```

- [ ] **Step 3: Start with pm2**

```bash
ssh root@204.168.176.128 "cd /opt/sweptmind && PORT=3005 pm2 start .next/standalone/server.js --name sweptmind && pm2 save"
```

- [ ] **Step 4: Verify the app is running**

```bash
ssh root@204.168.176.128 "pm2 list && curl -s -o /dev/null -w '%{http_code}' http://localhost:3005"
```

Expected: pm2 shows `sweptmind` as `online`, curl returns `200` (or `302` for auth redirect).

---

### Task 8: Set up systemd cron timers

**Files:** Server-side only (systemd units)

- [ ] **Step 1: Create push notification timer**

```bash
ssh root@204.168.176.128 "cat > /etc/systemd/system/sweptmind-push.service << 'EOF'
[Unit]
Description=SweptMind push notifications
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -H "Authorization: Bearer CRON_SECRET_PLACEHOLDER" http://localhost:3005/api/push/send
EOF"
```

```bash
ssh root@204.168.176.128 "cat > /etc/systemd/system/sweptmind-push.timer << 'EOF'
[Unit]
Description=SweptMind push notifications timer

[Timer]
OnCalendar=*-*-* 08:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF"
```

Replace `CRON_SECRET_PLACEHOLDER` with the actual value from `.env.local`.

- [ ] **Step 2: Create Google Calendar sync timer (every 5 minutes)**

```bash
ssh root@204.168.176.128 "cat > /etc/systemd/system/sweptmind-gcal-sync.service << 'EOF'
[Unit]
Description=SweptMind Google Calendar sync
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -H "Authorization: Bearer CRON_SECRET_PLACEHOLDER" http://localhost:3005/api/cron/sync-google-calendar
EOF"
```

```bash
ssh root@204.168.176.128 "cat > /etc/systemd/system/sweptmind-gcal-sync.timer << 'EOF'
[Unit]
Description=SweptMind Google Calendar sync timer

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF"
```

- [ ] **Step 3: Create Google Calendar watch renewal timer**

```bash
ssh root@204.168.176.128 "cat > /etc/systemd/system/sweptmind-gcal-renew.service << 'EOF'
[Unit]
Description=SweptMind Google Calendar watch renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -H "Authorization: Bearer CRON_SECRET_PLACEHOLDER" http://localhost:3005/api/cron/renew-google-watches
EOF"
```

```bash
ssh root@204.168.176.128 "cat > /etc/systemd/system/sweptmind-gcal-renew.timer << 'EOF'
[Unit]
Description=SweptMind Google Calendar watch renewal timer

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF"
```

- [ ] **Step 4: Enable and start all timers**

```bash
ssh root@204.168.176.128 "systemctl daemon-reload && systemctl enable --now sweptmind-push.timer sweptmind-gcal-sync.timer sweptmind-gcal-renew.timer"
```

- [ ] **Step 5: Verify timers are active**

```bash
ssh root@204.168.176.128 "systemctl list-timers sweptmind-*"
```

Expected: All 3 timers listed with correct schedules.

---

### Task 9: Migrate data from Vercel

**Files:** None (data migration)

- [ ] **Step 1: Export database from Vercel Postgres**

On local machine, pull Vercel env to get the production DATABASE_URL:

```bash
vercel env pull .env.production.local
source .env.production.local
pg_dump "$DATABASE_URL" --no-owner --no-acl > /tmp/sweptmind-vercel-dump.sql
rm .env.production.local
```

- [ ] **Step 2: Import into Hetzner PostgreSQL**

```bash
scp /tmp/sweptmind-vercel-dump.sql root@204.168.176.128:/tmp/
ssh root@204.168.176.128 "sudo -u postgres psql sweptmind < /tmp/sweptmind-vercel-dump.sql"
```

- [ ] **Step 3: Verify data**

```bash
ssh root@204.168.176.128 "sudo -u postgres psql sweptmind -c 'SELECT count(*) FROM users; SELECT count(*) FROM tasks; SELECT count(*) FROM lists;'"
```

- [ ] **Step 4: Migrate Vercel Blob attachments (if any)**

Check how many attachments exist:

```bash
ssh root@204.168.176.128 "sudo -u postgres psql sweptmind -c \"SELECT count(*) FROM task_attachments;\""
```

If there are attachments, download them from Vercel Blob URLs and save to `/opt/sweptmind-uploads/`. Update `blob_url` column to the new `/uploads/...` format. If there are very few or none, skip this step.

---

### Task 10: DNS cutover and verification

**Files:** None (DNS + verification)

- [ ] **Step 1: Update DNS in Subreg**

Change the A record for `sweptmind.com` to `204.168.176.128`. Also update `www.sweptmind.com` if it exists.

- [ ] **Step 2: Wait for DNS propagation**

```bash
dig sweptmind.com +short
```

Expected: `204.168.176.128`

- [ ] **Step 3: Verify HTTPS works**

```bash
curl -I https://sweptmind.com
```

Expected: HTTP/2 200 or 302 (Caddy auto-provisions Let's Encrypt cert).

- [ ] **Step 4: Verify cron jobs fire correctly**

```bash
ssh root@204.168.176.128 "systemctl start sweptmind-push.service && journalctl -u sweptmind-push.service --no-pager -n 5"
```

Expected: Successful curl response from the push endpoint.

- [ ] **Step 5: Verify app functionality**

Test manually:
- Login (Google OAuth, Facebook OAuth, credentials)
- Create/complete tasks
- Upload an attachment (premium)
- Verify push notifications

- [ ] **Step 6: Update CLAUDE.md**

Remove Vercel-specific deployment instructions. Add Hetzner deployment section. Update environment variable list (remove `BLOB_READ_WRITE_TOKEN`, add `UPLOADS_PATH`).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Hetzner deployment"
```

---

### Task 11: Decommission Vercel (after stability period)

**Files:** None

- [ ] **Step 1: Wait 2-3 days** after DNS cutover to confirm stability
- [ ] **Step 2: Disable Vercel deployment** (remove git integration or delete project)
- [ ] **Step 3: Revoke Vercel Blob token** if no longer needed
