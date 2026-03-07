import { db } from "@/server/db";
import { sql } from "drizzle-orm";

const startTime = Date.now();

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      env: {
        hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
        hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
        hasAuthSecret: !!process.env.AUTH_SECRET,
        hasAuthUrl: !!process.env.AUTH_URL,
        authUrl: process.env.AUTH_URL,
      },
    });
  } catch {
    return Response.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
