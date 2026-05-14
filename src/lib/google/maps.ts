// Google Maps Platform server helpers. Three APIs used:
//   - Geocoding API:    address string -> { lat, lng }
//   - Directions API:   origin + destination -> route summary + polyline
//   - Static Maps API:  signed URL that the /api/maps/static proxy fetches
//
// All called with the GOOGLE_MAPS_API_KEY env var. The key never leaves
// the server — the browser fetches images through /api/maps/static.

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const DIRECTIONS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json";
const STATIC_MAP_ENDPOINT = "https://maps.googleapis.com/maps/api/staticmap";

export function mapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

export type LatLng = { lat: number; lng: number };

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const key = mapsApiKey();
  if (!key || !address?.trim()) return null;

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (data.status !== "OK" || data.results.length === 0) return null;
    const first = data.results[0];
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    };
  } catch (e) {
    console.error("geocodeAddress failed", e);
    return null;
  }
}

export type DirectionsResult = {
  durationSeconds: number;
  distanceMeters: number;
  // Encoded polyline (Google's compressed format). Suitable for &path=enc:...
  // in a Static Maps URL.
  overviewPolyline: string;
  startAddress: string;
  endAddress: string;
};

export async function getDirections(args: {
  origin: string | LatLng;
  destination: string | LatLng;
  mode?: "driving" | "walking" | "transit" | "bicycling";
  departureTime?: Date;
  arrivalTime?: Date;
}): Promise<DirectionsResult | null> {
  const key = mapsApiKey();
  if (!key) return null;

  const url = new URL(DIRECTIONS_ENDPOINT);
  url.searchParams.set("origin", stringifyLatLng(args.origin));
  url.searchParams.set("destination", stringifyLatLng(args.destination));
  url.searchParams.set("mode", args.mode ?? "driving");
  url.searchParams.set("key", key);
  // Directions only honours one of departure_time / arrival_time. arrival_time
  // takes precedence for the user's "I need to be there by 09:45" framing.
  if (args.arrivalTime) {
    url.searchParams.set(
      "arrival_time",
      String(Math.floor(args.arrivalTime.getTime() / 1000)),
    );
  } else if (args.departureTime) {
    url.searchParams.set(
      "departure_time",
      String(Math.floor(args.departureTime.getTime() / 1000)),
    );
  }

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      routes: Array<{
        legs: Array<{
          duration: { value: number };
          distance: { value: number };
          start_address: string;
          end_address: string;
        }>;
        overview_polyline: { points: string };
      }>;
    };
    if (data.status !== "OK" || data.routes.length === 0) return null;
    const route = data.routes[0];
    const leg = route.legs[0];
    return {
      durationSeconds: leg.duration.value,
      distanceMeters: leg.distance.value,
      overviewPolyline: route.overview_polyline.points,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
    };
  } catch (e) {
    console.error("getDirections failed", e);
    return null;
  }
}

export type StaticMapMarker = {
  lat: number;
  lng: number;
  color?: "red" | "blue" | "green" | "orange" | "purple" | "yellow" | "black";
  label?: string; // single character
};

export type StaticMapPath = {
  encoded?: string; // polyline encoded string from Directions
  points?: LatLng[]; // OR plain list of points (we'll render straight-line)
  color?: string; // hex without "#"
  weight?: number;
};

export function buildStaticMapUrl(args: {
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  width: number;
  height: number;
  scale?: 1 | 2;
  zoom?: number;
  center?: LatLng;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  style?: "minimal" | "default";
}): string | null {
  const key = mapsApiKey();
  if (!key) return null;
  const url = new URL(STATIC_MAP_ENDPOINT);
  url.searchParams.set(
    "size",
    `${Math.min(args.width, 640)}x${Math.min(args.height, 640)}`,
  );
  url.searchParams.set("scale", String(args.scale ?? 2));
  if (args.center) {
    url.searchParams.set("center", `${args.center.lat},${args.center.lng}`);
  }
  if (args.zoom) url.searchParams.set("zoom", String(args.zoom));
  url.searchParams.set("maptype", args.mapType ?? "roadmap");

  // Subtle desaturated style to match the warm paper palette.
  if (args.style !== "minimal") {
    const desat = [
      "feature:all|element:labels.text.fill|color:0x5f5a52",
      "feature:all|element:labels.text.stroke|color:0xfbf8f1",
      "feature:landscape|element:geometry|color:0xf4f0e7",
      "feature:road|element:geometry.fill|color:0xfbf8f1",
      "feature:road|element:geometry.stroke|color:0xe4ddcd",
      "feature:water|element:geometry|color:0xd6cdb8",
      "feature:poi|element:geometry|color:0xede7d8",
      "feature:poi|element:labels|visibility:simplified",
      "feature:administrative|element:geometry.stroke|color:0xd6cdb8",
    ];
    for (const s of desat) url.searchParams.append("style", s);
  }

  for (const m of args.markers ?? []) {
    const parts = [
      `color:${m.color ?? "red"}`,
      m.label ? `label:${m.label}` : "",
      `${m.lat},${m.lng}`,
    ].filter(Boolean);
    url.searchParams.append("markers", parts.join("|"));
  }

  for (const p of args.paths ?? []) {
    if (p.encoded) {
      const parts = [
        `weight:${p.weight ?? 4}`,
        `color:0x${p.color ?? "c25c3a"}`,
        `enc:${p.encoded}`,
      ];
      url.searchParams.append("path", parts.join("|"));
    } else if (p.points && p.points.length >= 2) {
      const coords = p.points.map((pt) => `${pt.lat},${pt.lng}`).join("|");
      const parts = [
        `weight:${p.weight ?? 3}`,
        `color:0x${p.color ?? "c25c3a"}`,
        coords,
      ];
      url.searchParams.append("path", parts.join("|"));
    }
  }

  url.searchParams.set("key", key);
  return url.toString();
}

function stringifyLatLng(p: string | LatLng): string {
  if (typeof p === "string") return p;
  return `${p.lat},${p.lng}`;
}
