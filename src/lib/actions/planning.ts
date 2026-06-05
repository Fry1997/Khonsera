"use server";

// Phase 2 planning actions: trip-level travel strategy + rail candidates.
//
// These are the thin server-action wrappers over the pure planning engine
// (lib/planning/strategy.ts, rail-candidates.ts). They resolve workspace data,
// call the integration layer, and run the pure derivations — keeping the
// engine itself IO-free and unit-tested.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { findRailJourneys } from "@/lib/integrations/rail";
import {
  deriveOutbound,
  deriveReturn,
  type RailCandidate,
  type OutboundCandidate,
  type ReturnCandidate,
} from "@/lib/planning/rail-candidates";
import {
  resolveAppointment,
  type ArriveValue,
  type DurationValue,
  type LeaveValue,
  type ResolvedAppointment,
} from "@/lib/planning/appointment";
import { dbResult, parseInput } from "./_helpers";
import { resolveItineraryTimes } from "./itineraries";
import { err, errors, ok, type Result } from "@/lib/errors";
import type { TravelStrategy } from "@/lib/types/domain";

// ── Travel strategy ──────────────────────────────────────────────────────────

const setTravelStrategySchema = z.object({
  itinerary_id: z.string().uuid(),
  // Null clears the choice back to "undecided" (engine recommends).
  strategy: z.enum(["rail", "drive", "mixed"]).nullable(),
});

