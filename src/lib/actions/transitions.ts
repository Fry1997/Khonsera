"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { routeForTransition, type TransitionRoute } from "@/lib/integrations/routing";
import { resolveItineraryTimes } from "./itineraries";
import { dbResult, parseInput } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";
import type { TransitionMode } from "@/lib/types/domain";

const modeEnum = z.enum([
  "walk",
  "drive",
  "taxi",
  "bus",
  "tube",
  "train",
  "flight",
  "mixed",
]);

const upsertSchema = z.object({
  itinerary_id: z.string().uuid(),
  from_stop_id: z.string().uuid(),
  to_stop_id: z.string().uuid(),
  mode: modeEnum.optional(),
  is_locked: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const setModeSchema = z.object({
  id: z.string().uuid(),
  mode: modeEnum,
  is_locked: z.boolean().optional(),
});

export type Transition = {
  id: string;
  itinerary_id: string;
  workspace_id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: TransitionMode;
  start_time: string | null;
  end_time: string | null;
  computed_duration_minutes: number | null;
  distance_miles: number | null;
  overview_polyline: string | null;
  notes: string | null;
  is_locked: boolean;
};

// Upsert a transition between two stops, computing its mode/duration from the
// integration layer if possible. Idempotent on (from_stop_id, to_stop_id).
export async function upsertTransition(
  input: z.input<typeof upsertSchema>,
): Promise<Result<Transition>> {
  const parsed = parseInput(upsertSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Pull both stops to verify workspace ownership and get coordinates for
  // routing.
  const { data: stops } = await supabase
    .from("stops")
    .select(
      `id, start_time, end_time, location_id,
       customer_site_id,
       location:locations(latitude, longitude, name, address),
       customer_site:customer_sites(latitude, longitude, name, address)`,
    )
    .in("id", [parsed.value.from_stop_id, parsed.value.to_stop_id])
    .eq("workspace_id", ctx.workspaceId);
  if (!stops || stops.length !== 2) return err(errors.notFound("stop"));

  const fromStop =
    stops.find((s) => s.id === parsed.value.from_stop_id) ?? stops[0];
  const toStop =
    stops.find((s) => s.id === parsed.value.to_stop_id) ?? stops[1];

  const fromPoint = pickPoint(fromStop);
  const toPoint = pickPoint(toStop);

  const mode = parsed.value.mode ?? ("drive" as TransitionMode);
  let route: TransitionRoute | null = null;
  if (fromPoint && toPoint) {
    route = await routeForTransition({
      mode,
      origin: fromPoint,
      destination: toPoint,
    });
  }
  const computedDurationMinutes = route?.totalDurationMinutes ?? null;
  const distanceMiles = route?.totalDistanceMiles ?? null;
  const overviewPolyline = route?.overviewPolyline ?? null;

  const start = fromStop.end_time ?? fromStop.start_time;
  const end =
    start && computedDurationMinutes
      ? new Date(
          new Date(start as string).getTime() +
            computedDurationMinutes * 60_000,
        ).toISOString()
      : (toStop.start_time ?? null);

  const payload = {
    itinerary_id: parsed.value.itinerary_id,
    workspace_id: ctx.workspaceId,
    from_stop_id: parsed.value.from_stop_id,
    to_stop_id: parsed.value.to_stop_id,
    mode,
    is_locked: parsed.value.is_locked ?? false,
    notes: parsed.value.notes ?? null,
    start_time: start,
    end_time: end,
    computed_duration_minutes: computedDurationMinutes,
    distance_miles: distanceMiles,
    overview_polyline: overviewPolyline,
  };

  const { data, error } = await supabase
    .from("transitions")
    .upsert(payload, { onConflict: "from_stop_id,to_stop_id" })
    .select("*")
    .single();

  const result = dbResult<Transition>(data, error, "transition");
  if (result.ok) {
    await writeJourneyLegs(result.value.id, ctx.workspaceId, route);
    await recordAudit({
      entityType: "transition",
      entityId: result.value.id,
      action: "upsert",
      after: result.value,
    });
    await resolveItineraryTimes(result.value.itinerary_id);
  }
  return result;
}

// Replace the journey_legs rows attached to a transition with the breakdown
// from the latest route. No-op if routing returned nothing.
async function writeJourneyLegs(
  transitionId: string,
  workspaceId: string,
  route: TransitionRoute | null,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("journey_legs")
    .delete()
    .eq("transition_id", transitionId)
    .eq("workspace_id", workspaceId);
  if (!route || route.steps.length === 0) return;
  const rows = route.steps.map((s) => ({
    transition_id: transitionId,
    workspace_id: workspaceId,
    sequence: s.sequence,
    leg_type: s.legType,
    start_location_name: s.startName || null,
    end_location_name: s.endName || null,
    start_time: s.startTime ?? null,
    end_time: s.endTime ?? null,
    duration_minutes: s.durationMinutes,
    distance_miles: s.distanceMiles ?? null,
    service_number: s.serviceNumber ?? null,
    instructions: s.instructions ?? null,
  }));
  await supabase.from("journey_legs").insert(rows);
}

export async function setTransitionMode(
  input: z.input<typeof setModeSchema>,
): Promise<Result<Transition>> {
  const parsed = parseInput(setModeSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Read the existing transition + adjacent stops so we can re-route under
  // the new mode and rewrite journey_legs in the same call.
  const { data: existing } = await supabase
    .from("transitions")
    .select(
      `id, itinerary_id, from_stop_id, to_stop_id,
       from_stop:from_stop_id (
         id, start_time, end_time,
         location:locations(latitude, longitude),
         customer_site:customer_sites(latitude, longitude)
       ),
       to_stop:to_stop_id (
         id, start_time,
         location:locations(latitude, longitude),
         customer_site:customer_sites(latitude, longitude)
       )`,
    )
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return dbResult<Transition>(null, null, "transition");

  const fromPoint = pickPoint(existing.from_stop);
  const toPoint = pickPoint(existing.to_stop);
  let route: TransitionRoute | null = null;
  if (fromPoint && toPoint) {
    route = await routeForTransition({
      mode: parsed.value.mode,
      origin: fromPoint,
      destination: toPoint,
    });
  }
  const fromStop = first(existing.from_stop) as
    | { end_time?: string | null; start_time?: string | null }
    | null;
  const toStop = first(existing.to_stop) as
    | { start_time?: string | null }
    | null;
  const start = fromStop?.end_time ?? fromStop?.start_time ?? null;
  const end =
    start && route?.totalDurationMinutes
      ? new Date(
          new Date(start).getTime() + route.totalDurationMinutes * 60_000,
        ).toISOString()
      : (toStop?.start_time ?? null);

  const { data, error } = await supabase
    .from("transitions")
    .update({
      mode: parsed.value.mode,
      is_locked: parsed.value.is_locked ?? false,
      computed_duration_minutes: route?.totalDurationMinutes ?? null,
      distance_miles: route?.totalDistanceMiles ?? null,
      overview_polyline: route?.overviewPolyline ?? null,
      start_time: start,
      end_time: end,
    })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<Transition>(data, error, "transition");
  if (result.ok) {
    await writeJourneyLegs(result.value.id, ctx.workspaceId, route);
    await resolveItineraryTimes(result.value.itinerary_id);
  }
  return result;
}

export async function deleteTransition(
  id: string,
): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("transitions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return dbResult<{ id: string }>(null, error, "transition");
  return ok({ id });
}

// Supabase returns related rows as either an object or an array depending on
// the FK shape. `first` normalises both into a single record.
function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

// previewRoute — lightweight read-only sibling of upsertTransition.
// Given two stop ids and a mode, return the routing provider's
// duration + distance estimate without writing anything back. The
// editor's mode-picker uses it to surface per-mode hints (12m walk /
// 4m drive); the brief uses it to colour feasibility flags.
//
// Returns nulls when the routing provider isn't configured or when
// either stop is missing coordinates — callers treat that as "no
// estimate yet" and stay silent.
const previewSchema = z.object({
  from_stop_id: z.string().uuid(),
  to_stop_id: z.string().uuid(),
  mode: modeEnum,
});

export async function previewRoute(
  input: z.input<typeof previewSchema>,
): Promise<
  Result<{ durationMinutes: number | null; distanceMiles: number | null }>
> {
  const parsed = parseInput(previewSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: stops } = await supabase
    .from("stops")
    .select(
      `id, location_id, customer_site_id,
       location:locations(latitude, longitude),
       customer_site:customer_sites(latitude, longitude)`,
    )
    .in("id", [parsed.value.from_stop_id, parsed.value.to_stop_id])
    .eq("workspace_id", ctx.workspaceId);
  if (!stops || stops.length !== 2) return err(errors.notFound("stop"));

  const fromStop =
    stops.find((s) => s.id === parsed.value.from_stop_id) ?? stops[0];
  const toStop =
    stops.find((s) => s.id === parsed.value.to_stop_id) ?? stops[1];

  const fromPoint = pickPoint(fromStop);
  const toPoint = pickPoint(toStop);
  if (!fromPoint || !toPoint) {
    return ok({ durationMinutes: null, distanceMiles: null });
  }

  const route = await routeForTransition({
    mode: parsed.value.mode,
    origin: fromPoint,
    destination: toPoint,
  });
  return ok({
    durationMinutes: route?.totalDurationMinutes ?? null,
    distanceMiles: route?.totalDistanceMiles ?? null,
  });
}

function pickPoint(stop: unknown): { lat: number; lng: number } | null {
  const s = first(stop) as
    | { location?: unknown; customer_site?: unknown }
    | null;
  if (!s) return null;
  const cs = first(s.customer_site) as
    | { latitude?: number | null; longitude?: number | null }
    | null;
  const loc = first(s.location) as
    | { latitude?: number | null; longitude?: number | null }
    | null;
  if (cs?.latitude != null && cs?.longitude != null)
    return { lat: cs.latitude, lng: cs.longitude };
  if (loc?.latitude != null && loc?.longitude != null)
    return { lat: loc.latitude, lng: loc.longitude };
  return null;
}
