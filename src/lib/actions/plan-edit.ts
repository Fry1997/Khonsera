"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { updateStop, deleteStop } from "@/lib/actions/stops";
import { resolveItineraryTimes } from "@/lib/actions/itineraries";
import { inferAndUpdateSpan } from "@/lib/actions/events";
import { foldStopsToTickets } from "@/lib/tickets/from-stops";
import { wallClockToIso } from "@/lib/time-zone";
import { previewRoute, setTransitionMode, upsertTransition } from "@/lib/actions/transitions";
import { loadConstraints } from "@/lib/actions/constraints";
import { topViable, doorToDoorMinutes, type DoorToDoorOption } from "@/lib/planning/door-to-door";
import type { TransitionMode } from "@/lib/types/domain";
import type { AnchorVariableKind, AnchorVariableSlot } from "@/components/concierge";

// Planner master brief §5.3 — set any two of {arrive-by, duration, leave-by}; the
// engine derives the third. This persists one variable edit onto the underlying
// stop and re-solves (updateStop → resolveItineraryTimes), so the derived value
// recomputes. The chosen *kind* (precise/approximate/by-a-time/maximise) round-
// trips in stop.metadata so the card paints the right state next load.

export async function setAnchorVariable(input: {
  stopId: string;
  slot: AnchorVariableSlot;
  kind: AnchorVariableKind;
  iso?: string | null; // arriveBy / leaveBy — a resolved ISO datetime
  minutes?: number | null; // duration
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: stop } = await supabase
    .from("stops")
    .select("type, metadata")
    .eq("id", input.stopId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!stop) return { ok: false, error: "That anchor couldn't be found." };

  // Merge (don't replace) the metadata jsonb. updateStop requires `type`, so
  // carry the stop's existing type through unchanged.
  const meta: Record<string, unknown> = { ...((stop.metadata as Record<string, unknown> | null) ?? {}) };
  const patch: Parameters<typeof updateStop>[0] = {
    id: input.stopId,
    type: stop.type as Parameters<typeof updateStop>[0]["type"],
  };
  const hard = input.kind === "precise" || input.kind === "by-a-time";

  if (input.slot === "duration") {
    patch.duration_minutes = input.minutes ?? null;
    meta.var_duration_kind = input.kind;
  } else if (input.slot === "arriveBy") {
    patch.start_time = input.iso ?? null;
    patch.is_time_fixed = hard;
    meta.var_arrive_kind = input.kind;
    meta.timing_mode = input.kind === "maximise" ? "maximize" : "arrive_by";
  } else {
    patch.end_time = input.iso ?? null;
    patch.is_time_fixed = hard;
    meta.var_leave_kind = input.kind;
    meta.timing_mode = "leave_by";
  }
  patch.metadata = meta;

  const res = await updateStop(patch);
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't update that.";
    return { ok: false, error: msg };
  }
  revalidatePath("/plan");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Leg comparison (planner master brief §3.3 / §5.7) — rank transport options
// for a leg by composite door-to-door time. Speed ranks; exclusions filter.
// Candidate single-mode options are priced by the routing provider (previewRoute,
// cached); the engine (topViable) ranks them. Multi-mode first/last-mile mixes
// come with the constraints + first/last-mile slice.
// ---------------------------------------------------------------------------

const CANDIDATE_MODES: TransitionMode[] = ["walk", "taxi", "drive", "bus", "tube", "train"];

export type LegOption = {
  id: string;
  mode: TransitionMode;
  minutes: number; // door-to-door total
  miles?: number;
};

export async function compareLeg(input: {
  fromStopId: string;
  toStopId: string;
  exclude?: TransitionMode[];
}): Promise<{ ok: boolean; options?: LegOption[]; error?: string }> {
  // Global standing constraints always filter the matrix (§5.8: exclusions
  // remove options entirely), merged with any caller-supplied exclusions.
  const { excludedModes } = await loadConstraints();
  const exclude = [...new Set([...(input.exclude ?? []), ...excludedModes])];

  const routed = await Promise.all(
    CANDIDATE_MODES.map(async (mode) => {
      const res = await previewRoute({
        from_stop_id: input.fromStopId,
        to_stop_id: input.toStopId,
        mode,
      });
      if (!res.ok || res.value.durationMinutes == null) return null;
      return { mode, minutes: res.value.durationMinutes, miles: res.value.distanceMiles };
    }),
  );

  const options: (DoorToDoorOption & { mode: TransitionMode; miles?: number })[] = routed
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({
      id: r.mode,
      mode: r.mode,
      subLegs: [{ mode: r.mode, minutes: r.minutes }],
      miles: r.miles ?? undefined,
    }));

  if (options.length === 0) {
    return { ok: false, error: "No routable options for this leg." };
  }

  const ranked = topViable(options, 4, { exclude });
  return {
    ok: true,
    options: ranked.map((o) => ({
      id: o.id,
      mode: o.mode,
      minutes: doorToDoorMinutes(o),
      miles: o.miles,
    })),
  };
}

