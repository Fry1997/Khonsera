"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cumulativeDistances, guidanceTick, OFF_ROUTE_M, type GuidanceState } from "@/lib/nav/guidance";
import type { NavRoute } from "@/lib/nav/types";

// Live guidance — wraps watchPosition around the pure engine in
// lib/nav/guidance.ts. Owns: the GPS subscription, spoken instructions
// (SpeechSynthesis, muteable), off-route detection with a debounce, and an
// `onReroute` callback the screen wires to a fresh Valhalla fetch (only fired
// when online — offline you keep the saved line and the map shows you drift).

export interface GuidanceFix {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number;
}

export function useGuidance(
  route: NavRoute | null,
  active: boolean,
  opts: { voice: boolean; onReroute?: (from: GuidanceFix) => void },
) {
  const [fix, setFix] = useState<GuidanceFix | null>(null);
  const [state, setState] = useState<GuidanceState | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const lastSegment = useRef(-1);
  const spokenFor = useRef(-1);
  const offRouteSince = useRef<number | null>(null);
  const rerouteAt = useRef(0);

  const cumulative = useMemo(
    () => (route ? cumulativeDistances(route.geometry) : null),
    [route],
  );

  const speak = useCallback(
    (text: string) => {
      if (!opts.voice || typeof speechSynthesis === "undefined") return;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-GB";
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch {
        /* voice is best-effort */
      }
    },
    [opts.voice],
  );

  // Reset progression state when the route changes (incl. after a re-route).
  useEffect(() => {
    lastSegment.current = -1;
    spokenFor.current = -1;
    offRouteSince.current = null;
  }, [route]);

  useEffect(() => {
    if (!active || !route || !cumulative) {
      setState(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Location is not available on this device.");
      return;
    }
    setGeoError(null);

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const f: GuidanceFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
        };
        setFix(f);

        const tick = guidanceTick(route, cumulative, f, lastSegment.current);
        lastSegment.current = tick.segment_index;
        setState(tick);

        // Speak each maneuver once, as we come within earshot of it
        // (~80m walking; arrival announced at the end).
        const m = route.maneuvers[tick.maneuver_index];
        if (m && spokenFor.current !== tick.maneuver_index && tick.to_maneuver_m < 80) {
          spokenFor.current = tick.maneuver_index;
          speak(m.verbal ?? m.instruction);
        }
        if (tick.arrived && spokenFor.current !== Number.MAX_SAFE_INTEGER) {
          spokenFor.current = Number.MAX_SAFE_INTEGER;
          speak("You have arrived.");
        }

        // Off-route: sustained for 12s and online → ask the screen to
        // re-route from where we actually are. Min 30s between re-routes.
        const threshold = OFF_ROUTE_M[route.mode];
        if (tick.off_route_m > threshold && f.accuracy < threshold) {
          offRouteSince.current ??= Date.now();
          const sustained = Date.now() - (offRouteSince.current ?? 0) > 12_000;
          const cooled = Date.now() - rerouteAt.current > 30_000;
          if (sustained && cooled && navigator.onLine && opts.onReroute) {
            rerouteAt.current = Date.now();
            offRouteSince.current = null;
            opts.onReroute(f);
          }
        } else {
          offRouteSince.current = null;
        }
      },
      (e) => setGeoError(e.code === e.PERMISSION_DENIED ? "Location permission was declined." : "Couldn't get a location fix."),
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watch);
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, route, cumulative, speak]);

  return { fix, state, geoError };
}
