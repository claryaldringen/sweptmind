import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  },
  5 * 60 * 1000,
);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Sliding window rate limiter.
 * Returns null if allowed, or a 429 Response if rate limit exceeded.
 */
export function rateLimit(
  request: NextRequest,
  { maxRequests, windowMs = 60_000 }: { maxRequests: number; windowMs?: number },
): NextResponse | null {
  const ip = getClientIp(request);
  const now = Date.now();

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  entry.timestamps.push(now);
  return null;
}
