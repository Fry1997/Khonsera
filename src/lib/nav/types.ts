// Point-to-point navigation domain types — provider-agnostic. The Valhalla
// adapter (valhalla.ts) maps into these; a future transit provider (TfL, OTP)
// maps into the same shapes. UI and guidance code never see provider JSON.
//
// Everything here is JSON-serialisable on purpose: routes cross the server
// action boundary and are saved verbatim into the offline cache.

export type NavMode = "walk" | "cycle" | "drive";

export interface NavPoint {
  lat: number;
  lng: number;
  name: string;
}

// Normalised maneuver kinds — a small vocabulary the UI can draw glyphs for.
// Provider-specific exotica collapse onto the nearest of these.
export type ManeuverKind =
  | "depart"
  | "arrive"
  | "straight"
  | "slight-left"
  | "left"
  | "sharp-left"
  | "slight-right"
  | "right"
  | "sharp-right"
  | "uturn"
  | "merge"
  | "roundabout"
  | "exit-roundabout"
  | "ferry"
  | "stairs"
  | "other";

export interface NavManeuver {
  kind: ManeuverKind;
  instruction: string;        // written: "Turn left onto Friar Lane"
  verbal?: string;            // spoken (Valhalla's verbal_pre_transition)
  distance_m: number;         // length of this maneuver's stretch
  time_s: number;
  begin_shape_index: number;  // index range into NavRoute.geometry
  end_shape_index: number;
  street?: string;
}

export interface NavRoute {
  mode: NavMode;
  origin: NavPoint;
  destination: NavPoint;
  distance_m: number;
  duration_s: number;
  geometry: [number, number][]; // [lat, lng] — matches journey-map convention
  maneuvers: NavManeuver[];
  provider: string;             // "valhalla" — provenance, shown in About/debug
  fetched_at: string;           // ISO
}

// A route pinned to the device for offline guidance (nav-cache.ts).
export interface SavedNavRoute {
  id: string;          // crypto.randomUUID()
  label: string;       // "Wellingborough → The Bell, Leicester"
  route: NavRoute;
  saved_at: string;    // ISO
  tile_count: number;  // corridor tiles pinned alongside (0 = route only)
}

// Free-text geocode hit (Photon/Nominatim adapter in actions/nav.ts).
export interface GeocodeHit {
  name: string;
  detail: string;      // "street, city, country" context line
  lat: number;
  lng: number;
  kind: string;        // osm value: "station", "pub", "house" …
  distance_m?: number; // present when the search had a `near` anchor
}
