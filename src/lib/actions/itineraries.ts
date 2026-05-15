"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import { transitionItinerary } from "@/lib/state/transitions";
import type { Result } from "@/lib/errors";
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
