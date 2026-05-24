"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { transitionItinerary } from "@/lib/state/transitions";
import { solveTimes } from "@/lib/itinerary/solver";
import { ok, type Result } from "@/lib/errors";
import type { ItineraryStatus } from "@/lib/types/domain";

const createSchema = z
  .object({
    title: z.string().trim().max(200).optional().nullable(),
    date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .transform((v) => ({ ...v, date_end: v.date_end ?? v.date_start }))
  .refine((v) => v.date_end >= v.date_start, {
    message: "End date must be on or after start date",
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200).nullable().optional(),
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export type Itinerary = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string | null;
  date_start: string;
  date_end: string;
  status: ItineraryStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createItinerary(
  input: z.input<typeof createSchema>,
): Promise<Result<Itinerary>> {
  const parsed = parseInput(createSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("itineraries")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      title: parsed.value.title ?? null,
      date_start: parsed.value.date_start,
      date_end: parsed.value.date_end,
      notes: parsed.value.notes ?? null,
    })
    .select("*")
    .single();

  const result = dbResult<Itinerary>(data, error, "itinerary");
  if (result.ok) {
    await recordAudit({
      entityType: "itinerary",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateItinerary(
  input: z.input<typeof updateSchema>,
): Promise<Result<Itinerary>> {
  const parsed = parseInput(updateSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("itineraries")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  const { data, error } = await supabase
    .from("itineraries")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<Itinerary>(data, error, "itinerary");
  if (result.ok) {
    await recordAudit({
      entityType: "itinerary",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// createItineraryFromBrief — the "anchor your day" intake.
//
// The brief is a stack of anchor cards. Each anchor is a place that
// fixes a moment in the trip: an appointment, a hotel stay, a station
// to catch. The user adds + above or below any card; order doesn't
// matter on input — we sort chronologically before inserting.
//
// Each anchor's "kind" drives which stop type it becomes and which
// time fields it carries:
//
//   • hotel        → accommodation stop, check-in + check-out times
//   • appointment  → appointment stop, start_time + duration_minutes
//   • station      → appointment stop (short), arrive-by only
//
// We also seed a "start" stop from the travel-profile home (when set)
// so the editor opens with the spine in place. date_start/date_end on
// the itinerary span the full anchor range, including hotel checkouts.
// ─────────────────────────────────────────────────────────────────────

// The brief now understands five kinds, each with its own sub-roles:
//   • appointment — meeting / site visit / generic stop (no roles)
//   • stay        — check_in (new stay) | return_to_room (revisit)
//   • meal        — breakfast / lunch / dinner / drinks
//   • event       — session / show / concert
//   • station     — train / flight / bus
//
// Stop-type mapping on insert:
//   stay+check_in       → accommodation (locked check-in/out window)
//   stay+return_to_room → appointment   (short stop at the hotel, no window)
//   meal                → meal
//   event               → event
//   station             → appointment   (we don't model the catch as transit
//                                         yet — it's an arrive-by anchor)
//   appointment         → appointment
//
// Each anchor's role is persisted in stop.metadata as { role: "..." } so
// the editor can render the sub-badge.
const anchorKindEnum = z.enum([
  "appointment",
  "stay",
  "meal",
  "event",
  "station",
]);

const anchorInputSchema = z
  .object({
    // Stable identifier the client uses so transitions can refer to a
    // specific pair of anchors by uid even after server-side sorting.
    client_id: z.string().min(1).max(80).optional(),

    kind: anchorKindEnum,
    role: z.string().trim().max(40).nullable().optional(),

    location_id: z.string().uuid().nullable().optional(),
    customer_id: z.string().uuid().nullable().optional(),
    customer_site_id: z.string().uuid().nullable().optional(),
    label: z.string().trim().max(200).nullable().optional(),

    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    // ── Timing model ───────────────────────────────────────────────
    // arrive_by  — you know when to be there. start_time = time.
    // leave_by   — you know when you need to leave (catch a train,
    //              make the next thing). end_time = time, start_time =
    //              time − duration.
    // around_then — duration only, no fixed time. The editor solver
    //              fits the stop between the adjacent fixed anchors.
    //              start/end times are written null and is_time_fixed
    //              is set to false.
    timing_mode: z
      .enum(["arrive_by", "leave_by", "around_then"])
      .default("arrive_by"),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),

    duration_minutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .nullable()
      .optional(),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),

    // Stay (check_in) only.
    check_out_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    check_out_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),

    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (v) => v.timing_mode === "around_then" || v.time != null,
    {
      message: "Pinned anchors need a time",
      path: ["time"],
    },
  )
  .refine(
    (v) =>
      v.location_id != null ||
      v.customer_site_id != null ||
      v.customer_id != null ||
      v.label != null,
    {
      message: "Each anchor needs a place",
      path: ["location_id"],
    },
  );

// ─────────────────────────────────────────────────────────────────────
// Transition input
//
// The brief can now optionally specify, for any adjacent pair of
// anchors (by client_id), the user's intended travel mode + an
// optional pre-booked ticket. The editor's transition table is
// populated up-front so it opens with intent, not a blank canvas.
// ─────────────────────────────────────────────────────────────────────

const transitionModeEnum = z.enum([
  "auto",
  "walk",
  "drive",
  "taxi",
  "bus",
  "tube",
  "train",
  "flight",
  "mixed",
]);

const briefBookingSchema = z.object({
  provider: z.string().trim().max(80).nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
  service_number: z.string().trim().max(40).nullable().optional(),
  depart_time: z.string().regex(/^\d{2}:\d{2}$/),
  arrive_time: z.string().regex(/^\d{2}:\d{2}$/),
  // depart_date / arrive_date default to the from / to anchor's date.
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  arrive_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  seat: z.string().trim().max(120).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).optional(),
});

// Local-connection mode for station-/airport-based primary modes —
// how the user reaches the terminal at either end. The brief stores
// this so the editor can stitch journey_legs (walk → train → walk).
const localModeEnum = z.enum(["auto", "walk", "drive", "taxi"]);

const briefTransitionSchema = z.object({
  from_client_id: z.string().min(1).max(80),
  to_client_id: z.string().min(1).max(80),
  mode: transitionModeEnum,
  // Two-sided local connection for station-/airport-based modes:
  //   local_before — origin → departure terminal
  //   local_after  — arrival terminal → destination
  local_before: localModeEnum.nullable().optional(),
  local_after: localModeEnum.nullable().optional(),
  // Pre-booked ticket — when present we'll also write a booking_intent +
  // travel_booking and lock the transition's start/end to the ticket.
  booking: briefBookingSchema.nullable().optional(),
});

// A stopover is an *intent* to drop in somewhere between two anchors —
// it has no fixed time, only an ideal duration. The place reference
// mirrors the anchor schema (one of location_id / customer_site_id /
// customer_id, with a free-text label fallback that creates an
// ephemeral location row).
const briefStopoverSchema = z.object({
  from_client_id: z.string().min(1).max(80),
  to_client_id: z.string().min(1).max(80),
  location_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  customer_site_id: z.string().uuid().nullable().optional(),
  label: z.string().trim().max(200).nullable().optional(),
  duration_minutes: z.number().int().positive().max(24 * 60).default(30),
});

const briefTransportBookingSchema = z.object({
  mode: z.enum(["train", "flight", "taxi", "bus", "tube", "drive"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  departure_hub_id: z.string().uuid().nullable().optional(),
  departure_label: z.string().nullable().optional(),
  destination_hub_id: z.string().uuid().nullable().optional(),
  destination_label: z.string().nullable().optional(),
  depart_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  arrive_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  service_number: z.string().max(100).nullable().optional(),
  reference: z.string().max(200).nullable().optional(),
  seat: z.string().max(200).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
});

const briefAccommodationBookingSchema = z.object({
  hotel_location_id: z.string().uuid().nullable().optional(),
  hotel_label: z.string().max(200).nullable().optional(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/).default("15:00"),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/).default("11:00"),
  provider: z.string().max(200).nullable().optional(),
  reference: z.string().max(200).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  room: z.string().max(400).nullable().optional(),
});

const briefSchema = z.object({
  anchors: z.array(anchorInputSchema).min(1),
  transitions: z.array(briefTransitionSchema).optional().default([]),
  stopovers: z.array(briefStopoverSchema).optional().default([]),
  title: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  timezone: z.string().min(1).max(80),
  base_location_id: z.string().uuid().nullable().optional(),
  be_home_by: z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) })
    .nullable()
    .optional(),
  transport_bookings: z.array(briefTransportBookingSchema).optional().default([]),
  accommodation_bookings: z.array(briefAccommodationBookingSchema).optional().default([]),
});

type BriefTransitionInput = z.infer<typeof briefTransitionSchema>;
type BriefStopoverInput = z.infer<typeof briefStopoverSchema>;

type AnchorInput = z.infer<typeof anchorInputSchema>;

export async function createItineraryFromBrief(
  input: z.input<typeof briefSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(briefSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();
  const tz = parsed.value.timezone;

  type Resolved = {
    anchor: AnchorInput;
    locationId: string | null;
    customerId: string | null;
    customerSiteId: string | null;
    label: string | null;
  };
  const resolved: Resolved[] = [];

  for (const a of parsed.value.anchors) {
    let locationId = a.location_id ?? null;
    let label = a.label ?? null;

    if (!locationId && a.customer_site_id) {
      const { data: site } = await supabase
        .from("customer_sites")
        .select("name, address")
        .eq("id", a.customer_site_id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (site) label = label ?? site.name ?? site.address;
    }

    if (!locationId && !a.customer_site_id && label) {
      const typeForLocation =
        a.kind === "stay" ? "hotel" : a.kind === "station" ? "station" : "other";
      const { data: newLoc } = await supabase
        .from("locations")
        .insert({
          name: label,
          type: typeForLocation,
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
        })
        .select("id, name")
        .single();
      if (newLoc) {
        locationId = newLoc.id;
        label = newLoc.name;
      }
    }

    resolved.push({
      anchor: a,
      locationId,
      customerId: a.customer_id ?? null,
      customerSiteId: a.customer_site_id ?? null,
      label,
    });
  }

  // Sort by date + a sort key per anchor: pinned anchors use their time;
  // around-then anchors fall to the end of the day they were assigned to
  // (the editor solver will pull them into the right slot via duration +
  // adjacent fixed times). For sort purposes we use "23:59" so the
  // chronological order on input still feels right.
  resolved.sort((a, b) => {
    const aKey = `${a.anchor.date}T${sortKey(a.anchor)}`;
    const bKey = `${b.anchor.date}T${sortKey(b.anchor)}`;
    return aKey.localeCompare(bKey);
  });

  const allDates = new Set<string>();
  for (const r of resolved) {
    allDates.add(r.anchor.date);
    if (r.anchor.check_out_date) allDates.add(r.anchor.check_out_date);
  }
  const sortedDates = [...allDates].sort();
  const dateStart = sortedDates[0];
  const dateEnd = sortedDates[sortedDates.length - 1];

  let resolvedTitle = parsed.value.title ?? null;
  if (!resolvedTitle) {
    const lead =
      resolved.find((r) => r.anchor.kind !== "stay") ?? resolved[0];
    if (lead?.customerId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("name")
        .eq("id", lead.customerId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      resolvedTitle = cust?.name ?? lead.label;
    } else {
      resolvedTitle = lead?.label ?? null;
    }
  }

  const { data: itinerary, error: itinErr } = await supabase
    .from("itineraries")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      title: resolvedTitle,
      date_start: dateStart,
      date_end: dateEnd,
      notes: parsed.value.notes ?? null,
      // Brief submit lands in 'planning' — the brief IS the draft.
      // Migration 0013 also set this as the column default, but we
      // pass it explicitly so the intent stays visible at the call
      // site and doesn't depend on the column default being correct.
      status: "planning",
    })
    .select("*")
    .single();
  if (itinErr || !itinerary) {
    return dbResult<{ id: string }>(null, itinErr, "itinerary");
  }

  await recordAudit({
    entityType: "itinerary",
    entityId: itinerary.id,
    action: "create",
    after: itinerary,
  });

  // Use the explicit base_location_id from the brief when provided;
  // fall back to the travel profile for backward compat.
  let homeId = parsed.value.base_location_id ?? null;
  if (!homeId) {
    const { data: profile } = await supabase
      .from("travel_profiles")
      .select(
        "default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id",
      )
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    homeId =
      profile?.default_drive_origin_location_id ??
      profile?.default_rail_origin_location_id ??
      profile?.default_return_location_id ??
      null;
  }

  type StopType =
    | "start"
    | "accommodation"
    | "appointment"
    | "meal"
    | "event";
  const stopRows: Array<{
    sequence: number;
    type: StopType;
    location_id: string | null;
    customer_id: string | null;
    customer_site_id: string | null;
    title: string | null;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    is_time_fixed: boolean;
    notes: string | null;
    metadata: Record<string, unknown> | null;
    itinerary_id: string;
    workspace_id: string;
  }> = [];

  // Per-stop client_id sidecar — used to map back to anchor uids after
  // the insert so we can wire transitions onto the right stop ids.
  const clientIdBySeq = new Map<number, string>();

  // Sentinel client_id the brief uses for transitions that originate
  // at the implicit home stop. Kept in lockstep with HOME_UID on the
  // client.
  const HOME_CLIENT_ID = "__khonsera_home__";

  let seq = 0;
  if (homeId) {
    clientIdBySeq.set(seq, HOME_CLIENT_ID);
    stopRows.push({
      sequence: seq++,
      type: "start",
      location_id: homeId,
      customer_id: null,
      customer_site_id: null,
      title: null,
      start_time: null,
      end_time: null,
      duration_minutes: null,
      is_time_fixed: false,
      notes: null,
      metadata: null,
      itinerary_id: itinerary.id,
      workspace_id: ctx.workspaceId,
    });
  }

  for (const r of resolved) {
    const a = r.anchor;
    const isCheckIn = a.kind === "stay" && a.role !== "return_to_room";

    if (isCheckIn) {
      // Lock the check-in/out window. Hotel check-in is always arrive-by:
      // the time the user gives IS the moment the day swings to "checked
      // in". (Hotels don't have around_then or leave_by modes for the
      // anchor itself — the room's available window is a window.)
      const checkInTime = a.time ?? "15:00";
      const ci = isoFromLocal(a.date, checkInTime, tz);
      const co = isoFromLocal(
        a.check_out_date ?? a.date,
        a.check_out_time ?? "11:00",
        tz,
      );
      if (a.client_id) clientIdBySeq.set(seq, a.client_id);
      stopRows.push({
        sequence: seq++,
        type: "accommodation",
        location_id: r.locationId,
        customer_id: r.customerId,
        customer_site_id: r.customerSiteId,
        title: r.label,
        start_time: ci,
        end_time: co,
        duration_minutes: null,
        is_time_fixed: true,
        notes: a.notes ?? null,
        metadata: { kind: "stay", role: a.role ?? "check_in" },
        itinerary_id: itinerary.id,
        workspace_id: ctx.workspaceId,
      });
      continue;
    }

    // Everything else picks a pinning side based on timing_mode.
    const dur =
      a.duration_minutes ??
      (a.time && a.end_time
        ? minutesBetweenLocal(a.time, a.end_time)
        : null) ??
      defaultDurationForKind(a.kind, a.role);

    const stopType: StopType =
      a.kind === "meal"
        ? "meal"
        : a.kind === "event"
          ? "event"
          : "appointment";

    let startIso: string | null;
    let endIso: string | null;
    let isFixed = true;

    if (a.timing_mode === "around_then") {
      // Solver-resolved: no pinned times, just a duration. The editor
      // will fit this between adjacent fixed anchors based on travel.
      startIso = null;
      endIso = null;
      isFixed = false;
    } else if (a.timing_mode === "leave_by" && a.time) {
      // Pin at the back end — user knows when they need to leave.
      endIso = isoFromLocal(a.date, a.time, tz);
      startIso = addMinutesIso(endIso, -dur);
    } else {
      // arrive_by — the original behaviour and our default.
      startIso = isoFromLocal(a.date, a.time ?? "09:00", tz);
      endIso = addMinutesIso(startIso, dur);
    }

    if (a.client_id) clientIdBySeq.set(seq, a.client_id);
    stopRows.push({
      sequence: seq++,
      type: stopType,
      location_id: r.locationId,
      customer_id: r.customerId,
      customer_site_id: r.customerSiteId,
      title:
        a.kind === "stay" && a.role === "return_to_room"
          ? `Back at ${r.label ?? "the hotel"}`
          : r.label,
      start_time: startIso,
      end_time: endIso,
      duration_minutes: dur,
      is_time_fixed: isFixed,
      notes: a.notes ?? null,
      metadata: {
        kind: a.kind,
        role: a.role ?? null,
        timing_mode: a.timing_mode,
      },
      itinerary_id: itinerary.id,
      workspace_id: ctx.workspaceId,
    });
  }

  // Transport bookings → departure + arrival stops with a locked
  // transition between them. The booking data is stored in metadata
  // so the planning page can display it.
  for (const tb of parsed.value.transport_bookings) {
    const dateForBooking =
      tb.date ?? parsed.value.anchors[0]?.date ?? new Date().toISOString().slice(0, 10);
    const departIso = tb.depart_time
      ? isoFromLocal(dateForBooking, tb.depart_time, tz)
      : null;
    const arriveIso = tb.arrive_time
      ? isoFromLocal(dateForBooking, tb.arrive_time, tz)
      : null;

    stopRows.push({
      sequence: seq++,
      type: "appointment",
      location_id: null,
      customer_id: null,
      customer_site_id: null,
      title: tb.departure_label ?? `${tb.mode} departure`,
      start_time: departIso,
      end_time: departIso,
      duration_minutes: 0,
      is_time_fixed: !!departIso,
      notes: null,
      metadata: {
        kind: "transit_departure",
        transport_mode: tb.mode,
        service_number: tb.service_number,
        booking_reference: tb.reference,
        seat: tb.seat,
        price: tb.price,
        departure_hub_id: tb.departure_hub_id,
        destination_hub_id: tb.destination_hub_id,
      },
      itinerary_id: itinerary.id,
      workspace_id: ctx.workspaceId,
    });

    stopRows.push({
      sequence: seq++,
      type: "appointment",
      location_id: null,
      customer_id: null,
      customer_site_id: null,
      title: tb.destination_label ?? `${tb.mode} arrival`,
      start_time: arriveIso,
      end_time: arriveIso,
      duration_minutes: 0,
      is_time_fixed: !!arriveIso,
      notes: null,
      metadata: {
        kind: "transit_arrival",
        transport_mode: tb.mode,
        service_number: tb.service_number,
        destination_hub_id: tb.destination_hub_id,
      },
      itinerary_id: itinerary.id,
      workspace_id: ctx.workspaceId,
    });
  }

  // Accommodation bookings → stored as reference data. The planning
  // page surfaces check-in/check-out as constraints, not fixed stops.
  // The user places hotel stops on the timeline as needed.
  for (const ab of parsed.value.accommodation_bookings) {
    if (!ab.check_in_date) continue;
    const ciIso = isoFromLocal(
      ab.check_in_date,
      ab.check_in_time ?? "15:00",
      tz,
    );
    const coIso = ab.check_out_date
      ? isoFromLocal(
          ab.check_out_date,
          ab.check_out_time ?? "11:00",
          tz,
        )
      : null;
    stopRows.push({
      sequence: seq++,
      type: "accommodation",
      location_id: ab.hotel_location_id ?? null,
      customer_id: null,
      customer_site_id: null,
      title: ab.hotel_label ?? "Hotel",
      start_time: ciIso,
      end_time: coIso,
      duration_minutes: null,
      is_time_fixed: false,
      notes: null,
      metadata: {
        kind: "accommodation_booking",
        provider: ab.provider,
        booking_reference: ab.reference,
        price: ab.price,
        room: ab.room,
        check_in_from: ab.check_in_time ?? "15:00",
        check_out_by: ab.check_out_time ?? "11:00",
      },
      itinerary_id: itinerary.id,
      workspace_id: ctx.workspaceId,
    });
  }

  // "Be home by" constraint → an end stop at the base location.
  if (parsed.value.be_home_by && homeId) {
    const bhb = parsed.value.be_home_by;
    const endTime = isoFromLocal(bhb.date, bhb.time, tz);
    stopRows.push({
      sequence: seq++,
      type: "start",
      location_id: homeId,
      customer_id: null,
      customer_site_id: null,
      title: null,
      start_time: endTime,
      end_time: null,
      duration_minutes: null,
      is_time_fixed: true,
      notes: null,
      metadata: { kind: "be_home_by" },
      itinerary_id: itinerary.id,
      workspace_id: ctx.workspaceId,
    });
  }

  if (stopRows.length > 0) {
    await supabase.from("stops").insert(stopRows);
  }

  // ── Resolve client_id → stop_id ─────────────────────────────────
  // Built once now so the stopovers block and the transitions block
  // can share the same lookup. Stopovers add themselves to this map
  // as they get inserted, which is how the leg transitions
  // (anchor → stopover, stopover → anchor) eventually resolve their
  // synthetic svUid sentinels to real stop ids.
  const stopByClientId = new Map<
    string,
    { id: string; sequence: number; locationId: string | null }
  >();
  {
    const { data: insertedStops } = await supabase
      .from("stops")
      .select("id, sequence, location_id")
      .eq("itinerary_id", itinerary.id)
      .eq("workspace_id", ctx.workspaceId)
      .order("sequence");
    for (const s of insertedStops ?? []) {
      const cid = clientIdBySeq.get(s.sequence);
      if (cid)
        stopByClientId.set(cid, {
          id: s.id as string,
          sequence: s.sequence as number,
          locationId: (s.location_id as string | null) ?? null,
        });
    }
  }

  // ── Stopovers — insert as real stops between their anchor pair ───
  // Each stopover becomes a stops row with type='stopover' positioned
  // between its from_stop and to_stop. Bumping later sequences makes
  // room for the new row; the synthetic svUid sentinel that the
  // client used to key its leg transitions (sv::{fromUid}::{toUid})
  // is wired to the new stop_id so transitions can resolve it.
  for (const sv of parsed.value.stopovers) {
    const fromStop = stopByClientId.get(sv.from_client_id);
    const toStop = stopByClientId.get(sv.to_client_id);
    if (!fromStop || !toStop) continue;
    if (!sv.location_id && !sv.customer_site_id && !sv.customer_id && !sv.label) {
      continue;
    }

    let locationId = sv.location_id ?? null;
    let label = sv.label ?? null;
    if (!locationId && sv.customer_site_id) {
      const { data: site } = await supabase
        .from("customer_sites")
        .select("name, address")
        .eq("id", sv.customer_site_id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (site) label = label ?? site.name ?? site.address;
    }
    if (!locationId && !sv.customer_site_id && label) {
      const { data: newLoc } = await supabase
        .from("locations")
        .insert({
          name: label,
          type: "other",
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
        })
        .select("id, name")
        .single();
      if (newLoc) {
        locationId = newLoc.id;
        label = newLoc.name;
      }
    }

    // Bump downstream sequences to open a slot at toStop.sequence.
    // We have to re-read toStop's current sequence each time because
    // a previous stopover in this loop may have shifted it already.
    const { data: currentToStop } = await supabase
      .from("stops")
      .select("sequence")
      .eq("id", toStop.id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    const toSeq = currentToStop?.sequence ?? toStop.sequence;

    // Shift down. Postgres has no built-in array shift, so we
    // re-number explicitly. RLS-safe: same workspace_id filter as
    // every other write.
    const { data: shiftRows } = await supabase
      .from("stops")
      .select("id, sequence")
      .eq("itinerary_id", itinerary.id)
      .eq("workspace_id", ctx.workspaceId)
      .gte("sequence", toSeq)
      .order("sequence", { ascending: false });
    for (const r of shiftRows ?? []) {
      await supabase
        .from("stops")
        .update({ sequence: (r.sequence as number) + 1 })
        .eq("id", r.id as string)
        .eq("workspace_id", ctx.workspaceId);
    }

    const { data: newStop } = await supabase
      .from("stops")
      .insert({
        itinerary_id: itinerary.id,
        workspace_id: ctx.workspaceId,
        sequence: toSeq,
        type: "stopover",
        title: label,
        location_id: locationId,
        customer_id: sv.customer_id ?? null,
        customer_site_id: sv.customer_site_id ?? null,
        duration_minutes: sv.duration_minutes,
        is_time_fixed: false,
        metadata: { kind: "stopover" },
      })
      .select("id, sequence, location_id")
      .single();

    if (newStop) {
      const svUid = `sv::${sv.from_client_id}::${sv.to_client_id}`;
      stopByClientId.set(svUid, {
        id: newStop.id as string,
        sequence: newStop.sequence as number,
        locationId: (newStop.location_id as string | null) ?? null,
      });
      // Refresh the toStop entry too — its sequence got bumped.
      stopByClientId.set(sv.to_client_id, {
        ...toStop,
        sequence: (newStop.sequence as number) + 1,
      });
    }
  }

  // ── Transitions + pre-booked tickets ────────────────────────────
  // The brief can tell us, for any adjacent pair of anchors (by their
  // client_ids), what travel mode the user intends and — optionally —
  // the details of a ticket they've already got. Run after stopovers
  // so leg-transition svUids resolve to real stop rows.
  if (parsed.value.transitions.length > 0) {
    for (const t of parsed.value.transitions) {
      const from = stopByClientId.get(t.from_client_id);
      const to = stopByClientId.get(t.to_client_id);
      // The brief might send a transition whose anchors no longer sit
      // adjacent after sorting — drop those silently rather than
      // producing a nonsensical row.
      if (!from || !to || from.sequence + 1 !== to.sequence) continue;

      const isBooked = t.booking != null;
      const mode = t.mode === "auto" ? null : t.mode;

      // When the user has nothing to say (mode=auto, no booking), skip
      // — the editor's solver will compute the transition itself.
      if (!mode && !isBooked) continue;

      const fromAnchor = parsed.value.anchors.find(
        (a) => a.client_id === t.from_client_id,
      );
      const toAnchor = parsed.value.anchors.find(
        (a) => a.client_id === t.to_client_id,
      );

      let startIso: string | null = null;
      let endIso: string | null = null;
      let durationMins: number | null = null;
      if (isBooked && t.booking && fromAnchor && toAnchor) {
        const dDate = t.booking.depart_date ?? fromAnchor.date;
        const aDate = t.booking.arrive_date ?? toAnchor.date;
        startIso = isoFromLocal(dDate, t.booking.depart_time, tz);
        endIso = isoFromLocal(aDate, t.booking.arrive_time, tz);
        durationMins = Math.round(
          (new Date(endIso).getTime() - new Date(startIso).getTime()) /
            60_000,
        );
      }

      // For station-based modes we record the user's local-connection
      // preferences (one per side) so the editor can stitch journey_legs
      // (e.g. drive → train → walk) without re-asking. Encoded as a
      // structured marker in transitions.notes — easy for the editor to
      // parse, harmless to a human reader.
      const stationBased =
        mode === "train" ||
        mode === "tube" ||
        mode === "bus" ||
        mode === "flight";
      const localBefore = t.local_before ?? "auto";
      const localAfter = t.local_after ?? "auto";
      const noteParts: string[] = [];
      if (stationBased && localBefore !== "auto") {
        noteParts.push(`local_before=${localBefore}`);
      }
      if (stationBased && localAfter !== "auto") {
        noteParts.push(`local_after=${localAfter}`);
      }
      const transitionNote =
        noteParts.length > 0 ? `khonsera:${noteParts.join(";")}` : null;

      // Upsert the transition row (locked when booked, mode-only when not).
      const { data: transRow } = await supabase
        .from("transitions")
        .upsert(
          {
            itinerary_id: itinerary.id,
            workspace_id: ctx.workspaceId,
            from_stop_id: from.id,
            to_stop_id: to.id,
            mode: mode ?? "mixed",
            is_locked: isBooked,
            start_time: startIso,
            end_time: endIso,
            computed_duration_minutes: durationMins,
            notes: transitionNote,
          },
          { onConflict: "from_stop_id,to_stop_id" },
        )
        .select("id")
        .single();

      if (!isBooked || !t.booking || !transRow) continue;

      // Pre-booked: write the booking_intent + travel_booking + one
      // segment so the wallet (Bookings tab) reflects it immediately.
      const { data: intent } = await supabase
        .from("booking_intents")
        .insert({
          stop_id: from.id,
          itinerary_id: itinerary.id,
          workspace_id: ctx.workspaceId,
          provider: t.booking.provider ?? providerForMode(mode),
          status: "booked",
          currency: t.booking.currency ?? "GBP",
        })
        .select("id")
        .single();

      if (!intent) continue;

      const { data: bookingRow } = await supabase
        .from("travel_bookings")
        .insert({
          booking_intent_id: intent.id,
          workspace_id: ctx.workspaceId,
          provider: t.booking.provider ?? providerForMode(mode),
          booking_reference: t.booking.reference ?? null,
          ticket_status: "booked",
          actual_price: t.booking.price ?? null,
          currency: t.booking.currency ?? "GBP",
          booked_at: new Date().toISOString(),
          departure_location_id: from.locationId,
          arrival_location_id: to.locationId,
          departure_at: startIso,
          arrival_at: endIso,
          seat_reservation: t.booking.seat ?? null,
        })
        .select("id")
        .single();

      if (bookingRow) {
        await supabase.from("travel_booking_segments").insert({
          travel_booking_id: bookingRow.id,
          workspace_id: ctx.workspaceId,
          sequence: 0,
          from_location_name:
            (fromAnchor && (fromAnchor.label ?? "")) || "Origin",
          to_location_name:
            (toAnchor && (toAnchor.label ?? "")) || "Destination",
          departure_at: startIso!,
          arrival_at: endIso!,
          train_number: t.booking.service_number ?? null,
        });
      }
    }
  }

  return ok({ id: itinerary.id });
}

function providerForMode(mode: string | null): string {
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
    default:
      return "manual";
  }
}

function isoFromLocal(date: string, time: string, timezone: string): string {
  // Build an ISO timestamp from a local date + time in a named timezone.
  // We construct an "as-if UTC" instant, then derive the offset by asking
  // Intl what clock-time that instant prints in the target zone.
  const asUtc = new Date(`${date}T${time}:00.000Z`);
  const tzString = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(asUtc);
  const [tzHour, tzMin] = tzString.split(":").map((p) => parseInt(p, 10));
  const utcHour = asUtc.getUTCHours();
  const utcMin = asUtc.getUTCMinutes();
  const offsetMins = (tzHour - utcHour) * 60 + (tzMin - utcMin);
  const norm =
    offsetMins > 720
      ? offsetMins - 1440
      : offsetMins < -720
        ? offsetMins + 1440
        : offsetMins;
  return new Date(asUtc.getTime() - norm * 60_000).toISOString();
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function defaultDurationForKind(kind: string, role?: string | null): number {
  if (kind === "stay" && role === "return_to_room") return 30;
  if (kind === "station") return 10;
  if (kind === "meal") {
    switch (role) {
      case "breakfast":
        return 45;
      case "lunch":
        return 60;
      case "dinner":
        return 90;
      case "drinks":
        return 60;
      default:
        return 60;
    }
  }
  if (kind === "event") return 120;
  return 60;
}

// Sort key for chronological ordering on input. Pinned anchors use their
// declared time (arrive_by → that time; leave_by → that time so they land
// where the user expects them to "finish"). Around-then anchors fall to
// the end of the day they were assigned to — the editor solver will
// re-slot them once travel is known.
function sortKey(a: AnchorInput): string {
  if (a.timing_mode === "around_then") return "23:59";
  return a.time ?? "00:00";
}

function minutesBetweenLocal(a: string, b: string): number {
  const [ah, am] = a.split(":").map((p) => parseInt(p, 10));
  const [bh, bm] = b.split(":").map((p) => parseInt(p, 10));
  let mins = bh * 60 + bm - (ah * 60 + am);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export async function deleteItinerary(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("itineraries")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("itineraries")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "itinerary");
  await recordAudit({
    entityType: "itinerary",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}

export async function transitionItineraryStatus(
  id: string,
  toStatus: ItineraryStatus,
  metadata?: Record<string, unknown>,
) {
  return transitionItinerary(id, toStatus, metadata);
}

// Run the time solver over an itinerary and write back any newly-computed
// start/end times on stops and transitions. Idempotent and cheap — safe to
// call after every stop/transition mutation.
export async function resolveItineraryTimes(
  itineraryId: string,
): Promise<Result<{ itinerary_id: string; conflicts: number }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const [{ data: stops }, { data: transitions }] = await Promise.all([
    supabase
      .from("stops")
      .select(
        "id, sequence, start_time, end_time, duration_minutes, is_time_fixed",
      )
      .eq("itinerary_id", itineraryId)
      .eq("workspace_id", ctx.workspaceId)
      .order("sequence"),
    supabase
      .from("transitions")
      .select(
        "id, from_stop_id, to_stop_id, start_time, end_time, computed_duration_minutes, is_locked",
      )
      .eq("itinerary_id", itineraryId)
      .eq("workspace_id", ctx.workspaceId),
  ]);

  const result = solveTimes({
    stops: (stops ?? []) as Parameters<typeof solveTimes>[0]["stops"],
    transitions:
      (transitions ?? []) as Parameters<typeof solveTimes>[0]["transitions"],
  });

  // Write only the rows whose times actually changed, to keep audit chatter
  // and DB writes minimal. Sequential await — itineraries hold ~10s of stops.
  const stopsById = new Map(stops?.map((s) => [s.id, s]) ?? []);
  const transById = new Map(transitions?.map((t) => [t.id, t]) ?? []);
  for (const s of result.stops) {
    const orig = stopsById.get(s.id);
    if (!orig) continue;
    if (orig.start_time === s.start_time && orig.end_time === s.end_time)
      continue;
    await supabase
      .from("stops")
      .update({ start_time: s.start_time, end_time: s.end_time })
      .eq("id", s.id)
      .eq("workspace_id", ctx.workspaceId);
  }
  for (const t of result.transitions) {
    const orig = transById.get(t.id);
    if (!orig) continue;
    if (orig.start_time === t.start_time && orig.end_time === t.end_time)
      continue;
    await supabase
      .from("transitions")
      .update({ start_time: t.start_time, end_time: t.end_time })
      .eq("id", t.id)
      .eq("workspace_id", ctx.workspaceId);
  }

  // Refresh "leave_soon" notification rules. Strategy: replace the
  // itinerary's auto-generated rules (payload.kind === 'auto_leave_soon')
  // with a fresh batch — one per stop that has a computed start_time and
  // a preceding leg to actually "leave" for.
  await supabase
    .from("notification_rules")
    .delete()
    .eq("itinerary_id", itineraryId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("type", "leave_soon")
    .filter("payload->>kind", "eq", "auto_leave_soon");
  const bufferMinutes = 5;
  const notifications: {
    itinerary_id: string;
    workspace_id: string;
    type: "leave_soon";
    trigger_time: string;
    payload: Record<string, unknown>;
  }[] = [];
  for (const s of result.stops) {
    if (!s.start_time) continue;
    const triggerTime = new Date(
      new Date(s.start_time).getTime() - bufferMinutes * 60_000,
    ).toISOString();
    notifications.push({
      itinerary_id: itineraryId,
      workspace_id: ctx.workspaceId,
      type: "leave_soon",
      trigger_time: triggerTime,
      payload: { kind: "auto_leave_soon", stop_id: s.id },
    });
  }
  if (notifications.length > 0) {
    await supabase.from("notification_rules").insert(notifications);
  }

  return ok({
    itinerary_id: itineraryId,
    conflicts: result.conflicts.length,
  });
}
