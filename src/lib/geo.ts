// Shared geographic helpers. Haversine distance + human mileage formatting.
// Lifted here so the capture proximity ranking, route previews, and rail
// network code all share one implementation (DRY — see rail-network.ts).

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

// Great-circle distance between two points, in metres.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// Voice-safe miles label. Under 10 miles keeps one decimal ("0.4 mi"),
// further out rounds to whole miles ("12 mi"). Sub-50m reads as "here".
export function formatMiles(meters: number): string {
  if (meters < 50) return "here";
  const miles = meters / 1609.344;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// Sort rows nearest-first to `near`, attaching `distance_m` to each row that
// has coordinates. Rows without coordinates sink to the end, keeping their
// incoming order. Used by hub + place search proximity ranking.
export function rankByProximity<
  T extends { latitude: number | null; longitude: number | null; distance_m?: number },
>(rows: T[], near: LatLng): Array<T & { distance_m?: number }> {
  return rows
    .map((r, i) => {
      if (r.latitude == null || r.longitude == null) return { r, d: Number.POSITIVE_INFINITY, i };
      const d = haversineMeters(near.lat, near.lng, r.latitude, r.longitude);
      return { r: { ...r, distance_m: d }, d, i };
    })
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.r);
}
