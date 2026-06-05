"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";
import { resolveItineraryTimes } from "./itineraries";
import { planInsertionByTime } from "@/lib/planning/insert";
import type { StopType } from "@/lib/types/domain";

const stopTypeEnum = z.enum([
  "start",
  "end",
  "appointment",
  "accommodation",
  "event",
  "meal",
  "transport_booked",
  "transit_arrival",
  // Added by later migrations (0011 added transit_departure; 0014
  // added stopover). Kept in lock-step here so editor patches for
  // those stop types pass validation.
  "transit_departure",
  "stopover",
  "other",
]);

const baseStopFields = {
  type: stopTypeEnum,
  title: z.string().trim().max(200).nullable().optional(),
  start_time: z.string().datetime().nullable().optional(),
  end_time: z.string().datetime().nullable().optional(),
  duration_minutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  is_time_fixed: z.boolean().optional(),
  location_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  customer_site_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  // Optional FK to the global transport_hubs catalogue. Set for
  // transit_departure / transit_arrival stops the user creates via
  // the editor's '+ Train' / '+ Flight' inline buttons.
  transport_hub_id: z.string().uuid().nullable().optional(),
  external_reference: z.string().trim().max(200).nullable().optional(),
  external_url: z.string().trim().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
};

const createSchema = z.object({
  itinerary_id: z.string().uuid(),
  sequence: z.number().int().min(0).optional(),
  ...baseStopFields,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  ...baseStopFields,
});

const reorderSchema = z.object({
  itinerary_id: z.string().uuid(),
  stop_ids: z.array(z.string().uuid()).min(1),
});

export type Stop = {
  id: string;
  itinerary_id: string;
  workspace_id: string;
  sequence: number;
  type: StopType;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_time_fixed: boolean;
  location_id: string | null;
  customer_id: string | null;
  customer_site_id: string | null;
  contact_id: string | null;
  external_reference: string | null;
  external_url: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  receipt_file_path: string | null;
  created_at: string;
  updated_at: string;
};

