import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { routeRailPath } from "@/lib/actions/rail-network";

type LatLng = { lat: number; lng: number };

/**
 * Get an encoded polyline for a rail route between two stations.
 *
 * 1. Check the `rail_route_cache` table (L1 — keyed by CRS code pair).
 * 2. On miss, call `routeRailPath` which BFS-routes through the stored
 *    rail_network_edges graph (seeded from the admin page).
 * 3. If the graph produces a result, cache it for next time.
 * 4. If the network hasn't been seeded, return null gracefully.
 */
export async function getRailPolyline(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  fromCode?: string | null,
  toCode?: string | null,
  waypoints?: Array<{ lat: number; lng: number }>,
): Promise<string | null> {
  try {
    const supabase = await createSupabaseClient();
    const hasWaypoints = waypoints && waypoints.length > 0;

    // L1: code-pair cache lookup (skip when waypoints constrain the route)
    if (fromCode && toCode && !hasWaypoints) {
      const { data } = await supabase
        .from("rail_route_cache")
        .select("encoded_polyline")
        .eq("from_station_code", fromCode)
        .eq("to_station_code", toCode)
        .single();
      if (data?.encoded_polyline) return data.encoded_polyline;
    }

    // L2: Dijkstra through the stored rail network graph
    const polyline = await routeRailPath(
      fromLat, fromLng, toLat, toLng, waypoints,
    );
    if (!polyline) return null;

    // Cache the result for next time
    if (fromCode && toCode) {
      await supabase.from("rail_route_cache").upsert(
        {
          from_station_code: fromCode,
          to_station_code: toCode,
          encoded_polyline: polyline,
          point_count: 0,
        },
        { onConflict: "from_station_code,to_station_code" },
      );
    }

    return polyline;
  } catch {
    return null;
  }
}

// Google's encoded polyline algorithm — kept here for shared use.
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
