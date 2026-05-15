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
  draft: ["planning", "cancelled"],
  planning: ["draft", "planned", "cancelled"],
  planned: ["planning", "in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: ["draft"],
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