// Commit a leg to a chosen mode (§5.7: choosing commits the leg + re-routes +
// re-solves, hardening the bracketing anchors via the solver).
export async function chooseLeg(input: {
  transitionId: string;
  mode: TransitionMode;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await setTransitionMode({ id: input.transitionId, mode: input.mode });
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't choose that.";
    return { ok: false, error: msg };
  }
  revalidatePath("/plan");
  return { ok: true };
}

// Resolve a gap into a chosen leg (§5.5 → §5.4): create the transition between
// two adjacent stops with the chosen mode; routing + re-solve happen inside.
export async function createLeg(input: {
  itineraryId: string;
  fromStopId: string;
  toStopId: string;
  mode: TransitionMode;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await upsertTransition({
    itinerary_id: input.itineraryId,
    from_stop_id: input.fromStopId,
    to_stop_id: input.toStopId,
    mode: input.mode,
  });
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't add that leg.";
    return { ok: false, error: msg };
  }
  revalidatePath("/plan");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manual structured add (planner master brief §4.2) — the reliable floor under
// NLP. Lands a fact on the spine by time (createStop → re-sequence by start_time
// → re-solve), so a manually-entered fact is identical to a parsed one once in
// the model. Same insert-by-time + recompute as every other capture door.
// ---------------------------------------------------------------------------

import { createStop, reorderStops } from "@/lib/actions/stops";
import { createLocation } from "@/lib/actions/locations";

export async function addManualAnchor(input: {
  itineraryId: string;
  kind: "appointment" | "place";
  title: string;
  iso?: string | null;
  durationMinutes?: number | null;
  // The PlacePicker resolves a real, geocoded place (saved location or a Google
  // pin promoted into `locations`) and hands back its id — so the walk to/from
  // it routes. Prefer these over the raw-address fallback.
  locationId?: string | null;
  customerSiteId?: string | null;
  address?: string | null; // raw-text fallback → geocoded to coords
}): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give it a name." };

  // A specific place → coordinates so the leg routes. The picker already
  // geocoded; only fall back to geocoding a raw address when no place was bound.
  let locationId: string | null = input.locationId ?? null;
  const customerSiteId = input.customerSiteId ?? null;
  const address = input.address?.trim();
  if (!locationId && !customerSiteId && address) {
    const loc = await createLocation({ name: title, type: "other", address });
    if (loc.ok) locationId = loc.value.id;
  }

  const created = await createStop({
    itinerary_id: input.itineraryId,
    type: input.kind === "appointment" ? "appointment" : "other",
    title,
    start_time: input.iso ?? null,
    duration_minutes: input.durationMinutes ?? null,
    is_time_fixed: Boolean(input.iso),
    location_id: locationId,
    customer_site_id: customerSiteId,
  });
  if (!created.ok) {
    const msg = "message" in created.error ? created.error.message : "Couldn't add that.";
    return { ok: false, error: msg };
  }

  // Re-sequence the whole spine chronologically (insert-by-time, not append).
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("stops")
    .select("id, start_time")
    .eq("itinerary_id", input.itineraryId)
    .eq("workspace_id", ctx.workspaceId);

  const ordered = (rows ?? [])
    .slice()
    .sort((a, b) => {
      const ta = a.start_time ? new Date(a.start_time as string).getTime() : Infinity;
      const tb = b.start_time ? new Date(b.start_time as string).getTime() : Infinity;
      return ta - tb;
    })
    .map((r) => r.id as string);

  if (ordered.length > 1) {
    await reorderStops({ itinerary_id: input.itineraryId, stop_ids: ordered });
  }

  revalidatePath("/plan");
  return { ok: true };
}

// Remove a single tile (stop) from an Event — clear out a fact you no longer
// want. Re-solves + re-infers the span after.
export async function removeStop(
  stopId: string,
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await deleteStop(stopId);
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't remove that.";
    return { ok: false, error: msg };
  }
  await resolveItineraryTimes(eventId);
  await inferAndUpdateSpan(eventId);
  revalidatePath(`/plan/${eventId}`);
  return { ok: true };
}

