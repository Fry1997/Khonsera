import { createClient as createSupabaseClient } from "@/lib/supabase/server";

type LatLng = { lat: number; lng: number };

/**
 * Get an encoded polyline for a rail route between two stations.
 * Reads from the rail_route_cache table — populated offline by
 * `scripts/backfill-rail-polylines.mjs` (Overpass blocks cloud IPs).
 */
export async function getRailPolyline(
  _fromLat: number,
  _fromLng: number,
  _toLat: number,
  _toLng: number,
  fromCode?: string | null,
  toCode?: string | null,
): Promise<string | null> {
  if (!fromCode || !toCode) return null;

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
