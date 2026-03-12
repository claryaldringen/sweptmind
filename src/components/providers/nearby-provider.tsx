"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useUserLocation } from "@/hooks/use-user-location";
import { useAppData } from "@/components/providers/app-data-provider";
import { isNearby as checkNearby } from "@/lib/geo";
import { getPlatform, getLocationAdapter } from "@sweptmind/native-bridge";

interface NearbyContextValue {
  userLatitude: number | null;
  userLongitude: number | null;
  isTracking: boolean;
  isSupported: boolean;
  isApproximate: boolean;
  error: string | null;
  startTracking: () => void;
  stopTracking: () => void;
  isNearby: (lat: number, lon: number, radiusKm?: number) => boolean;
  nearbyLocationIds: string[];
}

const NearbyContext = createContext<NearbyContextValue | null>(null);

export function NearbyProvider({ children }: { children: ReactNode }) {
  const { position, error, isSupported, isTracking, isApproximate, startTracking, stopTracking } =
    useUserLocation();

  useEffect(() => {
    if (isSupported && !isTracking) {
      startTracking();
    }
  }, [isSupported, isTracking, startTracking]);

  const { locations } = useAppData();

  const isNearby = useCallback(
    (lat: number, lon: number, radiusKm?: number) => {
      if (!position || isApproximate) return false;
      return checkNearby(position.latitude, position.longitude, lat, lon, radiusKm);
    },
    [position, isApproximate],
  );

  const nearbyLocationIds = useMemo(() => {
    if (!position || !locations || isApproximate) return [];
    return locations
      .filter((loc) =>
        checkNearby(position.latitude, position.longitude, loc.latitude, loc.longitude, loc.radius),
      )
      .map((loc) => loc.id);
  }, [position, locations, isApproximate]);

  // Start native background tracking on Capacitor
  useEffect(() => {
    const platform = getPlatform();
    if (platform !== "ios" && platform !== "android") return;

    const locationAdapter = getLocationAdapter();
    locationAdapter.startBackgroundTracking({
      intervalMs: 10 * 60 * 1000,
      distanceFilterMeters: 100,
    });

    return () => {
      locationAdapter.stopBackgroundTracking();
    };
  }, []);

  return (
    <NearbyContext.Provider
      value={{
        userLatitude: position?.latitude ?? null,
        userLongitude: position?.longitude ?? null,
        isTracking,
        isSupported,
        isApproximate,
        error,
        startTracking,
        stopTracking,
        isNearby,
        nearbyLocationIds,
      }}
    >
      {children}
    </NearbyContext.Provider>
  );
}

export function useNearby(): NearbyContextValue {
  const ctx = useContext(NearbyContext);
  if (!ctx) throw new Error("useNearby must be used within NearbyProvider");
  return ctx;
}
