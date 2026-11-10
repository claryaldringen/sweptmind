import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { ITagRepository } from "../repositories/tag.repository";
import type { ILocationRepository } from "../repositories/location.repository";
import type { IUserRepository } from "../repositories/user.repository";
import { buildGeofenceRegistrations, type GeofenceRegistration } from "./geofence-registrations";
import { resolveTimeZone, toLocalDateTime } from "./task-notifications";

/**
 * Location reminders as they should be right now. The Android app registers geofences from its
 * own copy of the data, which goes stale when a task is completed on another device while the
 * app isn't running; before showing a notification it checks against this.
 */
export class LocationReminderService {
  constructor(
    private readonly taskRepo: Pick<ITaskRepository, "findActiveByUser">,
    private readonly listRepo: Pick<IListRepository, "findByUser">,
    private readonly tagRepo: Pick<ITagRepository, "findByUser" | "findByTaskIds">,
    private readonly locationRepo: Pick<ILocationRepository, "findByUser">,
    private readonly userRepo: Pick<IUserRepository, "getTimeZone">,
  ) {}

  /**
   * The same geofences the app builds itself (see `buildGeofenceRegistrations`), but all of
   * them: the app registered at most `MAX_GEOFENCES`, and the order may have changed since.
   * [deviceToday]: the phone's date, which the app built its geofences for; without it, today
   * in the user's time zone.
   */
  async getGeofences(
    userId: string,
    formatBody: (taskTitles: string[]) => string,
    deviceToday?: string,
  ): Promise<GeofenceRegistration[]> {
    const [tasks, lists, tags, locations, timeZone] = await Promise.all([
      this.taskRepo.findActiveByUser(userId),
      this.listRepo.findByUser(userId),
      this.tagRepo.findByUser(userId),
      this.locationRepo.findByUser(userId),
      this.userRepo.getTimeZone(userId).catch(() => null),
    ]);
    const tagsByTaskId = await this.tagRepo.findByTaskIds(tasks.map((t) => t.id));
    const activeTaskIds = new Set(tasks.map((t) => t.id));

    return buildGeofenceRegistrations({
      tasks: tasks.map((task) => ({
        ...task,
        tags: tagsByTaskId.get(task.id) ?? [],
        // A blocker that isn't among the active tasks is completed (or gone) — no longer blocks
        blockedByTaskIsCompleted: task.blockedByTaskId
          ? !activeTaskIds.has(task.blockedByTaskId)
          : null,
      })),
      lists,
      tags,
      locations,
      today: deviceToday ?? toLocalDateTime(new Date(), resolveTimeZone(timeZone)).date,
      formatBody,
      maxGeofences: Number.POSITIVE_INFINITY,
    });
  }
}
