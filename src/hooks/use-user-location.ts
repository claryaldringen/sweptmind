"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Position {
  latitude: number;
  longitude: number;
}

interface UseUserLocationReturn {
  position: Position | null;
  error: string | null;
  isSupported: boolean;
  isTracking: boolean;
  isApproximate: boolean;
  startTracking: () => void;
  stopTracking: () => void;
}

async function fetchIpLocation(): Promise<Position | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      return { latitude: data.latitude, longitude: data.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

export function useUserLocation(): UseUserLocationReturn {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isApproximate, setIsApproximate] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const ipFetchedRef = useRef(false);

  const isSupported = typeof window !== "undefined" && "geolocation" in navigator;

  const tryIpFallback = useCallback(async () => {
    if (ipFetchedRef.current) return;
    ipFetchedRef.current = true;
    const ipPos = await fetchIpLocation();
    if (ipPos) {
      setPosition(ipPos);
      setIsApproximate(true);
      setIsTracking(true);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!isSupported) {
      setError("Geolocation is not supported");
      tryIpFallback();
      return;
    }

    setError(null);
    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setIsApproximate(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        tryIpFallback();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, [isSupported, tryIpFallback]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, error, isSupported, isTracking, isApproximate, startTracking, stopTracking };
}
