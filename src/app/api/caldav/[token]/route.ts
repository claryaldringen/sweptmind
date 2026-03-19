import { NextRequest, NextResponse } from "next/server";
import { CalDavHandler } from "@/server/caldav/caldav-handler";
import { services, repos } from "@/infrastructure/container";

const handler = new CalDavHandler(services.calendar, repos.user);

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = await handler.authenticate(token);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const method = request.method;

  if (method === "PROPFIND") {
    const result = await handler.handlePropfind(token, "/");
    return new NextResponse(result.body, {
      status: result.status,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        DAV: "1, calendar-access",
      },
    });
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
