export interface GoogleCalendarEventData {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  status?: string;
  /** RRULE strings from Google Calendar (e.g. ["RRULE:FREQ=YEARLY"]) */
  recurrence?: string[];
}

export interface IGoogleCalendarClient {
  insertEvent(
    userId: string,
    calendarId: string,
    event: GoogleCalendarEventData,
  ): Promise<GoogleCalendarEventData>;
  patchEvent(
    userId: string,
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEventData>,
  ): Promise<GoogleCalendarEventData>;
  deleteEvent(userId: string, calendarId: string, eventId: string): Promise<void>;
  listEvents(
    userId: string,
    calendarId: string,
    syncToken?: string,
  ): Promise<{ items: GoogleCalendarEventData[]; nextSyncToken?: string }>;
  watchEvents(
    userId: string,
    calendarId: string,
    channelId: string,
    webhookUrl: string,
    token?: string,
  ): Promise<{ expiration: string }>;
  stopChannel(userId: string, channelId: string, resourceId: string): Promise<void>;
}
