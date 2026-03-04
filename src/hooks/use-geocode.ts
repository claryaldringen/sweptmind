"use client";

import { useState, useRef, useCallback } from "react";
import { formatLocationName } from "@/lib/shorten-display-name";

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

function osmIdForLookup(f: PhotonFeature): string | null {
  const type = f.properties.osm_type;
  const id = f.properties.osm_id;
  if (!type || !id) return null;
  const prefix = type === "N" ? "N" : type === "W" ? "W" : type === "R" ? "R" : null;
  return prefix ? `${prefix}${id}` : null;
}

interface NominatimLookupResult {
  osm_type: string;
  osm_id: number;
  name: string;
  address?: {
    name?: string;
    state?: string;
    country?: string;
  };
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
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "SweptMind/1.0" },
  });
  if (!res.ok) return new Map();
  const data: NominatimLookupResult[] = await res.json();
  const map = new Map<string, string>();
  for (const r of data) {
    const prefix = r.osm_type === "node" ? "N" : r.osm_type === "way" ? "W" : "R";
    const key = `${prefix}${r.osm_id}`;
    const displayName = r.address
      ? formatLocationName({
          name: r.name,
          state: r.address.state,
          country: r.address.country,
        })
      : r.name;
    map.set(key, displayName);
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
