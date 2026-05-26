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
  await requireUserContext();
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
  await requireUserContext();
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
 * Loads edges in the bounding box, builds an adjacency list, runs BFS,
 * trims to station boundaries, and returns an encoded Google polyline.
 */
export async function routeRailPath(
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

  // BFS
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [startKey];
  visited.add(startKey);

  let found = false;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endKey) {
      found = true;
      break;
    }
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
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

  // Trim path to station boundaries
  points = trimPathToStations(points, fromLat, fromLng, toLat, toLng);

  // Snap endpoints to exact station coordinates
  points[0] = { lat: fromLat, lng: fromLng };
  points[points.length - 1] = { lat: toLat, lng: toLng };

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
