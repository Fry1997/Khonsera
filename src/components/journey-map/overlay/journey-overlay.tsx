"use client";

import type { Journey } from "../types";
import type { ProjectFn } from "../hooks/use-map-projection";
import type { JourneyTheme } from "../themes/types";
import { LegPath } from "./leg-path";
import { StationMarker } from "./station-marker";

interface JourneyOverlayProps {
  journey: Journey;
  project: ProjectFn;
  theme: JourneyTheme;
  renderToken: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * SVG overlay positioned over the MapLibre canvas.
 *
 * Renders all leg paths and station markers. Subscribes to the map's
 * projection via the project() function and re-renders on every
 * camera change (driven by renderToken).
 */
export function JourneyOverlay({
  journey,
  project,
  theme,
  containerWidth,
  containerHeight,
}: JourneyOverlayProps) {
  if (journey.legs.length === 0) return null;

  // Collect unique stations for marker rendering.
  // First leg's `from` is the origin. Last leg's `to` is the destination.
  // Everything in between is intermediate.
  const originStation = journey.legs[0].from;
  const destinationStation = journey.legs[journey.legs.length - 1].to;

  // Intermediate stations: each leg boundary (to of leg N / from of leg N+1)
  // that isn't the origin or destination.
  const intermediateStations = new Map<string, { station: typeof originStation; role: "intermediate" | "waypoint" }>();

  for (let i = 0; i < journey.legs.length; i++) {
    const leg = journey.legs[i];

    // Leg's `from` — if it's not the overall origin
    const fromKey = `${leg.from.lat.toFixed(5)},${leg.from.lng.toFixed(5)}`;
    if (i > 0) {
      intermediateStations.set(fromKey, { station: leg.from, role: "intermediate" });
    }

    // Leg's `to` — if it's not the overall destination
    const toKey = `${leg.to.lat.toFixed(5)},${leg.to.lng.toFixed(5)}`;
    if (i < journey.legs.length - 1) {
      intermediateStations.set(toKey, { station: leg.to, role: "intermediate" });
    }

    // Waypoints within a leg
    if (leg.waypoints) {
      for (const wp of leg.waypoints) {
        const wpKey = `${wp.lat.toFixed(5)},${wp.lng.toFixed(5)}`;
        if (!intermediateStations.has(wpKey)) {
          intermediateStations.set(wpKey, { station: wp, role: "waypoint" });
        }
      }
    }
  }

  // Remove origin/destination from intermediates (in case of coordinate overlap)
  const originKey = `${originStation.lat.toFixed(5)},${originStation.lng.toFixed(5)}`;
  const destKey = `${destinationStation.lat.toFixed(5)},${destinationStation.lng.toFixed(5)}`;
  intermediateStations.delete(originKey);
  intermediateStations.delete(destKey);

  return (
    <svg
      width={containerWidth}
      height={containerHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {/* Leg paths — rendered bottom to top */}
      {journey.legs.map((leg, i) => (
        <LegPath
          key={`leg-${i}`}
          leg={leg}
          project={project}
          theme={theme}
        />
      ))}

      {/* Intermediate station markers */}
      {Array.from(intermediateStations.values()).map(({ station, role }, i) => (
        <StationMarker
          key={`inter-${i}`}
          station={station}
          role={role}
          project={project}
          theme={theme}
        />
      ))}

      {/* Origin marker — on top */}
      <StationMarker
        station={originStation}
        role="origin"
        project={project}
        theme={theme}
      />

      {/* Destination marker — on top */}
      <StationMarker
        station={destinationStation}
        role="destination"
        project={project}
        theme={theme}
      />
    </svg>
  );
}
