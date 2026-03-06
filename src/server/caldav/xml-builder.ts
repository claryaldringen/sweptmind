const DAV_NS = "DAV:";
const CALDAV_NS = "urn:ietf:params:xml:ns:caldav";
const CS_NS = "http://calendarserver.org/ns/";

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildPropfindResponse(
  href: string,
  props: Record<string, string>,
): string {
  const propLines: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    switch (key) {
      case "displayname":
        propLines.push(`<d:displayname>${escapeXml(value)}</d:displayname>`);
        break;
      case "current-user-principal":
        propLines.push(
          `<d:current-user-principal><d:href>${escapeXml(value)}</d:href></d:current-user-principal>`,
        );
        break;
      case "calendar-home-set":
        propLines.push(
          `<cal:calendar-home-set><d:href>${escapeXml(value)}</d:href></cal:calendar-home-set>`,
        );
        break;
      case "resourcetype-calendar":
        propLines.push(
          `<d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>`,
        );
        break;
      case "getctag":
        propLines.push(`<cs:getctag>${escapeXml(value)}</cs:getctag>`);
        break;
      case "supported-calendar-component-set":
        propLines.push(
          `<cal:supported-calendar-component-set><cal:comp name="VEVENT"/></cal:supported-calendar-component-set>`,
        );
        break;
      default:
        propLines.push(`<d:${key}>${escapeXml(value)}</d:${key}>`);
    }
  }

  return `${xmlHeader()}
<d:multistatus xmlns:d="${DAV_NS}" xmlns:cal="${CALDAV_NS}" xmlns:cs="${CS_NS}">
  <d:response>
    <d:href>${escapeXml(href)}</d:href>
    <d:propstat>
      <d:prop>
        ${propLines.join("\n        ")}
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
}

export function buildMultistatus(
  items: { href: string; etag: string }[],
): string {
  const responses = items
    .map(
      (item) => `  <d:response>
    <d:href>${escapeXml(item.href)}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>${escapeXml(item.etag)}</d:getetag>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`,
    )
    .join("\n");

  return `${xmlHeader()}
<d:multistatus xmlns:d="${DAV_NS}" xmlns:cal="${CALDAV_NS}">
${responses}
</d:multistatus>`;
}

export function buildCalendarMultigetResponse(
  items: { href: string; etag: string; calendarData: string }[],
): string {
  const responses = items
    .map(
      (item) => `  <d:response>
    <d:href>${escapeXml(item.href)}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>${escapeXml(item.etag)}</d:getetag>
        <cal:calendar-data>${escapeXml(item.calendarData)}</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`,
    )
    .join("\n");

  return `${xmlHeader()}
<d:multistatus xmlns:d="${DAV_NS}" xmlns:cal="${CALDAV_NS}">
${responses}
</d:multistatus>`;
}
