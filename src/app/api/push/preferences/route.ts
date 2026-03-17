import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await services.pushSubscription.getPreferences(session.user.id);

  return NextResponse.json(prefs);
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

  await services.pushSubscription.updatePreferences(session.user.id, updates);

  return NextResponse.json({ ok: true });
}
