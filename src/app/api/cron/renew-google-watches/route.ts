import { NextRequest, NextResponse } from "next/server";
import { services, repos } from "@/infrastructure/container";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 2);

  const users = await repos.user.findUsersWithExpiringChannels(threshold);
  const webhookUrl = `${process.env.AUTH_URL}/api/google-calendar/webhook`;
  let renewed = 0;

  for (const user of users) {
    try {
      // Clear existing channel settings (channel will be replaced by a new one).
      // We cannot call stopChannel because resourceId is not persisted.
      await services.user.updateGoogleCalendarChannel(user.id, null, null);
      await services.googleCalendar.registerWatch(user.id, webhookUrl);
      renewed++;
    } catch (error) {
      console.error(`Failed to renew watch for user ${user.id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, renewed });
}
