"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { loadReadiness } from "@/lib/actions/readiness";
import { deriveReviewLeaveBy, type ReviewStopRow, type ReviewTransitionRow } from "@/lib/actions/review-derive";

// The night-before review (Phase 5, B3.6) — preparation's payoff. NOT a new
// entity: a calm composition of what the day-object, the timing engine, and the
// readiness check already produce. "Here's tomorrow, here's when you leave,
// you're ready" — discharged the evening before, not white-knuckled at dawn.

export type ReviewCommitment = { label: string; timeLabel: string | null };

export type DayReview = {
  itineraryId: string;
  title: string;
  dateLabel: string;
  leaveBy: string | null; // ISO — the one time that matters
  totalDurationLabel: string | null;
  legCount: number;
  commitments: ReviewCommitment[];
  fragile: boolean;
  fragileNote: string | null;
  readinessOpen: number;
  readinessDone: number;
  verdict: string;
};

type StopRow = ReviewStopRow;
type TransRow = ReviewTransitionRow;

function clock(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m} min`;
}

export async function buildDayReview(itineraryId: string): Promise<DayReview | null> {
  await requireUserContext();
  const supabase = await createClient();

  const { data: itin } = await supabase
    .from("itineraries")
    .select("id, title, date_start")
    .eq("id", itineraryId)
    .maybeSingle();
  if (!itin) return null;

  const [{ data: s }, { data: t }, readiness] = await Promise.all([
    supabase.from("stops").select("id, type, title, start_time, end_time").eq("itinerary_id", itineraryId).order("sequence"),
    supabase.from("transitions").select("from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes").eq("itinerary_id", itineraryId),
    loadReadiness(itineraryId),
  ]);
  const stops = (s ?? []) as StopRow[];
  const transitions = (t ?? []) as TransRow[];
  const byId = new Map(stops.map((st) => [st.id, st]));

  // Leave-by is a departure from the user's base/day origin. Never derive it
  // from a transit arrival or changeover when legacy imported journeys are
  // missing the explicit home/start bookend.
  const leaveBy = deriveReviewLeaveBy(stops, transitions);

  // Route shape + fragility (a leg with no slack the day can't absorb).
  let totalMinutes = 0;
  let fragile = false;
  let fragileNote: string | null = null;
  for (const tr of transitions) {
    totalMinutes += tr.computed_duration_minutes ?? 0;
    if (tr.is_locked) continue;
    const from = byId.get(tr.from_stop_id);
    const to = byId.get(tr.to_stop_id);
    const feas = checkLegFeasibility({
      fromEnd: from?.end_time ? new Date(from.end_time) : from?.start_time ? new Date(from.start_time) : null,
      toStart: to?.start_time ? new Date(to.start_time) : null,
      travelMinutes: tr.computed_duration_minutes,
    });
    if (feas.state === "tight" || feas.state === "late") {
      fragile = true;
      if (!fragileNote) fragileNote = `Tight connection into ${to?.title ?? "your next stop"}`;
    }
  }

  const commitments: ReviewCommitment[] = stops
    .filter((st) => st.type !== "start" && st.type !== "end" && st.start_time)
    .map((st) => ({ label: st.title ?? "Stop", timeLabel: clock(st.start_time) }));

  const open = readiness.filter((r) => r.status === "open" || r.status === "snoozed").length;
  const done = readiness.filter((r) => r.status === "done").length;

  const verdict = fragile
    ? "One tight leg to keep an eye on — otherwise you're set."
    : open > 0
      ? `A few things to sort — ${open} on the list — then you're ready.`
      : "You're ready. Sleep easy.";

  return {
    itineraryId,
    title: itin.title || "Your day",
    dateLabel: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${itin.date_start as string}T12:00:00`)),
    leaveBy,
    totalDurationLabel: totalMinutes > 0 ? durationLabel(totalMinutes) : null,
    legCount: transitions.length,
    commitments,
    fragile,
    fragileNote,
    readinessOpen: open,
    readinessDone: done,
    verdict,
  };
}
