"use client";

import type { Station } from "../types";
import type { ProjectFn } from "../hooks/use-map-projection";
import type { JourneyTheme } from "../themes/types";

type MarkerRole = "origin" | "destination" | "intermediate" | "waypoint";

interface StationMarkerProps {
  station: Station;
  role: MarkerRole;
  project: ProjectFn;
  theme: JourneyTheme;
}

/**
 * Station marker + label.
 *
 * Origin: bullseye (outer ring + inner disc).
 * Destination: solid gold disc.
 * Intermediate (leg transitions): gold-ringed circle.
 * Waypoint: smaller ringed circle.
 *
 * Labels are uppercase, small, positioned to the right of the marker.
 */
export function StationMarker({
  station,
  role,
  project,
  theme,
}: StationMarkerProps) {
  const { geom, colors } = theme;
  const { x, y } = project(station.lat, station.lng);
  const r = role === "waypoint" ? geom.markerRadius * 0.6 : geom.markerRadius;

  const labelText = station.code ?? station.name;

  return (
    <g>
      {role === "origin" && (
        <>
          {/* Outer ring */}
          <circle
            cx={x}
            cy={y}
            r={geom.originRadius}
            fill="none"
            stroke={colors.markerStroke}
            strokeWidth={1.5}
          />
          {/* Inner disc */}
          <circle
            cx={x}
            cy={y}
            r={geom.markerRadius * 0.55}
            fill={colors.markerStroke}
          />
        </>
      )}

      {role === "destination" && (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={colors.markerFill}
        />
      )}

      {role === "intermediate" && (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={colors.labelHalo}
          stroke={colors.markerFill}
          strokeWidth={1.5}
        />
      )}

      {role === "waypoint" && (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={colors.labelHalo}
          stroke={colors.gold}
          strokeWidth={1}
        />
      )}

      {/* Label */}
      <text
        x={x + r + 6}
        y={y + 3.5}
        fill={colors.labelText}
        fontSize={9.5}
        fontFamily={theme.fonts.mono}
        letterSpacing="0.06em"
        textAnchor="start"
        style={{ textTransform: "uppercase" as const }}
      >
        {labelText}
      </text>
    </g>
  );
}
