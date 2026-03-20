import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(request, {
    maxRequests: 10,
    windowMs: 60_000,
    key: `location-report:${session.user.id}`,
  });
  if (limited) return limited;

  const body = await request.json();
  const locationId = typeof body?.locationId === "string" ? body.locationId : null;
  const type = body?.type === "enter" || body?.type === "exit" ? body.type : null;

  if (!locationId || !type) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  // For now, just acknowledge. Analytics/server-side notification logic
  // can be added later when needed.
  return NextResponse.json({ ok: true });
}
