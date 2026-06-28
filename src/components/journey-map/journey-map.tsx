"use client";

import { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { JourneyMapProps, Journey } from "./types";
import { THEMES } from "./themes";
import type { JourneyTheme } from "./themes/types";
import { buildMapStyle } from "./map-style/build-map-style";
import { registerBasemapProtocol } from "./pmtiles-source";
import { computeBounds } from "./utils/compute-bounds";
import { buildRouteRibbon } from "./utils/route-ribbon";

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
    const out: Array<{ lat: number; lng: number; label: string; role: "origin" | "destination" | "intermediate" }> = [];
    journey.legs.forEach((leg, i) => {
      const fk = `${leg.from.lat.toFixed(4)},${leg.from.lng.toFixed(4)}`;
      if (!seen.has(fk)) {
        seen.add(fk);
        out.push({ lat: leg.from.lat, lng: leg.from.lng, label: leg.from.code ?? leg.from.name, role: i === 0 ? "origin" : "intermediate" });
      }
      const tk = `${leg.to.lat.toFixed(4)},${leg.to.lng.toFixed(4)}`;
      if (!seen.has(tk)) {
        seen.add(tk);
        out.push({ lat: leg.to.lat, lng: leg.to.lng, label: leg.to.code ?? leg.to.name, role: i === journey.legs.length - 1 ? "destination" : "intermediate" });
      }
    });
    // Label side: pills open INWARD (toward the journey's centre) so they don't
    // clip at the map edge and the two ends' labels point away from each other.
    const cLng = out.reduce((s, o) => s + o.lng, 0) / (out.length || 1);
    return out.map((o) => ({ ...o, side: (o.lng > cLng ? "left" : "right") as "left" | "right" }));
  }, [journey]);

  // Initialise map
  useEffect(() => {
    if (!containerRef.current) return;
    registerBasemapProtocol(); // resolves khnav:// when the vector basemap is on

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
    const ribbon = m.getSource(RIBBON_ID) as maplibregl.GeoJSONSource | undefined;
    if (ribbon) ribbon.setData(buildRouteRibbon(journey));

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
const RIBBON_ID = "journey-ribbon";

function buildGeoJSON(journey: Journey): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: journey.legs
      .filter((leg) => leg.track.length >= 2)
      .map((leg) => ({
        type: "Feature" as const,
        properties: { mode: leg.mode, direction: leg.direction ?? "out" },
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

  // Raised cotton route RIBBON — the route buffered to a road-width polygon and
  // extruded, so at street zoom it lifts off the flat roads and catches the same
  // light as the buildings (Connor's clay reference). The one linear feature we
  // can raise on a live map. Below street zoom it's sub-pixel; the flat line
  // layers below carry the wide overview. Roads stay flat (lines can't extrude).
  const ribbonColor = theme.mapStyle.highway ?? theme.mapStyle.land;
  map.addSource(RIBBON_ID, { type: "geojson", data: buildRouteRibbon(journey) });
  map.addLayer({
    id: "j-ribbon",
    type: "fill-extrusion",
    source: RIBBON_ID,
    minzoom: 14,
    paint: {
      "fill-extrusion-color": ribbonColor,
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 4.5],
      "fill-extrusion-base": 0,
      "fill-extrusion-vertical-gradient": true,
      "fill-extrusion-opacity": 0.97,
    },
  });

  // Outbound = gold, return = the theme's contrasting routeReturn — so the two
  // directions never merge into one ambiguous line.
  const dirColor: maplibregl.ExpressionSpecification = [
    "case",
    ["==", ["get", "direction"], "back"], theme.colors.routeReturn,
    theme.colors.gold,
  ];

  // CASING — a crisp dark outline drawn UNDER every route line, wider than it, so
  // the route stands clear of similarly-toned basemap roads (the "route blends into
  // the road" complaint). One casing for all modes; the coloured lines sit on top.
  const g = theme.geom;
  // Walk dash from the theme ("2 5" → [2,5]); falls back to a sensible pattern.
  const walkDash = g.walkDash.trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));

  map.addLayer({
    id: "j-casing",
    type: "line",
    source: SOURCE_ID,
    // Not under dashed legs (walk / flight) — a solid casing would fill the gaps.
    filter: ["all", ["!=", ["get", "mode"], "walk"], ["!=", ["get", "mode"], "flight"]],
    paint: { "line-color": theme.colors.routeCasing, "line-width": g.casingWidth, "line-opacity": 0.9 },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-glow",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "rail"],
    // A soft lift, not a halo (Design): a touch stronger now the line is thinner.
    paint: { "line-color": dirColor, "line-width": g.railGlowWidth, "line-opacity": 0.32, "line-blur": 4 },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-rail",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "rail"],
    paint: { "line-color": dirColor, "line-width": g.railWidth, "line-opacity": 1 },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-walk",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "walk"],
    paint: { "line-color": dirColor, "line-width": g.walkWidth, "line-opacity": 0.95, "line-dasharray": walkDash.length >= 2 ? walkDash : [2, 5] },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  map.addLayer({
    id: "j-road",
    type: "line",
    source: SOURCE_ID,
    filter: ["in", ["get", "mode"], ["literal", ["road", "transit"]]],
    paint: { "line-color": dirColor, "line-width": g.railWidth, "line-opacity": 1 },
    layout: { "line-cap": "round", "line-join": "round" },
  });

  // Flight — a dashed line in the leg's direction colour (Design §4.5: same dash
  // as walk). The track is a great-circle arc when the leg carries one.
  map.addLayer({
    id: "j-flight",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "mode"], "flight"],
    paint: {
      "line-color": dirColor,
      "line-width": g.railWidth,
      "line-opacity": 0.95,
      "line-dasharray": walkDash.length >= 2 ? walkDash : [2, 5],
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

// Two-tier markers (Design 2026-06-27): the ends (origin/destination) are the
// larger GOLD dot; changeover/intermediate stops are the smaller INK dot. Both
// sit on a paper halo ring so they read on any basemap colour. Labels go on the
// ends only and open toward `side` (inward) so close stops don't collide.
function createMarkerEl(
  role: string,
  label: string,
  side: "left" | "right",
  theme: JourneyTheme,
): HTMLElement {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = "5px";
  el.style.pointerEvents = "none";

  const isEnd = role === "origin" || role === "destination";
  const dot = document.createElement("div");
  const sz = (isEnd ? theme.geom.originRadius : theme.geom.markerRadius) * 2;
  dot.style.width = `${sz}px`;
  dot.style.height = `${sz}px`;
  dot.style.borderRadius = "50%";
  dot.style.flexShrink = "0";
  dot.style.background = isEnd ? theme.colors.markerFill : theme.colors.markerFillMid;
  // Paper halo ring + a soft drop so the dot lifts off the map.
  dot.style.boxShadow = `0 0 0 2px ${theme.colors.markerStroke}, 0 1px 3px rgba(20,16,10,0.28)`;

  const makeLabel = (): HTMLElement => {
    // A solid badge, not bare text — our labels must sit ABOVE the basemap's
    // town/place names, which they used to merge into (e.g. "WEL" lost in
    // "Wellingborough").
    const lbl = document.createElement("span");
    lbl.textContent = label.toUpperCase();
    lbl.style.fontFamily = theme.fonts.mono;
    lbl.style.fontSize = "9px";
    lbl.style.fontWeight = "600";
    lbl.style.letterSpacing = "0.06em";
    lbl.style.color = theme.colors.labelBadgeText;
    lbl.style.background = theme.colors.labelBadge;
    lbl.style.padding = "1.5px 5px";
    lbl.style.borderRadius = "3px";
    lbl.style.whiteSpace = "nowrap";
    lbl.style.boxShadow = "0 1px 3px rgba(0,0,0,0.35)";
    return lbl;
  };

  // Ends carry a pill; intermediates are dot-only (they yield first, killing the
  // WEL/ILCE-AVENUE pile-up). The pill sits on the open side so the dot stays on
  // the coordinate (see anchor in addMarkers).
  if (isEnd && side === "left") {
    el.appendChild(makeLabel());
    el.appendChild(dot);
  } else if (isEnd) {
    el.appendChild(dot);
    el.appendChild(makeLabel());
  } else {
    el.appendChild(dot);
  }
  return el;
}

function addMarkers(
  map: maplibregl.Map,
  stations: Array<{ lat: number; lng: number; label: string; role: string; side: "left" | "right" }>,
  theme: JourneyTheme,
  markersRef: React.RefObject<maplibregl.Marker[]>,
) {
  for (const s of stations) {
    const el = createMarkerEl(s.role, s.label, s.side, theme);
    // Anchor the element so the DOT stays on the coordinate while the pill
    // extends to the open side: pill-left → element right-anchored, vice versa.
    // Dot-only intermediates centre on their point.
    const isEnd = s.role === "origin" || s.role === "destination";
    const anchor: maplibregl.PositionAnchor = !isEnd
      ? "center"
      : s.side === "left"
        ? "right"
        : "left";
    const marker = new maplibregl.Marker({ element: el, anchor })
      .setLngLat([s.lng, s.lat])
      .addTo(map);
    markersRef.current.push(marker);
  }
}

function clearMarkers(markersRef: React.RefObject<maplibregl.Marker[]>) {
  for (const m of markersRef.current) m.remove();
  markersRef.current = [];
}
