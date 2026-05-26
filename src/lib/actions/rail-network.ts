"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { encodePolyline } from "@/lib/osm/rail-routes";

type Edge = {
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
};

/**
 * Batch-insert rail network edges. Called from the seed page in chunks
 * of ~5000 to stay within request size limits.
 */
export async function seedRailEdges(
  edges: Edge[],
): Promise<{ inserted: number }> {
  const ctx = await requireUserContext();
  if (!ctx.isAdmin) throw new Error("Admin only");
  if (edges.length === 0) return { inserted: 0 };

  const supabase = await createClient();
  const { error } = await supabase.from("rail_network_edges").insert(edges);
  if (error) throw new Error(`seedRailEdges: ${error.message}`);
  return { inserted: edges.length };
}

/**
 * Return the count of stored edges (null if table is empty / not seeded).
 */
export async function getRailNetworkStats(): Promise<{
  edgeCount: number;
} | null> {
  await requireUserContext();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("rail_network_edges")
    .select("id", { count: "exact", head: true });
  if (error) return null;
  if (count === null || count === 0) return null;
  return { edgeCount: count };
}

/**
 * Truncate the rail network table so the user can re-seed.
 */
export async function clearRailNetwork(): Promise<void> {
  const ctx = await requireUserContext();
  if (!ctx.isAdmin) throw new Error("Admin only");
  const supabase = await createClient();
  // Delete all rows — Supabase JS doesn't have TRUNCATE, but
  // a broad delete with a tautological filter does the job.
  const { error } = await supabase
    .from("rail_network_edges")
    .delete()
    .gte("id", 0);
  if (error) throw new Error(`clearRailNetwork: ${error.message}`);
}

// ── BFS routing from stored graph ──────────────────────────────────

type LatLng = { lat: number; lng: number };

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/**
 * Route between two points using the stored rail network graph.
 * Loads edges in the bounding box, builds an adjacency list, runs
 * Dijkstra, trims to station boundaries, and returns an encoded
 * Google polyline.
 *
 * When waypoints are provided, routes through each sequentially
 * (from → wp1 → wp2 → ... → to) and concatenates the path segments.
 * This forces the path through the correct branch at junctions.
 */
export async function routeRailPath(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  waypoints?: Array<{ lat: number; lng: number }>,
): Promise<string | null> {
  if (waypoints && waypoints.length > 0) {
    return routeRailPathViaWaypoints(fromLat, fromLng, toLat, toLng, waypoints);
  }
  return routeRailPathDirect(fromLat, fromLng, toLat, toLng);
}

async function routeRailPathViaWaypoints(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  waypoints: Array<{ lat: number; lng: number }>,
): Promise<string | null> {
  // Route each segment independently using routeRailPathDirect.
  // Each segment gets its own bounding box, edge fetch, and A*.
  // Segments are concatenated by decoding/re-encoding.
  const allPts = [
    { lat: fromLat, lng: fromLng },
    ...waypoints,
    { lat: toLat, lng: toLng },
  ];

  const allPoints: LatLng[] = [];
  for (let i = 0; i < allPts.length - 1; i++) {
    const segPoly = await routeRailPathDirect(
      allPts[i].lat, allPts[i].lng,
      allPts[i + 1].lat, allPts[i + 1].lng,
    );
    if (!segPoly) continue;
    const decoded = decodePolylineInternal(segPoly);
    if (i > 0 && allPoints.length > 0 && decoded.length > 0) {
      decoded.shift();
    }
    allPoints.push(...decoded);
  }

  if (allPoints.length < 2) return null;
  return encodePolyline(allPoints);
}

