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
    p256dh = "_";
    authKey = "_";
  }

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
