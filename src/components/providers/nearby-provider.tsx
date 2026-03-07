"use client";

import { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useUserLocation } from "@/hooks/use-user-location";
import { isNearby as checkNearby } from "@/lib/geo";

const GET_LOCATIONS = gql`
  query GetLocationsForContext {
    locations {
      id
      latitude
      longitude
    }
  }
`;

interface NearbyContextValue {
  userLatitude: number | null;
  userLongitude: number | null;
  isTracking: boolean;
  isSupported: boolean;
  isApproximate: boolean;
  error: string | null;
  startTracking: () => void;
  stopTracking: () => void;
  isNearby: (lat: number, lon: number) => boolean;
  nearbyLocationIds: string[];
}

const NearbyContext = createContext<NearbyContextValue | null>(null);

export function NearbyProvider({ children }: { children: ReactNode }) {
  const { position, error, isSupported, isTracking, isApproximate, startTracking, stopTracking } =
    useUserLocation();

  const { data: locationsData } = useQuery<{
    locations: { id: string; latitude: number; longitude: number }[];
  }>(GET_LOCATIONS, { skip: !isTracking });

  const isNearby = useCallback(
    (lat: number, lon: number) => {
      if (!position) return false;
      return checkNearby(position.latitude, position.longitude, lat, lon);
    },
    [position],
  );

  const nearbyLocationIds = useMemo(() => {
    if (!position || !locationsData?.locations) return [];
    return locationsData.locations
      .filter((loc) =>
        checkNearby(position.latitude, position.longitude, loc.latitude, loc.longitude),
      )
      .map((loc) => loc.id);
  }, [position, locationsData?.locations]);

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
