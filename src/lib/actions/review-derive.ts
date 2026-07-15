export type ReviewStopRow = {
  id: string;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
};

export type ReviewTransitionRow = {
  from_stop_id: string;
  to_stop_id: string;
  mode: string;
  is_locked: boolean | null;
  computed_duration_minutes: number | null;
};

const NON_DEPARTURE_STOP_TYPES = new Set(["end", "transit_arrival", "transit_changeover"]);

function stopDepartureTime(stop: ReviewStopRow | undefined): string | null {
  if (!stop || NON_DEPARTURE_STOP_TYPES.has(stop.type)) return null;
  if (stop.type === "start") return stop.end_time ?? stop.start_time ?? null;
  return stop.start_time ?? stop.end_time ?? null;
}

export function deriveReviewLeaveBy(stops: ReviewStopRow[], transitions: ReviewTransitionRow[]): string | null {
  const byId = new Map(stops.map((st) => [st.id, st]));
  const home = stops.find((st) => st.type === "start");
  const homeDeparture = stopDepartureTime(home);
  if (homeDeparture) return homeDeparture;

  const orderedTransitions = home
    ? [...transitions].sort((a, b) => (a.from_stop_id === home.id ? -1 : b.from_stop_id === home.id ? 1 : 0))
    : transitions;

  for (const transition of orderedTransitions) {
    const departure = stopDepartureTime(byId.get(transition.from_stop_id));
    if (departure) return departure;
  }

  const firstDepartureStop = stops.find((stop) => stopDepartureTime(stop));
  return stopDepartureTime(firstDepartureStop);
}