function decodePolylineInternal(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

async function routeRailPathDirect(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<string | null> {
  await requireUserContext();
  const supabase = await createClient();

  // Bounding box with padding
  const pad = 0.05;
  const minLat = Math.min(fromLat, toLat) - pad;
  const maxLat = Math.max(fromLat, toLat) + pad;
  const minLng = Math.min(fromLng, toLng) - pad;
  const maxLng = Math.max(fromLng, toLng) + pad;

  // Load edges. We need edges where BOTH endpoints are roughly in the
  // bounding box. Use from_lat/from_lng index, then post-filter to_*.
  // Supabase doesn't allow compound range filters across two pairs,
  // so we filter on from_* in the query and post-filter to_* in JS.
  const { data: edges, error } = await supabase
    .from("rail_network_edges")
    .select("from_lat, from_lng, to_lat, to_lng")
    .gte("from_lat", minLat)
    .lte("from_lat", maxLat)
    .gte("from_lng", minLng)
    .lte("from_lng", maxLng);

  if (error || !edges || edges.length === 0) return null;

  // Build adjacency graph using rounded lat/lng as keys
  const adj = new Map<string, Set<string>>();
  const coordMap = new Map<string, LatLng>();

  const addEdge = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const keyA = coordKey(aLat, aLng);
    const keyB = coordKey(bLat, bLng);
    if (!adj.has(keyA)) adj.set(keyA, new Set());
    if (!adj.has(keyB)) adj.set(keyB, new Set());
    adj.get(keyA)!.add(keyB);
    adj.get(keyB)!.add(keyA);
    if (!coordMap.has(keyA)) coordMap.set(keyA, { lat: aLat, lng: aLng });
    if (!coordMap.has(keyB)) coordMap.set(keyB, { lat: bLat, lng: bLng });
  };

  for (const e of edges) {
    // Post-filter: ensure to endpoint is also within a reasonable area
    // (wider than bbox — it just needs to be reachable, not strictly inside)
    if (
      e.to_lat >= minLat - pad &&
      e.to_lat <= maxLat + pad &&
      e.to_lng >= minLng - pad &&
      e.to_lng <= maxLng + pad
    ) {
      addEdge(e.from_lat, e.from_lng, e.to_lat, e.to_lng);
    }
  }

  if (adj.size === 0) return null;

  // Find nearest graph nodes to from/to stations
  const startKey = findNearestKey(coordMap, fromLat, fromLng);
  const endKey = findNearestKey(coordMap, toLat, toLng);
  if (!startKey || !endKey || startKey === endKey) return null;

  // Weighted A* — biases toward the destination so the path prefers
  // branches heading toward the target. Pure Dijkstra picks the
  // geometrically shortest path which can detour through a nearby
  // branch (e.g. via Beeston/Nottingham instead of direct to Derby).
  // Epsilon > 1 trades slight optimality for directness.
  const EPSILON = 1.3;
  const endPt = coordMap.get(endKey)!;

  const gScore = new Map<string, number>();
  const parent = new Map<string, string>();
  gScore.set(startKey, 0);

  const startPt = coordMap.get(startKey)!;
  const startH = haversineKm(startPt.lat, startPt.lng, endPt.lat, endPt.lng);
  const pq: Array<{ key: string; f: number; g: number }> = [
    { key: startKey, f: EPSILON * startH, g: 0 },
  ];

  let found = false;
  while (pq.length > 0) {
    pq.sort((a, b) => a.f - b.f);
    const { key: current, g: currentG } = pq.shift()!;

    if (current === endKey) {
      found = true;
      break;
    }

    if (currentG > (gScore.get(current) ?? Infinity)) continue;

    const currentPt = coordMap.get(current)!;
    for (const neighbor of adj.get(current) ?? []) {
      const neighborPt = coordMap.get(neighbor);
      if (!neighborPt) continue;
      const edgeDist = haversineKm(currentPt.lat, currentPt.lng, neighborPt.lat, neighborPt.lng);
      const newG = currentG + edgeDist;
      if (newG < (gScore.get(neighbor) ?? Infinity)) {
        gScore.set(neighbor, newG);
        parent.set(neighbor, current);
        const h = haversineKm(neighborPt.lat, neighborPt.lng, endPt.lat, endPt.lng);
        pq.push({ key: neighbor, f: newG + EPSILON * h, g: newG });
      }
    }
  }

  if (!found) return null;

  // Reconstruct path
  const pathKeys: string[] = [];
  let node: string | undefined = endKey;
  while (node != null) {
    pathKeys.unshift(node);
    node = parent.get(node);
  }

  let points: LatLng[] = pathKeys
    .map((k) => coordMap.get(k))
    .filter((pt): pt is LatLng => pt != null);

  if (points.length < 2) return null;

  // Trim to station boundaries (remove overshoot past stations)
  points = trimPathToStations(points, fromLat, fromLng, toLat, toLng);

  // Don't snap endpoints to station entrance coordinates — the line
  // should end at the nearest point on the actual track, not jump to
  // the station building entrance (which causes zigzag on zoom).

  return encodePolyline(points);
}

function findNearestKey(
  coordMap: Map<string, LatLng>,
  lat: number,
  lng: number,
): string | null {
  let bestKey: string | null = null;
  let bestDist = Infinity;
  for (const [key, pt] of coordMap) {
    const d = (pt.lat - lat) ** 2 + (pt.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
    }
  }
  return bestKey;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function trimPathToStations(
  path: LatLng[],
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): LatLng[] {
  let startIdx = 0;
  let endIdx = path.length - 1;
  let bestStartDist = Infinity;
  let bestEndDist = Infinity;

  for (let i = 0; i < path.length; i++) {
    const dFrom =
      (path[i].lat - fromLat) ** 2 + (path[i].lng - fromLng) ** 2;
    const dTo = (path[i].lat - toLat) ** 2 + (path[i].lng - toLng) ** 2;
    if (dFrom < bestStartDist) {
      bestStartDist = dFrom;
      startIdx = i;
    }
    if (dTo < bestEndDist) {
      bestEndDist = dTo;
      endIdx = i;
    }
  }

  if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];
  return path.slice(startIdx, endIdx + 1);
}
