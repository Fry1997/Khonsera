import { createClient as createSupabaseClient } from "@/lib/supabase/server";

type LatLng = { lat: number; lng: number };

export async function getRailPolyline(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  fromCode?: string | null,
  toCode?: string | null,
): Promise<string | null> {
  // Check cache first
  if (fromCode && toCode) {
    const cached = await getCachedPolyline(fromCode, toCode);
    if (cached) {
      console.log(`[rail-routes] Cache hit: ${fromCode}→${toCode}`);
      return cached;
    }
  }

  console.log(`[rail-routes] Fetching: ${fromCode ?? "?"}→${toCode ?? "?"} (${fromLat},${fromLng}→${toLat},${toLng})`);

  // Query Overpass for railway geometry
  const points = await queryOverpassRailRoute(fromLat, fromLng, toLat, toLng);
  if (!points || points.length < 2) {
    console.error(`[rail-routes] No points returned for ${fromCode}→${toCode}`);
    return null;
  }

  console.log(`[rail-routes] Got ${points.length} points for ${fromCode}→${toCode}`);
  const encoded = encodePolyline(points);

  // Cache for future use
  if (fromCode && toCode) {
    await cachePolyline(fromCode, toCode, encoded, points.length);
  }

  return encoded;
}

async function getCachedPolyline(
  fromCode: string,
  toCode: string,
): Promise<string | null> {
  try {
    const supabase = await createSupabaseClient();
    const { data } = await supabase
      .from("rail_route_cache")
      .select("encoded_polyline")
      .eq("from_station_code", fromCode)
      .eq("to_station_code", toCode)
      .single();
    return data?.encoded_polyline ?? null;
  } catch {
    return null;
  }
}

async function cachePolyline(
  fromCode: string,
  toCode: string,
  encoded: string,
  pointCount: number,
): Promise<void> {
  try {
    const supabase = await createSupabaseClient();
    await supabase.from("rail_route_cache").upsert(
      {
        from_station_code: fromCode,
        to_station_code: toCode,
        encoded_polyline: encoded,
        point_count: pointCount,
      },
      { onConflict: "from_station_code,to_station_code" },
    );
  } catch {
    // Cache write is best-effort
  }
}

async function queryOverpassRailRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<LatLng[] | null> {
  // Build a bounding box with padding around the two stations
  const minLat = Math.min(fromLat, toLat) - 0.05;
  const maxLat = Math.max(fromLat, toLat) + 0.05;
  const minLng = Math.min(fromLng, toLng) - 0.05;
  const maxLng = Math.max(fromLng, toLng) + 0.05;

  // Query Overpass for mainline railway=rail ways in the bounding box,
  // excluding sidings, yards, and service tracks. Returns full node
  // geometry so we can stitch a path between the two stations.
  const query = `
    [out:json][timeout:20];
    way["railway"="rail"]["service"!~"siding|yard|crossover|spur"](${minLat},${minLng},${maxLat},${maxLng});
    (._;>;);
    out body;
  `;

  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(25_000),
    });

    if (!resp.ok) {
      console.error(`[rail-routes] Overpass HTTP ${resp.status} for ${fromLat},${fromLng}→${toLat},${toLng}`);
      return null;
    }
    const json = await resp.json();

    const nodes = new Map<number, LatLng>();
    const ways: Array<{ id: number; nodeIds: number[] }> = [];

    for (const el of json.elements ?? []) {
      if (el.type === "node" && el.lat != null && el.lon != null) {
        nodes.set(el.id, { lat: el.lat, lng: el.lon });
      } else if (el.type === "way" && el.nodes) {
        ways.push({ id: el.id, nodeIds: el.nodes });
      }
    }

    console.log(`[rail-routes] Overpass returned ${nodes.size} nodes, ${ways.length} ways`);
    if (ways.length === 0) return null;

    const fromNode = findNearestNode(nodes, fromLat, fromLng);
    const toNode = findNearestNode(nodes, toLat, toLng);
    if (!fromNode || !toNode || fromNode === toNode) {
      console.error(`[rail-routes] No path: fromNode=${fromNode} toNode=${toNode}`);
      return null;
    }

    const path = findRailPath(ways, nodes, fromNode, toNode);
    console.log(`[rail-routes] BFS path: ${path?.length ?? 0} points`);
    if (!path || path.length < 2) return null;

    return path;
  } catch (e) {
    console.error("[rail-routes] Overpass fetch failed:", e);
    return null;
  }
}

function findNearestNode(
  nodes: Map<number, LatLng>,
  lat: number,
  lng: number,
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const [id, pt] of nodes) {
    const d = (pt.lat - lat) ** 2 + (pt.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

function findRailPath(
  ways: Array<{ id: number; nodeIds: number[] }>,
  nodes: Map<number, LatLng>,
  startNode: number,
  endNode: number,
): LatLng[] | null {
  // Build adjacency list from ways
  const adj = new Map<number, Array<{ neighbor: number; wayId: number; idx: number }>>();
  for (const way of ways) {
    for (let i = 0; i < way.nodeIds.length - 1; i++) {
      const a = way.nodeIds[i];
      const b = way.nodeIds[i + 1];
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push({ neighbor: b, wayId: way.id, idx: i });
      adj.get(b)!.push({ neighbor: a, wayId: way.id, idx: i });
    }
  }

  // BFS to find shortest path (by number of nodes)
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [startNode];
  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endNode) {
      // Reconstruct path
      const path: number[] = [];
      let node: number | undefined = endNode;
      while (node != null) {
        path.unshift(node);
        node = parent.get(node);
      }
      return path
        .map((id) => nodes.get(id))
        .filter((pt): pt is LatLng => pt != null);
    }
    for (const edge of adj.get(current) ?? []) {
      if (!visited.has(edge.neighbor)) {
        visited.add(edge.neighbor);
        parent.set(edge.neighbor, current);
        queue.push(edge.neighbor);
      }
    }
  }

  return null;
}

// Google's encoded polyline algorithm
export function encodePolyline(points: LatLng[]): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const { lat, lng } of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encoded += encodeValue(latE5 - prevLat);
    encoded += encodeValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }

  return encoded;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}
