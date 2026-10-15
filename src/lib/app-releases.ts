/** The subset of a GitHub release (REST API) needed to offer a download. */
export interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: { name: string; browser_download_url: string }[];
}

export interface AppRelease {
  version: string;
  url: string;
}

/** The newest published release whose tag starts with `tagPrefix` and has the asset. */
export function pickLatestRelease(
  releases: GithubRelease[],
  tagPrefix: string,
  assetName: string,
): AppRelease | null {
  const candidates = releases
    .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(tagPrefix))
    .map((r) => ({ release: r, asset: r.assets.find((a) => a.name === assetName) }))
    .filter((c) => c.asset)
    .sort((a, b) => (b.release.published_at ?? "").localeCompare(a.release.published_at ?? ""));
  const latest = candidates[0];
  if (!latest?.asset) return null;
  return {
    version: latest.release.tag_name.slice(tagPrefix.length),
    url: latest.asset.browser_download_url,
  };
}
