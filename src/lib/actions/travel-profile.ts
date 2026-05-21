"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";
import type { TravelModePreference } from "@/lib/types/domain";

const preferenceEnum = z.enum(["rail", "drive", "compare", "mixed"]);

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
};

// Search the global transport_hubs catalogue for the settings UI's
// autocomplete. We match on name / code / city with a simple ILIKE
// and cap at 20 results — that's enough for the picker dropdown and
// keeps the round-trip snappy.
const searchHubsSchema = z.object({
  query: z.string().trim().max(80),
  kind: z.enum(["rail_station", "airport"]),
});

export type TransportHubHit = {
  id: string;
  kind: "rail_station" | "airport";
  code: string | null;
  name: string;
  city: string | null;
  country: string | null;
};

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
  // Empty query: return a small alphabetical seed so the picker can
  // show *something* before the user starts typing.
  if (q.length === 0) {
    const { data } = await supabase
      .from("transport_hubs")
      .select("id, kind, code, name, city, country")
      .eq("kind", parsed.value.kind)
      .order("name")
      .limit(20);
    return { ok: true, value: (data ?? []) as TransportHubHit[] };
  }

  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const { data } = await supabase
    .from("transport_hubs")
    .select("id, kind, code, name, city, country")
    .eq("kind", parsed.value.kind)
    .or(`name.ilike.${like},code.ilike.${like},city.ilike.${like}`)
    .order("name")
    .limit(20);
  return { ok: true, value: (data ?? []) as TransportHubHit[] };
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
    .select("id, kind, code, name, city, country")
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
