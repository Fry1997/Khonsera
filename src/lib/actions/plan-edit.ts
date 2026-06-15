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
import { haversineMeters } from "@/lib/geo";
import type { TransitionMode } from "@/lib/types/domain";
import type { ParsedTransportBooking } from "@/lib/gmail/types";
import type { AnchorVariableKind, AnchorVariableSlot } from "@/components/concierge";
import type { AccommodationDetails } from "@/lib/accommodation/types";

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
    .select("type, metadata, itinerary_id")
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
  // Changing a stop's time can change WHERE it belongs in the day (e.g. an office
  // edited to 09:00 must move after the morning train), so re-sequence + re-thread
  // + re-solve. This is a user action (sequential) — safe, unlike doing it on render.
  await resequenceAndSolve(stop.itinerary_id as string);
  revalidatePath(`/plan/${stop.itinerary_id as string}`);
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
  kind: "appointment" | "place" | "accommodation";
  title: string;
  iso?: string | null; // arrive-by (start)
  leaveIso?: string | null; // leave-by (end) — set both for a fixed window ("9 to 5")
  durationMinutes?: number | null; // used only when no leave time given
  // The PlacePicker resolves a real, geocoded place (saved location or a Google
  // pin promoted into `locations`) and hands back its id — so the walk to/from
  // it routes. Prefer these over the raw-address fallback.
  locationId?: string | null;
  customerSiteId?: string | null;
  address?: string | null; // raw-text fallback → geocoded to coords
  details?: AccommodationDetails | null; // ED1 — structured stay payload (accommodation kind only)
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

  // Arrive + leave → a fixed window; derive the duration. Arrive-only keeps the
  // supplied duration. Either pinned time fixes the anchor for the solver.
  const arriveIso = input.iso ?? null;
  const leaveIso = input.leaveIso ?? null;
  const duration =
    arriveIso && leaveIso
      ? Math.max(0, Math.round((new Date(leaveIso).getTime() - new Date(arriveIso).getTime()) / 60_000))
      : input.durationMinutes ?? null;

  const created = await createStop({
    itinerary_id: input.itineraryId,
    type: input.kind === "appointment" ? "appointment" : input.kind === "accommodation" ? "accommodation" : "other",
    title,
    start_time: arriveIso,
    end_time: leaveIso,
    duration_minutes: duration,
    is_time_fixed: Boolean(arriveIso || leaveIso),
    location_id: locationId,
    customer_site_id: customerSiteId,
    metadata:
      input.kind === "accommodation"
        ? { kind: "accommodation", accommodation: input.details ?? {} }
        : undefined,
  });
  if (!created.ok) {
    const msg = "message" in created.error ? created.error.message : "Couldn't add that.";
    return { ok: false, error: msg };
  }

  // Bookend with home (created once, here in the mutation — not on render) then
  // re-sequence + re-solve so the surrounding legs recompute around the new fact.
  await ensureHomeBookend(input.itineraryId, { create: true });
  await resequenceAndSolve(input.itineraryId);
  revalidatePath(`/plan/${input.itineraryId}`);
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
  const messageIds = [
    ...new Set(
      (rows ?? [])
        .filter((s) => ids.includes(s.id as string))
        .flatMap((s) => {
          const meta = (s.metadata as Record<string, unknown> | null) ?? {};
          const arr = Array.isArray(meta.gmail_message_ids) ? (meta.gmail_message_ids as unknown[]) : [];
          return [meta.gmail_message_id, ...arr];
        })
        .filter((m): m is string => typeof m === "string" && m.length > 0),
    ),
  ];
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
  // Extra structured payload to merge into the departure stop's metadata — e.g.
  // the Duffel order id / e-ticket / cabin for a flight, so the run is a rich
  // ticket card built from real data (no email decode) + manageable later.
  metadata?: Record<string, unknown> | null;
}): Promise<{ ok: boolean; error?: string }> {
  const from = input.fromLabel.trim();
  const to = input.toLabel.trim();
  if (!from || !to) return { ok: false, error: "Where from, and where to?" };
  const departIso = wallClockToIso(input.date, input.departTime);
  const arriveIso = wallClockToIso(input.date, input.arriveTime);
  if (!departIso || !arriveIso) return { ok: false, error: "Pick depart and arrive times." };

  const meta: Record<string, unknown> = { transport_mode: input.mode, ...(input.metadata ?? {}) };
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
  await resequenceAndSolve(input.itineraryId);
  revalidatePath(`/plan/${input.itineraryId}`);
  revalidatePath("/wallet");
  return { ok: true };
}

