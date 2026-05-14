// TS mirror of the visit_plan_transition function in 0003_state_machines.sql.
// Keep the edge set IDENTICAL to the SQL edge table — if you change one,
// change both. The TS reducer is used for client-side reasoning (which
// buttons to show, what's next) and tests; the SQL function is the
// authoritative gate for actual writes.

import type { VisitStatus } from "@/lib/types/domain";
import { errors, type Result, ok, err } from "@/lib/errors";

export const VISIT_EDGES: Readonly<Record<VisitStatus, readonly VisitStatus[]>> = {
  draft: ["checking", "cancelled"],
  checking: ["draft", "proposed", "cancelled"],
  proposed: ["checking", "confirmed", "cancelled"],
  confirmed: ["booked", "in_progress", "cancelled"],
  booked: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: ["draft"],
};

export function canTransitionVisit(from: VisitStatus, to: VisitStatus): boolean {
  if (from === to) return true; // idempotent
  return VISIT_EDGES[from].includes(to);
}

export function nextVisitStatuses(from: VisitStatus): readonly VisitStatus[] {
  return VISIT_EDGES[from];
}

export function checkVisitTransition(
  from: VisitStatus,
  to: VisitStatus,
): Result<{ from: VisitStatus; to: VisitStatus }> {
  if (canTransitionVisit(from, to)) return ok({ from, to });
  return err(
    errors.stateTransition(from, to, `Visit cannot move from ${from} to ${to}`),
  );
}
