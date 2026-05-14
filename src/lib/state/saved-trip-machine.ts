// TS mirror of saved_trip_transition in 0003_state_machines.sql.

import type { SavedTripStatus } from "@/lib/types/domain";
import { errors, type Result, ok, err } from "@/lib/errors";

export const TRIP_EDGES: Readonly<
  Record<SavedTripStatus, readonly SavedTripStatus[]>
> = {
  upcoming: ["ready", "cancelled"],
  ready: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionTrip(
  from: SavedTripStatus,
  to: SavedTripStatus,
): boolean {
  if (from === to) return true;
  return TRIP_EDGES[from].includes(to);
}

export function nextTripStatuses(
  from: SavedTripStatus,
): readonly SavedTripStatus[] {
  return TRIP_EDGES[from];
}

export function checkTripTransition(
  from: SavedTripStatus,
  to: SavedTripStatus,
): Result<{ from: SavedTripStatus; to: SavedTripStatus }> {
  if (canTransitionTrip(from, to)) return ok({ from, to });
  return err(
    errors.stateTransition(from, to, `Trip cannot move from ${from} to ${to}`),
  );
}
