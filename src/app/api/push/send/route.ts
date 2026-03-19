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
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(
    "mailto:noreply@sweptmind.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const now = new Date();
  const nowIso = now.toISOString().slice(0, 16);

  const tasks = await db.query.tasks.findMany({
    where: and(
      isNotNull(schema.tasks.dueDate),
      eq(schema.tasks.isCompleted, false),
      isNull(schema.tasks.notifiedAt),
    ),
  });

  const dueTasks = tasks.filter((t) => t.dueDate && t.dueDate.includes("T") && t.dueDate <= nowIso);

  if (dueTasks.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

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
    await db.update(schema.tasks).set({ notifiedAt: now }).where(eq(schema.tasks.id, task.id));

    const subscriptions = (subsByUser.get(task.userId) ?? []).filter((sub) => sub.notifyDueDate);
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
        const errObj = error as Record<string, unknown> | null;
        const statusCode = errObj && typeof errObj.statusCode === "number" ? errObj.statusCode : 0;

        const isFcmGone = errObj && errObj.code === "messaging/registration-token-not-registered";

        if (statusCode === 410 || isFcmGone) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
        }
      }
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
