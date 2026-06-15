"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logTrip } from "@/lib/actions/mileage";
import { trackDistanceMeters, metersToMiles } from "@/lib/mileage/engine";

type Pt = { lat: number; lng: number };

// Drive recorder (Phase 15) — opt-in GPS capture of an actual drive. Tap to start,
// it records the route via watchPosition (high-accuracy, noise-filtered), shows the
// live distance, and on stop logs the trip with its GPS track. Fully automatic
// background detection (motion/geofence) needs native — positioned; this is the
// opt-in capture that gets the route. Functional + `.cc-mileage-rec*` for Design.
export function DriveRecorder() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const [miles, setMiles] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pts = useRef<Pt[]>([]);
  const startedAt = useRef<string | null>(null);
  const watchId = useRef<number | null>(null);

  function start() {
    setError(null);
    if (!("geolocation" in navigator)) return setError("This device can't share its location.");
    pts.current = [];
    setMiles(0);
    startedAt.current = new Date().toISOString();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const last = pts.current[pts.current.length - 1];
        // Drop jitter (<10m) and impossible jumps (>2km between fixes).
        if (last) {
          const hop = trackDistanceMeters([last, p]);
          if (hop < 10 || hop > 2000) return;
        }
        pts.current.push(p);
        setMiles(Math.round(metersToMiles(trackDistanceMeters(pts.current)) * 10) / 10);
      },
      () => setError("Couldn't get a GPS fix — check location permission."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    setRecording(true);
  }

  function stop() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setRecording(false);
    const track = pts.current;
    if (track.length < 2) {
      setError("That drive was too short to log.");
      return;
    }
    startTransition(async () => {
      const res = await logTrip({ track, startedAt: startedAt.current ?? new Date().toISOString(), endedAt: new Date().toISOString(), source: "gps", classification: "unset" });
      if (!res.ok) return setError(res.error ?? "Couldn't save that drive.");
      pts.current = [];
      setMiles(0);
      router.refresh();
    });
  }

  return (
    <div className="cc-mileage-rec" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", background: "var(--card)" }}>
      {recording ? (
        <>
          <span className="cc-mileage-rec-live" style={{ fontFamily: "var(--mono)", color: "var(--rust)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rust)" }} /> Recording · {miles} mi
          </span>
          <button type="button" className="cc-btn cc-btn-gold" onClick={stop} disabled={pending} style={{ marginLeft: "auto" }}>
            {pending ? "Saving…" : "Stop & save"}
          </button>
        </>
      ) : (
        <>
          <span style={{ color: "var(--ink-dim)", fontSize: "var(--fs-label)" }}>Record a drive to log it with its route.</span>
          <button type="button" className="cc-btn cc-btn-ghost" onClick={start} style={{ marginLeft: "auto" }}>Record a drive</button>
        </>
      )}
      {error ? <span className="cc-mileage-rec-error" style={{ color: "var(--rust)", fontSize: "var(--fs-micro, 11px)" }}>{error}</span> : null}
    </div>
  );
}
