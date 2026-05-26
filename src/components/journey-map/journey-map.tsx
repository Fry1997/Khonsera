"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { JourneyMapProps } from "./types";
import { THEMES } from "./themes";
import { buildMapStyle } from "./map-style/build-map-style";
import { computeBounds } from "./utils/compute-bounds";
import { useMapProjection } from "./hooks/use-map-projection";
import { StationMarker } from "./overlay/station-marker";
import type { JourneyTheme } from "./themes/types";
import type { Journey } from "./types";

/**
 * JourneyMap — interactive MapLibre-based map for Khonsera itineraries.
 *
 * Journey lines render as native MapLibre GeoJSON layers (zero lag on
 * pan/zoom). Station markers render as a small SVG overlay.
 */
export function JourneyMap({
  journey,
  themeName = "dusk",
  mode: _mode,
  height,
  width,
}: JourneyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const theme = THEMES[themeName] ?? THEMES.dusk;
  const { project, renderToken } = useMapProjection(map);

  const updateSize = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setContainerSize({ w: rect.width, h: rect.height });
  }, []);

  // Initialise MapLibre
  useEffect(() => {
    if (!containerRef.current) return;

    const style = buildMapStyle(theme);
    const bounds = computeBounds(journey);

    const m = new maplibregl.Map({
      container: containerRef.current,
      style,
      bounds,
      fitBoundsOptions: {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
      },
      attributionControl: false,
      maxZoom: 16,
      minZoom: 3,
    });

    m.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    m.on("load", () => {
      addJourneyLayers(m, journey, theme);
      setMap(m);
      updateSize();
    });

    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update journey layers when journey or theme changes
  useEffect(() => {
    if (!map) return;
    updateJourneyLayers(map, journey, theme);
  }, [map, journey, theme]);

  // Re-fit bounds when journey changes
  useEffect(() => {
    if (!map || journey.legs.length === 0) return;
    const bounds = computeBounds(journey);
    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 600,
    });
  }, [map, journey]);

  // Update style when theme changes
  useEffect(() => {
    if (!map) return;
    const style = buildMapStyle(theme);
    map.setStyle(style);
    map.once("style.load", () => {
      addJourneyLayers(map, journey, theme);
    });
  }, [map, theme, journey]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => updateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateSize]);

  // Collect unique station markers from all legs
  const markers = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ lat: number; lng: number; label: string; role: "origin" | "destination" | "intermediate" }> = [];

    journey.legs.forEach((leg, i) => {
      const fromKey = `${leg.from.lat.toFixed(4)},${leg.from.lng.toFixed(4)}`;
      if (!seen.has(fromKey)) {
        seen.add(fromKey);
        out.push({
          lat: leg.from.lat,
          lng: leg.from.lng,
          label: leg.from.name,
          role: i === 0 ? "origin" : "intermediate",
        });
      }

      const toKey = `${leg.to.lat.toFixed(4)},${leg.to.lng.toFixed(4)}`;
      if (!seen.has(toKey)) {
        seen.add(toKey);
        out.push({
          lat: leg.to.lat,
          lng: leg.to.lng,
          label: leg.to.name,
          role: i === journey.legs.length - 1 ? "destination" : "intermediate",
        });
      }
    });

    return out;
  }, [journey]);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: width ? `${width}px` : "100%",
    height: height ? `${height}px` : "100%",
    minHeight: height ?? 320,
    borderRadius: 12,
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
      />
      {map && containerSize.w > 0 && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
          width={containerSize.w}
          height={containerSize.h}
          key={renderToken}
        >
          {markers.map((m, i) => (
            <StationMarker
              key={i}
              station={{ name: m.label, lat: m.lat, lng: m.lng }}
              role={m.role}
              project={project}
              theme={theme}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

// ── MapLibre GeoJSON layer management ───────────────────────────────

const JOURNEY_SOURCE = "journey-lines";
const GLOW_LAYER = "journey-glow";
const RAIL_LAYER = "journey-rail";
const WALK_LAYER = "journey-walk";
const ROAD_LAYER = "journey-road";

function buildGeoJSON(journey: Journey): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const leg of journey.legs) {
    if (leg.track.length < 2) continue;
    features.push({
      type: "Feature",
      properties: { mode: leg.mode },
      geometry: {
        type: "LineString",
        coordinates: leg.track.map(([lat, lng]) => [lng, lat]),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function addJourneyLayers(map: maplibregl.Map, journey: Journey, theme: JourneyTheme) {
  if (map.getSource(JOURNEY_SOURCE)) return;

  map.addSource(JOURNEY_SOURCE, {
    type: "geojson",
    data: buildGeoJSON(journey),
  });

  // Glow underlay for rail legs
  map.addLayer({
    id: GLOW_LAYER,
    type: "line",
    source: JOURNEY_SOURCE,
    filter: ["==", ["get", "mode"], "rail"],
    paint: {
      "line-color": theme.colors.gold,
      "line-width": 8,
      "line-opacity": 0.15,
      "line-blur": 4,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  // Rail legs — solid gold
  map.addLayer({
    id: RAIL_LAYER,
    type: "line",
    source: JOURNEY_SOURCE,
    filter: ["==", ["get", "mode"], "rail"],
    paint: {
      "line-color": theme.colors.gold,
      "line-width": 2.5,
      "line-opacity": 0.85,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  // Walk legs — dashed gold hairline
  map.addLayer({
    id: WALK_LAYER,
    type: "line",
    source: JOURNEY_SOURCE,
    filter: ["==", ["get", "mode"], "walk"],
    paint: {
      "line-color": theme.colors.gold,
      "line-width": 1.5,
      "line-opacity": 0.6,
      "line-dasharray": [2, 4],
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  // Road legs — solid hairline
  map.addLayer({
    id: ROAD_LAYER,
    type: "line",
    source: JOURNEY_SOURCE,
    filter: ["in", ["get", "mode"], ["literal", ["road", "transit"]]],
    paint: {
      "line-color": theme.colors.gold,
      "line-width": 1.5,
      "line-opacity": 0.6,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

function updateJourneyLayers(map: maplibregl.Map, journey: Journey, theme: JourneyTheme) {
  const source = map.getSource(JOURNEY_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(buildGeoJSON(journey));
  }
}
