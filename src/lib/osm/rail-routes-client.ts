/**
 * Client-side rail route fetching via Overpass API.
 *
 * Overpass blocks cloud provider IPs (Vercel gets 403), but allows
 * requests from home broadband. This module runs in the browser so
 * the request comes from the user's IP.
 */

type LatLng = { lat: number; lng: number };

export async function fetchRailPolylineFromBrowser(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ encoded: string; pointCount: number } | null> {
  const points = await queryOverpass(fromLat, fromLng, toLat, toLng);
  if (!points || points.length < 2) return null;

  // Snap endpoints to actual station coordinates so the line
  // starts and ends exactly at the map markers.
  points[0] = { lat: fromLat, lng: fromLng };
  points[points.length - 1] = { lat: toLat, lng: toLng };

  return { encoded: encodePolyline(points), pointCount: points.length };
}

async function queryOverpass(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<LatLng[] | null> {
  const minLat = Math.min(fromLat, toLat) - 0.05;
  const maxLat = Math.max(fromLat, toLat) + 0.05;
  const minLng = Math.min(fromLng, toLng) - 0.05;
  const maxLng = Math.max(fromLng, toLng) + 0.05;

  const query = `
    [out:json][timeout:30];
    way["railway"="rail"]["service"!~"siding|yard|crossover|spur"](${minLat},${minLng},${maxLat},${maxLng});
    (._;>;);
    out body;
  `;

  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!resp.ok) {
      console.warn(`[rail-routes] Overpass HTTP ${resp.status}`);
      return null;
    }

    const json = await resp.json();

    const nodes = new Map<number, LatLng>();
    const ways: Array<{ nodeIds: number[] }> = [];

    for (const el of json.elements ?? []) {
      if (el.type === "node" && el.lat != null && el.lon != null) {
        nodes.set(el.id, { lat: el.lat, lng: el.lon });
      } else if (el.type === "way" && el.nodes) {
        ways.push({ nodeIds: el.nodes });
      }
    }

    if (ways.length === 0) return null;

    const fromNode = findNearestNode(nodes, fromLat, fromLng);
    const toNode = findNearestNode(nodes, toLat, toLng);
    if (!fromNode || !toNode || fromNode === toNode) return null;

    return bfsPath(ways, nodes, fromNode, toNode);
  } catch (e) {
    console.warn("[rail-routes] Overpass fetch failed:", e);
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

function bfsPath(
  ways: Array<{ nodeIds: number[] }>,
  nodes: Map<number, LatLng>,
  startNode: number,
  endNode: number,
): LatLng[] | null {
  const adj = new Map<number, number[]>();
  for (const way of ways) {
    for (let i = 0; i < way.nodeIds.length - 1; i++) {
      const a = way.nodeIds[i];
      const b = way.nodeIds[i + 1];
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    }
  }

  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [startNode];
  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endNode) {
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
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}

function encodePolyline(points: LatLng[]): string {
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