// Shared: re-sequence every stop in an Event chronologically (insert-by-time),
// then re-solve + re-infer the span. Used by every Plan-flow mutation.
async function resequenceAndSolve(itineraryId: string): Promise<void> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("stops")
    .select("id, type, sequence, start_time, metadata")
    .eq("itinerary_id", itineraryId)
    .eq("workspace_id", ctx.workspaceId);

  // Home start stays first, the return-home / be-home-by end stays last, the
  // rest sort by time (matches createItineraryFromBrief's ordering).
  const isEnd = (r: { type: string; metadata: Record<string, unknown> | null }) =>
    r.type === "end" ||
    (r.metadata && (r.metadata.kind === "return_home" || r.metadata.kind === "be_home_by"));
  const isStart = (r: { type: string; metadata: Record<string, unknown> | null }) =>
    r.type === "start" && !(r.metadata && r.metadata.kind === "be_home_by");

  const sorted = (rows ?? []).slice().sort((a, b) => {
    const aS = isStart(a as never), bS = isStart(b as never);
    if (aS !== bS) return aS ? -1 : 1;
    const aE = isEnd(a as never), bE = isEnd(b as never);
    if (aE !== bE) return aE ? 1 : -1;
    const ta = a.start_time ? new Date(a.start_time as string).getTime() : Infinity;
    const tb = b.start_time ? new Date(b.start_time as string).getTime() : Infinity;
    return ta - tb;
  });
  const ordered = sorted.map((r) => r.id as string);
  // Only rewrite sequences when the chronological order differs from the stored
  // one — cheap enough to call on every Event open as a self-heal.
  const currentOrder = (rows ?? [])
    .slice()
    .sort((a, b) => (a.sequence as number) - (b.sequence as number))
    .map((r) => r.id as string);
  const needsReorder = ordered.some((id, i) => id !== currentOrder[i]);
  if (ordered.length > 1 && needsReorder) {
    await reorderStops({ itinerary_id: itineraryId, stop_ids: ordered });
  }
  await threadTransitions(itineraryId);
  await resolveItineraryTimes(itineraryId);
  await inferAndUpdateSpan(itineraryId);
}

// Thread the day: ensure a transition (leg) exists between each adjacent pair of
// stops, so the spine shows real legs with door-to-door times — not bare gaps.
// The brief does this; the Plan flow didn't, which is why manually-built / captured
// days never computed walk/drive times. Default mode is distance-based (short =
// walk, longer = drive); the user can tap-to-compare to change it, and booked
// runs keep their locked legs. Also clears stale unlocked legs whose endpoints are
// no longer adjacent (e.g. after a train splits a home→office leg).
async function threadTransitions(itineraryId: string): Promise<void> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: stopRows } = await supabase
    .from("stops")
    .select(
      `id, sequence, type,
       location:locations(latitude, longitude),
       customer_site:customer_sites(latitude, longitude),
       transport_hub:transport_hubs(latitude, longitude)`,
    )
    .eq("itinerary_id", itineraryId)
    .eq("workspace_id", ctx.workspaceId)
    .order("sequence");
  const stops = (stopRows ?? []) as unknown as Array<{
    id: string;
    type: string;
    location: { latitude: number | null; longitude: number | null } | null;
    customer_site: { latitude: number | null; longitude: number | null } | null;
    transport_hub: { latitude: number | null; longitude: number | null } | null;
  }>;
  if (stops.length < 2) return;

  const { data: trans } = await supabase
    .from("transitions")
    .select("id, from_stop_id, to_stop_id, is_locked")
    .eq("itinerary_id", itineraryId);
  const have = new Set((trans ?? []).map((t) => `${t.from_stop_id}->${t.to_stop_id}`));

  // Adjacent pairs in the current order.
  const adjacent = new Set<string>();
  for (let k = 0; k + 1 < stops.length; k++) adjacent.add(`${stops[k].id}->${stops[k + 1].id}`);

  // Drop stale unlocked legs that no longer bridge adjacent stops (booked/locked
  // legs are always kept — they're the train rides).
  const stale = (trans ?? []).filter(
    (t) => !t.is_locked && !adjacent.has(`${t.from_stop_id}->${t.to_stop_id}`),
  );
  if (stale.length) {
    await supabase.from("transitions").delete().in("id", stale.map((t) => t.id as string));
  }

  const coordOf = (s: (typeof stops)[number]) => {
    const lat = s.location?.latitude ?? s.customer_site?.latitude ?? s.transport_hub?.latitude;
    const lng = s.location?.longitude ?? s.customer_site?.longitude ?? s.transport_hub?.longitude;
    return lat != null && lng != null ? { lat, lng } : null;
  };

  for (let k = 0; k + 1 < stops.length; k++) {
    const a = stops[k];
    const b = stops[k + 1];
    if (have.has(`${a.id}->${b.id}`)) continue;
    let mode: TransitionMode = "walk";
    const pa = coordOf(a);
    const pb = coordOf(b);
    if (pa && pb) {
      const miles = haversineMeters(pa.lat, pa.lng, pb.lat, pb.lng) / 1609.344;
      mode = miles < 2 ? "walk" : "drive";
    }
    await upsertTransition({
      itinerary_id: itineraryId,
      from_stop_id: a.id,
      to_stop_id: b.id,
      mode,
    });
  }
}

