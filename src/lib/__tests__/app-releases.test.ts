import { describe, it, expect } from "vitest";
import { pickLatestRelease, type GithubRelease } from "../app-releases";

function release(
  tag: string,
  publishedAt: string,
  assets: string[] = [],
  extra = {},
): GithubRelease {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    published_at: publishedAt,
    assets: assets.map((name) => ({ name, browser_download_url: `https://dl/${tag}/${name}` })),
    ...extra,
  };
}

describe("pickLatestRelease", () => {
  const releases = [
    release("desktop-v1.0.0", "2026-10-15T09:00:00Z", ["SweptMind.dmg"]),
    release("android-v1.0.0", "2026-10-15T10:00:00Z", ["SweptMind.apk"]),
    release("android-v1.1.0", "2026-10-20T10:00:00Z", ["SweptMind.apk"]),
    release("android-v1.2.0", "2026-10-25T10:00:00Z", ["SweptMind.apk"], { draft: true }),
    release("android-v1.3.0", "2026-10-26T10:00:00Z", []), // asset still uploading
  ];

  it("vybere nejnovější vydané APK s požadovaným souborem", () => {
    expect(pickLatestRelease(releases, "android-v", "SweptMind.apk")).toEqual({
      version: "1.1.0",
      url: "https://dl/android-v1.1.0/SweptMind.apk",
    });
  });

  it("vydání jiné platformy nebo žádné vrátí null", () => {
    expect(pickLatestRelease(releases, "desktop-v", "SweptMind.dmg")?.version).toBe("1.0.0");
    expect(pickLatestRelease([], "android-v", "SweptMind.apk")).toBeNull();
  });
});
