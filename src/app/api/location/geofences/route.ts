import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatGeofenceBody } from "@/domain/services/geofence-registrations";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Location reminders as they should be now. The Android app asks right before showing a
 * geofence notification (with the WebView's session cookie), so a task completed on another
 * device doesn't announce itself from the phone's stale copy. The request carries no location
 * and no place — the app looks its geofence up in the whole list. `?today=YYYY-MM-DD` is the
 * phone's date, which the app built its geofences for.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = request.nextUrl.searchParams.get("today");
  const andMore = dictionaries[await getRequestLocale()].locationReminders.andMore;
  const geofences = await services.locationReminder.getGeofences(
    session.user.id,
    (titles) =>
      formatGeofenceBody(titles, (shown, count) => interpolate(andMore, { titles: shown, count })),
    today && DATE_RE.test(today) ? today : undefined,
  );

  return NextResponse.json({ geofences }, { headers: { "Cache-Control": "no-store" } });
}