export async function createStop(
  input: z.input<typeof createSchema>,
): Promise<Result<Stop>> {
  const parsed = parseInput(createSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Verify the itinerary belongs to the workspace before adding to it.
  const { data: itin } = await supabase
    .from("itineraries")
    .select("id")
    .eq("id", parsed.value.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!itin) return err(errors.notFound("itinerary"));

  // If no explicit sequence: append at the end.
  let sequence = parsed.value.sequence;
  if (sequence == null) {
    const { data: existing } = await supabase
      .from("stops")
      .select("sequence")
      .eq("itinerary_id", parsed.value.itinerary_id)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    sequence = (existing?.sequence ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("stops")
    .insert({
      ...parsed.value,
      sequence,
      workspace_id: ctx.workspaceId,
    })
    .select("*")
    .single();

  const result = dbResult<Stop>(data, error, "stop");
  if (result.ok) {
    await recordAudit({
      entityType: "stop",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
    await resolveItineraryTimes(result.value.itinerary_id);
  }
  return result;
}

export async function updateStop(
  input: z.input<typeof updateSchema>,
): Promise<Result<Stop>> {
  const parsed = parseInput(updateSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("stops")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  const { data, error } = await supabase
    .from("stops")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<Stop>(data, error, "stop");
  if (result.ok) {
    await recordAudit({
      entityType: "stop",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
    await resolveItineraryTimes(result.value.itinerary_id);
  }
  return result;
}

// insertStopAt — bumps every later stop's sequence by +1 to open a
// slot at `sequence`, then inserts a new stop there. Used by the
// editor's inline AddBetween triggers for both new anchors and new
// stopovers. Returns the newly-inserted stop's id so the caller can
// e.g. auto-expand it in the UI.
const insertStopAtSchema = z.object({
  itinerary_id: z.string().uuid(),
  sequence: z.number().int().min(0),
  ...baseStopFields,
});

export async function insertStopAt(
  input: z.input<typeof insertStopAtSchema>,
): Promise<Result<Stop>> {
  const parsed = parseInput(insertStopAtSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Bump every stop at sequence >= target by +1 to make room. Order
  // by sequence desc so the writes don't collide with each other on
  // any in-flight uniqueness assumptions.
  const { data: shiftRows } = await supabase
    .from("stops")
    .select("id, sequence")
    .eq("itinerary_id", parsed.value.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .gte("sequence", parsed.value.sequence)
    .order("sequence", { ascending: false });
  for (const r of shiftRows ?? []) {
    await supabase
      .from("stops")
      .update({ sequence: (r.sequence as number) + 1 })
      .eq("id", r.id as string)
      .eq("workspace_id", ctx.workspaceId);
  }

  const { itinerary_id, sequence, ...fields } = parsed.value;
  const { data, error } = await supabase
    .from("stops")
    .insert({
      itinerary_id,
      workspace_id: ctx.workspaceId,
      sequence,
      ...fields,
    })
    .select("*")
    .single();
  const result = dbResult<Stop>(data, error, "stop");
  if (result.ok) {
    await recordAudit({
      entityType: "stop",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
    await resolveItineraryTimes(result.value.itinerary_id);
  }
  return result;
}

// createStopAtTime — insert-fact-by-time (P1.3). Where `createStop` appends
// at max(sequence)+1 and `insertStopAt` takes an explicit slot, this places a
// fact by *when it happens*: it finds the time-ordered position from the
// stop's start_time, shifts later stops up by one, and scopes the recompute to
// the two adjacent transitions whose adjacency just changed.
//
// The bridging transition between the new stop's two neighbours (e.g. home →
// appointment) is now spurious — the chain runs through the inserted fact — so
// we drop it, mirroring insertTransitLeg. We deliberately do NOT auto-create
// the two new adjacent transitions with a default mode: the brief is explicit
// that gaps stay open for the equal-weight mode picker rather than
// pre-committing a mode. The time solver runs after so downstream times move.
const createStopAtTimeSchema = z.object({
  itinerary_id: z.string().uuid(),
  ...baseStopFields,
  // start_time is what we slot by, so it's required here (unlike the base).
  start_time: z.string().datetime(),
});

export async function createStopAtTime(
  input: z.input<typeof createStopAtTimeSchema>,
): Promise<Result<Stop>> {
  const parsed = parseInput(createStopAtTimeSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: itin } = await supabase
    .from("itineraries")
    .select("id")
    .eq("id", parsed.value.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!itin) return err(errors.notFound("itinerary"));

  const { data: existing } = await supabase
    .from("stops")
    .select("id, sequence, start_time")
    .eq("itinerary_id", parsed.value.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .order("sequence");

  const plan = planInsertionByTime(
    (existing ?? []).map((s) => ({
      id: s.id as string,
      sequence: s.sequence as number,
      start_time: (s.start_time as string | null) ?? null,
    })),
    parsed.value.start_time,
  );

  // Open the slot: bump every stop at sequence >= target up by one. Highest
  // first so the writes don't transiently collide on the sequence space.
  const { data: shiftRows } = await supabase
    .from("stops")
    .select("id, sequence")
    .eq("itinerary_id", parsed.value.itinerary_id)
    .eq("workspace_id", ctx.workspaceId)
    .gte("sequence", plan.sequence)
    .order("sequence", { ascending: false });
  for (const r of shiftRows ?? []) {
    await supabase
      .from("stops")
      .update({ sequence: (r.sequence as number) + 1 })
      .eq("id", r.id as string)
      .eq("workspace_id", ctx.workspaceId);
  }

  const { itinerary_id, ...fields } = parsed.value;
  const { data, error } = await supabase
    .from("stops")
    .insert({
      itinerary_id,
      workspace_id: ctx.workspaceId,
      sequence: plan.sequence,
      ...fields,
    })
    .select("*")
    .single();
  const result = dbResult<Stop>(data, error, "stop");
  if (!result.ok) return result;

  // Scoped recompute: the direct transition that used to bridge the two
  // neighbours now skips the inserted fact. Drop it so the editor doesn't draw
  // a phantom leg through the new stop.
  if (plan.beforeStopId && plan.afterStopId) {
    await supabase
      .from("transitions")
      .delete()
      .eq("itinerary_id", itinerary_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("from_stop_id", plan.beforeStopId)
      .eq("to_stop_id", plan.afterStopId);
  }

  await recordAudit({
    entityType: "stop",
    entityId: result.value.id,
    action: "create",
    after: result.value,
  });
  await resolveItineraryTimes(result.value.itinerary_id);
  return result;
}

export async function deleteStop(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("stops")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("stops")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "stop");
  await recordAudit({
    entityType: "stop",
    entityId: id,
    action: "delete",
    before,
  });
  if (before?.itinerary_id) {
    await resolveItineraryTimes(before.itinerary_id);
  }
  return ok({ id });
}

export async function reorderStops(
  input: z.input<typeof reorderSchema>,
): Promise<Result<{ itinerary_id: string }>> {
  const parsed = parseInput(reorderSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Update each stop's sequence number. Done in a loop because supabase-js
  // doesn't support bulk-update-with-CASE-WHEN; fine for 10-20 stops.
  for (const [idx, stopId] of parsed.value.stop_ids.entries()) {
    const { error } = await supabase
      .from("stops")
      .update({ sequence: idx })
      .eq("id", stopId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("itinerary_id", parsed.value.itinerary_id);
    if (error) return dbResult<{ itinerary_id: string }>(null, error, "stop");
  }

  await recordAudit({
    entityType: "itinerary",
    entityId: parsed.value.itinerary_id,
    action: "reorder_stops",
    after: { order: parsed.value.stop_ids },
  });

  return ok({ itinerary_id: parsed.value.itinerary_id });
}
