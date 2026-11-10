/**
 * Location reminders: one geofence per place (location + radius) where an actionable task can
 * be done. The Android app registers them with the OS, and the server computes the same ones
 * so the app can check, right before showing a notification, that the place still has one.
 */
import { isFutureTask } from "./task-visibility";

/** Android allows 100 geofences per app; keep a margin. (iOS would need 20 — Android-only for now.) */
export const MAX_GEOFENCES = 90;
const MIN_RADIUS_METERS = 200;
const NOTIFICATION_URL = "/context";
const BODY_MAX_TITLES = 3;

export interface GeofenceTask {
  title: string;
  listId: string;
  locationId: string | null;
  locationRadius: number | null; // km, null = location's default radius
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence?: string | null;
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
  tags?: { id: string }[] | null;
}

/** A list or a tag — both can carry a location for all their tasks. */
export interface GeofenceLocatable {
  id: string;
  locationId: string | null;
  locationRadius: number | null;
}

export interface GeofenceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // km
}

export interface GeofenceRegistration {
  identifier: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  notificationTitle: string;
  notificationBody: string;
  /** App path opened when the notification is tapped */
  notificationUrl: string;
}

interface Place {
  locationId: string;
  radiusKm: number | null; // null = location's default radius
}

/**
 * Places where a task can be done — the same rules as the Context page: the task's own
 * location, its list's location and the locations of its tags, each with its own radius.
 */
function placesOf(
  task: GeofenceTask,
  listsById: Map<string, GeofenceLocatable>,
  tagsById: Map<string, GeofenceLocatable>,
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

/** Notification text: the first few task titles, the rest as a count ("A, B, C and 2 more"). */
export function formatGeofenceBody(
  titles: string[],
  andMore: (shownTitles: string, restCount: number) => string,
): string {
  const shown = titles.slice(0, BODY_MAX_TITLES).join(", ");
  const rest = titles.length - BODY_MAX_TITLES;
  return rest > 0 ? andMore(shown, rest) : shown;
}

/**
 * One geofence per (location, radius) with at least one actionable task — at most
 * [maxGeofences] (default [MAX_GEOFENCES], the OS limit), the places with most tasks first.
 */
export function buildGeofenceRegistrations(input: {
  tasks: GeofenceTask[];
  lists: GeofenceLocatable[];
  tags: GeofenceLocatable[];
  locations: GeofenceLocation[];
  today: string;
  formatBody: (taskTitles: string[]) => string;
  maxGeofences?: number;
}): GeofenceRegistration[] {
  const locationsById = new Map(input.locations.map((l) => [l.id, l]));
  const listsById = new Map(input.lists.map((l) => [l.id, l]));
  const tagsById = new Map(input.tags.map((t) => [t.id, t]));

  const groups = new Map<
    string,
    { location: GeofenceLocation; radiusMeters: number; titles: string[] }
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
    .slice(0, input.maxGeofences ?? MAX_GEOFENCES)
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
