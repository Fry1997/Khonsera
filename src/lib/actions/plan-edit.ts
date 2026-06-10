"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { updateStop } from "@/lib/actions/stops";
import type { AnchorVariableKind, AnchorVariableSlot } from "@/components/concierge";

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
    .select("type, metadata")
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
  revalidatePath("/plan");
  return { ok: true };
}
