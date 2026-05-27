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
  if (!ctx.isSuperUser) throw new Error("Super user only");
  if (edges.length === 0) return { inserted: 0 };

  const supabase = await createClient();
  const { error } = await supabase.from("rail_network_edges").insert(edges);
  if (error) throw new Error(`seedRailEdges: ${error.message}`);
  return { inserted: edges.length };
}

export type RouteSegment = {
  osm_relation_id: number;
  route_name: string | null;
  operator: string | null;
  from_station_name: string;
  to_station_name: string;
  from_station_code: string | null;
  to_station_code: string | null;
  encoded_polyline: string;
  point_count: number;
};

export async function seedRouteSegments(
  segments: RouteSegment[],
): Promise<{ inserted: number }> {
  const ctx = await requireUserContext();
  if (!ctx.isSuperUser) throw new Error("Super user only");
  if (segments.length === 0) return { inserted: 0 };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rail_named_route_segments")
    .upsert(segments, { onConflict: "from_station_code,to_station_code" });
  if (error) throw new Error(`seedRouteSegments: ${error.message}`);
  return { inserted: segments.length };
}

export async function getRouteSegmentStats(): Promise<{ count: number } | null> {
  await requireUserContext();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("rail_named_route_segments")
    .select("id", { count: "exact", head: true });
  if (error) return null;
  return { count: count ?? 0 };
}

export async function clearRouteSegments(): Promise<void> {
  const ctx = await requireUserContext();
  if (!ctx.isSuperUser) throw new Error("Super user only");
  const supabase = await createClient();
  await supabase.from("rail_named_route_segments").delete().gte("id", "00000000-0000-0000-0000-000000000000");
}

export async function getAllRailStationCodes(): Promise<
  Array<{ code: string; name: string; lat: number; lng: number }>
> {
  await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("transport_hubs")
    .select("name, code, latitude, longitude")
    .eq("kind", "rail_station")
    .not("code", "is", null)
    .not("latitude", "is", null);
  return (data ?? []).map((h) => ({
    code: h.code!,
    name: h.name,
    lat: Number(h.latitude),
    lng: Number(h.longitude),
  }));
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
  if (!ctx.isSuperUser) throw new Error("Super user only");
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
  const allPts = [
    { lat: fromLat, lng: fromLng },
    ...waypoints,
    { lat: toLat, lng: toLng },
  ];

  const allPoints: LatLng[] = [];
  // Track the actual endpoint of the previous segment so the next
  // segment starts from where the track actually is, not from the
  // station entrance coordinates. This eliminates zigzag at junctions.
  let prevEndpoint: { lat: number; lng: number } | null = null;

  for (let i = 0; i < allPts.length - 1; i++) {
    const startPt = prevEndpoint ?? allPts[i];
    const endPt = allPts[i + 1];

    const segPoly = await routeRailPathDirect(
      startPt.lat, startPt.lng,
      endPt.lat, endPt.lng,
    );
    if (!segPoly) {
      prevEndpoint = null;
      continue;
    }
    const decoded = decodePolylineInternal(segPoly);
    if (decoded.length === 0) continue;

    // Capture the actual last track point for the next segment's start
    prevEndpoint = decoded[decoded.length - 1];

    // Skip the first point of subsequent segments to avoid duplicates
    if (i > 0 && allPoints.length > 0) decoded.shift();
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

  const pad = 0.1;
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

  // Corridor pruning: remove graph nodes that are too far from the
  // direct origin→destination line. This eliminates parallel branches
  // (e.g. the Beeston/Nottingham line when routing Leicester→Derby).
  const directDistKm = haversineKm(fromLat, fromLng, toLat, toLng);
  if (directDistKm > 10) {
    const corridorKm = Math.max(6, Math.min(15, directDistKm * 0.25));
    const dLat = toLat - fromLat;
    const dLng = toLng - fromLng;
    const len2 = dLat * dLat + dLng * dLng;
    const toRemove: string[] = [];
    for (const [key, pt] of coordMap) {
      const t = ((pt.lat - fromLat) * dLat + (pt.lng - fromLng) * dLng) / len2;
      const projLat = fromLat + Math.max(0, Math.min(1, t)) * dLat;
      const projLng = fromLng + Math.max(0, Math.min(1, t)) * dLng;
      const perpDist = haversineKm(pt.lat, pt.lng, projLat, projLng);
      if (perpDist > corridorKm) toRemove.push(key);
    }
    for (const key of toRemove) {
      coordMap.delete(key);
      adj.delete(key);
      for (const neighbors of adj.values()) neighbors.delete(key);
    }
  }

  if (adj.size === 0) return null;

  // Find nearest graph nodes to from/to stations
  const startKey = findNearestKey(coordMap, fromLat, fromLng);
  const endKey = findNearestKey(coordMap, toLat, toLng);
  if (!startKey || !endKey || startKey === endKey) return null;

  // Weighted A* — strongly biases toward the destination. At junctions
  // like Trent Junction, this forces the path along the branch heading
  // toward the destination rather than a nearby parallel line.
  // High epsilon (3.0) sacrifices distance-optimality for directness —
  // acceptable for rail where we want geometry, not shortest path.
  const EPSILON = 3.0;
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
