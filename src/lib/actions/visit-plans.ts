"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { transitionVisitPlan } from "@/lib/state/transitions";
import { err, errors, ok, fromThrown, type Result } from "@/lib/errors";
import type {
  TravelModePreference,
  VisitStatus,
} from "@/lib/types/domain";

const preferenceEnum = z.enum(["rail", "drive", "compare", "mixed"]);

const createVisitPlanSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  customer_site_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  proposed_start_time: z.string().datetime().nullable().optional(),
  proposed_end_time: z.string().datetime().nullable().optional(),
  meeting_duration_minutes: z.number().int().min(5).max(24 * 60).nullable().optional(),
  desired_arrival_time: z.string().datetime().nullable().optional(),
  latest_departure_from_site_time: z.string().datetime().nullable().optional(),
  latest_return_time: z.string().datetime().nullable().optional(),
  start_location_id: z.string().uuid().nullable().optional(),
  return_location_id: z.string().uuid().nullable().optional(),
  travel_mode_preference: preferenceEnum.optional(),
  arrival_buffer_minutes: z.number().int().min(0).max(180).optional(),
  return_buffer_minutes: z.number().int().min(0).max(180).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const updateVisitPlanSchema = createVisitPlanSchema.extend({
  id: z.string().uuid(),
});