// Persist the trip-level strategy chip. The full leg rebuild (collapse the
// rail spine to a single drive leg, or vice versa) is a UI-mount concern —
// it needs the composed journeys wired through getPlanningViewData — so here
// we record the choice and re-solve times. Documented in docs/planning-engine.md.
export async function setTravelStrategy(
  input: z.input<typeof setTravelStrategySchema>,
): Promise<Result<{ id: string; travel_strategy: TravelStrategy | null }>> {
  const parsed = parseInput(setTravelStrategySchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("itineraries")
    .update({ travel_strategy: parsed.value.strategy })
    .eq("id", parsed.value.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id, travel_strategy")
    .single();

  const result = dbResult<{
    id: string;
    travel_strategy: TravelStrategy | null;
  }>(data, error, "itinerary");
  if (result.ok) {
    await recordAudit({
      entityType: "itinerary",
      entityId: result.value.id,
      action: "set_travel_strategy",
      after: { travel_strategy: parsed.value.strategy },
    });
    await resolveItineraryTimes(parsed.value.itinerary_id);
  }
  return result;
}

// ── Appointment timing (three-variable model, P3) ────────────────────────────

const arriveValueSchema = z.object({
  time: z.string().datetime().nullable(),
  kind: z.enum(["precise", "fuzzy", "range", "by", "derived", "unset"]),
});
const durationValueSchema = z.object({
  minutes: z.number().int().min(0).max(24 * 60).nullable(),
  kind: z.enum(["precise", "fuzzy", "maximise", "derived", "unset"]),
});
const leaveValueSchema = z.object({
  time: z.string().datetime().nullable(),
  kind: z.enum(["precise", "fuzzy", "by", "derived", "unset"]),
});

const setAppointmentTimingSchema = z.object({
  stop_id: z.string().uuid(),
  // Any subset — omitted values keep what's already on the stop, so the UI can
  // set one field at a time and let the engine derive the rest.
  arrive: arriveValueSchema.nullable().optional(),
  duration: durationValueSchema.nullable().optional(),
  leave: leaveValueSchema.nullable().optional(),
  // Outer viable bounds for maximise mode, from the rail candidates + home-by.
  bounds: z
    .object({
      earliestArrive: z.string().datetime().nullable().optional(),
      latestLeave: z.string().datetime().nullable().optional(),
    })
    .optional(),
});

// Set any of arrive/duration/leave on an appointment stop. Merges with the
// stop's existing value-objects, resolves the triple (deriving the third +
// attribution source), persists the rich values, and projects them onto the
// canonical start_time/end_time/duration_minutes/is_time_fixed the time solver
// reads. Returns the resolved triple so the caller can render microcopy.
export async function setAppointmentTiming(
  input: z.input<typeof setAppointmentTimingSchema>,
): Promise<Result<ResolvedAppointment>> {
  const parsed = parseInput(setAppointmentTimingSchema, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: stop } = await supabase
    .from("stops")
    .select("id, itinerary_id, arrive_value, duration_value, leave_value")
    .eq("id", v.stop_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!stop) return err(errors.notFound("stop"));

  // Merge: a value passed in this call wins; otherwise keep the stored one.
  const arrive = (v.arrive ??
    (stop.arrive_value as ArriveValue | null) ??
    undefined) as ArriveValue | undefined;
  const duration = (v.duration ??
    (stop.duration_value as DurationValue | null) ??
    undefined) as DurationValue | undefined;
  const leave = (v.leave ??
    (stop.leave_value as LeaveValue | null) ??
    undefined) as LeaveValue | undefined;

  const resolved = resolveAppointment({
    arrive,
    duration,
    leave,
    bounds: v.bounds
      ? {
          earliestArrive: v.bounds.earliestArrive ?? null,
          latestLeave: v.bounds.latestLeave ?? null,
        }
      : undefined,
  });

  // Project to the canonical solver fields. A precise/by arrival is a hard
  // anchor; fuzzy/derived/maximise stays flexible so the solver can move it.
  const isFixed =
    resolved.arrive.time != null &&
    (resolved.arrive.kind === "precise" || resolved.arrive.kind === "by");

  const { error } = await supabase
    .from("stops")
    .update({
      arrive_value: resolved.arrive,
      duration_value: resolved.duration,
      leave_value: resolved.leave,
      start_time: resolved.arrive.time,
      end_time: resolved.leave.time,
      duration_minutes: resolved.duration.minutes,
      is_time_fixed: isFixed,
    })
    .eq("id", v.stop_id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return dbResult<ResolvedAppointment>(null, error, "stop");

  await recordAudit({
    entityType: "stop",
    entityId: v.stop_id,
    action: "set_appointment_timing",
    after: resolved,
  });
  await resolveItineraryTimes(stop.itinerary_id as string);
  return ok(resolved);
}

// ── Rail candidates for a gap ────────────────────────────────────────────────

const railCandidatesSchema = z
  .object({
    from_stop_id: z.string().uuid(),
    to_stop_id: z.string().uuid(),
    direction: z.enum(["outbound", "return"]),
    // Outbound is constrained by when you must arrive; return by the earliest
    // you can depart. One of these drives the timetable query.
    arrive_by: z.string().datetime().nullable().optional(),
    depart_after: z.string().datetime().nullable().optional(),
    // First-/last-mile minutes either side of the rail leg, from the UI's
    // routing previews. Default 0 = station is the door (rare but honest).
    first_mile_minutes: z.number().int().min(0).max(600).default(0),
    last_mile_minutes: z.number().int().min(0).max(600).default(0),
    venue_buffer_minutes: z.number().int().min(0).max(600).optional(),
    leave_venue_buffer_minutes: z.number().int().min(0).max(600).optional(),
  })
  .refine(
    (v) => v.direction === "outbound" || v.depart_after != null,
    { message: "return candidates need depart_after" },
  );

export type RailCandidatesResult = {
  mode: "live" | "demo" | "unavailable";
  direction: "outbound" | "return";
  reason?: string;
  candidates: (OutboundCandidate | ReturnCandidate)[];
};

export async function getRailCandidatesForGap(
  input: z.input<typeof railCandidatesSchema>,
): Promise<Result<RailCandidatesResult>> {
  const parsed = parseInput(railCandidatesSchema, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);
  const tz = wsCfg.timezone;

  const { data: stops } = await supabase
    .from("stops")
    .select(
      "id, title, transport_hub:transport_hubs(name, code)",
    )
    .in("id", [v.from_stop_id, v.to_stop_id])
    .eq("workspace_id", ctx.workspaceId);
  if (!stops || stops.length !== 2) return err(errors.notFound("stop"));

  const fromStop = stops.find((s) => s.id === v.from_stop_id) ?? stops[0];
  const toStop = stops.find((s) => s.id === v.to_stop_id) ?? stops[1];
  const stationName = (s: (typeof stops)[number]): string => {
    const hub = first(s.transport_hub) as
      | { name?: string | null; code?: string | null }
      | null;
    return hub?.code || hub?.name || (s.title as string | null) || "";
  };

  const result = await findRailJourneys({
    originStation: stationName(fromStop),
    destinationStation: stationName(toStop),
    departAt: v.depart_after ? new Date(v.depart_after) : undefined,
    arriveBy: v.arrive_by ? new Date(v.arrive_by) : undefined,
  });

  if (result.mode === "unavailable") {
    return ok({
      mode: "unavailable",
      direction: v.direction,
      reason: result.reason,
      candidates: [],
    });
  }

  const raw: RailCandidate[] = result.data.map((j) => ({
    dep: j.departAt.toISOString(),
    arr: j.arriveAt.toISOString(),
    durationMinutes: j.durationMinutes,
    changes: j.changes,
    peak: isPeakDeparture(j.departAt, tz),
    // Provider prices are pounds; the pure layer works in pence.
    pricePence:
      j.estimatedPrice != null ? Math.round(j.estimatedPrice * 100) : null,
    serviceNumbers: j.serviceNumbers,
  }));

  const candidates: (OutboundCandidate | ReturnCandidate)[] =
    v.direction === "outbound"
      ? raw.map((c) =>
          deriveOutbound(c, {
            firstMileMinutes: v.first_mile_minutes,
            lastMileMinutes: v.last_mile_minutes,
            venueArrivalBufferMinutes: v.venue_buffer_minutes,
          }),
        )
      : raw.map((c) =>
          deriveReturn(c, {
            toStationMinutes: v.last_mile_minutes,
            toHomeMinutes: v.first_mile_minutes,
            leaveVenueBufferMinutes: v.leave_venue_buffer_minutes,
          }),
        );

  return ok({
    mode: result.mode,
    direction: v.direction,
    candidates,
  });
}

// Peak if the departure falls in a weekday morning (07:00–09:59) or evening
// (16:00–18:59) window, evaluated in the workspace timezone. v1 heuristic for
// the pair-fare logic — real fare APIs replace it later.
function isPeakDeparture(d: Date, tz: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return false;
  return (hour >= 7 && hour < 10) || (hour >= 16 && hour < 19);
}

// Supabase returns embedded rows as object or array; normalise to one record.
function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? v[0] : v) ?? null;
}
