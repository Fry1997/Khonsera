// TS mirror of itinerary_transition (in 0010_reshape_itineraries.sql). Keep
// the edge set identical to the SQL edge table — if you change one, change
// both. The TS reducer is used for client-side reasoning (which buttons to
// show, what's next) and tests; the SQL function is the authoritative gate
// for actual writes.

import type { ItineraryStatus } from "@/lib/types/domain";
import { errors, type Result, ok, err } from "@/lib/errors";

export const ITINERARY_EDGES: Readonly<
  Record<ItineraryStatus, readonly ItineraryStatus[]>
> = {
  // 'draft' = an UNCOMMITTED "New itinerary" (createDraftItinerary). It's
  // hidden from the trip lists and promoted to 'planning' on the user's first
  // content change, via the itinerary_transition RPC. Edges mirror the SQL
  // itinerary_status_edges table (0010): draft → planning | cancelled.
  draft: ["planning", "cancelled"],
  planning: ["planned", "cancelled"],
  planned: ["planning", "in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: ["planning"],
};

export function canTransitionItinerary(
  from: ItineraryStatus,
  to: ItineraryStatus,
): boolean {
  if (from === to) return true;
  return ITINERARY_EDGES[from].includes(to);
}

export function nextItineraryStatuses(
  from: ItineraryStatus,
): readonly ItineraryStatus[] {
  return ITINERARY_EDGES[from];
}

export function checkItineraryTransition(
  from: ItineraryStatus,
  to: ItineraryStatus,
): Result<{ from: ItineraryStatus; to: ItineraryStatus }> {
  if (canTransitionItinerary(from, to)) return ok({ from, to });
  return err(
    errors.stateTransition(from, to, `Itinerary cannot move from ${from} to ${to}`),
  );
}
