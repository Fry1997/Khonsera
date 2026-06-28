"use client";

import type { Journey } from "@/components/journey-map";
import { CottonMap } from "@/components/cotton-map/cotton-map";

// Client wrapper for the canonical `/plan/[id]` (a server component). The Journey
// is built server-side from stops + transitions (journey-map/from-stops) and
// passed in serialised. The map is now the abstract "cotton material map"
// (Design v8) — pure SVG, no tiles, renders offline at any size.
export function PlanMap({ journey }: { journey: Journey }) {
  // .cc-plan-map is Design's framed inset band (Edition III skin); the map fills it.
  return (
    <div className="cc-plan-map">
      <CottonMap journey={journey} />
    </div>
  );
}
