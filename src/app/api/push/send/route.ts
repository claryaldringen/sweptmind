import { NextRequest, NextResponse } from "next/server";
import { missedRecurrenceJob, taskReminderJob } from "@/infrastructure/container";

// Triggered every minute by the systemd timer sweptmind-push. Missed recurring tasks
// move on first, so a task moved to today makes it into the morning digest.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skippedMissed = await missedRecurrenceJob.run();
  const result = await taskReminderJob.run();
  return NextResponse.json({ ...result, skippedMissed });
}
