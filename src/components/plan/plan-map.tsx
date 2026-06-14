"use client";

import dynamic from "next/dynamic";
import type { Journey } from "@/components/journey-map";

// Client wrapper so the canonical `/plan/[id]` (a server component) can render the
// browser-only MapLibre JourneyMap. The Journey is built server-side from stops +
// transitions (see journey-map/from-stops) and passed in serialised.
const JourneyMap = dynamic(() => import("@/components/journey-map").then((m) => m.JourneyMap), {
  ssr: false,
});

export function PlanMap({ journey }: { journey: Journey }) {
  return <JourneyMap journey={journey} mode="planning" />;
}