// Delete a booked travel run (a transit_departure → changeover(s) → arrival span)
// — clears it from BOTH the timeline (the docked Pass) and the Wallet, since both
// read the same stops. Removes the run's stops + their transitions + any linked
// travel_booking/booking_intent, then re-solves. `departureStopId` = the ticket id.
export async function deleteBookedRun(departureStopId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: dep } = await supabase
    .from("stops")
    .select("itinerary_id")
    .eq("id", departureStopId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!dep) return { ok: false, error: "That booking couldn't be found." };
  const itineraryId = dep.itinerary_id as string;

  const { data: rows } = await supabase
    .from("stops")
    .select("id, type, title, start_time, metadata")
    .eq("itinerary_id", itineraryId)
    .order("sequence");
  const folded = foldStopsToTickets(
    (rows ?? []).map((s) => ({
      id: s.id as string,
      type: s.type as string,
      title: (s.title as string | null) ?? null,
      start_time: (s.start_time as string | null) ?? null,
      metadata: (s.metadata as Record<string, unknown> | null) ?? null,
    })),
  );
  const run = folded.find((f) => f.departureStopId === departureStopId);
  if (!run) return { ok: false, error: "Couldn't resolve that booking." };
  const ids = run.stopIds;

  // Linked booking rows (when the booking lives in travel_bookings, not just stops).
  const { data: intents } = await supabase.from("booking_intents").select("id").in("stop_id", ids);
  const intentIds = (intents ?? []).map((r) => r.id as string);
  if (intentIds.length) {
    await supabase.from("travel_bookings").delete().in("booking_intent_id", intentIds);
    await supabase.from("booking_intents").delete().in("id", intentIds);
  }

  // RELEASE the source email(s) so a deleted import can be re-scanned + re-imported.
  // The import stamps gmail_message_id onto the departure stop's metadata; without
  // clearing the gmail_imported_messages row, the scan permanently skips it.
  const messageIds = (rows ?? [])
    .filter((s) => ids.includes(s.id as string))
    .map((s) => (s.metadata as Record<string, unknown> | null)?.gmail_message_id)
    .filter((m): m is string => typeof m === "string" && m.length > 0);
  if (messageIds.length) {
    await supabase
      .from("gmail_imported_messages")
      .delete()
      .eq("workspace_id", ctx.workspaceId)
      .in("gmail_message_id", messageIds);
  }

  // Transitions touching the run, then the stops themselves.
  await supabase.from("transitions").delete().eq("itinerary_id", itineraryId).in("from_stop_id", ids);
  await supabase.from("transitions").delete().eq("itinerary_id", itineraryId).in("to_stop_id", ids);
  await supabase.from("stops").delete().eq("workspace_id", ctx.workspaceId).in("id", ids);

  await resolveItineraryTimes(itineraryId);
  await inferAndUpdateSpan(itineraryId);
  revalidatePath(`/plan/${itineraryId}`);
  revalidatePath("/plan");
  revalidatePath("/wallet");
  return { ok: true };
}

// Add transport as a STANDALONE fact (no fixed anchor required) — a booked train
// (or flight/bus/…) from A to B at a time. Creates the transit_departure +
// transit_arrival stops (with their station hubs + times) and a locked leg
// between them, then re-sequences by time + re-solves. Shows as a docked Pass.
export async function addTransport(input: {
  itineraryId: string;
  mode: "train" | "flight" | "bus" | "tube" | "taxi" | "drive";
  fromHubId?: string | null;
  fromLabel: string;
  toHubId?: string | null;
  toLabel: string;
  date: string; // YYYY-MM-DD
  departTime: string; // HH:MM
  arriveTime: string; // HH:MM
  operator?: string | null;
  reference?: string | null;
  seat?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const from = input.fromLabel.trim();
  const to = input.toLabel.trim();
  if (!from || !to) return { ok: false, error: "Where from, and where to?" };
  const departIso = wallClockToIso(input.date, input.departTime);
  const arriveIso = wallClockToIso(input.date, input.arriveTime);
  if (!departIso || !arriveIso) return { ok: false, error: "Pick depart and arrive times." };

  const meta: Record<string, unknown> = { transport_mode: input.mode };
  if (input.operator?.trim()) meta.operator = input.operator.trim();
  if (input.reference?.trim()) meta.booking_reference = input.reference.trim();
  if (input.seat?.trim()) meta.seat = input.seat.trim();

  const dep = await createStop({
    itinerary_id: input.itineraryId,
    type: "transit_departure",
    title: from,
    start_time: departIso,
    is_time_fixed: true,
    transport_hub_id: input.fromHubId ?? null,
    metadata: meta,
  });
  const arr = await createStop({
    itinerary_id: input.itineraryId,
    type: "transit_arrival",
    title: to,
    start_time: arriveIso,
    is_time_fixed: true,
    transport_hub_id: input.toHubId ?? null,
  });
  if (!dep.ok || !arr.ok) return { ok: false, error: "Couldn't add the transport." };

  await upsertTransition({
    itinerary_id: input.itineraryId,
    from_stop_id: dep.value.id,
    to_stop_id: arr.value.id,
    mode: input.mode,
    is_locked: true,
  });

  // Re-sequence the whole spine by time, then re-solve + re-infer the span.
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("stops")
    .select("id, start_time")
    .eq("itinerary_id", input.itineraryId)
    .eq("workspace_id", ctx.workspaceId);
  const ordered = (rows ?? [])
    .slice()
    .sort((a, b) => {
      const ta = a.start_time ? new Date(a.start_time as string).getTime() : Infinity;
      const tb = b.start_time ? new Date(b.start_time as string).getTime() : Infinity;
      return ta - tb;
    })
    .map((r) => r.id as string);
  if (ordered.length > 1) await reorderStops({ itinerary_id: input.itineraryId, stop_ids: ordered });
  await resolveItineraryTimes(input.itineraryId);
  await inferAndUpdateSpan(input.itineraryId);

  revalidatePath(`/plan/${input.itineraryId}`);
  revalidatePath("/wallet");
  return { ok: true };
}
