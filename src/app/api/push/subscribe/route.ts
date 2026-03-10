import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.slice(0, 2048) : null;
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh.slice(0, 512) : null;
  const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth.slice(0, 512) : null;

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
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
    notifyDueDate,
    notifyReminder,
  });

  return NextResponse.json({ ok: true });
}
