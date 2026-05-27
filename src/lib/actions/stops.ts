"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";
import { resolveItineraryTimes } from "./itineraries";
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
  "transit_changeover",
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
    const timeFields = new Set(["start_time", "end_time", "duration_minutes", "is_time_fixed"]);
    const touchesTime = Object.keys(patch).some((k) => timeFields.has(k));
    if (touchesTime) {
      await resolveItineraryTimes(result.value.itinerary_id);
    }
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

  // Batch-bump all later stops in one query via RPC
  const { error: rpcErr } = await supabase.rpc("bump_stop_sequences" as any, {
    p_itinerary_id: parsed.value.itinerary_id,
    p_workspace_id: ctx.workspaceId,
    p_from_sequence: parsed.value.sequence,
  });

  if (rpcErr) {
    // Fallback: sequential updates (slow but correct)
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
    const hasTime = fields.start_time || fields.end_time || fields.duration_minutes;
    if (hasTime) {
      await resolveItineraryTimes(result.value.itinerary_id);
    }
  }
  return result;
}

export async function deleteStop(id: string, skipSolver?: boolean): Promise<Result<{ id: string }>> {
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
  if (before?.itinerary_id && !skipSolver) {
    await resolveItineraryTimes(before.itinerary_id);
  }
  return ok({ id });
}

export async function deleteStops(ids: string[]): Promise<Result<{ ids: string[] }>> {
  if (ids.length === 0) return ok({ ids: [] });
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("stops")
    .select("id, itinerary_id")
    .in("id", ids)
    .eq("workspace_id", ctx.workspaceId);

  const itineraryId = rows?.[0]?.itinerary_id ?? null;

  const { error } = await supabase
    .from("stops")
    .delete()
    .in("id", ids)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ ids: string[] }>(null, error, "stop");

  await recordAudit({
    entityType: "stop",
    entityId: ids[0],
    action: "delete",
    before: { deleted_ids: ids },
  });

  if (itineraryId) {
    await resolveItineraryTimes(itineraryId);
  }

  return ok({ ids });
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
