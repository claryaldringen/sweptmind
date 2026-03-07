import { handlers } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const { GET: authGET, POST: authPOST } = handlers;

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 60 });
  if (limited) return limited;
  return authGET(request);
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 10 });
  if (limited) {
    // next-auth/react expects { url: "..." } with absolute URL for X-Auth-Return-Redirect
    if (request.headers.get("X-Auth-Return-Redirect")) {
      const origin = new URL(request.url).origin;
      return NextResponse.json({ url: `${origin}/login?error=RateLimited` }, { status: 429 });
    }
    return limited;
  }
  return authPOST(request);
}
