"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { transitionSavedTrip } from "@/lib/state/transitions";
import { dbResult } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";

export async function startTrip(
  savedTripId: string,
): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("saved_trips")
    .select("id, status, workspace_id")
    .eq("id", savedTripId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!trip) return err(errors.notFound("saved_trip"));

  const result = await transitionSavedTrip(savedTripId, "in_progress", {
    started_by: ctx.userId,
  });
  if (!result.ok) return result;

  // Ensure a trip_progress row exists for the live state.
  await supabase
    .from("trip_progress")
    .upsert(
      {
        saved_trip_id: savedTripId,
        workspace_id: ctx.workspaceId,
        status: "on_track",
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "saved_trip_id" },
    );

  await recordAudit({
    entityType: "saved_trip",
    entityId: savedTripId,
    action: "start",
    after: { status: "in_progress" },
  });

  return ok({ id: savedTripId });
}

export async function completeTrip(
  savedTripId: string,
): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const result = await transitionSavedTrip(savedTripId, "completed", {
    completed_by: ctx.userId,
  });
  if (!result.ok) return result;

  await supabase
    .from("trip_progress")
    .upsert(
      {
        saved_trip_id: savedTripId,
        workspace_id: ctx.workspaceId,
        status: "completed",
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "saved_trip_id" },
    );

  await recordAudit({
    entityType: "saved_trip",
    entityId: savedTripId,
    action: "complete",
    after: { status: "completed" },
  });

  return ok({ id: savedTripId });
}

export async function cancelTrip(
  savedTripId: string,
): Promise<Result<{ id: string }>> {
  const result = await transitionSavedTrip(savedTripId, "cancelled");
  if (!result.ok) return result;
  return ok({ id: savedTripId });
}

// Stays around in case a future "manual advance" button gets added.
export async function setCurrentLeg(
  savedTripId: string,
  legId: string | null,
): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_progress")
    .upsert(
      {
        saved_trip_id: savedTripId,
        workspace_id: ctx.workspaceId,
        current_leg_id: legId,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "saved_trip_id" },
    )
    .select("id")
    .single();
  return dbResult<{ id: string }>(data, error, "trip_progress");
}
