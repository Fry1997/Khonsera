"use server";

import { z } from "zod";
import { requireUserContext } from "@/lib/auth";
import { ok, err, errors, type Result } from "@/lib/errors";
import { buildValhallaRequest, mapValhallaTrip, type ValhallaTrip } from "@/lib/nav/valhalla";
import { rankByProximity } from "@/lib/geo";
import type { GeocodeHit, NavRoute } from "@/lib/nav/types";

// Point-to-point navigation actions. Fully open-source stack, every endpoint
// self-hostable by env var:
//   routing  — Valhalla (VALHALLA_URL, default the FOSSGIS community instance)
//   geocode  — Photon/komoot (PHOTON_URL), OSM data, typo-tolerant autocomplete
// Calls go server-side so the public instances see one origin (us), we can
// swap to self-hosted without a client release, and no client CORS variance.

const VALHALLA_URL = () => process.env.VALHALLA_URL ?? "https://valhalla1.openstreetmap.de";
const PHOTON_URL = () => process.env.PHOTON_URL ?? "https://photon.komoot.io";

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().trim().min(1).max(160),
});

const routeSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  mode: z.enum(["walk", "cycle", "drive"]),
});

export async function fetchNavRoute(
  input: z.input<typeof routeSchema>,
): Promise<Result<NavRoute>> {
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) return err(errors.validation("Invalid route request"));
  await requireUserContext();

  const { origin, destination, mode } = parsed.data;
  try {
    const res = await fetch(`${VALHALLA_URL()}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildValhallaRequest(origin, destination, mode)),
      // Routing answers are moment-in-time — never cache.
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return err(errors.integration("valhalla", `HTTP ${res.status} ${detail.slice(0, 200)}`));
    }
    const body = (await res.json()) as ValhallaTrip;
    const route = mapValhallaTrip(body, origin, destination, mode);
    if (!route) return err(errors.integration("valhalla", "No route in response"));
    return ok(route);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Routing request failed";
    return err(errors.integration("valhalla", msg));
  }
}

const geocodeSchema = z.object({
  query: z.string().trim().min(2).max(120),
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
};

// Free-text place search over OSM via Photon — covers the "anywhere" cases the
// curated pickers (transport hubs, saved places) don't: pubs, addresses,
// venues. `near` biases results and attaches distance_m for the suggest UI.
export async function geocodeSearch(
  input: z.input<typeof geocodeSchema>,
): Promise<Result<GeocodeHit[]>> {
  const parsed = geocodeSchema.safeParse(input);
  if (!parsed.success) return ok([]);
  await requireUserContext();

  const { query, near, limit } = parsed.data;
  const params = new URLSearchParams({ q: query, limit: String(limit ?? 6), lang: "en" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  try {
    const res = await fetch(`${PHOTON_URL()}/api?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return err(errors.integration("photon", `HTTP ${res.status}`));
    const body = (await res.json()) as { features?: PhotonFeature[] };

    const hits = (body.features ?? [])
      .map((f): (GeocodeHit & { latitude: number | null; longitude: number | null }) | null => {
        const coords = f.geometry?.coordinates;
        const p = f.properties ?? {};
        if (!coords || (!p.name && !p.street)) return null;
        const name = p.name ?? [p.housenumber, p.street].filter(Boolean).join(" ");
        const detail = [p.street && p.street !== name ? p.street : null, p.city, p.country]
          .filter(Boolean)
          .join(", ");
        return {
          name,
          detail,
          lat: coords[1],
          lng: coords[0],
          latitude: coords[1],
          longitude: coords[0],
          kind: p.osm_value ?? "place",
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null);

    const ranked = near ? rankByProximity(hits, near) : hits;
    return ok(ranked.map(({ latitude: _a, longitude: _b, ...h }) => h));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Geocode request failed";
    return err(errors.integration("photon", msg));
  }
}
