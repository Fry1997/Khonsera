"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";
import { resolveItineraryTimes } from "./itineraries";

// Bookings now belong to a STOP (typically a transport_booked stop). The
// optional itinerary back-ref keeps "all bookings for trip X" queries cheap.
const createBookingIntentSchema = z.object({
  stop_id: z.string().uuid(),
  itinerary_id: z.string().uuid().nullable().optional(),
  provider: z.string().trim().max(80).nullable().optional(),
  outbound_summary: z.string().trim().max(1000).nullable().optional(),
  return_summary: z.string().trim().max(1000).nullable().optional(),
  estimated_price: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).optional(),
  partner_deep_link: z.string().url().nullable().optional(),
  idempotency_key: z.string().uuid(),
});

const intentStatusEnum = z.enum([
  "not_started",
  "opened_partner",
  "booked",
  "failed",
  "abandoned",
]);

const updateBookingIntentStatusSchema = z.object({
  id: z.string().uuid(),
  status: intentStatusEnum,
});

const recordTravelBookingSchema = z.object({
  booking_intent_id: z.string().uuid(),
  provider: z.string().trim().max(80).nullable().optional(),
  booking_reference: z.string().trim().max(120).nullable().optional(),
  ticket_status: z
    .enum(["booked", "changed", "cancelled", "refunded", "unknown"])
    .optional(),
  actual_price: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).optional(),
  receipt_file_path: z.string().trim().max(500).nullable().optional(),
  idempotency_key: z.string().uuid(),
});

