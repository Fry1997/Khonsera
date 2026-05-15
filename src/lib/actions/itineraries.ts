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
