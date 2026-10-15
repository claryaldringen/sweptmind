import { NextRequest, NextResponse } from "next/server";
import { services } from "@/infrastructure/container";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq } from "drizzle-orm";
import { computeChannelToken, describePullStats } from "@/domain/services/google-calendar.service";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");
  const channelToken = req.headers.get("x-goog-channel-token");

  if (!channelId) {
    console.warn("[gcal] webhook without channel ID");
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
  }

  // Verify the channel token (HMAC of channelId) to prevent spoofed webhooks
  const expectedToken = computeChannelToken(channelId);
  if (channelToken !== expectedToken) {
    console.warn(`[gcal] webhook with invalid token, channel ${channelId}`);
    return NextResponse.json({ error: "Invalid channel token" }, { status: 403 });
  }

  // Ignore sync messages (initial verification)
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  // Find user by channel ID
  const user = await db.query.users.findFirst({
    where: eq(schema.users.googleCalendarChannelId, channelId),
    columns: { id: true },
  });

  if (!user) {
    // Expected until a renewed channel's predecessor expires — renewal can't stop it
    // (its resourceId isn't stored)
    console.warn(`[gcal] webhook for unknown channel ${channelId}`);
    return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  }

  const startedAt = Date.now();
  try {
    const stats = await services.googleCalendar.pullChanges(user.id);
    console.log(
      `[gcal] webhook ${resourceState} user ${user.id}: ${describePullStats(stats)} ` +
        `(${Date.now() - startedAt} ms)`,
    );
  } catch (error) {
    console.error(`[gcal] pull failed for user ${user.id}:`, error);
  }

  return NextResponse.json({ ok: true });
}
