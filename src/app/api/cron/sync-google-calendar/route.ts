import { NextRequest, NextResponse } from "next/server";
import { services, repos } from "@/infrastructure/container";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await repos.user.findUsersWithGoogleCalendarEnabled();
  let totalPushed = 0;

  for (const user of users) {
    try {
      const pushed = await services.googleCalendar.pushUnsyncedTasks(user.id);
      totalPushed += pushed;
    } catch (error) {
      console.error(`Failed to sync tasks for user ${user.id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, users: users.length, pushed: totalPushed });
}