export async function createBookingIntent(
  input: z.input<typeof createBookingIntentSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(createBookingIntentSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Verify the stop belongs to the workspace before opening a booking.
  const { data: stop } = await supabase
    .from("stops")
    .select("id, itinerary_id")
    .eq("id", parsed.value.stop_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!stop) {
    return { ok: false, error: { kind: "not_found", entity: "stop" } };
  }

  const { data, error } = await supabase
    .from("booking_intents")
    .insert({
      ...parsed.value,
      itinerary_id: parsed.value.itinerary_id ?? stop.itinerary_id,
      workspace_id: ctx.workspaceId,
    })
    .select("id")
    .single();

  const result = dbResult<{ id: string }>(data, error, "booking_intent");
  if (result.ok) {
    await recordAudit({
      entityType: "booking_intent",
      entityId: result.value.id,
      action: "create",
      after: { ...parsed.value, id: result.value.id },
    });
  }
  return result;
}

export async function updateBookingIntentStatus(
  input: z.input<typeof updateBookingIntentStatusSchema>,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = parseInput(updateBookingIntentStatusSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("booking_intents")
    .select("status")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("booking_intents")
    .update({ status: parsed.value.status })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id, status")
    .single();

  const result = dbResult<{ id: string; status: string }>(data, error, "booking_intent");
  if (result.ok) {
    await recordAudit({
      entityType: "booking_intent",
      entityId: result.value.id,
      action: "update_status",
      before,
      after: result.value,
    });
  }
  return result;
}

// ---- attachTrainBookingToStop
//
// Booking flow for a manually-entered train ticket. From the station point
// the user is currently at, capture an arrival station + 1+ segments
// (each segment = a single train, with departure/arrival times and
// platforms). This action:
//
//   * inserts an arrival stop at the arrival station (creating its
//     location if needed),
//   * creates a booking_intent (status='booked') + travel_booking record
//     with the first/last segment times,
//   * writes travel_booking_segments rows,
//   * creates a locked transition between origin & arrival stops with
//     mode='train' and timestamps from the segments,
//   * runs the time solver so adjacent stops re-time.

const segmentSchema = z.object({
  from_location_name: z.string().trim().min(1).max(200),
  to_location_name: z.string().trim().min(1).max(200),
  departure_at: z.string().datetime(),
  arrival_at: z.string().datetime(),
  train_number: z.string().trim().max(40).nullable().optional(),
  platform_dep: z.string().trim().max(20).nullable().optional(),
  platform_arr: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const attachTrainBookingSchema = z
  .object({
    from_stop_id: z.string().uuid(),
    arrival_location_id: z.string().uuid().nullable().optional(),
    arrival_location_name: z.string().trim().max(200).nullable().optional(),
    booking_reference: z.string().trim().max(120).nullable().optional(),
    actual_price: z.number().nonnegative().nullable().optional(),
    currency: z.enum(["GBP", "EUR", "USD"]).optional(),
    seat_reservation: z.string().trim().max(120).nullable().optional(),
    segments: z.array(segmentSchema).min(1),
  })
  .refine(
    (v) => v.arrival_location_id != null || v.arrival_location_name != null,
    {
      message: "Provide arrival_location_id or arrival_location_name",
      path: ["arrival_location_id"],
    },
  );

export async function attachTrainBookingToStop(
  input: z.input<typeof attachTrainBookingSchema>,
): Promise<Result<{ arrival_stop_id: string; travel_booking_id: string }>> {
  const parsed = parseInput(attachTrainBookingSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // 1. Verify origin stop ownership and pull its details.
  const { data: fromStop } = await supabase
    .from("stops")
    .select("id, itinerary_id, sequence, location_id")
    .eq("id", parsed.value.from_stop_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!fromStop) return err(errors.notFound("stop"));

  // 2. Resolve arrival location: existing id, or create one from the name.
  let arrivalLocationId = parsed.value.arrival_location_id ?? null;
  if (!arrivalLocationId && parsed.value.arrival_location_name) {
    const { data: newLoc, error: locErr } = await supabase
      .from("locations")
      .insert({
        name: parsed.value.arrival_location_name,
        type: "station",
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
      })
      .select("id")
      .single();
    if (locErr || !newLoc) return err(errors.notFound("location"));
    arrivalLocationId = newLoc.id;
  }

  // 3. Shift any stops at sequence > fromStop.sequence by +1 so we can
  //    insert the new arrival stop immediately after fromStop.
  const newSeq = fromStop.sequence + 1;
  const { data: laterStops } = await supabase
    .from("stops")
    .select("id, sequence")
    .eq("itinerary_id", fromStop.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .gte("sequence", newSeq)
    .order("sequence", { ascending: false });
  for (const s of laterStops ?? []) {
    await supabase
      .from("stops")
      .update({ sequence: s.sequence + 1 })
      .eq("id", s.id)
      .eq("workspace_id", ctx.workspaceId);
  }

  const first = parsed.value.segments[0];
  const last = parsed.value.segments[parsed.value.segments.length - 1];

  // 4. Create the arrival stop pinned to the arrival time.
  const { data: arrivalStop, error: arrivalErr } = await supabase
    .from("stops")
    .insert({
      itinerary_id: fromStop.itinerary_id,
      workspace_id: ctx.workspaceId,
      sequence: newSeq,
      type: "transit_arrival",
      location_id: arrivalLocationId,
      start_time: last.arrival_at,
      end_time: last.arrival_at,
      is_time_fixed: true,
    })
    .select("id")
    .single();
  if (arrivalErr || !arrivalStop) return err(errors.notFound("stop"));

  // 5. booking_intent + travel_booking.
  const { data: intent, error: intentErr } = await supabase
    .from("booking_intents")
    .insert({
      stop_id: parsed.value.from_stop_id,
      itinerary_id: fromStop.itinerary_id,
      workspace_id: ctx.workspaceId,
      provider: "trainline",
      status: "booked",
      currency: parsed.value.currency ?? "GBP",
    })
    .select("id")
    .single();
  if (intentErr || !intent) return err(errors.notFound("booking_intent"));

  const { data: booking, error: bookingErr } = await supabase
    .from("travel_bookings")
    .insert({
      booking_intent_id: intent.id,
      workspace_id: ctx.workspaceId,
      provider: "trainline",
      booking_reference: parsed.value.booking_reference ?? null,
      ticket_status: "booked",
      actual_price: parsed.value.actual_price ?? null,
      currency: parsed.value.currency ?? "GBP",
      booked_at: new Date().toISOString(),
      departure_location_id: fromStop.location_id,
      arrival_location_id: arrivalLocationId,
      departure_at: first.departure_at,
      arrival_at: last.arrival_at,
      seat_reservation: parsed.value.seat_reservation ?? null,
    })
    .select("id")
    .single();
  if (bookingErr || !booking) return err(errors.notFound("travel_booking"));

  // 6. travel_booking_segments rows.
  const segmentRows = parsed.value.segments.map((s, i) => ({
    travel_booking_id: booking.id,
    workspace_id: ctx.workspaceId,
    sequence: i,
    from_location_name: s.from_location_name,
    to_location_name: s.to_location_name,
    departure_at: s.departure_at,
    arrival_at: s.arrival_at,
    train_number: s.train_number ?? null,
    platform_dep: s.platform_dep ?? null,
    platform_arr: s.platform_arr ?? null,
    notes: s.notes ?? null,
  }));
  await supabase.from("travel_booking_segments").insert(segmentRows);

  // 7. Locked transition for the booked train. computed_duration_minutes
  //    is taken from the booking timespan so the solver can treat the lock
  //    as a time anchor.
  const totalMinutes = Math.round(
    (new Date(last.arrival_at).getTime() -
      new Date(first.departure_at).getTime()) /
      60_000,
  );
  const { data: transition } = await supabase
    .from("transitions")
    .upsert(
      {
        itinerary_id: fromStop.itinerary_id,
        workspace_id: ctx.workspaceId,
        from_stop_id: parsed.value.from_stop_id,
        to_stop_id: arrivalStop.id,
        mode: "train",
        is_locked: true,
        start_time: first.departure_at,
        end_time: last.arrival_at,
        computed_duration_minutes: totalMinutes,
      },
      { onConflict: "from_stop_id,to_stop_id" },
    )
    .select("id")
    .single();

  // 7b. Mirror each booked segment as a journey_legs row so the editor's
  // sub-step UI renders the changeover detail (platforms appear in
  // instructions for now).
  if (transition?.id) {
    await supabase
      .from("journey_legs")
      .delete()
      .eq("transition_id", transition.id)
      .eq("workspace_id", ctx.workspaceId);
    const legRows = parsed.value.segments.map((s, i) => {
      const segMinutes = Math.round(
        (new Date(s.arrival_at).getTime() -
          new Date(s.departure_at).getTime()) /
          60_000,
      );
      const platformBits = [
        s.platform_dep ? `Plat ${s.platform_dep}` : null,
        s.platform_arr ? `→ Plat ${s.platform_arr}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        transition_id: transition.id,
        workspace_id: ctx.workspaceId,
        sequence: i,
        leg_type: "train" as const,
        start_location_name: s.from_location_name,
        end_location_name: s.to_location_name,
        start_time: s.departure_at,
        end_time: s.arrival_at,
        duration_minutes: segMinutes,
        service_number: s.train_number ?? null,
        platform: s.platform_dep ?? null,
        instructions: platformBits || null,
        booking_required: true,
      };
    });
    await supabase.from("journey_legs").insert(legRows);
  }

  await recordAudit({
    entityType: "travel_booking",
    entityId: booking.id,
    action: "create_train_booking",
    after: {
      booking_id: booking.id,
      arrival_stop_id: arrivalStop.id,
      segments: parsed.value.segments.length,
    },
  });

  await resolveItineraryTimes(fromStop.itinerary_id);

  return ok({
    arrival_stop_id: arrivalStop.id,
    travel_booking_id: booking.id,
  });
}

// ----------------------------------------------------------------------
// attachTransportBookingToStop
//
// Generic manual-booking flow for any non-rail mode (flight, taxi/cab,
// bus, tube, hire car). Mirrors the train booking flow but parameterised on
// the transport mode so the editor can capture every kind of ticket.
//
// Semantics by mode:
//   • flight  — service_number = flight code (e.g. "BA245"),
//               platform_dep   = departure terminal / gate,
//               platform_arr   = arrival terminal,
//               arrival stop placed at the destination airport.
//   • taxi    — service_number = booking ref, single segment.
//   • bus / tube — service_number = route name (e.g. "Bus 24").
//   • drive (rental) — service_number = hire ref, platform_dep/arr unused.
// ----------------------------------------------------------------------

const transportModeEnum = z.enum([
  "train",
  "flight",
  "taxi",
  "bus",
  "tube",
  "drive",
]);

const transportSegmentSchema = z.object({
  from_location_name: z.string().trim().min(1).max(200),
  to_location_name: z.string().trim().min(1).max(200),
  departure_at: z.string().datetime(),
  arrival_at: z.string().datetime(),
  service_number: z.string().trim().max(40).nullable().optional(),
  platform_dep: z.string().trim().max(40).nullable().optional(),
  platform_arr: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  from_station_code: z.string().trim().max(10).nullable().optional(),
  to_station_code: z.string().trim().max(10).nullable().optional(),
  operator: z.string().trim().max(200).nullable().optional(),
  ticket_type: z.string().trim().max(200).nullable().optional(),
  route_restriction: z.string().trim().max(200).nullable().optional(),
  coach: z.string().trim().max(20).nullable().optional(),
  seat: z.string().trim().max(20).nullable().optional(),
  barcode_ref: z.string().trim().max(40).nullable().optional(),
  barcode_data: z.string().max(500).nullable().optional(),
});

const attachTransportBookingSchema = z
  .object({
    from_stop_id: z.string().uuid(),
    mode: transportModeEnum,
    provider: z.string().trim().max(80).nullable().optional(),
    arrival_location_id: z.string().uuid().nullable().optional(),
    arrival_location_name: z.string().trim().max(200).nullable().optional(),
    arrival_location_type: z
      .enum(["station", "hotel", "office", "home", "parking", "other"])
      .optional(),
    booking_reference: z.string().trim().max(120).nullable().optional(),
    actual_price: z.number().nonnegative().nullable().optional(),
    currency: z.enum(["GBP", "EUR", "USD"]).optional(),
    seat_reservation: z.string().trim().max(120).nullable().optional(),
    // When the booking came from a Gmail import, stamp the source message id on
    // the departure stop so deleting the run can RELEASE the email (clear its
    // gmail_imported_messages row) — otherwise a deleted import can never be
    // re-scanned/re-imported.
    gmail_message_id: z.string().trim().max(200).nullable().optional(),
    segments: z.array(transportSegmentSchema).min(1),
  })
  .refine(
    (v) => v.arrival_location_id != null || v.arrival_location_name != null,
    {
      message: "Provide arrival_location_id or arrival_location_name",
      path: ["arrival_location_id"],
    },
  );

function legTypeForMode(mode: z.infer<typeof transportModeEnum>):
  | "walk"
  | "drive"
  | "train"
  | "bus"
  | "taxi" {
  switch (mode) {
    case "train":
    case "tube":
      return "train";
    case "flight":
      // No "flight" leg type in our enum — fall back to "bus" semantically
      // (transit-with-service-number) which the UI labels via mode anyway.
      return "bus";
    case "bus":
      return "bus";
    case "taxi":
      return "taxi";
    case "drive":
      return "drive";
  }
}

function expenseTypeForMode(mode: z.infer<typeof transportModeEnum>):
  | "rail_ticket"
  | "taxi"
  | "other" {
  switch (mode) {
    case "train":
    case "tube":
      return "rail_ticket";
    case "taxi":
      return "taxi";
    default:
      return "other";
  }
}

export async function attachTransportBookingToStop(
  input: z.input<typeof attachTransportBookingSchema>,
): Promise<Result<{ arrival_stop_id: string; travel_booking_id: string }>> {
  const parsed = parseInput(attachTransportBookingSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // 1. Verify origin stop ownership and pull its details.
  const { data: fromStop } = await supabase
    .from("stops")
    .select("id, itinerary_id, sequence, location_id")
    .eq("id", parsed.value.from_stop_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!fromStop) return err(errors.notFound("stop"));

  // 2. Resolve / create arrival location.
  let arrivalLocationId = parsed.value.arrival_location_id ?? null;
  if (!arrivalLocationId && parsed.value.arrival_location_name) {
    const { data: newLoc, error: locErr } = await supabase
      .from("locations")
      .insert({
        name: parsed.value.arrival_location_name,
        type: parsed.value.arrival_location_type ?? "other",
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
      })
      .select("id")
      .single();
    if (locErr || !newLoc) return err(errors.notFound("location"));
    arrivalLocationId = newLoc.id;
  }

  // 3. Shift later stops to make room.
  const newSeq = fromStop.sequence + 1;
  const { data: laterStops } = await supabase
    .from("stops")
    .select("id, sequence")
    .eq("itinerary_id", fromStop.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .gte("sequence", newSeq)
    .order("sequence", { ascending: false });
  for (const s of laterStops ?? []) {
    await supabase
      .from("stops")
      .update({ sequence: s.sequence + 1 })
      .eq("id", s.id)
      .eq("workspace_id", ctx.workspaceId);
  }

  const first = parsed.value.segments[0];
  const last = parsed.value.segments[parsed.value.segments.length - 1];

  // 4. Create the arrival stop pinned to the arrival time.
  const { data: arrivalStop, error: arrivalErr } = await supabase
    .from("stops")
    .insert({
      itinerary_id: fromStop.itinerary_id,
      workspace_id: ctx.workspaceId,
      sequence: newSeq,
      type: "transit_arrival",
      location_id: arrivalLocationId,
      start_time: last.arrival_at,
      end_time: last.arrival_at,
      is_time_fixed: true,
      metadata:
        parsed.value.mode === "flight"
          ? {
              flight_iata: first.service_number ?? null,
              mode: "flight",
            }
          : { mode: parsed.value.mode },
    })
    .select("id")
    .single();
  if (arrivalErr || !arrivalStop) return err(errors.notFound("stop"));

  // 5. booking_intent + travel_booking.
  const provider = parsed.value.provider ?? providerFromMode(parsed.value.mode);
  const { data: intent, error: intentErr } = await supabase
    .from("booking_intents")
    .insert({
      stop_id: parsed.value.from_stop_id,
      itinerary_id: fromStop.itinerary_id,
      workspace_id: ctx.workspaceId,
      provider,
      status: "booked",
      currency: parsed.value.currency ?? "GBP",
    })
    .select("id")
    .single();
  if (intentErr || !intent) return err(errors.notFound("booking_intent"));

  const { data: booking, error: bookingErr } = await supabase
    .from("travel_bookings")
    .insert({
      booking_intent_id: intent.id,
      workspace_id: ctx.workspaceId,
      provider,
      booking_reference: parsed.value.booking_reference ?? null,
      ticket_status: "booked",
      actual_price: parsed.value.actual_price ?? null,
      currency: parsed.value.currency ?? "GBP",
      booked_at: new Date().toISOString(),
      departure_location_id: fromStop.location_id,
      arrival_location_id: arrivalLocationId,
      departure_at: first.departure_at,
      arrival_at: last.arrival_at,
      seat_reservation: parsed.value.seat_reservation ?? null,
    })
    .select("id")
    .single();
  if (bookingErr || !booking) return err(errors.notFound("travel_booking"));

  // 6. Persist segments with all enriched fields from the Gmail parser.
  const segmentRows = parsed.value.segments.map((s, i) => ({
    travel_booking_id: booking.id,
    workspace_id: ctx.workspaceId,
    sequence: i,
    from_location_name: s.from_location_name,
    to_location_name: s.to_location_name,
    departure_at: s.departure_at,
    arrival_at: s.arrival_at,
    train_number: s.service_number ?? null,
    platform_dep: s.platform_dep ?? null,
    platform_arr: s.platform_arr ?? null,
    notes: s.notes ?? null,
    from_station_code: s.from_station_code ?? null,
    to_station_code: s.to_station_code ?? null,
    operator: s.operator ?? null,
    ticket_type: s.ticket_type ?? null,
    route_restriction: s.route_restriction ?? null,
    coach: s.coach ?? null,
    seat: s.seat ?? null,
    barcode_ref: s.barcode_ref ?? null,
    barcode_data: s.barcode_data ?? null,
  }));
  await supabase.from("travel_booking_segments").insert(segmentRows);

  // 6b. Enrich departure stop metadata so the planning page TrainTicketCard
  // can render operator, ticket type, barcode etc. without a separate query.
  await supabase
    .from("stops")
    .update({
      metadata: {
        kind: "transit_departure",
        transport_mode: parsed.value.mode,
        booking_reference: parsed.value.booking_reference,
        seat: parsed.value.seat_reservation,
        price: parsed.value.actual_price,
        operator: first.operator ?? null,
        ticket_type: first.ticket_type ?? null,
        route_restriction: first.route_restriction ?? null,
        barcode_ref: first.barcode_ref ?? null,
        barcode_data: first.barcode_data ?? null,
        gmail_message_id: parsed.value.gmail_message_id ?? null,
      },
    })
    .eq("id", parsed.value.from_stop_id)
    .eq("workspace_id", ctx.workspaceId);

  // 7. Locked transition.
  const totalMinutes = Math.round(
    (new Date(last.arrival_at).getTime() -
      new Date(first.departure_at).getTime()) /
      60_000,
  );
  const transitionMode: import("@/lib/types/domain").TransitionMode =
    parsed.value.mode;
  const { data: transition } = await supabase
    .from("transitions")
    .upsert(
      {
        itinerary_id: fromStop.itinerary_id,
        workspace_id: ctx.workspaceId,
        from_stop_id: parsed.value.from_stop_id,
        to_stop_id: arrivalStop.id,
        mode: transitionMode,
        is_locked: true,
        start_time: first.departure_at,
        end_time: last.arrival_at,
        computed_duration_minutes: totalMinutes,
      },
      { onConflict: "from_stop_id,to_stop_id" },
    )
    .select("id")
    .single();

  // 7b. Mirror each segment as a journey_leg.
  if (transition?.id) {
    await supabase
      .from("journey_legs")
      .delete()
      .eq("transition_id", transition.id)
      .eq("workspace_id", ctx.workspaceId);
    const legType = legTypeForMode(parsed.value.mode);
    const legRows = parsed.value.segments.map((s, i) => {
      const segMinutes = Math.round(
        (new Date(s.arrival_at).getTime() -
          new Date(s.departure_at).getTime()) /
          60_000,
      );
      const platformBits = [
        s.platform_dep ? platformLabel(parsed.value.mode, s.platform_dep, "dep") : null,
        s.platform_arr ? platformLabel(parsed.value.mode, s.platform_arr, "arr") : null,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        transition_id: transition.id,
        workspace_id: ctx.workspaceId,
        sequence: i,
        leg_type: legType,
        start_location_name: s.from_location_name,
        end_location_name: s.to_location_name,
        start_time: s.departure_at,
        end_time: s.arrival_at,
        duration_minutes: segMinutes,
        service_number: s.service_number ?? null,
        platform: s.platform_dep ?? null,
        instructions: platformBits || s.notes || null,
        booking_required: true,
      };
    });
    await supabase.from("journey_legs").insert(legRows);
  }

  await recordAudit({
    entityType: "travel_booking",
    entityId: booking.id,
    action: "create_transport_booking",
    after: {
      booking_id: booking.id,
      mode: parsed.value.mode,
      arrival_stop_id: arrivalStop.id,
      segments: parsed.value.segments.length,
    },
  });

  // Auto-create expense
  if (parsed.value.actual_price != null) {
    const { data: existing } = await supabase
      .from("expense_records")
      .select("id")
      .eq("itinerary_id", fromStop.itinerary_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("stop_id", parsed.value.from_stop_id)
      .eq("type", expenseTypeForMode(parsed.value.mode))
      .maybeSingle();
    if (!existing) {
      await supabase.from("expense_records").insert({
        itinerary_id: fromStop.itinerary_id,
        stop_id: parsed.value.from_stop_id,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        type: expenseTypeForMode(parsed.value.mode),
        amount: parsed.value.actual_price,
        currency: parsed.value.currency ?? "GBP",
        notes: parsed.value.booking_reference
          ? `${labelMode(parsed.value.mode)} · ref ${parsed.value.booking_reference}`
          : `${labelMode(parsed.value.mode)} booking`,
      });
    }
  }

  await resolveItineraryTimes(fromStop.itinerary_id);

  return ok({
    arrival_stop_id: arrivalStop.id,
    travel_booking_id: booking.id,
  });
}

function providerFromMode(mode: z.infer<typeof transportModeEnum>): string {
  switch (mode) {
    case "train":
      return "trainline";
    case "flight":
      return "airline";
    case "taxi":
      return "taxi";
    case "bus":
      return "bus";
    case "tube":
      return "tfl";
    case "drive":
      return "car-hire";
  }
}

function labelMode(mode: z.infer<typeof transportModeEnum>): string {
  switch (mode) {
    case "train":
      return "Train";
    case "flight":
      return "Flight";
    case "taxi":
      return "Taxi";
    case "bus":
      return "Bus";
    case "tube":
      return "Tube";
    case "drive":
      return "Car hire";
  }
}

function platformLabel(
  mode: z.infer<typeof transportModeEnum>,
  value: string,
  side: "dep" | "arr",
): string {
  switch (mode) {
    case "flight":
      return side === "dep" ? `Dep T${value}` : `Arr T${value}`;
    case "train":
    case "tube":
      return side === "dep" ? `Plat ${value}` : `→ Plat ${value}`;
    case "bus":
      return side === "dep" ? `Stop ${value}` : `→ Stop ${value}`;
    default:
      return side === "dep" ? `From ${value}` : `→ ${value}`;
  }
}

// ----------------------------------------------------------------------
// attachAccommodationBooking
//
// Books a hotel/stay onto an existing accommodation stop (or creates one
// after the current stop). Unlike transport, this doesn't create a
// transition — it just enriches a stop with a booking_intent + travel_booking
// record carrying provider/ref/price/check-in window and an expense entry.
// ----------------------------------------------------------------------

const attachAccommodationSchema = z.object({
  // Either attach to an existing accommodation stop…
  stop_id: z.string().uuid().nullable().optional(),
  // …or create one after the given stop.
  after_stop_id: z.string().uuid().nullable().optional(),
  hotel_location_id: z.string().uuid().nullable().optional(),
  hotel_name: z.string().trim().max(200).nullable().optional(),
  check_in: z.string().datetime(),
  check_out: z.string().datetime(),
  provider: z.string().trim().max(80).nullable().optional(),
  booking_reference: z.string().trim().max(120).nullable().optional(),
  actual_price: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).optional(),
  room_details: z.string().trim().max(200).nullable().optional(),
});

export async function attachAccommodationBooking(
  input: z.input<typeof attachAccommodationSchema>,
): Promise<Result<{ stop_id: string; travel_booking_id: string }>> {
  const parsed = parseInput(attachAccommodationSchema, input);
  if (!parsed.ok) return parsed;
  if (!parsed.value.stop_id && !parsed.value.after_stop_id) {
    return err(
      errors.validation("Provide either stop_id or after_stop_id", {
        stop_id: ["required"],
      }),
    );
  }

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Resolve the target accommodation stop.
  let stopId: string;
  let itineraryId: string;
  if (parsed.value.stop_id) {
    const { data: stop } = await supabase
      .from("stops")
      .select("id, itinerary_id")
      .eq("id", parsed.value.stop_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!stop) return err(errors.notFound("stop"));
    stopId = stop.id;
    itineraryId = stop.itinerary_id;

    // Update times + location on the existing stop.
    await supabase
      .from("stops")
      .update({
        type: "accommodation",
        start_time: parsed.value.check_in,
        end_time: parsed.value.check_out,
        is_time_fixed: true,
        title: parsed.value.hotel_name ?? null,
        location_id:
          parsed.value.hotel_location_id ?? undefined,
      })
      .eq("id", stopId)
      .eq("workspace_id", ctx.workspaceId);
  } else {
    const { data: afterStop } = await supabase
      .from("stops")
      .select("id, itinerary_id, sequence")
      .eq("id", parsed.value.after_stop_id!)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!afterStop) return err(errors.notFound("stop"));
    itineraryId = afterStop.itinerary_id;
    const newSeq = afterStop.sequence + 1;
    const { data: laterStops } = await supabase
      .from("stops")
      .select("id, sequence")
      .eq("itinerary_id", afterStop.itinerary_id)
      .eq("workspace_id", ctx.workspaceId)
      .gte("sequence", newSeq)
      .order("sequence", { ascending: false });
    for (const s of laterStops ?? []) {
      await supabase
        .from("stops")
        .update({ sequence: s.sequence + 1 })
        .eq("id", s.id)
        .eq("workspace_id", ctx.workspaceId);
    }
    const { data: created, error: createErr } = await supabase
      .from("stops")
      .insert({
        itinerary_id: afterStop.itinerary_id,
        workspace_id: ctx.workspaceId,
        sequence: newSeq,
        type: "accommodation",
        title: parsed.value.hotel_name ?? null,
        location_id: parsed.value.hotel_location_id ?? null,
        start_time: parsed.value.check_in,
        end_time: parsed.value.check_out,
        is_time_fixed: true,
      })
      .select("id")
      .single();
    if (createErr || !created) return err(errors.notFound("stop"));
    stopId = created.id;
  }

  // booking_intent + travel_booking
  const provider = parsed.value.provider ?? "hotel";
  const { data: intent, error: intentErr } = await supabase
    .from("booking_intents")
    .insert({
      stop_id: stopId,
      itinerary_id: itineraryId,
      workspace_id: ctx.workspaceId,
      provider,
      status: "booked",
      currency: parsed.value.currency ?? "GBP",
    })
    .select("id")
    .single();
  if (intentErr || !intent) return err(errors.notFound("booking_intent"));

  const { data: booking, error: bookingErr } = await supabase
    .from("travel_bookings")
    .insert({
      booking_intent_id: intent.id,
      workspace_id: ctx.workspaceId,
      provider,
      booking_reference: parsed.value.booking_reference ?? null,
      ticket_status: "booked",
      actual_price: parsed.value.actual_price ?? null,
      currency: parsed.value.currency ?? "GBP",
      booked_at: new Date().toISOString(),
      departure_at: parsed.value.check_in,
      arrival_at: parsed.value.check_out,
      seat_reservation: parsed.value.room_details ?? null,
    })
    .select("id")
    .single();
  if (bookingErr || !booking) return err(errors.notFound("travel_booking"));

  if (parsed.value.actual_price != null) {
    const { data: existing } = await supabase
      .from("expense_records")
      .select("id")
      .eq("itinerary_id", itineraryId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("stop_id", stopId)
      .eq("type", "hotel")
      .maybeSingle();
    if (!existing) {
      await supabase.from("expense_records").insert({
        itinerary_id: itineraryId,
        stop_id: stopId,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        type: "hotel",
        amount: parsed.value.actual_price,
        currency: parsed.value.currency ?? "GBP",
        notes: parsed.value.booking_reference
          ? `Hotel · ref ${parsed.value.booking_reference}`
          : "Hotel booking",
      });
    }
  }

  await recordAudit({
    entityType: "travel_booking",
    entityId: booking.id,
    action: "create_accommodation_booking",
    after: { booking_id: booking.id, stop_id: stopId },
  });

  await resolveItineraryTimes(itineraryId);

  return ok({ stop_id: stopId, travel_booking_id: booking.id });
}

export async function recordTravelBooking(
  input: z.input<typeof recordTravelBookingSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(recordTravelBookingSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: intent } = await supabase
    .from("booking_intents")
    .select("id, workspace_id, itinerary_id, stop_id")
    .eq("id", parsed.value.booking_intent_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!intent) {
    return { ok: false, error: { kind: "not_found", entity: "booking_intent" } };
  }

  const { data, error } = await supabase
    .from("travel_bookings")
    .insert({
      ...parsed.value,
      workspace_id: ctx.workspaceId,
      booked_at: new Date().toISOString(),
      ticket_status: parsed.value.ticket_status ?? "booked",
    })
    .select("id")
    .single();

  const result = dbResult<{ id: string }>(data, error, "travel_booking");
  if (result.ok) {
    await recordAudit({
      entityType: "travel_booking",
      entityId: result.value.id,
      action: "create",
      after: { ...parsed.value, id: result.value.id },
    });

    // Auto-create the rail-ticket expense if one doesn't already exist for
    // this itinerary. Actual price beats the pre-booking estimate.
    if (parsed.value.actual_price != null && intent.itinerary_id) {
      const { data: existing } = await supabase
        .from("expense_records")
        .select("id")
        .eq("itinerary_id", intent.itinerary_id)
        .eq("workspace_id", ctx.workspaceId)
        .eq("type", "rail_ticket")
        .maybeSingle();
      if (!existing) {
        await supabase.from("expense_records").insert({
          itinerary_id: intent.itinerary_id,
          stop_id: intent.stop_id,
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          type: "rail_ticket",
          amount: parsed.value.actual_price,
          currency: parsed.value.currency ?? "GBP",
          notes: parsed.value.booking_reference
            ? `Booking ref: ${parsed.value.booking_reference}`
            : "Auto-generated from rail booking.",
        });
      }
    }
  }
  return result;
}
