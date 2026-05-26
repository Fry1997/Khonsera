import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { routeRailPath } from "@/lib/actions/rail-network";

type LatLng = { lat: number; lng: number };

/**
 * Get an encoded polyline for a rail route between two stations.
 *
 * 1. Check the `rail_route_cache` table (L1 — keyed by CRS code pair).
 * 2. On miss, auto-discover intermediate stations along the direct line
 *    to use as waypoints (prevents wrong-branch routing at junctions).
 * 3. Call `routeRailPath` (weighted A*) through the stored rail network.
 * 4. Cache the result for next time.
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

    const polyline = await routeRailPath(
      fromLat, fromLng, toLat, toLng, waypoints,
    );
    if (!polyline) return null;

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

/**
 * Find rail stations that lie along the corridor between two points.
 * Returns stations sorted by progress along the line, excluding the
 * origin and destination themselves. Used as synthetic waypoints
 * when no calling points are available from ticket data.
 */
async function discoverIntermediateStations(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  fromCode?: string | null,
  toCode?: string | null,
): Promise<Array<{ lat: number; lng: number }>> {
  const directDistKm = haversineKm(fromLat, fromLng, toLat, toLng);
  if (directDistKm < 10) return [];

  const pad = 0.05;
  const minLat = Math.min(fromLat, toLat) - pad;
  const maxLat = Math.max(fromLat, toLat) + pad;
  const minLng = Math.min(fromLng, toLng) - pad;
  const maxLng = Math.max(fromLng, toLng) + pad;

  const { data: stations } = await supabase
    .from("transport_hubs")
    .select("code, latitude, longitude")
    .eq("kind", "rail_station")
    .gte("latitude", minLat)
    .lte("latitude", maxLat)
    .gte("longitude", minLng)
    .lte("longitude", maxLng);

  if (!stations || stations.length === 0) return [];

  // Direction vector from origin to destination
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const len2 = dLat * dLat + dLng * dLng;
  if (len2 === 0) return [];

  // UK rail lines curve significantly — the Midland Main Line deviates
  // up to 10km from the Leicester→Derby straight line. Scale corridor
  // with route length, generous enough to capture real intermediate
  // stations but tight enough to exclude parallel lines (Beeston is
  // 16km off the LEI→DBY direct line).
  const corridorKm = Math.max(5, Math.min(15, directDistKm * 0.3));

  const candidates: Array<{ lat: number; lng: number; t: number }> = [];

  for (const s of stations) {
    const sLat = Number(s.latitude);
    const sLng = Number(s.longitude);
    if (!sLat || !sLng) continue;

    // Skip origin/destination
    if (s.code === fromCode || s.code === toCode) continue;

    // Project station onto the origin→destination line
    const t = ((sLat - fromLat) * dLat + (sLng - fromLng) * dLng) / len2;
    if (t <= 0.05 || t >= 0.95) continue;

    // Perpendicular distance from the direct line
    const projLat = fromLat + t * dLat;
    const projLng = fromLng + t * dLng;
    const perpDist = haversineKm(sLat, sLng, projLat, projLng);

    if (perpDist <= corridorKm) {
      candidates.push({ lat: sLat, lng: sLng, t });
    }
  }

  // Sort by progress along the line
  candidates.sort((a, b) => a.t - b.t);

  // For long routes with many candidates, keep only a few well-spaced ones
  if (candidates.length > 5) {
    const kept: typeof candidates = [];
    let lastT = -0.2;
    for (const c of candidates) {
      if (c.t - lastT >= 0.15) {
        kept.push(c);
        lastT = c.t;
      }
    }
    return kept.map(({ lat, lng }) => ({ lat, lng }));
  }

  return candidates.map(({ lat, lng }) => ({ lat, lng }));
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
