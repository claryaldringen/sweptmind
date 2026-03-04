# Geocoding Relevance & Localization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Location search returns nearby places first with localized display names matching user's locale.

**Architecture:** Hybrid Photon (proximity autocomplete) + Nominatim `/lookup` (localized display names). Photon searches with lat/lon bias and `osm_tag=place`, results are enriched via Nominatim batch lookup with `accept-language`, sorted by distance, and truncated to 5.

**Tech Stack:** Photon API (photon.komoot.io), Nominatim API (nominatim.openstreetmap.org/lookup), React hooks

---

### Task 1: Write `shortenDisplayName` helper + tests

**Files:**
- Create: `src/lib/__tests__/shorten-display-name.test.ts`
- Create: `src/lib/shorten-display-name.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/shorten-display-name.test.ts
import { describe, it, expect } from "vitest";
import { shortenDisplayName } from "../shorten-display-name";

describe("shortenDisplayName", () => {
  it("keeps short names as-is (2 parts)", () => {
    expect(shortenDisplayName("Berlín, Německo")).toBe("Berlín, Německo");
  });

  it("keeps 3-part names as-is", () => {
    expect(shortenDisplayName("Bergen, Vestland, Norsko")).toBe("Bergen, Vestland, Norsko");
  });

  it("shortens long Czech names to name + region + country", () => {
    expect(
      shortenDisplayName(
        "Beroun, SO POÚ Beroun, SO ORP Beroun, okres Beroun, Středočeský kraj, Střední Čechy, Česko"
      )
    ).toBe("Beroun, Středočeský kraj, Česko");
  });

  it("shortens 4-part names to first + pre-last + last", () => {
    expect(
      shortenDisplayName("Rakovník, okres Rakovník, Středočeský kraj, Česko")
    ).toBe("Rakovník, Středočeský kraj, Česko");
  });

  it("handles single part", () => {
    expect(shortenDisplayName("Česko")).toBe("Česko");
  });

  it("handles empty string", () => {
    expect(shortenDisplayName("")).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test src/lib/__tests__/shorten-display-name.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/shorten-display-name.ts
export function shortenDisplayName(displayName: string): string {
  if (!displayName) return "";
  const parts = displayName.split(",").map((p) => p.trim());
  if (parts.length <= 3) return parts.join(", ");
  return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test src/lib/__tests__/shorten-display-name.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add src/lib/shorten-display-name.ts src/lib/__tests__/shorten-display-name.test.ts
git commit -m "feat: add shortenDisplayName helper with tests"
```

---

### Task 2: Rewrite `useGeocode` hook — Photon + Nominatim hybrid

**Files:**
- Modify: `src/hooks/use-geocode.ts`

**Step 1: Rewrite the hook**

Replace entire file content with:

