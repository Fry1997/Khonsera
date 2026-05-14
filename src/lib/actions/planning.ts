"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { transitionVisitPlan } from "@/lib/state/transitions";
import { getRoute } from "@/lib/integrations/routing";
import { findRailJourneys } from "@/lib/integrations/rail";
import { getFreeBusy } from "@/lib/integrations/calendar";
import {
  buildDriveOption,
  buildRailOption,
  rankBuiltOptions,
  type BuiltOption,
  type PlanningInput,
} from "@/lib/planning/orchestrator";
import { evaluateFeasibility } from "@/lib/planning/feasibility";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import {
  errors,
  err,
  ok,
  fromThrown,
  type Result,
} from "@/lib/errors";
import { dbResult, parseInput } from "./_helpers";
import type { TravelModePreference, VisitStatus } from "@/lib/types/domain";

const createAndPlanSchema = z.object({
  customer_id: z.string().uuid(),
  customer_site_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(200).optional(),
  proposed_start_time: z.string().datetime(),
  meeting_duration_minutes: z.number().int().min(5).max(24 * 60),
  latest_return_time: z.string().datetime().nullable().optional(),
  start_location_id: z.string().uuid(),
  return_location_id: z.string().uuid(),
  travel_mode_preference: z
    .enum(["rail", "drive", "compare", "mixed"])
    .default("compare"),
  arrival_buffer_minutes: z.number().int().min(0).max(180).default(15),
  return_buffer_minutes: z.number().int().min(0).max(180).default(15),
  notes: z.string().trim().max(4000).optional(),
});

export type PlannedVisit = {
  visitId: string;
  planningRunId: string;
  status: VisitStatus;
  optionCount: number;
  bestStatus: "recommended" | "tight" | "not_recommended" | "not_possible" | "none";
};

export async function createAndPlanVisit(
  input: z.input<typeof createAndPlanSchema>,
): Promise<Result<PlannedVisit>> {
  const parsed = parseInput(createAndPlanSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // 1. Verify the customer (and optional site) belong to the workspace.
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", parsed.value.customer_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!customer) return err(errors.notFound("customer"));

  // 2. Create the visit plan in draft.
  const { data: visit, error: visitErr } = await supabase
    .from("visit_plans")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      customer_id: parsed.value.customer_id,
      customer_site_id: parsed.value.customer_site_id ?? null,
      title: parsed.value.title ?? null,
      proposed_start_time: parsed.value.proposed_start_time,
      meeting_duration_minutes: parsed.value.meeting_duration_minutes,
      latest_return_time: parsed.value.latest_return_time ?? null,
      start_location_id: parsed.value.start_location_id,
      return_location_id: parsed.value.return_location_id,
      travel_mode_preference: parsed.value.travel_mode_preference,
      arrival_buffer_minutes: parsed.value.arrival_buffer_minutes,
      return_buffer_minutes: parsed.value.return_buffer_minutes,
      notes: parsed.value.notes ?? null,
    })
    .select("id, workspace_id")
    .single();
  const visitInsert = dbResult<{ id: string; workspace_id: string }>(visit, visitErr, "visit_plan");
  if (!visitInsert.ok) return visitInsert;
  const visitId = visitInsert.value.id;
  await recordAudit({
    entityType: "visit_plan",
    entityId: visitId,
    action: "create",
    after: parsed.value,
  });

  // 3. Move the visit into 'checking' so the UI shows the right state.
  const checking = await transitionVisitPlan(visitId, "checking");
  if (!checking.ok) return checking;

  // 4. Run planning.
  const planResult = await runPlanningForVisit(visitId);
  if (!planResult.ok) return planResult;

  // 5. If any option is feasible, transition to 'proposed' (offered to customer
  //    but not yet confirmed); otherwise stay in 'checking' so the user can
  //    iterate on the proposed time.
  const hasFeasible = planResult.value.bestStatus === "recommended" ||
                      planResult.value.bestStatus === "tight";
  if (hasFeasible) {
    const proposed = await transitionVisitPlan(visitId, "proposed");
    if (!proposed.ok) return proposed;
  }

  return ok({
    visitId,
    planningRunId: planResult.value.planningRunId,
    status: hasFeasible ? "proposed" : "checking",
    optionCount: planResult.value.optionCount,
    bestStatus: planResult.value.bestStatus,
  });
}

