// Google Places API helpers — server-side only. The key never leaves the
// server; the browser calls /api/maps/places/autocomplete + /api/maps/places/details
// which proxy through these functions.
//
// Uses Places API (New) — the legacy /maps/api/place/* endpoints are no
// longer enabled on new GCP projects. The public types (PlaceAutocomplete
// Suggestion / PlaceDetails) are unchanged so callers stay the same.

import { mapsApiKey } from "./maps";

const AUTOCOMPLETE_ENDPOINT =
  "https://places.googleapis.com/v1/places:autocomplete";
// Place details (New) is a GET on /v1/places/{PLACE_ID}. Built per-request.

export type PlaceAutocompleteSuggestion = {
  place_id: string;
  description: string;
  primary: string; // structuredFormat.mainText (e.g. "King's Cross Station")
  secondary: string; // structuredFormat.secondaryText (e.g. "London, UK")
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

export type PlaceAutocompleteResult = {
  suggestions: PlaceAutocompleteSuggestion[];
  // Only set when Google returned an error, so the API route can surface
  // the reason for debugging.
  failure?: { status: string; error_message?: string };
};

// Map our legacy "types" hints to Places API (New) `includedPrimaryTypes`.
// "establishment" / "geocode" / "address" have no direct primary-type
// equivalent — omit them (the new API ranks businesses well by default).
function toIncludedPrimaryTypes(legacy: string | null | undefined): string[] | null {
  if (!legacy) return null;
  const known = new Set([
    "train_station",
    "subway_station",
    "transit_station",
    "airport",
    "lodging",
    "restaurant",
    "cafe",
    "bar",
    "parking",
    "tourist_attraction",
  ]);
  return known.has(legacy) ? [legacy] : null;
}

export async function autocompletePlaces(args: {
  query: string;
  sessionToken?: string;
  // Bias toward a country (ISO 3166-1 alpha-2). UK default for now since
  // every customer lives in GB. Pass null to disable.
  country?: string | null;
  // Optional bias to a place type ("train_station", "airport", "lodging", …).
  types?: string | null;
}): Promise<PlaceAutocompleteResult> {
  const key = mapsApiKey();
  if (!key || !args.query?.trim()) return { suggestions: [] };

  const includedPrimaryTypes = toIncludedPrimaryTypes(args.types);
  const countryCode =
    args.country === null ? null : (args.country ?? "gb").toUpperCase();

  const body: Record<string, unknown> = { input: args.query };
  if (args.sessionToken) body.sessionToken = args.sessionToken;
  if (countryCode) body.includedRegionCodes = [countryCode];
  if (includedPrimaryTypes) body.includedPrimaryTypes = includedPrimaryTypes;

  try {
    const res = await fetch(AUTOCOMPLETE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      const err = raw as { error?: { status?: string; message?: string } } | null;
      const status = err?.error?.status ?? `HTTP_${res.status}`;
      const error_message = err?.error?.message;
      console.warn(
        "Places autocomplete failed:",
        status,
        error_message ?? "(no message)",
        "query:",
        args.query,
      );
      return { suggestions: [], failure: { status, error_message } };
    }
    const data = raw as {
      suggestions?: Array<{
        placePrediction?: {
          place?: string;
          placeId: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          types?: string[];
        };
      }>;
    } | null;
    const suggestions = (data?.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => ({
        place_id: p.placeId,
        description: p.text?.text ?? p.structuredFormat?.mainText?.text ?? "",
        primary:
          p.structuredFormat?.mainText?.text ??
          p.text?.text ??
          "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
        types: p.types ?? [],
      }));
    return { suggestions };
  } catch (e) {
    console.error("autocompletePlaces failed", e);
    return {
      suggestions: [],
      failure: { status: "FETCH_THREW", error_message: String(e) },
    };
  }
}

// One-shot free-text place search WITH coordinates inline — Places API (New)
// Text Search. Unlike autocomplete (which needs a details round-trip per result),
// this returns name + address + location in a single call, so it's fast and
// complete: the replacement for the slow public Photon/komoot geocoder on nav.
export type TextPlace = { name: string; address: string; latitude: number; longitude: number; types: string[] };

export async function textSearchPlaces(args: {
  query: string;
  near?: { lat: number; lng: number } | null;
  country?: string | null;
  limit?: number;
}): Promise<TextPlace[]> {
  const key = mapsApiKey();
  if (!key || !args.query?.trim()) return [];

  const body: Record<string, unknown> = {
    textQuery: args.query,
    languageCode: "en",
    maxResultCount: Math.min(20, args.limit ?? 8),
    regionCode: args.country === null ? undefined : (args.country ?? "GB"),
  };
  // Bias toward the user's anchor (e.g. their current location) so "the Bell"
  // ranks the nearby one first — 50km circle is a sensible region bias.
  if (args.near) {
    body.locationBias = { circle: { center: { latitude: args.near.lat, longitude: args.near.lng }, radius: 50_000 } };
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const e = await res.json().catch(() => null);
      console.warn("Text search failed:", e?.error?.status ?? `HTTP_${res.status}`, e?.error?.message ?? "");
      return [];
    }
    const data = (await res.json()) as {
      places?: Array<{ displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; types?: string[] }>;
    };
    return (data.places ?? [])
      .filter((p) => p.location && p.displayName?.text)
      .map((p) => ({
        name: p.displayName!.text!,
        address: p.formattedAddress ?? "",
        latitude: p.location!.latitude,
        longitude: p.location!.longitude,
        types: p.types ?? [],
      }));
  } catch (e) {
    console.error("textSearchPlaces failed", e);
    return [];
  }
}

export async function getPlaceDetails(args: {
  placeId: string;
  sessionToken?: string;
}): Promise<PlaceDetails | null> {
  const key = mapsApiKey();
  if (!key || !args.placeId) return null;

  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(args.placeId)}`,
  );
  if (args.sessionToken) url.searchParams.set("sessionToken", args.sessionToken);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,types,addressComponents",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.warn(
        "Place details failed:",
        err?.error?.status ?? `HTTP_${res.status}`,
        err?.error?.message ?? "(no message)",
        "placeId:",
        args.placeId,
      );
      return null;
    }
    const data = (await res.json()) as {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      types?: string[];
      addressComponents?: Array<{
        longText: string;
        shortText: string;
        types: string[];
      }>;
    };
    if (!data?.id || !data.location) return null;
    const postcode =
      data.addressComponents?.find((c) => c.types.includes("postal_code"))
        ?.longText ?? null;
    return {
      place_id: data.id,
      name: data.displayName?.text ?? "",
      formatted_address: data.formattedAddress ?? "",
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      types: data.types ?? [],
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
