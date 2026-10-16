import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { services } from "@/infrastructure/container";
import { describePullStats } from "@/domain/services/google-calendar.service";
import { auth } from "@/lib/auth";
import { publicUrl } from "@/lib/public-url";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(publicUrl("/settings?gcal=error", req));
  }

  const session = await auth();
  if (!session?.user?.id || session.user.id !== state) {
    return NextResponse.redirect(publicUrl("/settings?gcal=error", req));
  }

  const userId = session.user.id;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        redirect_uri: `${process.env.AUTH_URL}/api/google-calendar/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(publicUrl("/settings?gcal=error", req));
    }

    const tokens = await tokenRes.json();

    await db
      .update(schema.accounts)
      .set({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        scope: tokens.scope,
      })
      .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "google")));

    await services.user.updateGoogleCalendarEnabled(userId, true);

    const webhookUrl = `${process.env.AUTH_URL}/api/google-calendar/webhook`;
    await services.googleCalendar.registerWatch(userId, webhookUrl);
    const stats = await services.googleCalendar.pullChanges(userId);
    console.log(`[gcal] initial pull user ${userId}: ${describePullStats(stats)}`);

    return NextResponse.redirect(publicUrl("/settings?gcal=connected", req));
  } catch {
    return NextResponse.redirect(publicUrl("/settings?gcal=error", req));
  }
}
