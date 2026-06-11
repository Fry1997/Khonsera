"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SpineAnchor } from "./spine-model";
import { navigateHref, londonClock } from "./spine-model";

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

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <span className={past ? "cc-dot-leg" : "cc-dot-anchor"} />
      </div>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--rule)",
          borderLeft: state === "next" ? "2px solid var(--gold)" : "1px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          opacity: past ? 0.6 : 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
          <span
            style={{
              fontSize: "var(--fs-micro)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-uc)",
              color: state === "next" ? "var(--gold-2)" : "var(--ink-dim)",
            }}
          >
            {past ? "Done · " : ""}
            {TYPE_LABEL[anchor.type]}
          </span>
          {arrive ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-label)", color: "var(--ink)" }}>{arrive}</span>
          ) : null}
        </div>

        <h3 style={{ margin: "var(--space-1) 0 0", fontSize: "var(--fs-h3)", lineHeight: "var(--lh-h3)" }}>{anchor.title}</h3>
        {anchor.place && anchor.place !== anchor.title ? (
          <p style={{ margin: "2px 0 0", fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{anchor.place}</p>
        ) : null}

        {href && !past ? (
          <div style={{ marginTop: "var(--space-2)" }}>
            <Link href={href} className={state === "next" ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }}>
              Navigate
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