```typescript
// src/hooks/use-geocode.ts
"use client";

import { useState, useRef, useCallback } from "react";
import { shortenDisplayName } from "@/lib/shorten-display-name";

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface UseGeocodeOptions {
  userLatitude?: number | null;
  userLongitude?: number | null;
  locale?: string;
}

interface UseGeocodeReturn {
  results: GeocodingResult[];
  isLoading: boolean;
  search: (query: string) => void;
  clear: () => void;
}

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup";
const MIN_INTERVAL_MS = 1000;
const FETCH_LIMIT = 15;
const MAX_RESULTS = 5;

function distanceSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return dLat * dLat + dLon * dLon;
}

// Module-level: single shared promise so IP is fetched at most once
let ipInfoPromise: Promise<{ latitude: number; longitude: number } | null> | null = null;

function getIpInfo() {
  if (!ipInfoPromise) {
    ipInfoPromise = fetch("https://ipapi.co/json/")
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          return { latitude: data.latitude as number, longitude: data.longitude as number };
        }
        return null;
      })
      .catch(() => null);
  }
  return ipInfoPromise;
}

// Start fetching immediately on module load
getIpInfo();

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
  };
}

// Map Photon osm_type (N/W/R) to Nominatim format
function osmIdForLookup(f: PhotonFeature): string | null {
  const type = f.properties.osm_type;
  const id = f.properties.osm_id;
  if (!type || !id) return null;
  const prefix = type === "N" ? "N" : type === "W" ? "W" : type === "R" ? "R" : null;
  return prefix ? `${prefix}${id}` : null;
}

async function nominatimLookup(
  osmIds: string[],
  locale: string,
): Promise<Map<string, string>> {
  if (osmIds.length === 0) return new Map();
  const url = new URL(NOMINATIM_LOOKUP_URL);
  url.searchParams.set("osm_ids", osmIds.join(","));
  url.searchParams.set("format", "json");
  url.searchParams.set("accept-language", locale);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "SweptMind/1.0" },
  });
  if (!res.ok) return new Map();
  const data: { osm_type: string; osm_id: number; display_name: string }[] = await res.json();
  const map = new Map<string, string>();
  for (const r of data) {
    const prefix = r.osm_type === "node" ? "N" : r.osm_type === "way" ? "W" : "R";
    map.set(`${prefix}${r.osm_id}`, shortenDisplayName(r.display_name));
  }
  return map;
}

export function useGeocode(options?: UseGeocodeOptions): UseGeocodeReturn {
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastRequestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setResults([]);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const doSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const ipInfo = await getIpInfo();
        const lat = options?.userLatitude ?? ipInfo?.latitude ?? null;
        const lon = options?.userLongitude ?? ipInfo?.longitude ?? null;
        const locale = options?.locale ?? "en";

        // Step 1: Photon search with proximity bias
        const photonUrl = new URL(PHOTON_URL);
        photonUrl.searchParams.set("q", query);
        photonUrl.searchParams.set("limit", String(FETCH_LIMIT));
        photonUrl.searchParams.set("osm_tag", "place");
        photonUrl.searchParams.set("lang", "default");
        if (lat != null && lon != null) {
          photonUrl.searchParams.set("lat", String(lat));
          photonUrl.searchParams.set("lon", String(lon));
        }

        const photonRes = await fetch(photonUrl.toString());
        if (!photonRes.ok) throw new Error("Photon search failed");
        const photonData: { features: PhotonFeature[] } = await photonRes.json();
        lastRequestRef.current = Date.now();

        const features = photonData.features;
        if (features.length === 0) {
          setResults([]);
          return;
        }

        // Step 2: Collect OSM IDs for Nominatim lookup
        const osmIds: string[] = [];
        const featureOsmIds: (string | null)[] = [];
        for (const f of features) {
          const osmId = osmIdForLookup(f);
          featureOsmIds.push(osmId);
          if (osmId && !osmIds.includes(osmId)) {
            osmIds.push(osmId);
          }
        }

        // Step 3: Nominatim batch lookup for localized display names
        const displayNames = await nominatimLookup(osmIds, locale);

        // Step 4: Build results with localized names, sort by distance
        let converted: GeocodingResult[] = features.map((f, i) => {
          const osmId = featureOsmIds[i];
          const localizedName = osmId ? displayNames.get(osmId) : null;
          // Fallback to Photon name if Nominatim didn't return this ID
          const fallbackName = f.properties.name ?? "?";
          return {
            display_name: localizedName ?? fallbackName,
            lon: String(f.geometry.coordinates[0]),
            lat: String(f.geometry.coordinates[1]),
          };
        });

        if (lat != null && lon != null) {
          converted.sort(
            (a, b) =>
              distanceSq(lat, lon, +a.lat, +a.lon) -
              distanceSq(lat, lon, +b.lat, +b.lon),
          );
        }

        setResults(converted.slice(0, MAX_RESULTS));
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [options?.userLatitude, options?.userLongitude, options?.locale],
  );

  const search = useCallback(
    (query: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const elapsed = Date.now() - lastRequestRef.current;
      const delay = Math.max(0, MIN_INTERVAL_MS - elapsed);
      timerRef.current = setTimeout(() => doSearch(query), delay);
    },
    [doSearch],
  );

  return { results, isLoading, search, clear };
}
```

**Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/use-geocode.ts
git commit -m "feat: hybrid Photon + Nominatim geocoding with proximity and localization"
```

---

### Task 3: Pass `locale` to `useGeocode` from call sites

**Files:**
- Modify: `src/components/tasks/task-detail-panel.tsx:326`
- Modify: `src/app/(app)/lists/[listId]/page.tsx:208,213`

**Step 1: Update task-detail-panel.tsx**

At line 326, change:
```typescript
const geocode = useGeocode({ userLatitude, userLongitude });
```
to:
```typescript
const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });
```

Note: `appLocale` already exists at line 284: `const { t, locale: appLocale } = useTranslations();`

**Step 2: Update lists/[listId]/page.tsx**

At line 208, change:
```typescript
const { t } = useTranslations();
```
to:
```typescript
const { t, locale: appLocale } = useTranslations();
```

At line 213, change:
```typescript
const geocode = useGeocode({ userLatitude, userLongitude });
```
to:
```typescript
const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });
```

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/tasks/task-detail-panel.tsx src/app/\(app\)/lists/\[listId\]/page.tsx
git commit -m "feat: pass locale to useGeocode for localized search results"
```

---

### Task 4: Run all checks

**Step 1: Run full check suite**

Run: `yarn check`
Expected: lint + format + typecheck + test all PASS

**Step 2: Manual verification notes**

To verify manually:
1. Set browser language to Czech, open task detail, search "Ber" → expect Beroun near top, display name in Czech
2. Switch to English in Settings, search "Ber" → expect display names in English
3. Search "Ra" → expect Račice/Rakovník near top (if near Rakovník area)
4. Search "Berlin" → expect "Berlín, Německo" in Czech, "Berlin, Germany" in English
