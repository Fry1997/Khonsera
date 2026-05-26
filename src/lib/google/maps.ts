// Google Maps Platform server helpers.
//   - Geocoding API:    address string -> { lat, lng }
//   - Routes API:       origin + destination -> route summary + polyline
//                       (migrated from legacy Directions API in 2026 — the
//                       legacy endpoint is no longer enabled on new GCP
//                       projects)
//   - Static Maps API:  signed URL that the /api/maps/static proxy fetches
//
// All called with the GOOGLE_MAPS_API_KEY env var. The key never leaves
// the server — the browser fetches images through /api/maps/static.

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "geocodeAddress HTTP error:",
        res.status,
        body.slice(0, 200),
        "address:",
        address,
      );
      return null;
    }
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (data.status !== "OK" || data.results.length === 0) {
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.warn(
          "geocodeAddress failed:",
          data.status,
          data.error_message ?? "(no error_message)",
          "address:",
          address,
        );
      }
      return null;
    }
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

export type DirectionsStep = {
  travelMode: "WALKING" | "DRIVING" | "TRANSIT" | "BICYCLING" | string;
  durationSeconds: number;
  distanceMeters: number;
  startLocation: LatLng;
  endLocation: LatLng;
  polyline: string;
  htmlInstructions?: string;
  // Present when travelMode is TRANSIT.
  transit?: {
    line: string; // e.g. "Bus 24" or "Northern Line"
    vehicleType: string; // BUS, SUBWAY, RAIL, TRAM, …
    headsign?: string;
    departureStop: string;
    arrivalStop: string;
    departureTime?: string; // ISO
    arrivalTime?: string; // ISO
    numStops?: number;
  };
};

export type DirectionsResult = {
  durationSeconds: number;
  distanceMeters: number;
  // Encoded polyline (Google's compressed format). Suitable for &path=enc:...
  // in a Static Maps URL.
  overviewPolyline: string;
  startAddress: string;
  endAddress: string;
  steps: DirectionsStep[];
};

// Map our internal mode strings to Routes API travelMode enum values.
function toRoutesTravelMode(
  mode: "driving" | "walking" | "transit" | "bicycling" | undefined,
): "DRIVE" | "WALK" | "TRANSIT" | "BICYCLE" {
  switch (mode) {
    case "walking":
      return "WALK";
    case "transit":
      return "TRANSIT";
    case "bicycling":
      return "BICYCLE";
    case "driving":
    default:
      return "DRIVE";
  }
}

// Routes API durations come back as RFC3339-style strings ("1234s" or
// "1234.5s"). Pull the seconds out tolerantly.
function parseRoutesDuration(d: string | number | undefined): number {
  if (typeof d === "number") return Math.round(d);
  if (!d) return 0;
  const m = /^(-?\d+(?:\.\d+)?)s?$/.exec(d.trim());
  return m ? Math.round(parseFloat(m[1])) : 0;
}