// Import a parsed transport booking as a proper booked RUN — transit_departure →
// transit_changeover(s) → transit_arrival, one boarded-leg barcode per stop, locked
// transitions between. This is the structure foldStopsToTickets folds into a Pass
// (so the timeline + Wallet show the rail card, not a bare "by train" leg). Mirrors
// the brief's transport-booking build (createItineraryFromBrief). Unlike the legacy
// attachTransportBookingToStop, it does NOT repurpose a previous anchor as the
// departure — the train is its own fact.
export async function importBookingAsRun(input: {
  itineraryId: string;
  booking: ParsedTransportBooking;
}): Promise<{ ok: boolean; error?: string }> {
  const { itineraryId, booking } = input;
  const segs = booking.segments;
  if (!segs.length) return { ok: false, error: "That booking had no journey legs." };

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Resolve station hubs so the stops carry coordinates (the walk to/from the
  // station then routes with real geography). By CRS code where present (etickets),
  // else by NAME — a confirmation's legs only carry station names, and without the
  // coords the station→office walk can't route.
  // CRS codes are NOT unique across hub kinds — "WEL" is both Wellingborough
  // (rail_station) AND Welkom Airport (airport, in South Africa). A train booking
  // must resolve to the rail station, or the home→station leg becomes an 8000-mile
  // "drive". Prefer the hub kind that matches the booking mode.
  const wantKind = booking.mode === "flight" ? "airport" : "rail_station";
  const codes = [...new Set(segs.flatMap((s) => [s.from_station_code, s.to_station_code]).filter((c): c is string => !!c))];
  const hubByCode = new Map<string, string>();
  if (codes.length) {
    const { data: hubs } = await supabase
      .from("transport_hubs")
      .select("id, code, kind")
      .in("code", codes.map((c) => c.toUpperCase()));
    for (const c of codes) {
      const cu = c.toUpperCase();
      const matches = (hubs ?? []).filter((h) => (h.code as string)?.toUpperCase() === cu);
      const pick = matches.find((h) => h.kind === wantKind) ?? matches[0];
      if (pick) hubByCode.set(cu, pick.id as string);
    }
  }

  const names = [...new Set(segs.flatMap((s) => [s.from_station, s.to_station]).filter((n): n is string => !!n))];
  const hubByName = new Map<string, string>();
  if (names.length) {
    const orFilter = names.map((n) => `name.ilike.${n.replace(/[(),]/g, " ").trim()}`).join(",");
    const { data: hubs } = await supabase
      .from("transport_hubs")
      .select("id, name, kind")
      .or(orFilter);
    for (const n of names) {
      // Prefer an exact rail-station name match (avoids "Luton Airport Parkway"
      // matching "Luton"); fall back to any exact-name hub.
      const matches = (hubs ?? []).filter((h) => (h.name as string)?.toLowerCase() === n.toLowerCase());
      const pick = matches.find((h) => h.kind === wantKind) ?? matches[0];
      if (pick) hubByName.set(n.toLowerCase(), pick.id as string);
    }
  }

  const hubFor = (code: string | null, name?: string | null) =>
    (code ? hubByCode.get(code.toUpperCase()) : null) ?? (name ? hubByName.get(name.toLowerCase()) ?? null : null);

  const segIso = (date: string, time: string | null) => (time ? wallClockToIso(date, time) : null);

  // Split into JOURNEYS. A return booking lists every leg in one email:
  // out (WEL→Luton→Harpenden) then return (Harpenden→Luton→WEL). The hours you
  // spend at the destination show up as a huge gap between two legs, whereas a
  // real changeover is minutes. So a gap > 3h starts a new journey — each becomes
  // its own Pass (outbound in the morning, return in the evening), with the day's
  // activity sitting between them. Small gaps stay as changeovers within a run.
  type Seg = (typeof segs)[number];
  const journeys: Seg[][] = [];
  let current: Seg[] = [];
  for (let k = 0; k < segs.length; k++) {
    if (k > 0) {
      const prevArr = segIso(segs[k - 1].arrival_date, segs[k - 1].arrival_time);
      const curDep = segIso(segs[k].departure_date, segs[k].departure_time);
      const gapMin = prevArr && curDep ? (new Date(curDep).getTime() - new Date(prevArr).getTime()) / 60_000 : 0;
      if (gapMin > 180) {
        journeys.push(current);
        current = [];
      }
    }
    current.push(segs[k]);
  }
  if (current.length) journeys.push(current);

  // Build one transit run (departure → changeover(s) → arrival + locked rides) per
  // journey. Price lands on the first journey only (it's the whole-booking total);
  // booking ref + source-email id land on every journey so deleting either Pass
  // can release the email and the wallet shows the reference.
  for (let j = 0; j < journeys.length; j++) {
    const js = journeys[j];
    const first = js[0];
    const dep = await createStop({
      itinerary_id: itineraryId,
      type: "transit_departure",
      title: first.from_station,
      start_time: segIso(first.departure_date, first.departure_time),
      is_time_fixed: true,
      transport_hub_id: hubFor(first.from_station_code, first.from_station),
      metadata: {
        kind: "transit_departure",
        transport_mode: booking.mode,
        booking_reference: booking.booking_reference,
        price: j === 0 && booking.price != null ? String(booking.price) : null,
        operator: first.operator,
        ticket_type: first.ticket_type,
        route_restriction: first.route_restriction,
        service_number: first.service_number,
        seat: first.seat,
        barcode_ref: first.barcode_ref,
        barcode_data: first.barcode_data,
        gmail_message_id: booking.gmail_message_id ?? null,
        gmail_message_ids: booking.source_message_ids ?? (booking.gmail_message_id ? [booking.gmail_message_id] : []),
      },
    });
    if (!dep.ok) return { ok: false, error: "Couldn't add the booking." };
    const runStopIds: string[] = [dep.value.id];

    for (let k = 1; k < js.length; k++) {
      const prev = js[k - 1];
      const cur = js[k];
      const co = await createStop({
        itinerary_id: itineraryId,
        type: "transit_changeover",
        title: cur.from_station,
        start_time: segIso(prev.arrival_date, prev.arrival_time), // arrive at the change
        end_time: segIso(cur.departure_date, cur.departure_time), // depart onward
        is_time_fixed: true,
        transport_hub_id: hubFor(cur.from_station_code, cur.from_station),
        metadata: {
          kind: "transit_changeover",
          transport_mode: booking.mode,
          operator: cur.operator,
          ticket_type: cur.ticket_type,
          route_restriction: cur.route_restriction,
          service_number: cur.service_number,
          seat: cur.seat,
          barcode_ref: cur.barcode_ref,
          barcode_data: cur.barcode_data,
        },
      });
      if (co.ok) runStopIds.push(co.value.id);
    }

    const lastSeg = js[js.length - 1];
    const arr = await createStop({
      itinerary_id: itineraryId,
      type: "transit_arrival",
      title: lastSeg.to_station,
      start_time: segIso(lastSeg.arrival_date, lastSeg.arrival_time),
      is_time_fixed: true,
      transport_hub_id: hubFor(lastSeg.to_station_code, lastSeg.to_station),
      metadata: { kind: "transit_arrival", transport_mode: booking.mode, service_number: lastSeg.service_number },
    });
    if (!arr.ok) return { ok: false, error: "Couldn't add the booking arrival." };
    runStopIds.push(arr.value.id);

    for (let k = 0; k + 1 < runStopIds.length; k++) {
      await upsertTransition({
        itinerary_id: itineraryId,
        from_stop_id: runStopIds[k],
        to_stop_id: runStopIds[k + 1],
        mode: booking.mode as TransitionMode,
        is_locked: true,
      });
    }
  }

  await ensureHomeBookend(itineraryId, { create: true });
  await resequenceAndSolve(itineraryId);
  revalidatePath(`/plan/${itineraryId}`);
  revalidatePath("/wallet");
  return { ok: true };
}

// Ensure a Plan Event is bookended by the user's home/base — exactly ONE `start`
// stop at the front and ONE `return_home` `end` stop at the back — like the brief
// (One Toolkit, Two Views). Without this, a day starts at the first appointment so
// the solver can't back-calculate the leave-home time.
//
// IMPORTANT: `create` is true only from MUTATIONS (add a fact / import), which run
// sequentially — so the bookend is created exactly once. The page RENDER calls it
// with create:false (collapse-only); since server components render concurrently
// (prefetch + navigate), creating on render raced and flashed duplicate home stops
// ("home home work home home"). Collapse is idempotent and safe to race.
export async function ensureHomeBookend(
  itineraryId: string,
  opts: { create?: boolean } = {},
): Promise<{ ok: boolean; added: boolean }> {
  const create = opts.create ?? false;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("travel_profiles")
    .select("default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  const homeId =
    profile?.default_drive_origin_location_id ??
    profile?.default_rail_origin_location_id ??
    profile?.default_return_location_id ??
    null;

  const { data: rows } = await supabase
    .from("stops")
    .select("id, type, sequence, metadata")
    .eq("itinerary_id", itineraryId)
    .eq("workspace_id", ctx.workspaceId)
    .order("sequence");
  const stops = rows ?? [];
  if (stops.length === 0) return { ok: true, added: false }; // empty Event — nothing to bookend yet

  const starts = stops.filter((s) => s.type === "start");
  const ends = stops.filter(
    (s) => s.type === "end" || (s.metadata as Record<string, unknown> | null)?.kind === "return_home",
  );

  // Collapse duplicates: keep the first start + the last end, delete the rest
  // (and any transitions touching them) — this is what self-heals a race.
  const extra = [...starts.slice(1), ...ends.slice(0, -1)].map((s) => s.id as string);
  let changed = false;
  if (extra.length) {
    await supabase.from("transitions").delete().eq("itinerary_id", itineraryId).in("from_stop_id", extra);
    await supabase.from("transitions").delete().eq("itinerary_id", itineraryId).in("to_stop_id", extra);
    await supabase.from("stops").delete().eq("workspace_id", ctx.workspaceId).in("id", extra);
    changed = true;
  }

  if (create && homeId) {
    if (starts.length === 0) {
      await createStop({ itinerary_id: itineraryId, type: "start", location_id: homeId, is_time_fixed: false });
      changed = true;
    }
    if (ends.length === 0) {
      await createStop({
        itinerary_id: itineraryId,
        type: "end",
        location_id: homeId,
        is_time_fixed: false,
        metadata: { kind: "return_home" },
      });
      changed = true;
    }
  }

  if (changed) await resequenceAndSolve(itineraryId);
  return { ok: true, added: changed };
}

// Re-tag a whole day as work or personal (Edition III D1: the tag is the privacy
// boundary, flipped in context — not a global lens). Owner-only; RLS keeps a
// personal-tagged day invisible to the workspace.
export async function setItineraryMode(itineraryId: string, mode: "work" | "personal") {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("itineraries")
    .update({ mode })
    .eq("id", itineraryId)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  revalidatePath("/plan");
  revalidatePath("/today");
  return { ok: true as const };
}
