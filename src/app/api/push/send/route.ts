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

  let sent = 0;
  for (const task of dueTasks) {
    // Mark as notified first to prevent duplicate notifications on timeout
    await db.update(schema.tasks).set({ notifiedAt: now }).where(eq(schema.tasks.id, task.id));

    const subscriptions = subsByUser.get(task.userId) ?? [];
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
        if (
          error &&
          typeof error === "object" &&
          "statusCode" in error &&
          (error as { statusCode: number }).statusCode === 410
        ) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
        }
      }
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
