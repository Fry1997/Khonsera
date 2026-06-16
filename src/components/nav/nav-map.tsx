"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { THEMES } from "@/components/journey-map/themes";
import type { JourneyTheme } from "@/components/journey-map/themes/types";
import { haversineMeters } from "@/lib/geo";
import { buildMapStyle } from "@/components/journey-map/map-style/build-map-style";
import { registerBasemapProtocol, basemapProtocolUrl, vectorEnabled, probePmtiles } from "@/components/journey-map/pmtiles-source";
import type { NavRoute } from "@/lib/nav/types";

// NavMap — the navigation rendering surface. Same MapLibre + theme treatment as
// JourneyMap; the basemap (raster OSM or premium Protomaps vector) flows through
// the shared cache-aware `khnav://` protocol, so saved routes paint offline and
// online browsing is unchanged.

export interface NavMapProps {
  route: NavRoute | null;
  themeName?: "dusk" | "midnight" | "sahara";
  // Live fix + snapped point during guidance; the dot rides the snap.
  position?: { lat: number; lng: number; heading?: number | null } | null;
  follow?: boolean; // guidance mode: keep the camera on the dot
  height?: number;
  // 0..1 fraction of the route already travelled — dims the passed segment so the
  // line reads live (the premium "what's behind you fades" cue).
  progress?: number;
}

const ROUTE_SOURCE = "nav-route";
const POSITION_SOURCE = "nav-position";

function routeGeoJSON(route: NavRoute | null): GeoJSON.FeatureCollection {
  if (!route) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: route.geometry.map(([lat, lng]) => [lng, lat]),
        },
      },
    ],
  };
}

function positionGeoJSON(p: NavMapProps["position"]): GeoJSON.FeatureCollection {
  if (!p) return { type: "FeatureCollection", features: [] };
  const hasHeading = typeof p.heading === "number" && !Number.isNaN(p.heading);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { heading: hasHeading ? (p.heading as number) : 0, hasHeading },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      },
    ],
  };
}

