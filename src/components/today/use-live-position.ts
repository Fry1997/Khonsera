"use client";

import { useEffect, useRef, useState } from "react";
import { haversineMeters } from "@/lib/geo";

// Continuous live position for the day-of engine — the "from" is always where you
// actually are. Throttled to meaningful movement (>15 m) so GPS jitter doesn't
// thrash routing. `enabled` gates the watch so Today never prompts for location
// on load; the caller flips it on when permission is already granted or the user
// opts in.

export interface LiveFix {
  lat: number;
  lng: number;
  accuracy: number;
}

export type GeoStatus = "idle" | "granted" | "denied" | "unavailable";

export function useLivePosition(enabled: boolean): { fix: LiveFix | null; status: GeoStatus } {
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const last = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const n = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (!last.current || haversineMeters(last.current.lat, last.current.lng, n.lat, n.lng) > 15) {
          last.current = n;
          setFix({ ...n, accuracy: p.coords.accuracy });
        }
        setStatus("granted");
      },
      (e) => setStatus(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix, status };
}
