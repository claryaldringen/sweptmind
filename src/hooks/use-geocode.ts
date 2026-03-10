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
  reverseGeocode: (lat: number, lon: number) => Promise<GeocodingResult | null>;
}

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup";
const MIN_INTERVAL_MS = 1000;
const FETCH_LIMIT = 20;
const MAX_RESULTS = 10;

interface IpInfo {
  latitude: number;
  longitude: number;
  countryCode: string | null;
}

// Module-level: single shared promise so IP is fetched at most once
let ipInfoPromise: Promise<IpInfo | null> | null = null;

async function fetchIpFromIpwho(): Promise<IpInfo | null> {
  const res = await fetch("https://ipwho.is/");
  if (!res.ok) return null;
  const data = await res.json();
  if (data.success && typeof data.latitude === "number" && typeof data.longitude === "number") {
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      countryCode: typeof data.country_code === "string" ? data.country_code.toUpperCase() : null,
    };
  }
  return null;
}

async function fetchIpFromGeojs(): Promise<IpInfo | null> {
  const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
  if (!res.ok) return null;
  const data = await res.json();
  const lat = parseFloat(data.latitude);
  const lon = parseFloat(data.longitude);
  if (!isNaN(lat) && !isNaN(lon)) {
    return {
      latitude: lat,
      longitude: lon,
      countryCode: typeof data.country_code === "string" ? data.country_code.toUpperCase() : null,
    };
  }
  return null;
}

function getIpInfo() {
  if (!ipInfoPromise) {
    ipInfoPromise = fetchIpFromIpwho()
      .catch(() => null)
      .then((result) => result ?? fetchIpFromGeojs().catch(() => null));
  }
  return ipInfoPromise;
}

// IP info is fetched lazily on first use via getIpInfo()

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    countrycode?: string;
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
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
}

async function nominatimLookup(osmIds: string[], locale: string): Promise<Map<string, string>> {
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
    const city =
      r.address?.city || r.address?.town || r.address?.village || r.address?.municipality;
    const displayName = r.address
      ? formatLocationName({
          name: r.name,
          city: city ?? undefined,
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
        const userCountry = ipInfo?.countryCode ?? null;
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

        // Sort: same country first, then rest (stable sort preserves Photon's relevance order within each group)
        const features = photonData.features.toSorted((a, b) => {
          if (!userCountry) return 0;
          const aLocal = a.properties.countrycode?.toUpperCase() === userCountry ? 0 : 1;
          const bLocal = b.properties.countrycode?.toUpperCase() === userCountry ? 0 : 1;
          return aLocal - bLocal;
        });
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

        // Step 4: Build results with localized names (keep Photon's relevance order)
        const converted: GeocodingResult[] = features.map((f, i) => {
          const osmId = featureOsmIds[i];
          const localizedName = osmId ? displayNames.get(osmId) : null;
          const fallbackName = f.properties.name ?? "?";
          return {
            display_name: localizedName ?? fallbackName,
            lon: String(f.geometry.coordinates[0]),
            lat: String(f.geometry.coordinates[1]),
          };
        });

        // Deduplicate by display_name (Nominatim can map different OSM IDs to same name)
        const seen = new Set<string>();
        const unique = converted.filter((r) => {
          if (seen.has(r.display_name)) return false;
          seen.add(r.display_name);
          return true;
        });

        setResults(unique.slice(0, MAX_RESULTS));
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

  const reverseGeocode = useCallback(
    async (lat: number, lon: number): Promise<GeocodingResult | null> => {
      const locale = options?.locale ?? "en";
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=${locale}`,
          { headers: { "User-Agent": "SweptMind/1.0" } },
        );
        if (!res.ok) return null;
        const data = await res.json();
        const addr = data.address ?? {};
        const name =
          addr.city || addr.town || addr.village || addr.suburb || data.display_name?.split(",")[0];
        if (!name) return null;
        return {
          display_name: name,
          lat: String(lat),
          lon: String(lon),
        };
      } catch {
        return null;
      }
    },
    [options?.locale],
  );

  return { results, isLoading, search, clear, reverseGeocode };
}