// A Google-Maps-style field-of-view wedge, drawn once to a canvas and added as
// a map image. Apex sits at the dot (canvas centre) and fans "north" (up); the
// symbol layer rotates it to the live heading. Gold, fading to nothing.
function makeFovCone(gold: string): { data: ImageData; pixelRatio: number } | null {
  if (typeof document === "undefined") return null;
  const pr = 2;
  const size = 160 * pr;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const half = (33 * Math.PI) / 180; // ~66° field of view
  const start = -Math.PI / 2 - half; // -90° = up = north
  const end = -Math.PI / 2 + half;

  const [rr, gg, bb] = hexToRgb(gold);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(${rr},${gg},${bb},0.55)`);
  grad.addColorStop(0.7, `rgba(${rr},${gg},${bb},0.12)`);
  grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, start, end);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  return { data: ctx.getImageData(0, 0, size, size), pixelRatio: pr };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [184, 137, 63]; // Khonsera gold fallback
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// Line widths interpolate with zoom: the design-pack's slim overview lines when
// the whole route is in frame (low zoom), fattening to the bold close-up nav line
// once you've hit Start and the camera is at street level (~z16.5+). A fixed width
// that looks right up-close is "thicker than houses" zoomed out — this fixes that.
function widthByZoom(thin: number, thick: number): maplibregl.ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], 13, thin, 16.5, thick];
}

// The route core gradient — travelled segment dimmed (goldMuted), the road ahead
// bright (gold), the hand-off right at your progress. Clamped so the interpolate
// stops stay strictly ascending and in-range.
function routeGradient(theme: JourneyTheme, progress: number): maplibregl.ExpressionSpecification {
  const p = Math.max(0.0001, Math.min(0.999, progress));
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0, theme.colors.goldMuted,
    p, theme.colors.goldMuted,
    Math.min(1, p + 0.001), theme.colors.gold,
    1, theme.colors.gold,
  ];
}

// A directional puck — a white-bordered chevron with a soft drop shadow, the
// Google/Apple-grade vehicle marker. Rotated to heading by the symbol layer.
function makePuck(gold: string): { data: ImageData; pixelRatio: number } | null {
  if (typeof document === "undefined") return null;
  const pr = 2;
  const size = 64 * pr;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const cx = size / 2;
  const cy = size / 2;
  const w = 22 * pr;
  const h = 28 * pr;
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = 7 * pr;
  ctx.shadowOffsetY = 2 * pr;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2); // tip, pointing up (north before rotation)
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx, cy + h / 2 - 9 * pr); // tail notch → a chevron, not a triangle
  ctx.lineTo(cx - w / 2, cy + h / 2);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 3 * pr;
  ctx.strokeStyle = "#ffffff";
  ctx.lineJoin = "round";
  ctx.stroke();
  return { data: ctx.getImageData(0, 0, size, size), pixelRatio: pr };
}

function routeBounds(route: NavRoute): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds();
  for (const [lat, lng] of route.geometry) b.extend([lng, lat]);
  return b;
}

export function NavMap({ route, themeName = "dusk", position, follow = false, height, progress = 0 }: NavMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const lastCameraRef = useRef(0);
  // For speed-adaptive zoom: remember the last fix so we can derive m/s.
  const lastFixRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const navZoomRef = useRef(17.5);
  const [mapError, setMapError] = useState<string | null>(null);
  const theme = THEMES[themeName] ?? THEMES.dusk;

  useEffect(() => {
    if (!containerRef.current) return;
    registerBasemapProtocol();

    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: containerRef.current,
        style: buildMapStyle(theme, [basemapProtocolUrl()]),
        center: [-1.5, 52.5],
        zoom: 5,
        attributionControl: false,
        maxZoom: 18,
        minZoom: 3,
      });
    } catch (e) {
      // Invalid style / WebGL unavailable — surface it instead of a blank panel.
      setMapError(e instanceof Error ? e.message : "Map failed to initialise");
      return;
    }
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    // Surface the first hard error (style/source/tile) rather than failing
    // silent. A generic tile "Load failed" in vector mode gets a one-shot probe
    // that names the real cause (404 / CORS-blocked / reachable).
    let probed = false;
    m.on("error", (e) => {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      if (msg) setMapError((prev) => prev ?? msg);
      if (vectorEnabled() && !probed) {
        probed = true;
        void probePmtiles().then((detail) => setMapError(`tiles: ${detail}`));
      }
    });

    // The classic MapLibre blank cause: the container measured 0 at construct
    // time (flex/layout timing on mobile). Force a resize on load and whenever
    // the box changes size.
    const ro = new ResizeObserver(() => m.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    m.on("load", () => {
      m.resize();
      setMapError(null);
      // lineMetrics lets us drive a travelled-vs-remaining gradient along the line.
      m.addSource(ROUTE_SOURCE, { type: "geojson", data: routeGeoJSON(route), lineMetrics: true });
      m.addSource(POSITION_SOURCE, { type: "geojson", data: positionGeoJSON(position) });

      // A crisp dark casing UNDER the route so it stands clear of the road network
      // (the cartographic move that reads "real navigation", not a line on a map).
      m.addLayer({
        id: "nav-casing",
        type: "line",
        source: ROUTE_SOURCE,
        paint: { "line-color": theme.colors.routeCasing, "line-width": widthByZoom(theme.geom.casingWidth, 11), "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      m.addLayer({
        id: "nav-glow",
        type: "line",
        source: ROUTE_SOURCE,
        paint: { "line-color": theme.colors.gold, "line-width": widthByZoom(theme.geom.railGlowWidth, 13), "line-opacity": 0.16, "line-blur": 5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      // The core line — a gradient that DIMS the part you've already travelled
      // (goldMuted behind your progress) and stays bright ahead. Updated as you move.
      m.addLayer({
        id: "nav-line",
        type: "line",
        source: ROUTE_SOURCE,
        paint: {
          "line-width": widthByZoom(theme.geom.railWidth, 6),
          "line-gradient": routeGradient(theme, 0),
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      // FOV cone — beneath the dot, only when a heading is known. Rotates to the
      // live heading; map-aligned so it stays true under a heading-up camera.
      const cone = makeFovCone(theme.colors.gold);
      if (cone && !m.hasImage("fov-cone")) {
        m.addImage("fov-cone", cone.data, { pixelRatio: cone.pixelRatio });
      }
      if (m.hasImage("fov-cone")) {
        m.addLayer({
          id: "nav-fov",
          type: "symbol",
          source: POSITION_SOURCE,
          filter: ["==", ["get", "hasHeading"], true],
          layout: {
            "icon-image": "fov-cone",
            "icon-size": 0.7,
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
      }
      m.addLayer({
        id: "nav-pos-halo",
        type: "circle",
        source: POSITION_SOURCE,
        paint: {
          "circle-radius": 14,
          "circle-color": theme.colors.gold,
          "circle-opacity": 0.2,
        },
      });
      // The directional puck — a chevron rotated to heading. A plain dot is the
      // fallback when there's no heading yet (standing still / first fix).
      const puck = makePuck(theme.colors.gold);
      if (puck && !m.hasImage("nav-puck")) {
        m.addImage("nav-puck", puck.data, { pixelRatio: puck.pixelRatio });
      }
      if (m.hasImage("nav-puck")) {
        m.addLayer({
          id: "nav-pos-arrow",
          type: "symbol",
          source: POSITION_SOURCE,
          filter: ["==", ["get", "hasHeading"], true],
          layout: {
            "icon-image": "nav-puck",
            "icon-size": 0.62,
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
      }
      m.addLayer({
        id: "nav-pos-dot",
        type: "circle",
        source: POSITION_SOURCE,
        filter: ["!=", ["get", "hasHeading"], true],
        paint: {
          "circle-radius": 8,
          "circle-color": theme.colors.gold,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      // A sky/atmosphere at the horizon — the "this is a 3D world" cue when the
      // camera tilts. Themed sky→horizon→fog so distant buildings melt into a warm
      // haze. Faded in by zoom so the flat overview never gets an odd sky tint.
      // (best-effort; older MapLibre lacks setSky.)
      try {
        (m as unknown as { setSky?: (s: Record<string, unknown>) => void }).setSky?.({
          "sky-color": theme.mapStyle.sky,
          "sky-horizon-blend": 0.6,
          "horizon-color": theme.mapStyle.skyHorizon,
          "horizon-fog-blend": 0.5,
          "fog-color": theme.colors.paper,
          "fog-ground-blend": 0.4,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 12, 0, 15, 0.4, 18, 0.55],
        });
      } catch {
        /* sky is a flourish; never block the map on it */
      }

      readyRef.current = true;
      if (route) {
        m.fitBounds(routeBounds(route), { padding: 56, duration: 0 });
        addEndpointMarkers(m, route);
      }
    });

    mapRef.current = m;
    return () => {
      ro.disconnect();
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      m.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addEndpointMarkers(m: maplibregl.Map, r: NavRoute) {
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];
    // Only the destination gets a pin. The origin is either obvious (the route
    // line starts there) or, in guidance, your live position dot sits on it —
    // a second origin marker just reads as a stray dot beside the dot.
    const el = document.createElement("div");
    el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${theme.colors.gold};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
    const marker = new maplibregl.Marker({ element: el }).setLngLat([r.destination.lng, r.destination.lat]).addTo(m);
    markersRef.current.push(marker);
  }

  // Route updates
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    (m.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(routeGeoJSON(route));
    if (route) {
      m.fitBounds(routeBounds(route), { padding: 56, duration: 500 });
      addEndpointMarkers(m, route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Source update — every frame, cheap. This rotates the puck + FOV cone smoothly
  // to the live heading without touching the camera.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    (m.getSource(POSITION_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(positionGeoJSON(position));
  }, [position]);

  // Travelled-progress → dim the segment behind you (re-paint the gradient).
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current || !m.getLayer("nav-line")) return;
    m.setPaintProperty("nav-line", "line-gradient", routeGradient(theme, progress));
  }, [progress, theme]);

  // Camera follow — the cinematic nav view: pitched into the 3D world, heading-up,
  // the puck in the LOWER THIRD so the road ahead fills the frame, a continuous
  // glide between fixes (linear easing over ~1s, not a per-tick jump), and a gentle
  // SPEED-ADAPTIVE zoom (pull back as you speed up, tighten in when slow).
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current || !follow || !position) return;
    const now = Date.now();
    if (now - lastCameraRef.current < 250) return;

    const last = lastFixRef.current;
    if (last && now > last.t) {
      const mps = haversineMeters(last.lat, last.lng, position.lat, position.lng) / ((now - last.t) / 1000);
      const target = 17.8 - Math.min(1.3, Math.max(0, mps - 1.4) * 0.12); // ~17.8 walking → ~16.5 fast
      navZoomRef.current += (target - navZoomRef.current) * 0.25; // ease toward, no snapping
    }
    lastFixRef.current = { lat: position.lat, lng: position.lng, t: now };
    lastCameraRef.current = now;

    const headingUp = typeof position.heading === "number" && !Number.isNaN(position.heading);
    const h = containerRef.current?.clientHeight ?? 600;
    m.easeTo({
      center: [position.lng, position.lat],
      zoom: navZoomRef.current,
      pitch: 63, // leant back enough that a sliver of sky/horizon enters the frame
      bearing: headingUp ? (position.heading as number) : m.getBearing(),
      padding: { top: Math.round(h * 0.56), bottom: 0, left: 0, right: 0 }, // puck low; road ahead fills the top
      duration: 1000,
      easing: (t) => t, // linear → a continuous glide between fixes
    });
  }, [position, follow]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: height ? `${height}px` : "100%",
        minHeight: height ?? 320,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {mapError ? (
        <div
          style={{
            position: "absolute",
            left: "var(--space-2)",
            right: "var(--space-2)",
            bottom: "var(--space-2)",
            padding: "var(--space-2) var(--space-3)",
            background: "var(--card)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--fs-micro)",
            color: "var(--ink-dim)",
            zIndex: 2,
          }}
        >
          Map couldn&apos;t load: {mapError}
        </div>
      ) : null}
    </div>
  );
}
