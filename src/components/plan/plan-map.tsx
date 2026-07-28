"use client";

import dynamic from "next/dynamic";
import type { Journey } from "@/components/journey-map";

// The REAL map (Connor: "this is NOT a map"): the abstract SVG is gone — the
// overview now renders the real Protomaps vector basemap, so it shows real
// roads, railways and (at zoom) extruded buildings with a normal thin route.
// It needs NEXT_PUBLIC_PMTILES_URL for the full vector treatment; without it,
// the raster fallback is still a real map.
const JourneyMap = dynamic(
  () => import("@/components/journey-map").then((m) => m.JourneyMap),
  {
    ssr: false,
  },
);

export function PlanMap({ journey }: { journey: Journey }) {
  return (
    <div className="cc-route-map">
      <JourneyMap
        journey={journey}
        mode="planning"
        themeName="cotton"
        height={340}
      />
    </div>
  );
}
