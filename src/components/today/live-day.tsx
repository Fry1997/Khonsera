"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { londonClock } from "./spine-model";
import { computeDayState, type EngineAnchor, type Feasibility } from "@/lib/today/engine";
import { totalSpareMinutes } from "@/lib/planning/gaps";
import { leaveByCountdown } from "@/lib/planning/leave-by";
import { fetchNavRoute } from "@/lib/actions/nav";
import { requestHeadingPermission } from "@/components/nav/use-heading";
import { FullLeg } from "./next-leg-map";
import { useLivePosition } from "./use-live-position";
import type { NavMode, NavRoute } from "@/lib/nav/types";

// The live next-move — timing-first, and reactive. It threads the plan, picks
// the next obligation, predicts the leave-by from where you ACTUALLY are (live
// GPS, falling back to your home base), and bands it honestly (reads the buffer
// so it never cries "overdue" while you can still make it). No inline map — you
// get the timing here and the map full-screen on Navigate. When you're late it
// keeps the obligation in front of you and shows planned → new ETA; a reversible
// Walk/Taxi toggle lets you see a faster way; "Tell" shares your real ETA.

const HHMM = (ms: number) => londonClock(new Date(ms).toISOString());

const MODE_LABEL: Record<NavMode, string> = { walk: "Walk", cycle: "Cycle", drive: "Taxi" };

export function LiveDay({ anchors, sub, base }: { anchors: SpineAnchor[]; sub?: string; base?: { lat: number; lng: number } | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [modeOverride, setModeOverride] = useState<NavMode | null>(null);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [locEnabled, setLocEnabled] = useState(false);
  const { fix, status } = useLivePosition(locEnabled);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Upgrade to live position only if already granted — never prompt on load.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
        if (perms?.query) {
          const s = await perms.query({ name: "geolocation" as PermissionName });
          if (!cancelled && s.state === "granted") setLocEnabled(true);
        }
      } catch {
        /* no Permissions API — wait for a tap */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const engineAnchors: EngineAnchor[] = useMemo(
    () =>
      anchors.map((a) => ({
        id: a.id,
        startMs: a.arriveByIso ? Date.parse(a.arriveByIso) : null,
        endMs: a.endIso ? Date.parse(a.endIso) : null,
        plannedTravelMinutes: a.plannedTravelMinutes,
        isStation: !!a.station,
      })),
    [anchors],
  );

  // Pick the next obligation first (time-only), so the route fetch + mode toggle
  // hang off a stable target.
  const preState = computeDayState({ anchors: engineAnchors, nowMs: now });
  const next = preState.nextIndex != null ? anchors[preState.nextIndex] : null;
  const mode: NavMode = modeOverride ?? next?.navMode ?? "walk";
  const origin = fix ? { lat: fix.lat, lng: fix.lng, name: "Your location" } : base ? { lat: base.lat, lng: base.lng, name: "Home" } : null;
  const fromHome = !fix && !!base;

  // Reset per-leg choices when the obligation changes.
  const nextId = next?.id ?? null;
  const prevNextId = useRef<string | null>(null);
  useEffect(() => {
    if (prevNextId.current !== nextId) {
      prevNextId.current = nextId;
      setModeOverride(null);
      setRoute(null);
    }
  }, [nextId]);

  // Fetch the route for the active mode (for the leave-by maths AND Navigate) —
  // but never show it inline. From your live position, else your home base.
  const oLat = origin?.lat;
  const oLng = origin?.lng;
  const dLat = next?.coord?.lat;
  const dLng = next?.coord?.lng;
  useEffect(() => {
    if (oLat == null || oLng == null || dLat == null || dLng == null) {
      setRoute(null);
      return;
    }
    let active = true;
    void fetchNavRoute({ origin: { lat: oLat, lng: oLng, name: "Start" }, destination: { lat: dLat, lng: dLng, name: "Destination" }, mode }).then((r) => {
      if (active && r.ok) setRoute(r.value);
    });
    return () => {
      active = false;
    };
  }, [oLat, oLng, dLat, dLng, mode]);

  const state = computeDayState({ anchors: engineAnchors, nowMs: now, liveTravelSeconds: route?.duration_s ?? null });
  const spare = totalSpareMinutes(state.gaps);

  if (!next) {
    return (
      <section className="cc-active-tile" data-urgency="comfortable">
        <span className="cc-at-status">
          <span className="cc-at-dot" />
          {state.phase === "arrived" ? "All done" : "At rest"}
        </span>
        <h2 className="cc-at-headline">{state.phase === "arrived" ? "That's your day" : "Nothing on right now"}</h2>
        {sub ? <p className="cc-at-sub">{sub}</p> : null}
      </section>
    );
  }

  const feas = state.feasibility;
  const arriveByMs = next.arriveByIso ? Date.parse(next.arriveByIso) : null;
  const arrivalMs = feas ? now + feas.travelMinutes * 60_000 : null;
  const lateMin = arrivalMs != null && arriveByMs != null ? Math.round((arrivalMs - arriveByMs) / 60_000) : null;
  const isMeeting = !next.station;
  const isLate = (feas?.band === "cliff") || (lateMin != null && lateMin > 0);

  const modeOptions = Array.from(new Set<NavMode>([next.navMode, "drive"]));

  return (
    <section className="cc-active-tile" data-urgency={urgencyOf(feas)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        {state.phase === "in_transit" || isLate ? "On your way" : "Next move"}
      </span>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 className="cc-at-headline" style={{ margin: 0 }}>{headline(feas)}</h2>
        {feas && feas.band !== "cliff" ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>{HHMM(feas.leaveByMs)}</span> : null}
      </div>

      <p className="cc-at-sub" style={{ margin: 0 }}>
        To {next.title}
        {next.place && next.place !== next.title ? ` · ${next.place}` : ""}
      </p>

      {/* Timing — the part you actually want. Late shows planned → new ETA. */}
      {arrivalMs != null ? (
        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "var(--fs-label)", color: isLate ? "var(--amber)" : "var(--ink-dim)" }}>
          {isLate && arriveByMs != null
            ? `Planned ${HHMM(arriveByMs)} → arriving ~${HHMM(arrivalMs)}${lateMin != null && lateMin > 0 ? ` · ${lateMin} min late` : ""}`
            : `Arrive ~${HHMM(arrivalMs)}${lateMin != null && lateMin < -1 ? ` · ${-lateMin} min to spare` : ""}`}
          {fromHome ? " · from home" : ""}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Working out the time…</p>
      )}

      {/* Reversible mode toggle — see a faster way and switch straight back. */}
      {origin && next.coord && modeOptions.length > 1 ? (
        <div style={{ display: "inline-flex", gap: 4, alignSelf: "flex-start", border: "1px solid var(--rule)", borderRadius: "var(--radius-pill, 999px)", padding: 2 }}>
          {modeOptions.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeOverride(m)}
              className={m === mode ? "cc-btn cc-btn-gold" : "cc-btn"}
              style={{ fontSize: "var(--fs-label)", padding: "3px 12px", border: "none", background: m === mode ? undefined : "transparent" }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginTop: "var(--space-1)" }}>
        {next.coord && origin ? (
          <button
            type="button"
            className="cc-btn cc-btn-gold"
            disabled={!route}
            onClick={() => {
              void requestHeadingPermission();
              setNavOpen(true);
            }}
          >
            {route ? "Navigate" : "Finding route…"}
          </button>
        ) : null}
        {isLate && isMeeting && arrivalMs != null ? <NotifyButton who={next.title} arrivalMs={arrivalMs} /> : null}
        {fromHome && next.coord ? (
          <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)" }} onClick={() => setLocEnabled(true)}>
            {status === "denied" ? "Location blocked" : "Use live location"}
          </button>
        ) : null}
        {!origin && next.coord ? (
          <button type="button" className="cc-btn cc-btn-gold" onClick={() => setLocEnabled(true)}>
            {status === "denied" ? "Location is blocked" : "Use live location"}
          </button>
        ) : null}
      </div>

      {spare >= 15 && !isLate ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{spare} min of free time across your day — room to fit something in.</p>
      ) : null}

      {navOpen && route ? <FullLeg route={route} preview={false} onClose={() => setNavOpen(false)} /> : null}
    </section>
  );
}

