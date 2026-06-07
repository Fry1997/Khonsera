import Link from "next/link";
import type { JourneyVM } from "./types";

// JourneyListCard — one journey on the home/list surface (handover §3).
function formatRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(new Date(s));
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function JourneyListCard({ journey }: { journey: JourneyVM }) {
  return (
    <Link
      href={`/itineraries/${journey.id}`}
      className="j-card block p-4 transition-colors duration-fast"
    >
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <span className="uc">{formatRange(journey.dateStart, journey.dateEnd)}</span>
        <span className={journey.mode === "work" ? "tag-tight" : "tag-ok"}>
          {journey.mode}
        </span>
      </header>
      <h3 className="h3">{journey.title || "Untitled journey"}</h3>
      <p className="small mt-1">
        {journey.anchorCount} {journey.anchorCount === 1 ? "anchor" : "anchors"}
        {journey.openGapCount > 0 ? (
          <span style={{ color: "var(--warning)" }}>
            {" "}
            · {journey.openGapCount} to resolve
          </span>
        ) : null}
      </p>
    </Link>
  );
}
