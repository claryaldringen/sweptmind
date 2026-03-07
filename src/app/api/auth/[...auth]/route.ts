import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

const { GET: authGET, POST: authPOST } = handlers;

export async function GET(req: NextRequest) {
  console.log("[auth-route] GET URL:", req.url, "pathname:", req.nextUrl.pathname);
  return authGET(req);
}

export async function POST(req: NextRequest) {
  console.log("[auth-route] POST URL:", req.url, "pathname:", req.nextUrl.pathname);
  return authPOST(req);
}
