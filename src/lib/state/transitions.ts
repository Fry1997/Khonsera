// Server-side wrappers around the SQL transition functions. Callers (server
// actions) use these instead of raw RPC so we have one place that maps
// Postgres errors into our AppError taxonomy.

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import {
  errors,
  fromThrown,
  ok,
  err,
  type Result,
} from "@/lib/errors";
import type { VisitStatus, SavedTripStatus } from "@/lib/types/domain";

export async function transitionVisitPlan(
  visitId: string,
  toStatus: VisitStatus,
  metadata?: Record<string, unknown>,
): Promise<Result<{ id: string; status: VisitStatus }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("visit_plan_transition", {
    p_visit_id: visitId,
    p_to_status: toStatus,
    p_actor_id: ctx.userId,
    p_metadata: (metadata ?? null) as never,
  });

  if (error) {
    // SQLSTATE 22023 → illegal transition; map to our state_transition error.
    if (error.code === "22023") {
      return err(errors.stateTransition("?", toStatus, error.message));
    }
    return err(fromThrown(error, "visit_plan"));
  }
  if (!data) return err(errors.notFound("visit_plan", visitId));

  const row = Array.isArray(data) ? data[0] : data;
  return ok({ id: row.id, status: row.status as VisitStatus });
}

export async function transitionSavedTrip(
  tripId: string,
  toStatus: SavedTripStatus,
  metadata?: Record<string, unknown>,
): Promise<Result<{ id: string; status: SavedTripStatus }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("saved_trip_transition", {
    p_trip_id: tripId,
    p_to_status: toStatus,
    p_actor_id: ctx.userId,
    p_metadata: (metadata ?? null) as never,
  });

  if (error) {
    if (error.code === "22023") {
      return err(errors.stateTransition("?", toStatus, error.message));
    }
    return err(fromThrown(error, "saved_trip"));
  }
  if (!data) return err(errors.notFound("saved_trip", tripId));

  const row = Array.isArray(data) ? data[0] : data;
  return ok({ id: row.id, status: row.status as SavedTripStatus });
}