// Internal: fetch integration data + persist a PlanningRun + TravelOptions +
// JourneyLegs for an existing visit. Re-runnable.
async function runPlanningForVisit(
  visitId: string,
): Promise<Result<{ planningRunId: string; optionCount: number; bestStatus: PlannedVisit["bestStatus"] }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Pull the visit + the start/return location addresses for the integration calls.
  const { data: visit } = await supabase
    .from("visit_plans")
    .select(
      `id, workspace_id, proposed_start_time, meeting_duration_minutes,
       latest_return_time, arrival_buffer_minutes, return_buffer_minutes,
       travel_mode_preference,
       start_location:locations!visit_plans_start_location_id_fkey(name, address, postcode),
       return_location:locations!visit_plans_return_location_id_fkey(name, address, postcode),
       customer_site:customer_sites!visit_plans_customer_site_id_fkey(name, address, postcode)`,
    )
    .eq("id", visitId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!visit || !visit.proposed_start_time) {
    return err(errors.notFound("visit_plan"));
  }

  const wsCfg = await getWorkspaceConfig(visit.workspace_id);
  const appt = new Date(visit.proposed_start_time);
  const startLoc = (visit.start_location as unknown as { name?: string; address?: string } | null) ?? null;
  const returnLoc = (visit.return_location as unknown as { name?: string; address?: string } | null) ?? null;
  const site = (visit.customer_site as unknown as { name?: string; address?: string } | null) ?? null;

  const planningInput: PlanningInput = {
    appointmentStart: appt,
    meetingDurationMinutes: visit.meeting_duration_minutes ?? 60,
    latestReturnTime: visit.latest_return_time
      ? new Date(visit.latest_return_time)
      : undefined,
    arrivalBufferMinutes: visit.arrival_buffer_minutes ?? 15,
    returnBufferMinutes: visit.return_buffer_minutes ?? 15,
    preferredMode: (visit.travel_mode_preference as TravelModePreference) ?? "compare",
    timezone: wsCfg.timezone,
  };

  // Pull travel profile for mileage rate.
  const { data: tp } = await supabase
    .from("travel_profiles")
    .select("mileage_rate")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", visit.workspace_id)
    .maybeSingle();
  const mileageRate = Number(tp?.mileage_rate ?? 0.45);

  // 1. Fetch route (drive) and rail journeys.
  const arriveBy = new Date(appt.getTime() - planningInput.arrivalBufferMinutes * 60_000);
  const driveRoute = await getRoute({
    origin: startLoc?.address ?? startLoc?.name ?? "Origin",
    destination: site?.address ?? site?.name ?? "Customer site",
    mode: "drive",
    arriveBy,
  });
  const railOutbound = await findRailJourneys({
    originStation: startLoc?.name ?? "Origin",
    destinationStation: site?.name ?? "Destination",
    arriveBy,
  });
  const railReturn = await findRailJourneys({
    originStation: site?.name ?? "Destination",
    destinationStation: returnLoc?.name ?? startLoc?.name ?? "Origin",
    departAt: new Date(appt.getTime() + (visit.meeting_duration_minutes ?? 60) * 60_000),
  });

  // 2. Build options from whichever integrations returned data.
  const built: BuiltOption[] = [];

  if (driveRoute.mode !== "unavailable") {
    const leg = driveRoute.data.legs[0];
    if (leg) {
      built.push(
        buildDriveOption(planningInput, {
          leaveOriginAt: leg.startTime,
          arriveSiteAt: leg.endTime,
          durationMinutes: leg.durationMinutes,
          distanceMiles: leg.distanceMiles ?? driveRoute.data.totalDistanceMiles ?? 0,
          mileageRate,
          returnDurationMinutes: leg.durationMinutes,
        }),
      );
    }
  }

  if (railOutbound.mode !== "unavailable" && railReturn.mode !== "unavailable") {
    const out = railOutbound.data.find((j) => j.arriveAt <= arriveBy) ?? railOutbound.data[0];
    const back = railReturn.data[0];
    if (out && back) {
      built.push(
        buildRailOption(planningInput, {
          outboundDepartAt: out.departAt,
          outboundArriveAt: out.arriveAt,
          outboundDurationMinutes: out.durationMinutes,
          outboundChanges: out.changes,
          outboundEstimatedPrice: out.estimatedPrice,
          outboundServiceNumbers: out.serviceNumbers,
          outboundOriginStation: out.departStation,
          outboundDestinationStation: out.arriveStation,
          returnDepartAt: back.departAt,
          returnArriveAt: back.arriveAt,
          returnDurationMinutes: back.durationMinutes,
          returnChanges: back.changes,
          returnEstimatedPrice: back.estimatedPrice,
          walkToSiteMinutes: 9,
          walkFromSiteMinutes: 9,
        }),
      );
    }
  }

  if (built.length === 0) {
    return err(
      errors.integration(
        "planning",
        "No travel options could be generated. Connect a routing or rail provider, or enable demo mode if you're staff.",
      ),
    );
  }

  // 2b. Overlay calendar conflicts. Fetch free/busy for the broadest window
  // any built option touches, then for each option find overlapping events
  // and re-evaluate its feasibility with those titles attached. Failure to
  // reach the calendar provider is non-fatal — the visit just won't be
  // conflict-aware.
  const earliest = built.reduce(
    (a, o) => (o.leaveOriginAt < a ? o.leaveOriginAt : a),
    built[0].leaveOriginAt,
  );
  const latest = built.reduce(
    (a, o) => (o.arriveReturnLocationAt > a ? o.arriveReturnLocationAt : a),
    built[0].arriveReturnLocationAt,
  );
  const freeBusy = await getFreeBusy({ start: earliest, end: latest });
  const busyBlocks = freeBusy.mode === "unavailable" ? [] : freeBusy.data;

  const overlaid = built.map((o) => {
    if (busyBlocks.length === 0) return o;
    const overlapping = busyBlocks.filter(
      (b) => b.end > o.leaveOriginAt && b.start < o.arriveReturnLocationAt,
    );
    if (overlapping.length === 0) return o;
    const titles = overlapping.map((b) => b.title ?? "Existing event");
    const verdict = evaluateFeasibility({
      appointmentStart: o.meetingStartAt,
      appointmentEnd: o.meetingEndAt,
      arriveSiteAt: o.arriveSiteAt,
      leaveSiteAt: o.leaveSiteAt,
      arriveReturnLocationAt: o.arriveReturnLocationAt,
      latestReturnTime: planningInput.latestReturnTime,
      arrivalBufferMinutes: planningInput.arrivalBufferMinutes,
      returnBufferMinutes: planningInput.returnBufferMinutes,
      timezone: planningInput.timezone,
      conflictTitles: titles,
    });
    return { ...o, feasibilityStatus: verdict.status, verdict };
  });

  // 3. Rank.
  const ranked = rankBuiltOptions(overlaid, planningInput.preferredMode);
  const best = ranked[0];

  // 4. Insert PlanningRun + TravelOptions + JourneyLegs.
  const { data: run, error: runErr } = await supabase
    .from("planning_runs")
    .insert({
      visit_plan_id: visitId,
      workspace_id: visit.workspace_id,
      requested_start_time: appt.toISOString(),
      requested_end_time: new Date(
        appt.getTime() + (visit.meeting_duration_minutes ?? 60) * 60_000,
      ).toISOString(),
      requested_latest_return_time: visit.latest_return_time ?? null,
      status: "success",
      summary: `${ranked.length} option(s); best: ${best.feasibilityStatus}`,
    })
    .select("id")
    .single();
  const runInsert = dbResult<{ id: string }>(run, runErr, "planning_run");
  if (!runInsert.ok) return runInsert;
  const runId = runInsert.value.id;

  // Insert each option, then its legs.
  for (const o of ranked) {
    const { data: opt, error: optErr } = await supabase
      .from("travel_options")
      .insert({
        planning_run_id: runId,
        workspace_id: visit.workspace_id,
        mode: o.mode,
        feasibility_status: o.feasibilityStatus,
        leave_origin_at: o.leaveOriginAt.toISOString(),
        arrive_site_at: o.arriveSiteAt.toISOString(),
        meeting_start_at: o.meetingStartAt.toISOString(),
        meeting_end_at: o.meetingEndAt.toISOString(),
        leave_site_at: o.leaveSiteAt.toISOString(),
        arrive_return_location_at: o.arriveReturnLocationAt.toISOString(),
        total_duration_minutes: o.totalDurationMinutes,
        total_cost_estimate: o.totalCostEstimate,
        travel_time_minutes: o.travelTimeMinutes,
        buffer_minutes: o.bufferMinutes,
        recommendation_summary: o.verdict.suggestedWording,
        risk_summary: o.verdict.reasons.map((r) => r.message).join(" "),
        currency: wsCfg.currency,
      })
      .select("id")
      .single();
    if (optErr || !opt) return err(fromThrown(optErr ?? new Error("travel_option insert"), "travel_option"));

    const { error: legsErr } = await supabase.from("journey_legs").insert(
      o.legs.map((l) => ({
        travel_option_id: opt.id,
        workspace_id: visit.workspace_id,
        sequence: l.sequence,
        leg_type: l.legType,
        start_location_name: l.startLocationName,
        end_location_name: l.endLocationName,
        start_time: l.startTime.toISOString(),
        end_time: l.endTime.toISOString(),
        duration_minutes: l.durationMinutes,
        distance_miles: l.distanceMiles ?? null,
        provider: l.provider ?? null,
        service_number: l.serviceNumber ?? null,
        instructions: l.instructions ?? null,
      })),
    );
    if (legsErr) return err(fromThrown(legsErr, "journey_leg"));
  }

  await recordAudit({
    entityType: "planning_run",
    entityId: runId,
    action: "create",
    after: { option_count: ranked.length, best_status: best.feasibilityStatus },
  });

  return ok({
    planningRunId: runId,
    optionCount: ranked.length,
    bestStatus: best.feasibilityStatus,
  });
}

export async function rePlanVisit(visitId: string) {
  // For now, just re-runs planning. Future: take a new proposed_start_time.
  return runPlanningForVisit(visitId);
}
