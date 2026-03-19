import { NextRequest, NextResponse } from "next/server";
import { repos, services } from "@/infrastructure/container";
import { taskToVevent } from "@/server/caldav/ical-converter";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = await repos.user.findByCalendarToken(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const tasks = await services.calendar.getSyncableTasks(
    user.id,
    user.calendarSyncAll,
    user.calendarSyncDateRange,
  );

  const vevents: string[] = [];
  for (const task of tasks) {
    const syncEntry = await services.calendar.getSyncEntry(task.id);
    const icalUid = syncEntry?.icalUid ?? `${task.id}@sweptmind`;
    vevents.push(taskToVevent(task, icalUid));
  }

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SweptMind//SweptMind//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SweptMind",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sweptmind.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
