// Server-side wrappers around the SQL transition functions. Callers (server
// actions) use this instead of raw RPC so error mapping into AppError stays
// in one place.

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { errors, fromThrown, ok, err, type Result } from "@/lib/errors";
import type { ItineraryStatus } from "@/lib/types/domain";

export async function transitionItinerary(
  itineraryId: string,
  toStatus: ItineraryStatus,
  metadata?: Record<string, unknown>,
): Promise<Result<{ id: string; status: ItineraryStatus }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("itinerary_transition", {
    p_itinerary_id: itineraryId,
    p_to_status: toStatus,
    p_actor_id: ctx.userId,
    p_metadata: (metadata ?? null) as never,
  });

  if (error) {
    if (error.code === "22023") {
      return err(errors.stateTransition("?", toStatus, error.message));
    }
    return err(fromThrown(error, "itinerary"));
  }
  if (!data) return err(errors.notFound("itinerary", itineraryId));

  const row = Array.isArray(data) ? data[0] : data;
  return ok({ id: row.id, status: row.status as ItineraryStatus });
}
