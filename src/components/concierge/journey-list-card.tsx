import Link from "next/link";
import type { Route } from "next";
import type { JourneyVM } from "./types";
import { ModeTag } from "./mode-tag";

// JourneyListCard — one Event (a day or a multi-day trip) in the Plan index
// (contract §3). Rebuilt to Design's Edition II `.cc-*` contract (was the one
// list component that never got the cc pass). Code keeps the name + data; the
// CSS owns the look. Links into the Event detail (`/plan/[id]`), not legacy.

function dayMonth(s: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(s));
}

function dayCount(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  const ms = b.getTime() - a.getTime();
  if (Number.isNaN(ms) || ms <= 0) return 1;
  return Math.round(ms / 86_400_000) + 1;
}

// "Wed 25 Jun" for a single day; "Wed 25 Jun – Sat 28 Jun · 4 days" for a span.
function spanLabel(start: string, end: string): string {
  if (start === end) return dayMonth(start);
  return `${dayMonth(start)} – ${dayMonth(end)} · ${dayCount(start, end)} days`;
}

export function JourneyListCard({
  journey,
  href,
}: {
  journey: JourneyVM;
  href?: Route;
}) {
  return (
    <Link href={href ?? (`/plan/${journey.id}` as Route)} className="cc-journey-card" data-mode={journey.mode}>
      <div className="cc-journey-when">
        <span className="cc-journey-span">{spanLabel(journey.dateStart, journey.dateEnd)}</span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
          <ModeTag mode={journey.mode} />
          <span className="cc-journey-status" data-status={journey.status}>{journey.status}</span>
        </span>
      </div>
      <h3 className="cc-journey-title">{journey.title || "Untitled"}</h3>
      <p className="cc-journey-meta">
        {journey.anchorCount} {journey.anchorCount === 1 ? "stop" : "stops"}
        {journey.openGapCount > 0 ? (
          <span className="cc-journey-gaps"> · {journey.openGapCount} to resolve</span>
        ) : null}
      </p>
    </Link>
  );
}
