import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";
import { PushSubscriptionService } from "@/domain/services/push-subscription.service";
import type { PushPlatform } from "@/domain/entities/push-subscription";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const platform: PushPlatform = PushSubscriptionService.isValidPlatform(body?.platform)
    ? body.platform
    : "web";

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.slice(0, 2048) : null;
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  let p256dh: string;
  let authKey: string;

  if (platform === "web") {
    p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh.slice(0, 512) : "";
    authKey = typeof body?.keys?.auth === "string" ? body.keys.auth.slice(0, 512) : "";
    if (!p256dh || !authKey) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
  } else {
    p256dh = "_";
    authKey = "_";
  }

  const notifyDueDate = body?.notifyDueDate !== false;
  const notifyReminder = body?.notifyReminder !== false;

  await services.pushSubscription.subscribe(session.user.id, {
    endpoint,
    p256dh,
    auth: authKey,
    platform,
    notifyDueDate,
    notifyReminder,
  });

  return NextResponse.json({ ok: true });
}
