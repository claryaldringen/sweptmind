import { db } from "@/server/db";
import * as schema from "@/server/db/schema/auth";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  status?: string;
}

export interface GoogleEventsListResponse {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
}

export interface GoogleTokens {
  access_token: string;
  expires_at: number;
  refresh_token: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async function getGoogleAccount(userId: string) {
  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "google")));

  if (!account) {
    throw new Error(`No Google account linked for user ${userId}`);
  }
  return account;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function getValidAccessToken(userId: string): Promise<string> {
  const account = await getGoogleAccount(userId);

  const nowSec = Math.floor(Date.now() / 1000);
  // If token is still valid (with 60s buffer), return it
  if (account.access_token && account.expires_at && account.expires_at > nowSec + 60) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error(`No refresh token for user ${userId}`);
  }

  const tokens = await refreshAccessToken(account.refresh_token);

  const newExpiresAt = nowSec + tokens.expires_in;
  await db
    .update(schema.accounts)
    .set({
      access_token: tokens.access_token,
      expires_at: newExpiresAt,
    })
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "google")));

  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Fetch helper with auto-retry on 401
// ---------------------------------------------------------------------------

async function calendarFetch(
  userId: string,
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<Response> {
  const token = await getValidAccessToken(userId);

  const res = await fetch(`${CALENDAR_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  // Auto-retry once on 401 (force token refresh)
  if (res.status === 401 && !_retried) {
    // Invalidate the current token by setting expires_at to 0
    await db
      .update(schema.accounts)
      .set({ expires_at: 0 })
      .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.provider, "google")));
    return calendarFetch(userId, path, options, true);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function insertEvent(
  userId: string,
  calendarId: string,
  event: GoogleCalendarEvent,
): Promise<GoogleCalendarEvent> {
  const res = await calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insertEvent failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function patchEvent(
  userId: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEvent>,
): Promise<GoogleCalendarEvent> {
  const res = await calendarFetch(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`patchEvent failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function deleteEvent(
  userId: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await calendarFetch(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );

  // Ignore 404/410 — event already deleted
  if (res.status === 404 || res.status === 410) return;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`deleteEvent failed (${res.status}): ${text}`);
  }
}

export async function listEvents(
  userId: string,
  calendarId: string,
  syncToken?: string,
): Promise<GoogleEventsListResponse> {
  const params = new URLSearchParams();
  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    // Full sync — only future events
    params.set("timeMin", new Date().toISOString());
    params.set("singleEvents", "true");
  }
  params.set("maxResults", "2500");

  const res = await calendarFetch(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );

  // 410 Gone → syncToken expired, do full sync
  if (res.status === 410 && syncToken) {
    return listEvents(userId, calendarId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`listEvents failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    items: data.items ?? [],
    nextSyncToken: data.nextSyncToken,
  };
}

export async function watchEvents(
  userId: string,
  calendarId: string,
  channelId: string,
  webhookUrl: string,
  token?: string,
): Promise<{ expiration: string }> {
  const body: Record<string, string> = {
    id: channelId,
    type: "web_hook",
    address: webhookUrl,
  };
  if (token) {
    body.token = token;
  }

  const res = await calendarFetch(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`watchEvents failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { expiration: data.expiration };
}

export async function stopChannel(
  userId: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const res = await calendarFetch(userId, "/channels/stop", {
    method: "POST",
    body: JSON.stringify({
      id: channelId,
      resourceId,
    }),
  });

  // Ignore errors — channel may already have expired
  if (!res.ok) {
    const text = await res.text();
    console.warn(`stopChannel warning (${res.status}): ${text}`);
  }
}
