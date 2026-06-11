"use client";

import { useEffect, useState } from "react";
import type { TravelStatus } from "@/components/concierge";

// Live rail status for a booked Pass, fetched CLIENT-SIDE after paint — so the
// page render is never blocked, and when no Darwin token is set it simply renders
// nothing (the static "On time" on the Pass stands). Polls lightly while open.

type Live = {
  available: boolean;
  status?: TravelStatus;
  label?: string;
  detail?: string;
};

// status → token colour (no raw hex; references the brand ramp).
const DOT: Record<string, string> = {
  on_time: "var(--sage)",
  delayed: "var(--amber)",
  platform_change: "var(--amber)",
  cancelled: "var(--rust)",
};

export function LiveStatus({ crs, time }: { crs?: string | null; time?: string | null }) {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    if (!crs || !time) return;
    let active = true;
    const load = () => {
      fetch(`/api/darwin/departure?crs=${encodeURIComponent(crs)}&time=${encodeURIComponent(time)}`)
        .then((r) => r.json())
        .then((d: Live) => {
          if (active) setLive(d?.available ? d : null);
        })
        .catch(() => {
          /* keep the static badge */
        });
    };
    load();
    // Refresh every 60s while the day is open (cheap; Darwin board is on-demand).
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [crs, time]);

  if (!live || !live.available || !live.status) return null;

  return (
    <p
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        margin: "var(--space-1) 0 0",
        fontSize: "var(--fs-micro)",
        letterSpacing: "var(--ls-uc)",
        textTransform: "uppercase",
        color: "var(--ink-dim)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "var(--radius-pill)",
          background: DOT[live.status] ?? "var(--ink-faint)",
          flexShrink: 0,
        }}
      />
      <span>Live · {live.label}</span>
      {live.detail ? <span style={{ color: "var(--ink-faint)" }}>{live.detail}</span> : null}
    </p>
  );
}
