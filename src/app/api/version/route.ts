import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The deployed build — open clients compare it with their own to offer an update. */
export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
