"use server";

import type { LegVM } from "@/components/concierge";
import type { SpineAnchor, TransitionProgressState } from "@/components/today/spine-model";
import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LEG_MODES = new Set(["walk", "drive", "taxi", "bus", "tube", "train", "flight", "mixed"]);

type Geo = { name?: string | null; latitude?: number | null; longitude?: number | null } | null;
type Hub = (Geo & { code?: string | null; kind?: string | null }) | null;
type StopRow = {
  id: string;
  sequence: number;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: Geo;
  customer_site: Geo;
  transport_hub: Hub;
};
type TransitionRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: string | null;
  is_locked: boolean | null;
  computed_duration_minutes: number | null;
  commitment_state: TransitionProgressState | null;
  actual_started_at: string | null;
  actual_arrived_at: string | null;
};

export type BookendLegs = {
  leading: LegVM | null;
  trailing: LegVM | null;
  endContext: SpineAnchor | null;
};

function labelOf(stop: StopRow): string {
  return stop.title ?? stop.location?.name ?? stop.customer_site?.name ?? stop.transport_hub?.name ?? "Base";
}

function coordOf(stop: StopRow): { lat: number; lng: number } | null {
  for (const geo of [stop.customer_site, stop.location, stop.transport_hub]) {
    if (geo?.latitude != null && geo.longitude != null) return { lat: geo.latitude, lng: geo.longitude };
  }
  return null;
}

function legMode(mode: string | null): LegVM["mode"] {
  return (mode && LEG_MODES.has(mode) ? mode : "mixed") as LegVM["mode"];
}

function navMode(mode: string | null): SpineAnchor["navMode"] {
  if (["drive", "taxi", "car"].includes(mode ?? "")) return "drive";
  if (["cycle", "bike", "bicycle"].includes(mode ?? "")) return "cycle";
  return "walk";
}

function plusMinutes(iso: string | null, minutes: number | null): string | null {
  if (!iso || minutes == null) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? new Date(value + minutes * 60_000).toISOString() : null;
}

function buildLeg(transition: TransitionRow, from: StopRow, to: StopRow): LegVM {
  const departure = from.end_time ?? from.start_time ?? undefined;
  const arrival = plusMinutes(departure ?? null, transition.computed_duration_minutes) ?? to.start_time ?? undefined;
  const target = to.start_time ? Date.parse(to.start_time) : null;
  const arrived = arrival ? Date.parse(arrival) : null;
  const slackMinutes = target != null && arrived != null ? Math.round((target - arrived) / 60_000) : undefined;

  return {
    id: `${transition.from_stop_id}->${transition.to_stop_id}`,
    mode: legMode(transition.mode),
    fromLabel: labelOf(from),
    toLabel: labelOf(to),
    departure,
    arrival,
    notes: transition.computed_duration_minutes != null ? `${transition.computed_duration_minutes} min` : undefined,
    bookingStatus: transition.is_locked ? "booked_in_app" : "manual",
    buffer: slackMinutes != null ? { state: slackMinutes < 0 ? "late" : slackMinutes < 5 ? "tight" : "ok", slackMinutes } : undefined,
    atRisk: slackMinutes != null ? slackMinutes < 5 : false,
  };
}

export async function loadBookendLegs(itineraryId: string): Promise<BookendLegs> {
  await requireUserContext();
  const supabase = await createClient();
  const [{ data: stopData, error: stopError }, { data: transitionData, error: transitionError }] = await Promise.all([
    supabase
      .from("stops")
      .select("id, sequence, type, title, start_time, end_time, location:locations(name, latitude, longitude), customer_site:customer_sites(name, latitude, longitude), transport_hub:transport_hubs(name, code, kind, latitude, longitude)")
      .eq("itinerary_id", itineraryId)
      .order("sequence"),
    supabase
      .from("transitions")
      .select("id, from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes, commitment_state, actual_started_at, actual_arrived_at")
      .eq("itinerary_id", itineraryId),
  ]);

  if (stopError || transitionError) return { leading: null, trailing: null, endContext: null };
  const stops = (stopData ?? []) as unknown as StopRow[];
  const transitions = (transitionData ?? []) as unknown as TransitionRow[];
  const byPair = new Map(transitions.map((transition) => [`${transition.from_stop_id}->${transition.to_stop_id}`, transition]));
  const visible = stops.filter((stop) => stop.type !== "start" && stop.type !== "end");
  const start = stops.find((stop) => stop.type === "start") ?? null;
  const end = [...stops].reverse().find((stop) => stop.type === "end") ?? null;
  const first = visible[0] ?? null;
  const last = visible[visible.length - 1] ?? null;

  const leadingTransition = start && first ? byPair.get(`${start.id}->${first.id}`) ?? null : null;
  const trailingTransition = last && end ? byPair.get(`${last.id}->${end.id}`) ?? null : null;
  const leading = start && first && leadingTransition ? buildLeg(leadingTransition, start, first) : null;
  const trailing = last && end && trailingTransition ? buildLeg(trailingTransition, last, end) : null;

  const endArrival = trailing?.arrival ?? end?.start_time ?? null;
  const endContext: SpineAnchor | null = end && trailingTransition && trailing
    ? {
        id: end.id,
        type: "custom",
        title: labelOf(end),
        place: labelOf(end),
        arriveByIso: endArrival,
        endIso: null,
        coord: coordOf(end),
        plannedTravelMinutes: trailingTransition.computed_duration_minutes,
        bufferMinutes: 0,
        notBeforeIso: last?.end_time ?? last?.start_time ?? null,
        travelMode: trailingTransition.mode,
        inboundTransitionId: trailingTransition.id,
        transitionState: trailingTransition.commitment_state,
        actualStartedAt: trailingTransition.actual_started_at,
        actualArrivedAt: trailingTransition.actual_arrived_at,
        navMode: navMode(trailingTransition.mode),
        station: null,
        role: "stop",
        mode: null,
        pass: null,
        contextOnly: true,
      }
    : null;

  return { leading, trailing, endContext };
}