export async function getDirections(args: {
  origin: string | LatLng;
  destination: string | LatLng;
  mode?: "driving" | "walking" | "transit" | "bicycling";
  departureTime?: Date;
  arrivalTime?: Date;
}): Promise<DirectionsResult | null> {
  const key = mapsApiKey();
  if (!key) return null;

  const travelMode = toRoutesTravelMode(args.mode);
  // arrivalTime is only valid on TRANSIT in Routes API; for DRIVE/WALK/BICYCLE
  // we fall back to departureTime (or "leave now" if neither given).
  const body: Record<string, unknown> = {
    origin: latLngOrAddressToRoutes(args.origin),
    destination: latLngOrAddressToRoutes(args.destination),
    travelMode,
    languageCode: "en-GB",
    units: "METRIC",
  };
  if (travelMode === "TRANSIT" && args.arrivalTime) {
    body.arrivalTime = args.arrivalTime.toISOString();
  } else if (args.departureTime) {
    body.departureTime = args.departureTime.toISOString();
  }
  if (travelMode === "DRIVE") {
    body.routingPreference = "TRAFFIC_AWARE";
  }

  // Field mask must list every leaf field we read below, otherwise Routes
  // API returns them empty. The mask is mode-aware: Routes API rejects
  // paths that don't apply to the requested travelMode (e.g. asking for
  // transitDetails on a DRIVE call returns INVALID_ARGUMENT). Keep the
  // universal paths up front; only add transit-specific ones for TRANSIT.
  const baseFieldMask = [
    "routes.duration",
    "routes.distanceMeters",
    "routes.polyline.encodedPolyline",
    "routes.legs.startLocation.latLng",
    "routes.legs.endLocation.latLng",
    "routes.legs.steps.travelMode",
    "routes.legs.steps.staticDuration",
    "routes.legs.steps.distanceMeters",
    "routes.legs.steps.polyline.encodedPolyline",
    "routes.legs.steps.startLocation.latLng",
    "routes.legs.steps.endLocation.latLng",
    "routes.legs.steps.navigationInstruction",
    // Note: Routes API v2's GeocodingResults shape doesn't include
    // formattedAddress (that's a Directions-v1 field). Requesting it
    // returns INVALID_ARGUMENT for the whole call. Consumers fall
    // back to the original origin/destination string when these
    // aren't returned — see startAddress/endAddress below.
  ];
  const transitOnly = ["routes.legs.steps.transitDetails"];
  const fieldMask = (
    travelMode === "TRANSIT" ? [...baseFieldMask, ...transitOnly] : baseFieldMask
  ).join(",");

  try {
    const res = await fetch(ROUTES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: { status?: string; message?: string };
      } | null;
      const status = err?.error?.status ?? `HTTP_${res.status}`;
      const message = err?.error?.message ?? "(no message)";
      console.warn(`Routes API failed status=${status}`);
      // Debug shunt: Vercel's runtime-log column truncates at ~30
      // chars, so the full message is unreadable in the dashboard.
      // Write to a Supabase table so we can read the whole thing
      // server-side. Best-effort — never let the debug write throw.
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const sb = await createClient();
        await sb.from("_debug_routes_api").insert({
          status,
          message,
          body,
          field_mask: fieldMask,
        });
      } catch {
        // swallow
      }
      return null;
    }
    type RoutesStep = {
      travelMode?: string;
      staticDuration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
      startLocation?: { latLng?: { latitude: number; longitude: number } };
      endLocation?: { latLng?: { latitude: number; longitude: number } };
      navigationInstruction?: { instructions?: string };
      transitDetails?: {
        stopDetails?: {
          arrivalStop?: { name?: string };
          departureStop?: { name?: string };
          arrivalTime?: string;
          departureTime?: string;
        };
        headsign?: string;
        transitLine?: {
          name?: string;
          nameShort?: string;
          vehicle?: { type?: string; name?: { text?: string } };
        };
        stopCount?: number;
      };
    };
    const data = (await res.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{
          startLocation?: { latLng?: { latitude: number; longitude: number } };
          endLocation?: { latLng?: { latitude: number; longitude: number } };
          steps?: RoutesStep[];
        }>;
      }>;
      geocodingResults?: {
        origin?: { formattedAddress?: string };
        destination?: { formattedAddress?: string };
      };
    };
    const route = data.routes?.[0];
    if (!route) return null;
    const leg = route.legs?.[0];
    const steps: DirectionsStep[] = (leg?.steps ?? []).map((s) => {
      const startLatLng = s.startLocation?.latLng;
      const endLatLng = s.endLocation?.latLng;
      const out: DirectionsStep = {
        travelMode: s.travelMode ?? "DRIVE",
        durationSeconds: parseRoutesDuration(s.staticDuration),
        distanceMeters: s.distanceMeters ?? 0,
        startLocation: startLatLng
          ? { lat: startLatLng.latitude, lng: startLatLng.longitude }
          : { lat: 0, lng: 0 },
        endLocation: endLatLng
          ? { lat: endLatLng.latitude, lng: endLatLng.longitude }
          : { lat: 0, lng: 0 },
        polyline: s.polyline?.encodedPolyline ?? "",
        htmlInstructions: s.navigationInstruction?.instructions,
      };
      const td = s.transitDetails;
      if (td) {
        out.transit = {
          line:
            td.transitLine?.nameShort ??
            td.transitLine?.name ??
            td.transitLine?.vehicle?.name?.text ??
            "",
          vehicleType: td.transitLine?.vehicle?.type ?? "",
          headsign: td.headsign,
          departureStop: td.stopDetails?.departureStop?.name ?? "",
          arrivalStop: td.stopDetails?.arrivalStop?.name ?? "",
          departureTime: td.stopDetails?.departureTime,
          arrivalTime: td.stopDetails?.arrivalTime,
          numStops: td.stopCount,
        };
      }
      return out;
    });
    const geo = data.geocodingResults;
    return {
      durationSeconds: parseRoutesDuration(route.duration),
      distanceMeters: route.distanceMeters ?? 0,
      overviewPolyline: route.polyline?.encodedPolyline ?? "",
      startAddress:
        geo?.origin?.formattedAddress ??
        (typeof args.origin === "string" ? args.origin : ""),
      endAddress:
        geo?.destination?.formattedAddress ??
        (typeof args.destination === "string" ? args.destination : ""),
      steps,
    };
  } catch (e) {
    console.error("getDirections failed", e);
    return null;
  }
}

