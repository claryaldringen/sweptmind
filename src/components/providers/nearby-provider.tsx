"use client";

import { createContext, useContext, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { useUserLocation } from "@/hooks/use-user-location";
import { useAppData } from "@/components/providers/app-data-provider";
import { isNearby as checkNearby } from "@/lib/geo";
import { getPlatform } from "@sweptmind/native-bridge";
import { useGeofenceSync } from "@/hooks/use-geofence-sync";
import { useGeofenceEvents } from "@/hooks/use-geofence-events";

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

  const { locations, allTasks } = useAppData();

  const isNearby = useCallback(
    (lat: number, lon: number, radiusKm?: number) => {
      if (!position) return false;
      return checkNearby(position.latitude, position.longitude, lat, lon, radiusKm);
    },
    [position],
  );

  const nearbyLocationIds = useMemo(() => {
    if (!position || !locations) return [];
    return locations
      .filter((loc) =>
        checkNearby(position.latitude, position.longitude, loc.latitude, loc.longitude, loc.radius),
      )
      .map((loc) => loc.id);
  }, [position, locations]);

  // Native geofence sync — registers OS-level geofences for task locations
  // so notifications are shown even when the app is not running
  const platform = getPlatform();
  useGeofenceSync(locations, allTasks, platform);
  useGeofenceEvents(platform);

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
