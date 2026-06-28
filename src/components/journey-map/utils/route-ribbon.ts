import type { Journey } from "../types";

// Buffer the journey's route into thin, road-width polygons so the route can be
// EXTRUDED into a raised cotton ribbon (fill-extrusion) — the one linear feature
// we can lift on a live map (roads arrive as lines, which MapLibre can't
// extrude). Width is in real-world metres so the ribbon tracks the basemap's
// roads; at the wide overview it's sub-pixel (the flat route line carries that
// zoom, the ribbon only reads once you're at street level).

const M_PER_DEG_LAT = 111_320;

// Offset both sides of a polyline by halfWidth (metres) and close into a ring.
// Per-vertex perpendicular from the neighbouring points — good enough for a
// smooth route; sharp hairpins may pinch slightly, which is invisible at the
// ribbon's scale.
function ringForLine(
  coords: [number, number][],
  halfWidthM: number,
): [number, number][] | null {
  if (coords.length < 2) return null;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    const a = coords[Math.max(0, i - 1)];
    const b = coords[Math.min(coords.length - 1, i + 1)];
    const mPerDegLng = M_PER_DEG_LAT * Math.max(0.1, Math.cos((lat * Math.PI) / 180));
    const dxm = (b[0] - a[0]) * mPerDegLng;
    const dym = (b[1] - a[1]) * M_PER_DEG_LAT;
    const len = Math.hypot(dxm, dym) || 1;
    // unit perpendicular (metres) → back to degrees
    const offLng = ((-dym / len) * halfWidthM) / mPerDegLng;
    const offLat = ((dxm / len) * halfWidthM) / M_PER_DEG_LAT;
    left.push([lng + offLng, lat + offLat]);
    right.push([lng - offLng, lat - offLat]);
  }
  return [...left, ...right.reverse(), left[0]];
}

export function buildRouteRibbon(journey: Journey, widthM = 7): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const leg of journey.legs) {
    if (leg.track.length < 2) continue;
    const coords = leg.track.map(([lat, lng]) => [lng, lat] as [number, number]);
    const ring = ringForLine(coords, widthM / 2);
    if (!ring) continue;
    features.push({
      type: "Feature",
      properties: { direction: leg.direction ?? "out" },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return { type: "FeatureCollection", features };
}
