import { NextRequest, NextResponse } from "next/server";
import { services } from "@/infrastructure/container";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq } from "drizzle-orm";
import { computeChannelToken } from "@/domain/services/google-calendar.service";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");
  const channelToken = req.headers.get("x-goog-channel-token");

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
  }

  // Verify the channel token (HMAC of channelId) to prevent spoofed webhooks
  const expectedToken = computeChannelToken(channelId);
  if (channelToken !== expectedToken) {
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
    return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  }

  try {
    await services.googleCalendar.pullChanges(user.id);
  } catch (error) {
    console.error("Google Calendar pull failed:", error);
  }

  return NextResponse.json({ ok: true });
}
