"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { rankByProximity } from "@/lib/geo";
import type { Result } from "@/lib/errors";
import type { TravelModePreference } from "@/lib/types/domain";

// Migration 0016 extended this enum with walk / taxi / no_preference
// and migrated legacy 'rail' / 'compare' / 'mixed' rows to
// 'no_preference'. Old values stay on the Postgres enum (can't be
// dropped cleanly) but the scoring engine treats anything outside
// the new four as 'no_preference'.
const preferenceEnum = z.enum([
  "walk",
  "drive",
  "taxi",
  "no_preference",
  // Legacy values kept so existing rows still validate on read.
  "rail",
  "compare",
  "mixed",
]);

const luggageEnum = z.enum(["none", "light", "heavy"]);

// Travel profile is 1:1 per (user, workspace) and provisioned by the auth
// trigger, so we only ever update it.
const updateTravelProfileSchema = z.object({
  default_drive_origin_location_id: z.string().uuid().nullable().optional(),
  default_rail_origin_location_id: z.string().uuid().nullable().optional(),
  default_return_location_id: z.string().uuid().nullable().optional(),
  // Transport-hub defaults (FKs to the global transport_hubs table —
  // 11k+ UK rail stations + airports). Letting users pick a default
  // station means the brief / editor can auto-stamp a
  // transit_departure stop when the leg is train / tube / flight,
  // without dragging them through the picker every trip.
  default_rail_origin_transport_hub_id: z.string().uuid().nullable().optional(),
  default_flight_origin_transport_hub_id: z.string().uuid().nullable().optional(),
  preferred_mode: preferenceEnum.optional(),
  default_arrival_buffer_minutes: z.number().int().min(0).max(180).optional(),
  default_return_buffer_minutes: z.number().int().min(0).max(180).optional(),
  mileage_rate: z.number().min(0).max(10).optional(),
  // Scoring engine inputs (migration 0016).
  walking_threshold_minutes: z.number().int().min(0).max(60).optional(),
  minimum_buffer_minutes: z.number().int().min(0).max(60).optional(),
  max_taxi_fare_pence: z.number().int().min(0).max(10000).optional(),
  luggage_default: luggageEnum.optional(),
});

export type TravelProfile = {
  id: string;
  user_id: string;
  workspace_id: string;
  default_drive_origin_location_id: string | null;
  default_rail_origin_location_id: string | null;
  default_return_location_id: string | null;
  default_rail_origin_transport_hub_id: string | null;
  default_flight_origin_transport_hub_id: string | null;
  preferred_mode: TravelModePreference;
  default_arrival_buffer_minutes: number;
  default_return_buffer_minutes: number;
  mileage_rate: number;
  walking_threshold_minutes: number;
  minimum_buffer_minutes: number;
  max_taxi_fare_pence: number;
  luggage_default: "none" | "light" | "heavy";
};

