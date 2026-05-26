"use client";

import type { Leg, LatLng } from "../types";
import type { ProjectFn } from "../hooks/use-map-projection";
import type { JourneyTheme } from "../themes/types";

interface LegPathProps {
  leg: Leg;
  project: ProjectFn;
  theme: JourneyTheme;
  dimmed?: boolean;
}

/**
 * Renders a single leg's track as SVG path elements.
 *
 * Rail legs: solid gold line with a soft glow underlay.
 * Walk legs: dashed gold hairline.
 * Road legs: solid gold hairline (same width as walk, no dash).
 * Other modes: solid gold, standard width.
 */
export function LegPath({ leg, project, theme, dimmed = false }: LegPathProps) {
  const { geom, colors } = theme;
  const points = leg.track;

  if (points.length < 2) return null;

  const d = buildPathD(points, project);
  const opacity = dimmed ? 0.25 : 1;

  if (leg.mode === "walk") {
    return (
      <path
        d={d}
        fill="none"
        stroke={colors.gold}
        strokeWidth={geom.walkWidth}
        strokeDasharray={geom.walkDash}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  }

  if (leg.mode === "road") {
    return (
      <path
        d={d}
        fill="none"
        stroke={colors.gold}
        strokeWidth={geom.walkWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  }

  // Rail, transit, flight, ferry — gold with glow underlay
  return (
    <g opacity={opacity}>
      {/* Glow underlay */}
      <path
        d={d}
        fill="none"
        stroke={colors.goldGlow}
        strokeWidth={geom.railGlowWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Main line */}
      <path
        d={d}
        fill="none"
        stroke={colors.gold}
        strokeWidth={geom.railWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function buildPathD(points: LatLng[], project: ProjectFn): string {
  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const [lat, lng] = points[i];
    const { x, y } = project(lat, lng);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}
