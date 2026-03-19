import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await request.json();
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await services.pushSubscription.unsubscribe(session.user.id, endpoint);

  return NextResponse.json({ ok: true });
}