// Tell whoever's waiting your real ETA — Share where available, else copy.
// (WhatsApp / contacts integration to come.)
function NotifyButton({ who, arrivalMs }: { who: string; arrivalMs: number }) {
  const [done, setDone] = useState(false);
  const msg = `Running a little late — I'll be there around ${HHMM(arrivalMs)}.`;
  const send = async () => {
    try {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) await nav.share({ text: msg });
      else await navigator.clipboard?.writeText(msg);
      setDone(true);
    } catch {
      /* dismissed */
    }
  };
  const first = who.split(/[ —-]/)[0];
  return (
    <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)" }} onClick={send}>
      {done ? "ETA sent" : `Tell ${first || "them"}`}
    </button>
  );
}

function urgencyOf(feas: Feasibility | null): "comfortable" | "urgent" | "breach" {
  if (!feas) return "comfortable";
  if (feas.band === "cliff") return "breach";
  if (feas.band === "leave_now" || feas.band === "heads_up") return "urgent";
  return "comfortable";
}

function headline(feas: Feasibility | null): string {
  if (!feas) return "Working out your leave time…";
  if (feas.band === "cliff") return "Running late";
  if (feas.band === "leave_now") return feas.bufferLeftMin > 0 ? `Leave now · ${feas.bufferLeftMin} min buffer` : "Leave now";
  return leaveByCountdown(feas.slackMin);
}
