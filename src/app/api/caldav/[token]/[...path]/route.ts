import { NextRequest, NextResponse } from "next/server";
import { CalDavHandler } from "@/server/caldav/caldav-handler";
import { services, repos } from "@/infrastructure/container";
import { rateLimit } from "@/lib/rate-limit";

const handler = new CalDavHandler(services.calendar, repos.user);

type Params = { params: Promise<{ token: string; path: string[] }> };

async function handleRequest(request: NextRequest, context: Params) {
  const rateLimited = rateLimit(request, { maxRequests: 120 });
  if (rateLimited) return rateLimited;

  const { token, path } = await context.params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const method = request.method;
  const lastSegment = path[path.length - 1];
  const pathStr = "/" + path.join("/") + (lastSegment?.includes(".") ? "" : "/");

  if (method === "PROPFIND") {
    const result = await handler.handlePropfind(token, pathStr);
    return new NextResponse(result.body, {
      status: result.status,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        DAV: "1, calendar-access",
      },
    });
  }

  if (method === "REPORT" || method === "POST") {
    // CalDAV clients may use POST for REPORT in some cases
    const body = await request.text();
    if (body.includes("calendar-query") || body.includes("calendar-multiget")) {
      const result = await handler.handleReport(token, user, body);
      return new NextResponse(result.body, {
        status: result.status,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          DAV: "1, calendar-access",
        },
      });
    }
  }

  // GET individual .ics file
  if (method === "GET") {
    const filename = path[path.length - 1];
    if (!filename?.endsWith(".ics")) return new NextResponse("Not Found", { status: 404 });
    const icalUid = filename.replace(".ics", "");
    const result = await handler.handleGet(token, user, icalUid);
    if (result.status !== 200) return new NextResponse(result.body, { status: result.status });
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        ...(result.etag ? { ETag: result.etag } : {}),
      },
    });
  }

  // PUT .ics file
  if (method === "PUT") {
    const filename = path[path.length - 1];
    if (!filename?.endsWith(".ics")) return new NextResponse("Bad Request", { status: 400 });
    const icalUid = filename.replace(".ics", "");
    const body = await request.text();
    const ifMatch = request.headers.get("If-Match");
    const result = await handler.handlePut(token, user, icalUid, body, ifMatch);
    return new NextResponse(result.body || null, {
      status: result.status,
      headers: result.etag ? { ETag: result.etag } : {},
    });
  }

  // DELETE .ics file
  if (method === "DELETE") {
    const filename = path[path.length - 1];
    if (!filename?.endsWith(".ics")) return new NextResponse("Not Found", { status: 404 });
    const icalUid = filename.replace(".ics", "");
    const result = await handler.handleDelete(user, icalUid);
    return new NextResponse(null, { status: result.status });
  }

  if (method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        Allow: "OPTIONS, PROPFIND, REPORT, GET, PUT, DELETE",
        DAV: "1, calendar-access",
      },
    });
  }

  return new NextResponse("Method Not Allowed", { status: 405 });
}

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
  handleRequest as DELETE,
  handleRequest as PATCH,
  handleRequest as OPTIONS,
};