export type VisitPlan = {
  id: string;
  workspace_id: string;
  user_id: string;
  customer_id: string | null;
  customer_site_id: string | null;
  contact_id: string | null;
  title: string | null;
  status: VisitStatus;
  proposed_start_time: string | null;
  proposed_end_time: string | null;
  meeting_duration_minutes: number | null;
  desired_arrival_time: string | null;
  latest_departure_from_site_time: string | null;
  latest_return_time: string | null;
  start_location_id: string | null;
  return_location_id: string | null;
  travel_mode_preference: TravelModePreference;
  arrival_buffer_minutes: number;
  return_buffer_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createVisitPlan(
  input: z.input<typeof createVisitPlanSchema>,
): Promise<Result<VisitPlan>> {
  const parsed = parseInput(createVisitPlanSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_plans")
    .insert({
      ...parsed.value,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
    })
    .select("*")
    .single();

  const result = dbResult<VisitPlan>(data, error, "visit_plan");
  if (result.ok) {
    await recordAudit({
      entityType: "visit_plan",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateVisitPlan(
  input: z.input<typeof updateVisitPlanSchema>,
): Promise<Result<VisitPlan>> {
  const parsed = parseInput(updateVisitPlanSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("visit_plans")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  // .status is protected by the block_direct_status_update trigger; we never
  // include it in this patch even if a caller tried to.
  const { data, error } = await supabase
    .from("visit_plans")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<VisitPlan>(data, error, "visit_plan");
  if (result.ok) {
    await recordAudit({
      entityType: "visit_plan",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

// Status changes route through the SQL transition function — exposed here as
// a thin wrapper so callers (UI + tests) import from one place.
export async function transitionVisit(
  visitId: string,
  toStatus: VisitStatus,
  metadata?: Record<string, unknown>,
) {
  return transitionVisitPlan(visitId, toStatus, metadata);
}

// Confirm a visit: lock in the chosen travel option, transition the visit
// to 'confirmed', create the SavedTrip and a BookingIntent ready for the
// partner booking handoff (or "mark as booked" for drive). Also creates
// calendar events (outbound travel + meeting + return travel) when the user
// has a connected calendar.
export async function confirmVisitWithTravelOption(
  visitId: string,
  travelOptionId: string,
): Promise<Result<{ visitId: string; savedTripId: string; bookingIntentId: string | null; calendarEventCount: number }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // 1. Verify the travel option belongs to a planning run for this visit (RLS
  //    also enforces workspace scope).
  const { data: option } = await supabase
    .from("travel_options")
    .select(
      `id, mode, total_cost_estimate, currency,
       leave_origin_at, arrive_site_at, meeting_start_at, meeting_end_at,
       leave_site_at, arrive_return_location_at,
       planning_runs!inner(visit_plan_id)`,
    )
    .eq("id", travelOptionId)
    .maybeSingle();
  if (!option) return err(errors.notFound("travel_option"));
  const linkedVisit = (option.planning_runs as unknown as { visit_plan_id: string } | null)?.visit_plan_id;
  if (linkedVisit !== visitId) {
    return err(errors.validation("Travel option does not belong to this visit"));
  }

  // 1b. Pull visit metadata for the event titles.
  const { data: visit } = await supabase
    .from("visit_plans")
    .select(
      `title, customer:customers(name),
       customer_site:customer_sites(name, address)`,
    )
    .eq("id", visitId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  const customer = (visit?.customer as unknown as { name?: string } | null)?.name ?? "Customer";
  const site = visit?.customer_site as unknown as { name?: string; address?: string } | null;
  const meetingTitle = visit?.title ?? `${customer} visit`;
  const siteLocation = [site?.name, site?.address].filter(Boolean).join(", ") || undefined;

  // 2. Transition the visit to confirmed.
  const transitioned = await transitionVisitPlan(visitId, "confirmed", {
    selected_travel_option_id: travelOptionId,
  });
  if (!transitioned.ok) return transitioned;

  // 3. Create the SavedTrip (1:1 with visit; if it already exists from a
  //    previous confirm, update it).
  const { data: trip, error: tripErr } = await supabase
    .from("saved_trips")
    .upsert(
      {
        visit_plan_id: visitId,
        selected_travel_option_id: travelOptionId,
        workspace_id: ctx.workspaceId,
        status: "upcoming",
      },
      { onConflict: "visit_plan_id" },
    )
    .select("id")
    .single();
  const tripInsert = dbResult<{ id: string }>(trip, tripErr, "saved_trip");
  if (!tripInsert.ok) return tripInsert;

  // 4. For rail, queue a BookingIntent ready for the partner handoff. For
  //    drive, no booking intent — the user can record fuel/parking expenses
  //    later.
  let bookingIntentId: string | null = null;
  if (option.mode === "rail") {
    const { data: intent, error: intentErr } = await supabase
      .from("booking_intents")
      .insert({
        visit_plan_id: visitId,
        travel_option_id: travelOptionId,
        workspace_id: ctx.workspaceId,
        provider: "trainline",
        status: "not_started",
        estimated_price: option.total_cost_estimate,
        currency: option.currency ?? "GBP",
        idempotency_key: crypto.randomUUID(),
      })
      .select("id")
      .single();
    if (intentErr || !intent) {
      return err(fromThrown(intentErr ?? new Error("booking_intent insert"), "booking_intent"));
    }
    bookingIntentId = intent.id;
  }

  // 5. Create calendar events. createCalendarEvent gracefully degrades to
  //    "unavailable" when no calendar is connected, so this is a no-op for
  //    users who haven't connected Google. Failures here don't block the
  //    confirm — we just don't store the link rows.
  const calendarEventCount = await createCalendarEventsForVisit({
    visitPlanId: visitId,
    workspaceId: ctx.workspaceId,
    customer,
    meetingTitle,
    siteLocation,
    leaveOriginAt: new Date(option.leave_origin_at as unknown as string),
    arriveSiteAt: new Date(option.arrive_site_at as unknown as string),
    meetingStartAt: new Date(option.meeting_start_at as unknown as string),
    meetingEndAt: new Date(option.meeting_end_at as unknown as string),
    leaveSiteAt: new Date(option.leave_site_at as unknown as string),
    arriveReturnLocationAt: new Date(option.arrive_return_location_at as unknown as string),
  });

  // 6. Auto-create the mileage expense for drive options. Rail tickets get
  //    a separate expense row when recordTravelBooking is called against the
  //    booking intent — at that point we know the actual paid price.
  if (option.mode === "drive") {
    await createMileageExpenseIfDrive({
      visitPlanId: visitId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      travelOptionId,
    });
  }

  await recordAudit({
    entityType: "visit_plan",
    entityId: visitId,
    action: "confirm",
    after: {
      travel_option_id: travelOptionId,
      saved_trip_id: tripInsert.value.id,
      booking_intent_id: bookingIntentId,
      calendar_event_count: calendarEventCount,
    },
  });

  return ok({
    visitId,
    savedTripId: tripInsert.value.id,
    bookingIntentId,
    calendarEventCount,
  });
}

async function createMileageExpenseIfDrive(args: {
  visitPlanId: string;
  workspaceId: string;
  userId: string;
  travelOptionId: string;
}): Promise<void> {
  const supabase = await createClient();

  // Don't double up: if an expense for this visit already exists with
  // type='mileage', leave it alone (user might have edited the amount).
  const { data: existing } = await supabase
    .from("expense_records")
    .select("id")
    .eq("visit_plan_id", args.visitPlanId)
    .eq("workspace_id", args.workspaceId)
    .eq("type", "mileage")
    .maybeSingle();
  if (existing) return;

  // Sum distance across the option's drive legs (round-trip if both legs
  // exist; one-way otherwise).
  const { data: legs } = await supabase
    .from("journey_legs")
    .select("distance_miles, leg_type")
    .eq("travel_option_id", args.travelOptionId)
    .eq("workspace_id", args.workspaceId);
  const distance = (legs ?? [])
    .filter((l) => l.leg_type === "drive")
    .reduce((s, l) => s + (Number(l.distance_miles) || 0), 0);
  if (distance <= 0) return;

  const { data: profile } = await supabase
    .from("travel_profiles")
    .select("mileage_rate")
    .eq("user_id", args.userId)
    .eq("workspace_id", args.workspaceId)
    .maybeSingle();
  const rate = Number(profile?.mileage_rate ?? 0.45);
  if (rate <= 0) return;

  const amount = Math.round(distance * rate * 100) / 100;

  const { data: expense, error: expenseErr } = await supabase
    .from("expense_records")
    .insert({
      visit_plan_id: args.visitPlanId,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      type: "mileage",
      amount,
      currency: "GBP",
      notes: "Auto-generated from confirmed drive option.",
    })
    .select("id")
    .single();
  if (expenseErr || !expense) return;

  await supabase.from("mileage_expenses").insert({
    expense_record_id: expense.id,
    workspace_id: args.workspaceId,
    distance_miles: distance,
    mileage_rate: rate,
    calculated_amount: amount,
  });
}

async function createCalendarEventsForVisit(args: {
  visitPlanId: string;
  workspaceId: string;
  customer: string;
  meetingTitle: string;
  siteLocation?: string;
  leaveOriginAt: Date;
  arriveSiteAt: Date;
  meetingStartAt: Date;
  meetingEndAt: Date;
  leaveSiteAt: Date;
  arriveReturnLocationAt: Date;
}): Promise<number> {
  const { createCalendarEvent } = await import("@/lib/integrations/calendar");
  const supabase = await createClient();
  const events: Array<{
    title: string;
    description: string;
    start: Date;
    end: Date;
    location?: string;
    colorId: string;
    eventType: "outbound_travel" | "appointment" | "return_travel";
  }> = [
    {
      title: `Travel: ${args.customer}`,
      description: "Outbound travel to customer site (Journies).",
      start: args.leaveOriginAt,
      end: args.arriveSiteAt,
      location: args.siteLocation,
      colorId: "6", // tangerine
      eventType: "outbound_travel",
    },
    {
      title: args.meetingTitle,
      description: "On-site visit (Journies).",
      start: args.meetingStartAt,
      end: args.meetingEndAt,
      location: args.siteLocation,
      colorId: "9", // blueberry
      eventType: "appointment",
    },
    {
      title: `Travel home from ${args.customer}`,
      description: "Return travel (Journies).",
      start: args.leaveSiteAt,
      end: args.arriveReturnLocationAt,
      colorId: "6",
      eventType: "return_travel",
    },
  ];

  let created = 0;
  for (const e of events) {
    const result = await createCalendarEvent(
      {
        title: e.title,
        description: e.description,
        start: e.start,
        end: e.end,
        location: e.location,
      },
      { colorId: e.colorId },
    );
    if (result.mode === "unavailable") continue;
    await supabase.from("calendar_event_links").insert({
      visit_plan_id: args.visitPlanId,
      workspace_id: args.workspaceId,
      provider: "google",
      external_event_id: result.data.externalId,
      event_type: e.eventType,
      start_time: e.start.toISOString(),
      end_time: e.end.toISOString(),
    });
    created++;
  }
  return created;
}

export async function deleteVisitPlan(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("visit_plans")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("visit_plans")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "visit_plan");
  await recordAudit({
    entityType: "visit_plan",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}
