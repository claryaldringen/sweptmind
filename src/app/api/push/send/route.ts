import { NextRequest, NextResponse } from "next/server";
import { taskReminderJob } from "@/infrastructure/container";

// Triggered every minute by the systemd timer sweptmind-push
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await taskReminderJob.run();
  return NextResponse.json(result);
}