// Routes API accepts either { address } or { location: { latLng: ... } }.
function latLngOrAddressToRoutes(
  p: string | LatLng,
): { address: string } | { location: { latLng: { latitude: number; longitude: number } } } {
  if (typeof p === "string") return { address: p };
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

// Named pin slots for the Journies map: each maps onto a brand hex. Use these
// instead of Google's stock colours (which only offer red/blue/green/…) so
// every pin sits inside the warm editorial palette.
export type MarkerColor =
  | "terra"
  | "sage"
  | "amber"
  | "rust"
  | "ink"
  // legacy aliases — older code (e.g. locations page) still passes these.
  | "red"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "yellow"
  | "black";

const MARKER_HEX: Record<MarkerColor, string> = {
  // brand
  terra: "c25c3a",
  sage: "5f7053",
  amber: "a07520",
  rust: "9b3422",
  ink: "1a1612",
  // legacy aliases mapped onto the closest brand colour so existing
  // call-sites stay cohesive without needing a sweep.
  red: "c25c3a",
  orange: "c25c3a",
  blue: "5f7053",
  green: "5f7053",
  yellow: "a07520",
  purple: "9b3422",
  black: "1a1612",
};

export type StaticMapMarker = {
  lat: number;
  lng: number;
  color?: MarkerColor;
  label?: string; // single character (A–Z, 0–9)
  size?: "tiny" | "small" | "mid" | "normal";
};

export type StaticMapPath = {
  encoded?: string; // polyline encoded string from Directions
  points?: LatLng[]; // OR plain list of points (we'll render straight-line)
  color?: string; // hex without "#"
  weight?: number;
};

export type MapStyle = "journies" | "minimal" | "default";

// The Journies map style — a hand-tuned cohesive look that matches the
// warm-paper editorial palette. Built around three rules:
//   1. Hide commercial POIs entirely — the map exists to orient, not advertise.
//   2. Roads + landscape stay in the cream/card range; the only contrast is
//      water (sage) and the terra-tinted highway hairlines.
//   3. Labels are stripped to administrative + locality + major roads, all
//      in ink-dim, so the route + pins read first.
const JOURNIES_STYLE = [
  // Global label treatment — ink-dim text on a paper halo.
  "feature:all|element:labels.text.fill|color:0x6e6557",
  "feature:all|element:labels.text.stroke|color:0xfbf8f1|weight:2",
  "feature:all|element:labels.icon|visibility:off",

  // Landscape — warm paper.
  "feature:landscape|element:geometry|color:0xf4f0e7",
  "feature:landscape.man_made|element:geometry|color:0xede7d8",
  "feature:landscape.natural|element:geometry|color:0xede7d8",

  // POIs — hidden. We surface our own markers instead.
  "feature:poi|element:all|visibility:off",
  "feature:poi.park|element:geometry|color:0xe6ebdb|visibility:on",
  "feature:poi.park|element:labels|visibility:off",

  // Transit lines — off (we own the route polyline).
  "feature:transit|element:all|visibility:off",
  "feature:transit.station|element:labels.text|visibility:on|color:0x9c917f",

  // Roads — three-tier hierarchy, all in the cream range.
  "feature:road|element:geometry.fill|color:0xfbf8f1",
  "feature:road|element:geometry.stroke|color:0xe4ddcd",
  "feature:road|element:labels.icon|visibility:off",
  "feature:road.local|element:labels|visibility:simplified",
  "feature:road.local|element:geometry|color:0xf7f2e6",
  "feature:road.arterial|element:geometry.fill|color:0xfbf8f1",
  "feature:road.arterial|element:geometry.stroke|color:0xd6cdb8",
  "feature:road.highway|element:geometry.fill|color:0xf0e6c8",
  "feature:road.highway|element:geometry.stroke|color:0xa07520",
  "feature:road.highway|element:labels.text.fill|color:0x8e3c20",

  // Water — sage-tinted, the one cool note in the palette.
  "feature:water|element:geometry|color:0xb8c2a8",
  "feature:water|element:labels.text.fill|color:0x5f7053",

  // Administrative — faint hairlines.
  "feature:administrative|element:geometry.stroke|color:0xd6cdb8",
  "feature:administrative.country|element:geometry.stroke|color:0x9c917f",
  "feature:administrative.locality|element:labels.text.fill|color:0x3a342c",
  "feature:administrative.neighborhood|element:labels|visibility:off",
];

// Minimal: just desaturate, no POI/transit hiding. Useful when we want a
// map-of-record (e.g. customer site context) and don't want surprises.
const MINIMAL_STYLE = [
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

export function buildStaticMapUrl(args: {
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  width: number;
  height: number;
  scale?: 1 | 2;
  zoom?: number;
  center?: LatLng;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  style?: MapStyle;
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

  const style = args.style ?? "journies";
  const styleRules =
    style === "journies"
      ? JOURNIES_STYLE
      : style === "minimal"
        ? MINIMAL_STYLE
        : null;
  if (styleRules) {
    for (const s of styleRules) url.searchParams.append("style", s);
  }

  for (const m of args.markers ?? []) {
    const hex = MARKER_HEX[m.color ?? "terra"];
    const parts = [
      `color:0x${hex}`,
      m.size && m.size !== "normal" ? `size:${m.size}` : "",
      m.label ? `label:${m.label}` : "",
      `${m.lat},${m.lng}`,
    ].filter(Boolean);
    url.searchParams.append("markers", parts.join("|"));
  }

  // Path parameters need manual URL construction because:
  // 1. URLSearchParams double-encodes %7C → %257C
  // 2. Encoded polylines can contain | (valid in the encoding alphabet)
  //    which collides with Google's | delimiter in path params
  // Solution: URL-encode the polyline content, keep | as literal delimiters
  const pathParams: string[] = [];
  for (const p of args.paths ?? []) {
    if (p.encoded) {
      const safePolyline = encodeURIComponent(p.encoded);
      pathParams.push(
        `weight:${p.weight ?? 4}|color:0x${p.color ?? "c25c3a"}|enc:${safePolyline}`,
      );
    } else if (p.points && p.points.length >= 2) {
      const coords = p.points.map((pt) => `${pt.lat},${pt.lng}`).join("|");
      pathParams.push(
        `weight:${p.weight ?? 3}|color:0x${p.color ?? "c25c3a"}|${coords}`,
      );
    }
  }

  url.searchParams.set("key", key);
  let finalUrl = url.toString();
  for (const pp of pathParams) {
    finalUrl += `&path=${pp}`;
  }
  return finalUrl;
}

