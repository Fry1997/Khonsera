"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { routeForTransition, type TransitionRoute } from "@/lib/integrations/routing";
import { getRailPolyline } from "@/lib/osm/rail-routes";
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
       customer_site_id, transport_hub_id,
       location:locations(latitude, longitude, name, address),
       customer_site:customer_sites(latitude, longitude, name, address),
       transport_hub:transport_hubs(latitude, longitude, name)`,
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
         customer_site:customer_sites(latitude, longitude),
         transport_hub:transport_hubs(latitude, longitude)
       ),
       to_stop:to_stop_id (
         id, start_time,
         location:locations(latitude, longitude),
         customer_site:customer_sites(latitude, longitude),
         transport_hub:transport_hubs(latitude, longitude)
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

  // Cache check first. Migration 0017's route_preview_cache stores
  // (from_stop_id, to_stop_id, mode) -> duration + distance. Routes
  // API charges per request and the underlying coords are stable,
  // so we serve from cache when fresh. Stale rows (> 7 days) fall
  // through and re-fetch.
  const { data: cached } = await supabase
    .from("route_preview_cache")
    .select("duration_minutes, distance_miles, computed_at")
    .eq("from_stop_id", parsed.value.from_stop_id)
    .eq("to_stop_id", parsed.value.to_stop_id)
    .eq("mode", parsed.value.mode)
    .maybeSingle();
  if (cached) {
    const ageMs =
      Date.now() - new Date(cached.computed_at as string).getTime();
    const fresh = ageMs < 7 * 24 * 60 * 60_000;
    if (fresh) {
      return ok({
        durationMinutes: (cached.duration_minutes as number | null) ?? null,
        distanceMiles: (cached.distance_miles as number | null) ?? null,
      });
    }
  }

  const { data: stops } = await supabase
    .from("stops")
    .select(
      `id, location_id, customer_site_id,
       location:locations(latitude, longitude),
       customer_site:customer_sites(latitude, longitude),
       transport_hub:transport_hubs(latitude, longitude)`,
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
  const durationMinutes = route?.totalDurationMinutes ?? null;
  const distanceMiles = route?.totalDistanceMiles ?? null;

  // Write-through cache. Best-effort: a write failure doesn't fail
  // the user's preview, but does mean the next load will recompute.
  void supabase
    .from("route_preview_cache")
    .upsert(
      {
        from_stop_id: parsed.value.from_stop_id,
        to_stop_id: parsed.value.to_stop_id,
        mode: parsed.value.mode,
        duration_minutes: durationMinutes,
        distance_miles: distanceMiles,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "from_stop_id,to_stop_id,mode" },
    )
    .then(() => undefined);

  return ok({
    durationMinutes,
    distanceMiles,
  });
}

// previewRouteForPlaces — sibling of previewRoute that takes raw
// place references (location_id or customer_site_id) rather than
// stop_ids. The brief uses this: it has no stops yet (they're
// created on submit), only PlaceSelection values from the picker.
//
// Coordinates are resolved straight from the locations /
// customer_sites tables in the user's workspace.
const previewByPlaceSchema = z.object({
  from_location_id: z.string().uuid().nullable().optional(),
  from_customer_site_id: z.string().uuid().nullable().optional(),
  from_transport_hub_id: z.string().uuid().nullable().optional(),
  to_location_id: z.string().uuid().nullable().optional(),
  to_customer_site_id: z.string().uuid().nullable().optional(),
  to_transport_hub_id: z.string().uuid().nullable().optional(),
  mode: modeEnum,
});

export async function previewRouteForPlaces(
  input: z.input<typeof previewByPlaceSchema>,
): Promise<
  Result<{ durationMinutes: number | null; distanceMiles: number | null }>
> {
  const parsed = parseInput(previewByPlaceSchema, input);
  if (!parsed.ok) return parsed;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const lookup = async (
    locationId: string | null | undefined,
    customerSiteId: string | null | undefined,
    hubId?: string | null | undefined,
  ): Promise<{ lat: number; lng: number } | null> => {
    if (locationId) {
      const { data } = await supabase
        .from("locations")
        .select("latitude, longitude")
        .eq("id", locationId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (data?.latitude != null && data?.longitude != null) {
        return { lat: data.latitude, lng: data.longitude };
      }
    }
    if (customerSiteId) {
      const { data } = await supabase
        .from("customer_sites")
        .select("latitude, longitude")
        .eq("id", customerSiteId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (data?.latitude != null && data?.longitude != null) {
        return { lat: data.latitude, lng: data.longitude };
      }
    }
    if (hubId) {
      const { data } = await supabase
        .from("transport_hubs")
        .select("latitude, longitude")
        .eq("id", hubId)
        .maybeSingle();
      if (data?.latitude != null && data?.longitude != null) {
        return { lat: Number(data.latitude), lng: Number(data.longitude) };
      }
    }
    return null;
  };

  const fromPoint = await lookup(
    parsed.value.from_location_id,
    parsed.value.from_customer_site_id,
    parsed.value.from_transport_hub_id,
  );
  const toPoint = await lookup(
    parsed.value.to_location_id,
    parsed.value.to_customer_site_id,
    parsed.value.to_transport_hub_id,
  );
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

// insertTransitLeg — inserts a transit_departure + transit_arrival
// stop pair + a single train/flight transition between them, at the
// position immediately before `after_stop_id`. The two stops bump
// every later stop's sequence by +2 to open a slot.
//
// Doesn't touch the surrounding 'last-mile' legs (before_anchor →
// departure station, arrival station → after_anchor) — the user
// picks those modes via the existing 3-pill picker once the leg
// is inserted.
const insertTransitLegSchema = z.object({
  itinerary_id: z.string().uuid(),
  before_stop_id: z.string().uuid(),
  // Null = append at the end of the itinerary. Used when the user
  // wants to add a train/flight after their last anchor (e.g. flight
  // home from a trip).
  after_stop_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["train", "flight", "bus", "tube", "taxi", "drive"]),
  depart_hub_id: z.string().uuid(),
  depart_label: z.string().trim().max(200),
  depart_time: z.string().datetime(),
  arrive_hub_id: z.string().uuid(),
  arrive_label: z.string().trim().max(200),
  arrive_time: z.string().datetime(),
  service_number: z.string().trim().max(80).nullable().optional(),
});

export async function insertTransitLeg(
  input: z.input<typeof insertTransitLegSchema>,
): Promise<Result<{ depart_stop_id: string; arrive_stop_id: string }>> {
  const parsed = parseInput(insertTransitLegSchema, input);
  if (!parsed.ok) return parsed;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Resolve insertion slot. When after_stop_id is provided we slot
  // immediately before it (bumping its sequence and everything later
  // by +2). When it's null we append at the end (max sequence + 1,
  // no shift needed).
  let targetSeq: number;
  let needsShift = false;
  if (parsed.value.after_stop_id) {
    const { data: afterStop } = await supabase
      .from("stops")
      .select("sequence")
      .eq("id", parsed.value.after_stop_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!afterStop) return err(errors.notFound("stop"));
    targetSeq = afterStop.sequence as number;
    needsShift = true;
  } else {
    const { data: maxRow } = await supabase
      .from("stops")
      .select("sequence")
      .eq("itinerary_id", parsed.value.itinerary_id)
      .eq("workspace_id", ctx.workspaceId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetSeq = ((maxRow?.sequence as number | undefined) ?? -1) + 1;
  }

  if (needsShift) {
    const { data: shiftRows } = await supabase
      .from("stops")
      .select("id, sequence")
      .eq("itinerary_id", parsed.value.itinerary_id)
      .eq("workspace_id", ctx.workspaceId)
      .gte("sequence", targetSeq)
      .order("sequence", { ascending: false });
    for (const r of shiftRows ?? []) {
      await supabase
        .from("stops")
        .update({ sequence: (r.sequence as number) + 2 })
        .eq("id", r.id as string)
        .eq("workspace_id", ctx.workspaceId);
    }
  }

  // Insert the two transit stops.
  const { data: departStop, error: dErr } = await supabase
    .from("stops")
    .insert({
      itinerary_id: parsed.value.itinerary_id,
      workspace_id: ctx.workspaceId,
      sequence: targetSeq,
      type: "transit_departure",
      title: parsed.value.depart_label,
      transport_hub_id: parsed.value.depart_hub_id,
      start_time: parsed.value.depart_time,
      is_time_fixed: true,
      metadata: { kind: parsed.value.mode === "train" ? "station" : "airport" },
    })
    .select("id")
    .single();
  if (dErr || !departStop) return err(errors.notFound("stop"));

  const { data: arriveStop, error: aErr } = await supabase
    .from("stops")
    .insert({
      itinerary_id: parsed.value.itinerary_id,
      workspace_id: ctx.workspaceId,
      sequence: targetSeq + 1,
      type: "transit_arrival",
      title: parsed.value.arrive_label,
      transport_hub_id: parsed.value.arrive_hub_id,
      start_time: parsed.value.arrive_time,
      is_time_fixed: true,
      metadata: { kind: parsed.value.mode === "train" ? "station" : "airport" },
    })
    .select("id")
    .single();
  if (aErr || !arriveStop) return err(errors.notFound("stop"));

  // Insert the locked transition between the two transit stops.
  const durationMins = Math.max(
    1,
    Math.round(
      (new Date(parsed.value.arrive_time).getTime() -
        new Date(parsed.value.depart_time).getTime()) /
        60_000,
    ),
  );
  await supabase.from("transitions").insert({
    itinerary_id: parsed.value.itinerary_id,
    workspace_id: ctx.workspaceId,
    from_stop_id: departStop.id,
    to_stop_id: arriveStop.id,
    mode: parsed.value.mode,
    is_locked: true,
    start_time: parsed.value.depart_time,
    end_time: parsed.value.arrive_time,
    computed_duration_minutes: durationMins,
    notes: parsed.value.service_number
      ? `khonsera:service=${parsed.value.service_number}`
      : null,
  });

  // The pre-existing transition from before_stop → after_stop is
  // now spurious (the route goes through the stations). Drop it so
  // the editor doesn't draw a phantom direct leg through the
  // station chain. Only meaningful when there's a real
  // after_stop_id (append-at-end mode has no pre-existing leg).
  if (parsed.value.after_stop_id) {
    await supabase
      .from("transitions")
      .delete()
      .eq("itinerary_id", parsed.value.itinerary_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("from_stop_id", parsed.value.before_stop_id)
      .eq("to_stop_id", parsed.value.after_stop_id);
  }

  await resolveItineraryTimes(parsed.value.itinerary_id);

  return ok({
    depart_stop_id: departStop.id as string,
    arrive_stop_id: arriveStop.id as string,
  });
}

function pickPoint(stop: unknown): { lat: number; lng: number } | null {
  const s = first(stop) as
    | { location?: unknown; customer_site?: unknown; transport_hub?: unknown }
    | null;
  if (!s) return null;
  const cs = first(s.customer_site) as
    | { latitude?: number | null; longitude?: number | null }
    | null;
  const loc = first(s.location) as
    | { latitude?: number | null; longitude?: number | null }
    | null;
  const hub = first(s.transport_hub) as
    | { latitude?: number | null; longitude?: number | null }
    | null;
  if (cs?.latitude != null && cs?.longitude != null)
    return { lat: cs.latitude, lng: cs.longitude };
  if (loc?.latitude != null && loc?.longitude != null)
    return { lat: loc.latitude, lng: loc.longitude };
  if (hub?.latitude != null && hub?.longitude != null)
    return { lat: hub.latitude, lng: hub.longitude };
  return null;
}

export async function backfillRailPolylines(
  itineraryId: string,
): Promise<{ filled: number }> {
  await requireUserContext();
  const supabase = await createClient();

  // Find locked transit transitions without polylines
  const { data: missing } = await supabase
    .from("transitions")
    .select("id, mode, from_stop_id, to_stop_id")
    .eq("itinerary_id", itineraryId)
    .eq("is_locked", true)
    .is("overview_polyline", null);

  console.log("[rail-routes] backfill: found", missing?.length ?? 0, "transitions missing polylines");
  if (!missing || missing.length === 0) return { filled: 0 };

  let filled = 0;
  for (const t of missing) {
    const { data: stops, error: stopsErr } = await supabase
      .from("stops")
      .select("id, transport_hub_id, transport_hub:transport_hubs(latitude, longitude, code)")
      .in("id", [t.from_stop_id, t.to_stop_id]);

    if (stopsErr) {
      console.error("[rail-routes] stops query error:", stopsErr.message);
      continue;
    }
    if (!stops || stops.length < 2) {
      console.log("[rail-routes] skipping transition", t.id, "- only", stops?.length ?? 0, "stops found");
      continue;
    }
    const fromStop = stops.find((s) => s.id === t.from_stop_id);
    const toStop = stops.find((s) => s.id === t.to_stop_id);
    const fh = first(fromStop?.transport_hub) as
      | { latitude?: number | null; longitude?: number | null; code?: string | null }
      | null;
    const th = first(toStop?.transport_hub) as
      | { latitude?: number | null; longitude?: number | null; code?: string | null }
      | null;
    console.log("[rail-routes] from hub:", fh, "to hub:", th);
    if (!fh?.latitude || !fh?.longitude || !th?.latitude || !th?.longitude) {
      console.log("[rail-routes] skipping - missing coordinates");
      continue;
    }

    try {
      const poly = await getRailPolyline(
        Number(fh.latitude), Number(fh.longitude),
        Number(th.latitude), Number(th.longitude),
        (fh.code as string) ?? null, (th.code as string) ?? null,
      );
      console.log("[rail-routes] polyline result for", t.id, ":", poly ? `${poly.length} chars` : "null");
      if (poly) {
        await supabase
          .from("transitions")
          .update({ overview_polyline: poly })
          .eq("id", t.id);
        filled++;
      }
    } catch (err) {
      console.error("[rail-routes] error for transition", t.id, ":", err);
    }
  }
  console.log("[rail-routes] backfill complete:", filled, "filled");
  return { filled };
}

const storePolylineSchema = z.object({
  transitionId: z.string().uuid(),
  polyline: z.string().min(1).max(100_000),
  fromCode: z.string().max(10).optional(),
  toCode: z.string().max(10).optional(),
  pointCount: z.number().int().min(2).optional(),
});

export async function storeRailPolyline(
  input: z.infer<typeof storePolylineSchema>,
): Promise<{ ok: boolean }> {
  const ctx = await requireUserContext();
  const parsed = storePolylineSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("transitions")
    .update({ overview_polyline: parsed.polyline })
    .eq("id", parsed.transitionId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return { ok: false };

  if (parsed.fromCode && parsed.toCode) {
    await supabase.from("rail_route_cache").upsert(
      {
        from_station_code: parsed.fromCode,
        to_station_code: parsed.toCode,
        encoded_polyline: parsed.polyline,
        point_count: parsed.pointCount ?? 0,
      },
      { onConflict: "from_station_code,to_station_code" },
    );
  }

  return { ok: true };
}
