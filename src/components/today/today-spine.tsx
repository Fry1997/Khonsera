"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SpineAnchor } from "./spine-model";
import { navigateHref, londonClock, roleLabel } from "./spine-model";

// Today's spine — the whole day threaded on the gold rail (reusing the planning
// spine's `.cc-spine` vocabulary). A live NOW pulse sits at the current time;
// done anchors recede above it (dimmed, ticked), the next one is lifted, the
// rest wait below. `now` ticks every 30s so as time passes the NOW marker
// advances and events visibly move up past it — no reload. Every anchor with a
// location carries a "Navigate" link into the point-to-point router.

const TYPE_LABEL: Record<SpineAnchor["type"], string> = {
  appointment: "Appointment",
  reservation: "Reservation",
  accommodation_check_in: "Check-in",
  accommodation_check_out: "Check-out",
  transport_arrival: "Arrival",
  flight: "Flight",
  custom: "Stop",
};

type Row =
  | { kind: "anchor"; anchor: SpineAnchor; state: "past" | "next" | "future" }
  | { kind: "now" };

export function TodaySpine({ anchors, nextId }: { anchors: SpineAnchor[]; nextId?: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let nowPlaced = false;
    for (const a of anchors) {
      const startMs = a.arriveByIso ? new Date(a.arriveByIso).getTime() : null;
      const endMs = a.endIso ? new Date(a.endIso).getTime() : startMs;
      // The NOW marker drops in just before the first anchor still ahead of us.
      if (!nowPlaced && startMs != null && startMs > now) {
        out.push({ kind: "now" });
        nowPlaced = true;
      }
      const isPast = endMs != null && endMs < now && a.id !== nextId;
      const state: "past" | "next" | "future" = a.id === nextId ? "next" : isPast ? "past" : "future";
      out.push({ kind: "anchor", anchor: a, state });
    }
    if (!nowPlaced) out.push({ kind: "now" }); // whole day is behind us
    return out;
  }, [anchors, now, nextId]);

  if (anchors.length === 0) return null;

  return (
    <section>
      <div className="cc-eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        Today · {anchors.length}
      </div>
      <div className="cc-spine">
        <div className="cc-spine-rail" />
        {rows.map((row, i) =>
          row.kind === "now" ? (
            <div className="cc-node" key={`now-${i}`}>
              <div className="cc-node-dot">
                <span className="cc-dot-now" />
              </div>
              <div style={{ alignSelf: "center" }}>
                <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
                  Now · {londonClock(new Date(now).toISOString())}
                </span>
              </div>
            </div>
          ) : (
            <AnchorNode key={row.anchor.id} anchor={row.anchor} state={row.state} />
          ),
        )}
      </div>
    </section>
  );
}

function AnchorNode({ anchor, state }: { anchor: SpineAnchor; state: "past" | "next" | "future" }) {
  const href = navigateHref(anchor);
  const arrive = londonClock(anchor.arriveByIso);
  const past = state === "past";
  const station = anchor.station;

  // Eyebrow: a station reads as its role (Departure / Change / Arrival) with a
  // rail/air glyph; a plain anchor keeps its type label.
  const eyebrow = station ? roleLabel(anchor.role, station) : TYPE_LABEL[anchor.type];

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <span className={past ? "cc-dot-leg" : "cc-dot-anchor"} />
      </div>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--rule)",
          borderLeft: state === "next" ? "2px solid var(--gold)" : station ? "2px solid var(--rule-2)" : "1px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          opacity: past ? 0.6 : 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              fontSize: "var(--fs-micro)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-uc)",
              color: state === "next" ? "var(--gold-2)" : "var(--ink-dim)",
            }}
          >
            {station ? <StationGlyph kind={station.kind} /> : null}
            {past ? "Done · " : ""}
            {eyebrow}
          </span>
          {arrive ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-label)", color: "var(--ink)" }}>{arrive}</span>
          ) : null}
        </div>

        <h3 style={{ margin: "var(--space-1) 0 0", fontSize: "var(--fs-h3)", lineHeight: "var(--lh-h3)", display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
          <span>{anchor.title}</span>
          {station?.code ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-micro)",
                letterSpacing: "0.08em",
                color: "var(--ink-dim)",
                border: "1px solid var(--rule-2)",
                borderRadius: "var(--radius-xs)",
                padding: "1px 4px",
              }}
            >
              {station.code}
            </span>
          ) : null}
        </h3>
        {anchor.place && anchor.place !== anchor.title ? (
          <p style={{ margin: "2px 0 0", fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{anchor.place}</p>
        ) : null}

        {href && !past ? (
          <div style={{ marginTop: "var(--space-2)" }}>
            <Link href={href} className={state === "next" ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }}>
              {station ? "Walk to station" : "Navigate"}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Small rail / air glyphs — same stroke idiom as the shell nav icons. No emojis.
function StationGlyph({ kind }: { kind: "rail_station" | "airport" }) {
  const path =
    kind === "airport"
      ? "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"
      : "M8 4h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M5 11h14 M9 20l-2 2 M15 20l2 2 M9.5 14h.01 M14.5 14h.01";
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}
