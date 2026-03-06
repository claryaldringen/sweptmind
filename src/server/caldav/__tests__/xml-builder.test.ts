import { describe, it, expect } from "vitest";
import {
  buildMultistatus,
  buildPropfindResponse,
  buildCalendarMultigetResponse,
} from "../xml-builder";

describe("buildPropfindResponse", () => {
  it("builds principal discovery response", () => {
    const xml = buildPropfindResponse("/api/caldav/tok123/", {
      displayname: "SweptMind",
      "current-user-principal": "/api/caldav/tok123/principal/",
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<d:multistatus");
    expect(xml).toContain("<d:displayname>SweptMind</d:displayname>");
    expect(xml).toContain("/api/caldav/tok123/principal/");
  });
  it("builds calendar-home-set response", () => {
    const xml = buildPropfindResponse("/api/caldav/tok123/principal/", {
      "calendar-home-set": "/api/caldav/tok123/calendars/",
    });
    expect(xml).toContain("calendar-home-set");
    expect(xml).toContain("/api/caldav/tok123/calendars/");
  });
});

describe("buildCalendarMultigetResponse", () => {
  it("builds response with multiple events", () => {
    const items = [
      {
        href: "/api/caldav/tok/calendars/tasks/uid1.ics",
        etag: '"etag1"',
        calendarData: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:uid1\r\nEND:VEVENT\r\nEND:VCALENDAR",
      },
      {
        href: "/api/caldav/tok/calendars/tasks/uid2.ics",
        etag: '"etag2"',
        calendarData: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:uid2\r\nEND:VEVENT\r\nEND:VCALENDAR",
      },
    ];
    const xml = buildCalendarMultigetResponse(items);
    expect(xml).toContain("uid1.ics");
    expect(xml).toContain("uid2.ics");
    expect(xml).toContain('"etag1"');
    expect(xml).toContain('"etag2"');
  });
});

describe("buildMultistatus", () => {
  it("builds list of hrefs with etags", () => {
    const items = [{ href: "/api/caldav/tok/calendars/tasks/uid1.ics", etag: '"e1"' }];
    const xml = buildMultistatus(items);
    expect(xml).toContain("uid1.ics");
    expect(xml).toContain('"e1"');
  });
});
