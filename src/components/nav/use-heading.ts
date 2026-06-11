"use client";

import { useEffect, useState } from "react";

// Device heading for the navigation FOV cone — which way the phone is pointing,
// even standing still (GPS `coords.heading` only exists while moving). Reads the
// compass: iOS exposes `webkitCompassHeading` (already 0=N, clockwise); elsewhere
// the absolute `deviceorientation`/`deviceorientationabsolute` alpha (CCW from N).
//
// Degrees clockwise from true north, 0–360, or null until a reading arrives.

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

function readHeading(e: CompassEvent): number | null {
  if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
    return e.webkitCompassHeading; // iOS: true heading, clockwise
  }
  if (e.absolute && e.alpha != null && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360; // alpha is counter-clockwise from north
  }
  return null;
}

export function useHeading(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    let raf = 0;
    let pending: number | null = null;
    const flush = () => {
      raf = 0;
      if (pending != null) setHeading(pending);
    };
    const onOrient = (e: Event) => {
      const h = readHeading(e as CompassEvent);
      if (h == null) return;
      // Smooth a touch and throttle to a frame — compasses are noisy.
      pending = (h + 360) % 360;
      if (!raf) raf = requestAnimationFrame(flush);
    };

    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient, true);
      window.removeEventListener("deviceorientation", onOrient, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active]);

  return heading;
}

// iOS 13+ gates the compass behind a permission that MUST be requested from a
// user gesture (the Start tap). No-op where the API doesn't exist.
export async function requestHeadingPermission(): Promise<void> {
  const D = (typeof DeviceOrientationEvent !== "undefined"
    ? (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> })
    : undefined);
  if (D?.requestPermission) {
    try {
      await D.requestPermission();
    } catch {
      /* declined — the cone simply won't show until heading is available */
    }
  }
}
