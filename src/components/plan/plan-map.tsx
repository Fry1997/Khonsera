"use client";

import dynamic from "next/dynamic";
import type { Journey } from "@/components/journey-map";

// The REAL map (Connor: "this is NOT a map"): the abstract SVG is gone — the
// overview now renders the real Protomaps vector basemap in the cotton theme,
// so it shows real roads, railways and (at zoom) extruded cotton buildings,
// with a normal thin route. Frameless: an edge feather dissolves it into the
// page (no box). Needs the vector basemap on (NEXT_PUBLIC_PMTILES_URL) for the
// full cotton/clay look; without it, cotton-tinted raster — still a real map.
const JourneyMap = dynamic(() => import("@/components/journey-map").then((m) => m.JourneyMap), {
  ssr: false,
});

const EDGE_MASK = "radial-gradient(128% 100% at 50% 46%, #000 68%, rgba(0,0,0,0.5) 86%, transparent 100%)";

export function PlanMap({ journey }: { journey: Journey }) {
  return (
    <div style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}>
      <JourneyMap journey={journey} mode="planning" themeName="cotton" height={340} />
    </div>
  );
}