// Search the global transport_hubs catalogue for the settings UI's
// autocomplete. We match on name / code / city with a simple ILIKE
// and cap at 20 results — that's enough for the picker dropdown and
// keeps the round-trip snappy.
const searchHubsSchema = z.object({
  query: z.string().trim().max(80),
  kind: z.enum(["rail_station", "airport"]),
  // Optional anchor: when set, results are sorted by distance from this
  // point (nearest first) and each carries `distance_m`. Used by the
  // capture screen to surface the nearest station to the user's other stops.
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export type TransportHubHit = {
  id: string;
  kind: "rail_station" | "airport";
  code: string | null;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  // Present only when the search was given a `near` anchor.
  distance_m?: number;
};

const HUB_COLS = "id, kind, code, name, city, country, latitude, longitude";

export async function resolveHubByName(
  name: string,
): Promise<{ id: string; name: string; code: string | null } | null> {
  await requireUserContext();
  const supabase = await createClient();
  const cleaned = name.trim();
  if (!cleaned) return null;
  const { data } = await supabase
    .from("transport_hubs")
    .select("id, name, code")
    .ilike("name", cleaned)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function searchTransportHubs(
  input: z.input<typeof searchHubsSchema>,
): Promise<Result<TransportHubHit[]>> {
  const parsed = parseInput(searchHubsSchema, input);
  if (!parsed.ok) return parsed;

  // No context check needed — transport_hubs is a global reference
  // table (no workspace_id, no RLS gating). The user just needs to
  // be authenticated to hit the catalogue.
  await requireUserContext();
  const supabase = await createClient();

  const q = parsed.value.query;
  const near = parsed.value.near;

  // Empty query: with a `near` anchor, find the nearest hubs (Stage 4 —
  // "nearest station to your hotel"); otherwise a small alphabetical seed.
  if (q.length === 0) {
    if (near) {
      // Bounding box first (~0.7° ≈ 50 miles of latitude) so we sort a small
      // set in JS rather than the whole 11k+ catalogue.
      const box = 0.7;
      const { data } = await supabase
        .from("transport_hubs")
        .select(HUB_COLS)
        .eq("kind", parsed.value.kind)
        .gte("latitude", near.lat - box)
        .lte("latitude", near.lat + box)
        .gte("longitude", near.lng - box)
        .lte("longitude", near.lng + box)
        .limit(200);
      return { ok: true, value: rankByProximity((data ?? []) as TransportHubHit[], near).slice(0, 20) };
    }
    const { data } = await supabase
      .from("transport_hubs")
      .select(HUB_COLS)
      .eq("kind", parsed.value.kind)
      .order("name")
      .limit(20);
    return { ok: true, value: (data ?? []) as TransportHubHit[] };
  }

  const prefix = `${q.replace(/[%_\\]/g, "\\$&")}%`;
  // Code matches first — "WLB" resolves a station instantly.
  const { data: codeHits } = await supabase
    .from("transport_hubs")
    .select(HUB_COLS)
    .eq("kind", parsed.value.kind)
    .ilike("code", prefix)
    .order("name")
    .limit(5);
  // Prefix match on name — "Wel" finds "Wellingborough" before "Abbey Well".
  const { data: prefixHits } = await supabase
    .from("transport_hubs")
    .select(HUB_COLS)
    .eq("kind", parsed.value.kind)
    .ilike("name", prefix)
    .order("name")
    .limit(15);
  // Merge: code first, then prefix. Both are strong matches.
  const seen = new Set<string>();
  const merged: TransportHubHit[] = [];
  for (const h of [...(codeHits ?? []), ...(prefixHits ?? [])]) {
    if (!seen.has(h.id)) {
      seen.add(h.id);
      merged.push(h as TransportHubHit);
    }
  }
  // Substring fallback only when prefix found very little — avoids
  // "Abbey Well" outranking "Wellingborough" for "wel".
  if (merged.length < 3 && q.length >= 3) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const { data: subHits } = await supabase
      .from("transport_hubs")
      .select(HUB_COLS)
      .eq("kind", parsed.value.kind)
      .or(`name.ilike.${like},city.ilike.${like}`)
      .order("name")
      .limit(10);
    for (const h of subHits ?? []) {
      if (!seen.has(h.id)) {
        seen.add(h.id);
        merged.push(h as TransportHubHit);
      }
    }
  }
  // With a `near` anchor, re-sort the (already-filtered) matches by distance
  // so e.g. "Liverpool" surfaces the station closest to the user's other stops.
  const out = near ? rankByProximity(merged, near) : merged;
  return { ok: true, value: out.slice(0, 20) };
}

// Lookup a single hub by id — used by the settings page so it can
// render the current default's name even when the dropdown is
// closed.
export async function getTransportHub(
  id: string,
): Promise<Result<TransportHubHit | null>> {
  await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("transport_hubs")
    .select(HUB_COLS)
    .eq("id", id)
    .maybeSingle();
  return { ok: true, value: (data as TransportHubHit | null) ?? null };
}

export async function updateTravelProfile(
  input: z.input<typeof updateTravelProfileSchema>,
): Promise<Result<TravelProfile>> {
  const parsed = parseInput(updateTravelProfileSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("travel_profiles")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("travel_profiles")
    .update(parsed.value)
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<TravelProfile>(data, error, "travel_profile");
  if (result.ok) {
    await recordAudit({
      entityType: "travel_profile",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}
