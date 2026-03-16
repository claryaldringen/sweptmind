import type { CalendarService } from "@/domain/services/calendar.service";
import type { IUserRepository } from "@/domain/repositories/user.repository";
import { taskToVevent, veventToTaskData } from "./ical-converter";
import {
  buildPropfindResponse,
  buildMultistatus,
  buildCalendarMultigetResponse,
} from "./xml-builder";

interface CalDavUser {
  id: string;
  calendarSyncAll: boolean;
  calendarSyncDateRange: boolean;
  calendarTargetListId: string | null;
}

export class CalDavHandler {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly userRepo: IUserRepository,
  ) {}

  async authenticate(token: string): Promise<CalDavUser | null> {
    const user = await this.userRepo.findByCalendarToken(token);
    if (!user) return null;
    return {
      id: user.id,
      calendarSyncAll: user.calendarSyncAll,
      calendarSyncDateRange: user.calendarSyncDateRange,
      calendarTargetListId: user.calendarTargetListId,
    };
  }

  async handlePropfind(token: string, path: string): Promise<{ status: number; body: string }> {
    const base = `/api/caldav/${token}`;

    if (path === "/" || path === "") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/`, {
          displayname: "SweptMind",
          "current-user-principal": `${base}/principal/`,
        }),
      };
    }

    if (path === "/principal/" || path === "/principal") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/principal/`, {
          "calendar-home-set": `${base}/calendars/`,
        }),
      };
    }

    if (path === "/calendars/" || path === "/calendars") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/calendars/`, {
          displayname: "Calendars",
        }),
      };
    }

    if (path === "/calendars/tasks/" || path === "/calendars/tasks") {
      return {
        status: 207,
        body: buildPropfindResponse(`${base}/calendars/tasks/`, {
          displayname: "SweptMind Tasks",
          "resourcetype-calendar": "true",
          "supported-calendar-component-set": "VEVENT",
          getctag: `"${Date.now()}"`,
        }),
      };
    }

    return { status: 404, body: "Not Found" };
  }

  async handleReport(
    token: string,
    user: CalDavUser,
    body: string,
  ): Promise<{ status: number; body: string }> {
    const base = `/api/caldav/${token}`;
    const tasks = await this.calendarService.getSyncableTasks(
      user.id,
      user.calendarSyncAll,
      user.calendarSyncDateRange,
    );
    const isMultiget = body.includes("calendar-multiget");

    if (isMultiget) {
      const hrefRegex = /<d:href>([^<]+)<\/d:href>/gi;
      const requestedHrefs: string[] = [];
      let match;
      while ((match = hrefRegex.exec(body)) !== null) {
        requestedHrefs.push(match[1]);
      }

      const items: { href: string; etag: string; calendarData: string }[] = [];
      for (const task of tasks) {
        const syncEntry = await this.calendarService.getSyncEntry(task.id);
        const icalUid = syncEntry?.icalUid ?? task.id;
        const href = `${base}/calendars/tasks/${icalUid}.ics`;
        if (requestedHrefs.length > 0 && !requestedHrefs.includes(href)) continue;
        const vevent = taskToVevent(task, icalUid);
        const calendarData = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SweptMind//CalDAV//EN\r\n${vevent}\r\nEND:VCALENDAR`;
        const etag = this.calendarService.generateEtag(task);
        items.push({ href, etag, calendarData });
      }

      return {
        status: 207,
        body: buildCalendarMultigetResponse(items),
      };
    }

    // calendar-query: return hrefs + etags
    const items: { href: string; etag: string }[] = [];
    for (const task of tasks) {
      const syncEntry = await this.calendarService.getSyncEntry(task.id);
      const icalUid = syncEntry?.icalUid ?? task.id;
      items.push({
        href: `${base}/calendars/tasks/${icalUid}.ics`,
        etag: this.calendarService.generateEtag(task),
      });
    }

    return { status: 207, body: buildMultistatus(items) };
  }

  async handleGet(
    token: string,
    user: CalDavUser,
    icalUid: string,
  ): Promise<{ status: number; body: string; etag?: string }> {
    const syncEntry = await this.calendarService.getSyncEntryByIcalUid(user.id, icalUid);
    const taskId = syncEntry?.taskId ?? icalUid;
    const tasks = await this.calendarService.getSyncableTasks(
      user.id,
      user.calendarSyncAll,
      user.calendarSyncDateRange,
    );
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { status: 404, body: "Not Found" };

    const uid = syncEntry?.icalUid ?? task.id;
    const vevent = taskToVevent(task, uid);
    const calendarData = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SweptMind//CalDAV//EN\r\n${vevent}\r\nEND:VCALENDAR`;

    return {
      status: 200,
      body: calendarData,
      etag: this.calendarService.generateEtag(task),
    };
  }

  async handlePut(
    token: string,
    user: CalDavUser,
    icalUid: string,
    body: string,
    ifMatch?: string | null,
  ): Promise<{ status: number; body: string; etag?: string }> {
    const data = veventToTaskData(body);
    if (!data) return { status: 400, body: "Invalid iCal data" };

    if (!user.calendarTargetListId) {
      return { status: 400, body: "No target list configured" };
    }

    if (ifMatch) {
      const existing = await this.calendarService.getSyncEntryByIcalUid(user.id, data.icalUid);
      if (existing && existing.etag !== ifMatch) {
        return { status: 412, body: "Precondition Failed" };
      }
    }

    const { task } = await this.calendarService.upsertFromIcal(
      user.id,
      user.calendarTargetListId,
      data,
    );

    return {
      status: 201,
      body: "",
      etag: this.calendarService.generateEtag(task),
    };
  }

  async handleDelete(user: CalDavUser, icalUid: string): Promise<{ status: number; body: string }> {
    await this.calendarService.deleteFromIcal(user.id, icalUid);
    return { status: 204, body: "" };
  }
}
