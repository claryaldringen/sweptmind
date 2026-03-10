import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return preferences from any subscription (they're the same for all devices)
  const sub = await db.query.pushSubscriptions.findFirst({
    where: eq(schema.pushSubscriptions.userId, session.user.id),
  });

  return NextResponse.json({
    notifyDueDate: sub?.notifyDueDate ?? true,
    notifyReminder: sub?.notifyReminder ?? true,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, boolean> = {};
  if (typeof body?.notifyDueDate === "boolean") updates.notifyDueDate = body.notifyDueDate;
  if (typeof body?.notifyReminder === "boolean") updates.notifyReminder = body.notifyReminder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No preferences to update" }, { status: 400 });
  }

  // Update all subscriptions for this user
  await db
    .update(schema.pushSubscriptions)
    .set(updates)
    .where(eq(schema.pushSubscriptions.userId, session.user.id));

  return NextResponse.json({ ok: true });
}
