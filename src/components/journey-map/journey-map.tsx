"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";

import type { JourneyMapProps } from "./types";
import { THEMES } from "./themes";
import { buildMapStyle } from "./map-style/build-map-style";
import { computeBounds } from "./utils/compute-bounds";
import { useMapProjection } from "./hooks/use-map-projection";
import { JourneyOverlay } from "./overlay/journey-overlay";

// Register the pmtiles protocol once at module level.
// Guard against double-registration in dev mode (HMR).
let protocolRegistered = false;
function ensureProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

/**
 * JourneyMap — interactive MapLibre-based map for Khonsera itineraries.
 *
 * v1: planning mode only. Renders the full journey on a styled
 * basemap with an SVG overlay for the route line and station markers.
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

  // Track container size for the SVG overlay
  const updateSize = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setContainerSize({ w: rect.width, h: rect.height });
  }, []);

  // Initialise MapLibre
  useEffect(() => {
    if (!containerRef.current) return;
    ensureProtocol();

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

    // Compact attribution in the corner
    m.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    m.on("load", () => {
      setMap(m);
      updateSize();
    });

    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
      setMap(null);
    };
    // Intentionally only run on mount — theme/journey changes handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update style when theme changes
  useEffect(() => {
    if (!map) return;
    const style = buildMapStyle(theme);
    map.setStyle(style);
  }, [map, theme]);

  // Re-fit bounds when journey changes
  useEffect(() => {
    if (!map || journey.legs.length === 0) return;
    const bounds = computeBounds(journey);
    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 600,
    });
  }, [map, journey]);

  // Track container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateSize]);

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
        style={{
          position: "absolute",
          inset: 0,
        }}
      />
      {/* SVG overlay — rendered on top of the MapLibre canvas */}
      {map && journey.legs.length > 0 && containerSize.w > 0 && (
        <JourneyOverlay
          journey={journey}
          project={project}
          theme={theme}
          renderToken={renderToken}
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
        />
      )}
    </div>
  );
}
