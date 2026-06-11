// Slippy-map tile arithmetic + corridor enumeration for offline route saving.
// Pure (unit-tested) — the fetching/storage lives in offline/nav-cache.ts.
//
// Tile usage is deliberately frugal: a corridor a few hundred metres wide
// along the route, detail zoom only near maneuver points, hard-capped total.
// That respects the OSM tile policy (no area scraping) while guaranteeing the
// map you need at every decision point of a saved route.

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.min(Math.max(x, 0), n - 1), y: Math.min(Math.max(y, 0), n - 1) };
}

export function tileKey(t: TileCoord): string {
  return `${t.z}/${t.x}/${t.y}`;
}

// Default corridor recipe: overview zooms along the whole line, detail zoom
// only around maneuver points (where you actually look at the map).
export const CORRIDOR_ZOOMS = [13, 15] as const;
export const MANEUVER_ZOOM = 16;
export const MAX_CORRIDOR_TILES = 400;

// Metres → degrees, locally. Longitude shrinks with latitude.
function buffersDeg(lat: number, bufferM: number): { dLat: number; dLng: number } {
  const dLat = bufferM / 111_320;
  const dLng = bufferM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { dLat, dLng };
}

function addTilesAround(
  out: Map<string, TileCoord>,
  lat: number,
  lng: number,
  z: number,
  bufferM: number,
) {
  const { dLat, dLng } = buffersDeg(lat, bufferM);
  const a = lngLatToTile(lng - dLng, lat + dLat, z); // NW
  const b = lngLatToTile(lng + dLng, lat - dLat, z); // SE
  for (let x = a.x; x <= b.x; x++) {
    for (let y = a.y; y <= b.y; y++) {
      const t = { z, x, y };
      out.set(tileKey(t), t);
    }
  }
}

// Enumerate the tiles covering a buffered corridor along `geometry`
// ([lat,lng] order), plus detail tiles at each `detailPoint`. Deduplicated,
// capped at `cap` (overview zooms win — better a whole route coarse than half
// a route fine).
export function tilesForCorridor(
  geometry: [number, number][],
  opts: {
    zooms?: readonly number[];
    detailPoints?: [number, number][];
    detailZoom?: number;
    bufferM?: number;
    cap?: number;
  } = {},
): TileCoord[] {
  const zooms = opts.zooms ?? CORRIDOR_ZOOMS;
  const bufferM = opts.bufferM ?? 250;
  const cap = opts.cap ?? MAX_CORRIDOR_TILES;
  const out = new Map<string, TileCoord>();

  for (const z of [...zooms].sort((a, b) => a - b)) {
    // Sample the line densely enough that no tile gap can open between
    // consecutive samples: one tile at this zoom spans 360/2^z degrees.
    for (const [lat, lng] of geometry) {
      addTilesAround(out, lat, lng, z, bufferM);
      if (out.size > cap * 2) break; // runaway guard for absurd routes
    }
  }

  for (const [lat, lng] of opts.detailPoints ?? []) {
    addTilesAround(out, lat, lng, opts.detailZoom ?? MANEUVER_ZOOM, bufferM);
  }

  const all = [...out.values()];
  if (all.length <= cap) return all;
  // Over cap: keep coarse zooms first (whole-route coverage), trim the finest.
  return all.sort((a, b) => a.z - b.z).slice(0, cap);
}
