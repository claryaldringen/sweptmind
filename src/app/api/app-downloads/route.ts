import { NextResponse } from "next/server";
import { pickLatestRelease, type GithubRelease } from "@/lib/app-releases";

// New releases show up within 10 minutes; GitHub allows 60 unauthenticated calls per hour
export const revalidate = 600;

const RELEASES_URL = "https://api.github.com/repos/claryaldringen/sweptmind/releases?per_page=30";

/** Downloads of the native apps, from the GitHub releases the workflows publish. */
export async function GET() {
  let releases: GithubRelease[] = [];
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate },
    });
    if (res.ok) releases = await res.json();
  } catch {
    // GitHub unreachable — offer nothing rather than a broken link
  }
  return NextResponse.json({
    android: pickLatestRelease(releases, "android-v", "SweptMind.apk"),
  });
}
