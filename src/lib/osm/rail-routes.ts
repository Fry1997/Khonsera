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
  if (fromCode && toCode) {
    const cached = await getCachedPolyline(fromCode, toCode);
    if (cached) return cached;
  }

  const points = await buildCorridorPolyline(fromLat, fromLng, toLat, toLng);
  if (!points || points.length < 2) return null;

  const encoded = encodePolyline(points);

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

/**
 * Find intermediate stations in the corridor between two endpoints
 * from our transport_hubs table, then build a multi-waypoint polyline.
 * Much better than a straight line — follows the general rail corridor.
 */
async function buildCorridorPolyline(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<LatLng[] | null> {
  const supabase = await createSupabaseClient();

  const minLat = Math.min(fromLat, toLat) - 0.02;
  const maxLat = Math.max(fromLat, toLat) + 0.02;
  const minLng = Math.min(fromLng, toLng) - 0.02;
  const maxLng = Math.max(fromLng, toLng) + 0.02;

  const { data: hubs } = await supabase
    .from("transport_hubs")
    .select("code, latitude, longitude")
    .gte("latitude", minLat)
    .lte("latitude", maxLat)
    .gte("longitude", minLng)
    .lte("longitude", maxLng)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .not("code", "is", null);

  if (!hubs || hubs.length === 0) {
    return [{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }];
  }

  // Filter to stations within ~8km of the straight line between endpoints.
  // This keeps us in the rail corridor and excludes stations on branch lines.
  const dx = toLng - fromLng;
  const dy = toLat - fromLat;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen === 0) return null;

  const maxPerpendicularDeg = 0.08; // ~8km

  const corridor: Array<{ lat: number; lng: number; t: number }> = [];
  for (const h of hubs) {
    const lat = Number(h.latitude);
    const lng = Number(h.longitude);
    const px = lng - fromLng;
    const py = lat - fromLat;

    // Project onto the line: t is the parameter [0, 1] along from→to
    const t = (px * dx + py * dy) / (lineLen * lineLen);
    if (t < -0.05 || t > 1.05) continue;

    // Perpendicular distance from the line
    const perpDist = Math.abs(px * dy - py * dx) / lineLen;
    if (perpDist > maxPerpendicularDeg) continue;

    corridor.push({ lat, lng, t });
  }

  // Sort by position along the line
  corridor.sort((a, b) => a.t - b.t);

  // Deduplicate very close stations (within 0.01 degrees ~1km)
  const deduped: LatLng[] = [{ lat: fromLat, lng: fromLng }];
  for (const pt of corridor) {
    const prev = deduped[deduped.length - 1];
    const dist = Math.sqrt((pt.lat - prev.lat) ** 2 + (pt.lng - prev.lng) ** 2);
    if (dist > 0.005) {
      deduped.push({ lat: pt.lat, lng: pt.lng });
    }
  }
  deduped.push({ lat: toLat, lng: toLng });

  return deduped;
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
