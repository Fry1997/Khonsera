"use client";

import { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { JourneyMapProps, Journey } from "./types";
import { THEMES } from "./themes";
import type { JourneyTheme } from "./themes/types";
import { buildMapStyle } from "./map-style/build-map-style";
import { computeBounds } from "./utils/compute-bounds";

/**
 * JourneyMap — interactive MapLibre-based map for Khonsera itineraries.
 *
 * Everything renders inside MapLibre's pipeline (GeoJSON layers for lines,
 * native Markers for stations). Zero SVG, zero lag on pan/zoom.
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
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const layersAdded = useRef(false);

  const theme = THEMES[themeName] ?? THEMES.dusk;

  const stations = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ lat: number; lng: number; label: string; role: "origin" | "destination" | "intermediate" | "waypoint" }> = [];
    journey.legs.forEach((leg, i) => {
      const fk = `${leg.from.lat.toFixed(4)},${leg.from.lng.toFixed(4)}`;
      if (!seen.has(fk)) {
        seen.add(fk);
        out.push({ lat: leg.from.lat, lng: leg.from.lng, label: leg.from.code ?? leg.from.name, role: i === 0 ? "origin" : "intermediate" });
      }
      if (leg.waypoints) {
        for (const wp of leg.waypoints) {
          if (!wp.lat || !wp.lng) continue;
          const wk = `${wp.lat.toFixed(4)},${wp.lng.toFixed(4)}`;
          if (!seen.has(wk)) {
            seen.add(wk);
            out.push({ lat: wp.lat, lng: wp.lng, label: wp.code ?? wp.name, role: "waypoint" });
          }
        }
      }
      const tk = `${leg.to.lat.toFixed(4)},${leg.to.lng.toFixed(4)}`;
      if (!seen.has(tk)) {
        seen.add(tk);
        out.push({ lat: leg.to.lat, lng: leg.to.lng, label: leg.to.code ?? leg.to.name, role: i === journey.legs.length - 1 ? "destination" : "intermediate" });
      }
    });
    return out;
  }, [journey]);

  // Initialise map
  useEffect(() => {
    if (!containerRef.current) return;

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(theme),
      bounds: computeBounds(journey),
      fitBoundsOptions: { padding: { top: 50, bottom: 50, left: 50, right: 50 } },
      attributionControl: false,
      maxZoom: 16,
      minZoom: 3,
    });

    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    m.on("load", () => {
      addJourneyLayers(m, journey, theme);
      layersAdded.current = true;
      addMarkers(m, stations, theme, markersRef);
    });

    mapRef.current = m;

    return () => {
      clearMarkers(markersRef);
      m.remove();
      mapRef.current = null;
      layersAdded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update journey data when it changes (without re-creating the map)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersAdded.current) return;
    const src = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildGeoJSON(journey));

    clearMarkers(markersRef);
    addMarkers(m, stations, theme, markersRef);
  }, [journey, stations, theme]);

  // Re-fit bounds when journey changes
  useEffect(() => {
    const m = mapRef.current;
    if (!m || journey.legs.length === 0) return;
    m.fitBounds(computeBounds(journey), {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 600,
    });
  }, [journey]);

  return (
    <div
      style={{
        position: "relative",
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "100%",
        minHeight: height ?? 320,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

const SOURCE_ID = "journey-lines";

function buildGeoJSON(journey: Journey): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: journey.legs
      .filter((leg) => leg.track.length >= 2)
      .map((leg) => ({
        type: "Feature" as const,
        properties: { mode: leg.mode },
        geometry: {
          type: "LineString" as const,
          coordinates: leg.track.map(([lat, lng]) => [lng, lat]),
        },
      })),
  };
}

function addJourneyLayers(map: maplibregl.Map, journey: Journey, theme: JourneyTheme) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, { type: "geojson", data: buildGeoJSON(journey) });

  map.addLayer({
    id: "j-glow",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "rail"],
    paint: { "line-color": theme.colors.gold, "line-width": 8, "line-opacity": 0.15, "line-blur": 4 },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-rail",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "rail"],
    paint: { "line-color": theme.colors.gold, "line-width": 2.5, "line-opacity": 0.85 },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-walk",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "walk"],
    paint: { "line-color": theme.colors.gold, "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [2, 4] },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-road",
    type: "line",
    source: SOURCE_ID,
    filter: ["in", ["get", "mode"], ["literal", ["road", "transit"]]],
    paint: { "line-color": theme.colors.gold, "line-width": 1.5, "line-opacity": 0.6 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

function createMarkerEl(role: string, label: string, theme: JourneyTheme): HTMLElement {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = role === "waypoint" ? "3px" : "5px";
  el.style.pointerEvents = "none";

  const dot = document.createElement("div");
  const sz = role === "origin" ? 12 : role === "destination" ? 10 : role === "waypoint" ? 5 : 8;
  dot.style.width = `${sz}px`;
  dot.style.height = `${sz}px`;
  dot.style.borderRadius = "50%";
  dot.style.flexShrink = "0";

  if (role === "origin") {
    dot.style.background = "transparent";
    dot.style.border = `2px solid ${theme.colors.markerStroke}`;
    dot.style.boxShadow = `inset 0 0 0 2px transparent, inset 0 0 0 3px ${theme.colors.markerStroke}`;
    const inner = document.createElement("div");
    inner.style.width = "5px";
    inner.style.height = "5px";
    inner.style.borderRadius = "50%";
    inner.style.background = theme.colors.markerStroke;
    inner.style.margin = "auto";
    dot.style.display = "flex";
    dot.style.alignItems = "center";
    dot.style.justifyContent = "center";
    dot.appendChild(inner);
  } else if (role === "destination") {
    dot.style.background = theme.colors.markerFill;
  } else if (role === "waypoint") {
    dot.style.background = theme.colors.labelHalo;
    dot.style.border = `1px solid ${theme.colors.gold}`;
  } else {
    dot.style.background = theme.colors.labelHalo;
    dot.style.border = `1.5px solid ${theme.colors.markerFill}`;
  }

  const lbl = document.createElement("span");
  lbl.textContent = label.toUpperCase();
  lbl.style.fontFamily = theme.fonts.mono;
  lbl.style.fontSize = role === "waypoint" ? "7.5px" : "9px";
  lbl.style.letterSpacing = "0.06em";
  lbl.style.color = theme.colors.labelText;
  lbl.style.whiteSpace = "nowrap";
  if (role === "waypoint") lbl.style.opacity = "0.7";

  el.appendChild(dot);
  el.appendChild(lbl);
  return el;
}

function addMarkers(
  map: maplibregl.Map,
  stations: Array<{ lat: number; lng: number; label: string; role: string }>,
  theme: JourneyTheme,
  markersRef: React.RefObject<maplibregl.Marker[]>,
) {
  for (const s of stations) {
    const el = createMarkerEl(s.role, s.label, theme);
    const marker = new maplibregl.Marker({ element: el, anchor: "left" })
      .setLngLat([s.lng, s.lat])
      .addTo(map);
    markersRef.current.push(marker);
  }
}

function clearMarkers(markersRef: React.RefObject<maplibregl.Marker[]>) {
  for (const m of markersRef.current) m.remove();
  markersRef.current = [];
}
