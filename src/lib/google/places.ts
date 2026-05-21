// Google Places API helpers — server-side only. The key never leaves the
// server; the browser calls /api/maps/places/autocomplete + /api/maps/places/details
// which proxy through these functions.
//
// Uses the legacy Places API (free tier covers it; modern Places API New
// returns the same fields with a different shape — easy to swap later).

import { mapsApiKey } from "./maps";

const AUTOCOMPLETE_ENDPOINT =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const DETAILS_ENDPOINT =
  "https://maps.googleapis.com/maps/api/place/details/json";

export type PlaceAutocompleteSuggestion = {
  place_id: string;
  description: string;
  primary: string; // main_text (e.g. "King's Cross Station")
  secondary: string; // secondary_text (e.g. "London, UK")
  types: string[]; // Google place types (e.g. ["train_station","point_of_interest"])
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  types: string[];
  postcode: string | null;
};

export async function autocompletePlaces(args: {
  query: string;
  sessionToken?: string;
  // Bias toward a country (ISO 3166-1 alpha-2). UK default for now since
  // every customer lives in GB. Pass null to disable.
  country?: string | null;
  // Optional bias to a place type ("train_station", "airport", "lodging",
  // "establishment", "geocode", "address"). Falls back to no restriction.
  types?: string | null;
}): Promise<PlaceAutocompleteSuggestion[]> {
  const key = mapsApiKey();
  if (!key || !args.query?.trim()) return [];

  const url = new URL(AUTOCOMPLETE_ENDPOINT);
  url.searchParams.set("input", args.query);
  url.searchParams.set("key", key);
  if (args.sessionToken) url.searchParams.set("sessiontoken", args.sessionToken);
  if (args.country !== null) {
    url.searchParams.set("components", `country:${args.country ?? "gb"}`);
  }
  if (args.types) url.searchParams.set("types", args.types);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      predictions?: Array<{
        place_id: string;
        description: string;
        structured_formatting?: {
          main_text: string;
          secondary_text?: string;
        };
        types?: string[];
      }>;
    };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn(
        "Places autocomplete failed:",
        data.status,
        data.error_message ?? "(no error_message)",
        "query:",
        args.query,
      );
      return [];
    }
    return (data.predictions ?? []).map((p) => ({
      place_id: p.place_id,
      description: p.description,
      primary: p.structured_formatting?.main_text ?? p.description,
      secondary: p.structured_formatting?.secondary_text ?? "",
      types: p.types ?? [],
    }));
  } catch (e) {
    console.error("autocompletePlaces failed", e);
    return [];
  }
}

export async function getPlaceDetails(args: {
  placeId: string;
  sessionToken?: string;
}): Promise<PlaceDetails | null> {
  const key = mapsApiKey();
  if (!key || !args.placeId) return null;

  const url = new URL(DETAILS_ENDPOINT);
  url.searchParams.set("place_id", args.placeId);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,geometry/location,types,address_components",
  );
  url.searchParams.set("key", key);
  if (args.sessionToken) url.searchParams.set("sessiontoken", args.sessionToken);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      result?: {
        place_id: string;
        name: string;
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        types?: string[];
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      };
    };
    if (data.status !== "OK" || !data.result) return null;
    const r = data.result;
    const postcode =
      r.address_components?.find((c) => c.types.includes("postal_code"))
        ?.long_name ?? null;
    return {
      place_id: r.place_id,
      name: r.name,
      formatted_address: r.formatted_address,
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
      types: r.types ?? [],
      postcode,
    };
  } catch (e) {
    console.error("getPlaceDetails failed", e);
    return null;
  }
}

// Map a Google place type to our LocationType. Best-effort — falls back to
// "other" for things that don't match a cleanly defined slot.
export function locationTypeFromGoogleTypes(types: string[]): import("@/lib/types/domain").LocationType {
  if (types.includes("train_station") || types.includes("subway_station") || types.includes("transit_station")) {
    return "station";
  }
  if (types.includes("airport")) return "station";
  if (types.includes("lodging")) return "hotel";
  if (types.includes("parking")) return "parking";
  return "other";
}
