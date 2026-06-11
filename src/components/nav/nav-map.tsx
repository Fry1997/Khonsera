"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { THEMES } from "@/components/journey-map/themes";
import { buildMapStyle } from "@/components/journey-map/map-style/build-map-style";
import { getTileBlob, osmTileUrl } from "@/lib/offline/nav-cache";
import type { NavRoute } from "@/lib/nav/types";

// NavMap — the navigation rendering surface. Same MapLibre + theme treatment
// as JourneyMap, but tiles flow through a custom `khnav://` protocol that
// tries the on-device tile store first (saved routes pin their corridor
// there), then the network. So a saved route paints its map with no signal,
// and online browsing behaves exactly as before.

const PROTOCOL = "khnav";
let protocolRegistered = false;

function registerOfflineTileProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  maplibregl.addProtocol(PROTOCOL, async (params) => {
    // URL form: khnav://z/x/y
    const m = /^khnav:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (!m) throw new Error("bad tile url");
    const [z, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];

    const cached = await getTileBlob(`${z}/${x}/${y}`);
    if (cached) return { data: await cached.arrayBuffer() };

    const res = await fetch(osmTileUrl({ z, x, y }));
    if (!res.ok) throw new Error(`tile ${res.status}`);
    return { data: await res.arrayBuffer() };
  });
}

export interface NavMapProps {
  route: NavRoute | null;
  themeName?: "dusk" | "midnight" | "sahara";
  // Live fix + snapped point during guidance; the dot rides the snap.
  position?: { lat: number; lng: number; heading?: number | null } | null;
  follow?: boolean; // guidance mode: keep the camera on the dot
  height?: number;
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
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lng, p.lat] } },
    ],
  };
}

function routeBounds(route: NavRoute): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds();
  for (const [lat, lng] of route.geometry) b.extend([lng, lat]);
  return b;
}

export function NavMap({ route, themeName = "dusk", position, follow = false, height }: NavMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const theme = THEMES[themeName] ?? THEMES.dusk;

  useEffect(() => {
    if (!containerRef.current) return;
    registerOfflineTileProtocol();

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(theme, [`${PROTOCOL}://{z}/{x}/{y}`]),
      center: [-1.5, 52.5],
      zoom: 5,
      attributionControl: false,
      maxZoom: 18,
      minZoom: 3,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    m.on("load", () => {
      m.addSource(ROUTE_SOURCE, { type: "geojson", data: routeGeoJSON(route) });
      m.addSource(POSITION_SOURCE, { type: "geojson", data: positionGeoJSON(position) });

      m.addLayer({
        id: "nav-glow",
        type: "line",
        source: ROUTE_SOURCE,
        paint: { "line-color": theme.colors.gold, "line-width": 10, "line-opacity": 0.18, "line-blur": 4 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      m.addLayer({
        id: "nav-line",
        type: "line",
        source: ROUTE_SOURCE,
        paint: { "line-color": theme.colors.gold, "line-width": 4, "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
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
      m.addLayer({
        id: "nav-pos-dot",
        type: "circle",
        source: POSITION_SOURCE,
        paint: {
          "circle-radius": 6,
          "circle-color": theme.colors.gold,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      readyRef.current = true;
      if (route) {
        m.fitBounds(routeBounds(route), { padding: 56, duration: 0 });
        addEndpointMarkers(m, route);
      }
    });

    mapRef.current = m;
    return () => {
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
    const mk = (lat: number, lng: number, fill: string) => {
      const el = document.createElement("div");
      el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${fill};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(m);
      markersRef.current.push(marker);
    };
    mk(r.origin.lat, r.origin.lng, "transparent");
    mk(r.destination.lat, r.destination.lng, theme.colors.gold);
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

  // Position updates — cheap setData, optional camera follow.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    (m.getSource(POSITION_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(positionGeoJSON(position));
    if (position && follow) {
      m.easeTo({
        center: [position.lng, position.lat],
        zoom: Math.max(m.getZoom(), 16),
        bearing: position.heading ?? m.getBearing(),
        duration: 800,
      });
    }
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
    </div>
  );
}
