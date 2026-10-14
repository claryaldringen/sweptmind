import type { GeofenceRegistration } from "@sweptmind/native-bridge";
import type {
  AppTask,
  ListItem,
  TagItem,
  LocationItem,
} from "@/components/providers/app-data-provider";
import { isFutureTask } from "@/domain/services/task-visibility";

/** Android allows 100 geofences per app; keep a margin. (iOS would need 20 — Android-only for now.) */
export const MAX_GEOFENCES = 90;
const MIN_RADIUS_METERS = 200;
const NOTIFICATION_URL = "/context";

interface Place {
  locationId: string;
  radiusKm: number | null; // null = location's default radius
}

/**
 * Places where a task can be done — the same rules as the Context page: the task's own
 * location, its list's location and the locations of its tags, each with its own radius.
 */
function placesOf(
  task: AppTask,
  listsById: Map<string, ListItem>,
  tagsById: Map<string, TagItem>,
): Place[] {
  const places: Place[] = [];
  if (task.locationId) places.push({ locationId: task.locationId, radiusKm: task.locationRadius });

  const list = listsById.get(task.listId);
  if (list?.locationId) places.push({ locationId: list.locationId, radiusKm: list.locationRadius });

  for (const taskTag of task.tags ?? []) {
    const tag = tagsById.get(taskTag.id);
    if (tag?.locationId) places.push({ locationId: tag.locationId, radiusKm: tag.locationRadius });
  }
  return places;
}

/** One geofence per (location, radius) with at least one actionable task. */
export function buildGeofenceRegistrations(input: {
  tasks: AppTask[];
  lists: ListItem[];
  tags: TagItem[];
  locations: LocationItem[];
  today: string;
  formatBody: (taskTitles: string[]) => string;
}): GeofenceRegistration[] {
  const locationsById = new Map(input.locations.map((l) => [l.id, l]));
  const listsById = new Map(input.lists.map((l) => [l.id, l]));
  const tagsById = new Map(input.tags.map((t) => [t.id, t]));

  const groups = new Map<
    string,
    { location: LocationItem; radiusMeters: number; titles: string[] }
  >();

  for (const task of input.tasks) {
    if (task.isCompleted || isFutureTask(task, input.today)) continue;

    const seen = new Set<string>();
    for (const place of placesOf(task, listsById, tagsById)) {
      const location = locationsById.get(place.locationId);
      if (!location) continue;

      const radiusMeters = Math.max(
        Math.round((place.radiusKm ?? location.radius) * 1000),
        MIN_RADIUS_METERS,
      );
      const key = `location:${location.id}:${radiusMeters}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const group = groups.get(key) ?? { location, radiusMeters, titles: [] };
      group.titles.push(task.title);
      groups.set(key, group);
    }
  }

  return [...groups.entries()]
    .sort(([, a], [, b]) => b.titles.length - a.titles.length)
    .slice(0, MAX_GEOFENCES)
    .map(([identifier, { location, radiusMeters, titles }]) => ({
      identifier,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters,
      notificationTitle: location.name,
      notificationBody: input.formatBody(titles),
      notificationUrl: NOTIFICATION_URL,
    }));
}
