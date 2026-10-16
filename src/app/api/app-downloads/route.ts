import { NextResponse } from "next/server";
import { pickLatestRelease, type GithubRelease } from "@/lib/app-releases";

// Rendered per request — a prerendered/ISR response hands the first visitor after a quiet
// spell a stale version (even the one from build time) and refreshes only for the next one
export const dynamic = "force-dynamic";

const RELEASES_URL = "https://api.github.com/repos/claryaldringen/sweptmind/releases?per_page=30";
// New releases show up within 10 minutes; GitHub allows 60 unauthenticated calls per hour
const TTL_MS = 10 * 60 * 1000;

let cache: { fetchedAt: number; releases: GithubRelease[] } | null = null;

async function getReleases(): Promise<GithubRelease[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.releases;
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (res.ok) {
      cache = { fetchedAt: Date.now(), releases: await res.json() };
      return cache.releases;
    }
  } catch {
    // GitHub unreachable — fall back to the last known releases
  }
  return cache?.releases ?? [];
}

/** Downloads of the native apps, from the GitHub releases the workflows publish. */
export async function GET() {
  return NextResponse.json({
    android: pickLatestRelease(await getReleases(), "android-v", "SweptMind.apk"),
  });
}
