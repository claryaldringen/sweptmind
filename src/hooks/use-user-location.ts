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

const POSITION_CACHE_KEY = "sweptmind-last-position";

function getCachedPosition(): Position | null {
  try {
    const stored = localStorage.getItem(POSITION_CACHE_KEY);
    if (!stored) return null;
    const { latitude, longitude, ts } = JSON.parse(stored);
    // Use cached position if less than 30 minutes old
    if (Date.now() - ts > 30 * 60 * 1000) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function cachePosition(pos: Position) {
  try {
    localStorage.setItem(
      POSITION_CACHE_KEY,
      JSON.stringify({ latitude: pos.latitude, longitude: pos.longitude, ts: Date.now() }),
    );
  } catch {
    /* quota exceeded — ignore */
  }
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
  const [position, setPosition] = useState<Position | null>(() => getCachedPosition());
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isApproximate, setIsApproximate] = useState(() => getCachedPosition() !== null);
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

    // Step 1: Quick coarse position from network/cache (fast, low accuracy)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPosition(p);
        setIsApproximate(false);
        setError(null);
        cachePosition(p);
      },
      () => {
        /* ignore — watchPosition will handle it */
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 },
    );

    // Step 2: Continuous high-accuracy tracking (GPS, slower but precise)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPosition(p);
        setIsApproximate(false);
        setError(null);
        cachePosition(p);
      },
      (err) => {
        setError(err.message);
        tryIpFallback();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 },
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
