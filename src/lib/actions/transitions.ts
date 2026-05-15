"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { getRoute } from "@/lib/integrations/routing";
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

  let computedDurationMinutes: number | null = null;
  let distanceMiles: number | null = null;
  let overviewPolyline: string | null = null;

  if (
    parsed.value.mode === "drive" ||
    (parsed.value.mode === undefined && fromPoint && toPoint)
  ) {
    if (fromPoint && toPoint) {
      const route = await getRoute({
        origin: fromPoint,
        destination: toPoint,
        mode: "drive",
      });
      if (route.mode !== "unavailable") {
        computedDurationMinutes = route.data.totalDurationMinutes;
        distanceMiles = route.data.totalDistanceMiles ?? null;
        overviewPolyline =
          (route.data as { overviewPolyline?: string }).overviewPolyline ?? null;
      }
    }
  }

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
    mode: parsed.value.mode ?? ("drive" as TransitionMode),
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
    await recordAudit({
      entityType: "transition",
      entityId: result.value.id,
      action: "upsert",
      after: result.value,
    });
  }
  return result;
}

export async function setTransitionMode(
  input: z.input<typeof setModeSchema>,
): Promise<Result<Transition>> {
  const parsed = parseInput(setModeSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transitions")
    .update({
      mode: parsed.value.mode,
      is_locked: parsed.value.is_locked ?? true,
    })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  return dbResult<Transition>(data, error, "transition");
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

function pickPoint(stop: unknown): { lat: number; lng: number } | null {
  // Supabase returns related rows as either an object or an array depending on
  // the FK shape. Normalise both into a single record.
  const s = stop as {
    location?: unknown;
    customer_site?: unknown;
  };
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as
    | { latitude?: number | null; longitude?: number | null }
    | null
    | undefined;
  const cs = first(s.customer_site);
  const loc = first(s.location);
  if (cs?.latitude != null && cs?.longitude != null)
    return { lat: cs.latitude, lng: cs.longitude };
  if (loc?.latitude != null && loc?.longitude != null)
    return { lat: loc.latitude, lng: loc.longitude };
  return null;
}
