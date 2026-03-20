import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Get all user locations
  const locations = await services.location.getByUser(userId);
  if (locations.length === 0) {
    return NextResponse.json({ geofences: [] });
  }

  // Get all tasks with location assigned (non-completed only)
  const tasksWithLocation = await services.task.getWithLocation(userId);
  const activeTasks = tasksWithLocation.filter((t) => !t.isCompleted);

  // Build geofence registrations — one per location that has active tasks
  const activeLocationIds = new Set(activeTasks.map((t) => t.locationId).filter(Boolean));

  const geofences = locations
    .filter((loc) => activeLocationIds.has(loc.id))
    .map((loc) => {
      const tasks = activeTasks.filter((t) => t.locationId === loc.id);
      const body = tasks.length === 1 ? tasks[0].title : `${tasks[0].title} (+${tasks.length - 1})`;

      return {
        identifier: `location:${loc.id}`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusMeters: Math.max(loc.radius * 1000, 200),
        notificationTitle: loc.name,
        notificationBody: body,
      };
    });

  return NextResponse.json({ geofences });
}
