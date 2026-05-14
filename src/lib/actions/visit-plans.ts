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
// partner booking handoff (or "mark as booked" for drive).
export async function confirmVisitWithTravelOption(
  visitId: string,
  travelOptionId: string,
): Promise<Result<{ visitId: string; savedTripId: string; bookingIntentId: string | null }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // 1. Verify the travel option belongs to a planning run for this visit (RLS
  //    also enforces workspace scope).
  const { data: option } = await supabase
    .from("travel_options")
    .select(
      "id, mode, total_cost_estimate, currency, planning_runs!inner(visit_plan_id)",
    )
    .eq("id", travelOptionId)
    .maybeSingle();
  if (!option) return err(errors.notFound("travel_option"));
  const linkedVisit = (option.planning_runs as unknown as { visit_plan_id: string } | null)?.visit_plan_id;
  if (linkedVisit !== visitId) {
    return err(errors.validation("Travel option does not belong to this visit"));
  }

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

  await recordAudit({
    entityType: "visit_plan",
    entityId: visitId,
    action: "confirm",
    after: {
      travel_option_id: travelOptionId,
      saved_trip_id: tripInsert.value.id,
      booking_intent_id: bookingIntentId,
    },
  });

  return ok({
    visitId,
    savedTripId: tripInsert.value.id,
    bookingIntentId,
  });
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
