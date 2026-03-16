import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { services } from "@/infrastructure/container";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
  }

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
      return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
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
    await services.googleCalendar.pullChanges(userId);

    return NextResponse.redirect(new URL("/settings?gcal=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
  }
}
