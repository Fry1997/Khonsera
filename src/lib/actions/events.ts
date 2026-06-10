"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Events (proposal §1) — an Event is one `itineraries` row: a single day or a
// multi-day trip, hinged on date_start, spanning to date_end (default single-day
// until a bounding fact extends it, §5). No migration — Events ARE itineraries.
//
// This is the create door for the Plan index: a new Event needs a start date
// (the hinge) and an optional name (Khonsera auto-names from the first place
// later if blank). It opens straight into the Event detail.

export async function createEvent(input: {
  dateStart: string; // YYYY-MM-DD — the hinge / lock
  name?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const date = (input.dateStart ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Pick a start date." };
  }
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("itineraries")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      mode: ctx.activeMode,
      title: input.name?.trim() || null,
      date_start: date,
      date_end: date, // single-day until a bounding fact extends it (§5)
      status: "planning",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Couldn't start that. Please try again." };
  }
  return { ok: true, id: data.id as string };
}

// Convenience for a form action: create then navigate into the Event.
export async function createEventAndOpen(formData: FormData): Promise<void> {
  const res = await createEvent({
    dateStart: String(formData.get("dateStart") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (res.ok && res.id) redirect(`/plan/${res.id}` as Route);
  redirect("/plan" as Route);
}

// Span inference (proposal §5): a multi-day Event's bounds are derived from its
// facts — a return flight/train, a hotel checkout — so "fly out the 25th, back
// the 28th" becomes a 4-day Event automatically; a lone appointment stays single
// day until a bounding fact appears. Mechanism: the span is [earliest, latest]
// across the Event's stops (every bounding fact is a stop with a time), never
// shrinking below the user's chosen start. Idempotent — safe on every
// materialise and on open (backfills legacy Events).
function ymd(iso: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
}

export async function inferAndUpdateSpan(itineraryId: string): Promise<void> {
  const supabase = await createClient();
  const { data: journey } = await supabase
    .from("itineraries")
    .select("date_start, date_end")
    .eq("id", itineraryId)
    .maybeSingle();
  if (!journey) return;

  const { data: stops } = await supabase
    .from("stops")
    .select("start_time, end_time")
    .eq("itinerary_id", itineraryId);

  const dates: string[] = [];
  for (const s of stops ?? []) {
    const a = ymd((s.start_time as string | null) ?? "");
    const b = ymd((s.end_time as string | null) ?? "");
    if (a) dates.push(a);
    if (b) dates.push(b);
  }
  if (dates.length === 0) return;

  dates.sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  const newStart = earliest < (journey.date_start as string) ? earliest : (journey.date_start as string);
  const newEnd = latest > (journey.date_end as string) ? latest : (journey.date_end as string);

  if (newStart !== journey.date_start || newEnd !== journey.date_end) {
    await supabase
      .from("itineraries")
      .update({ date_start: newStart, date_end: newEnd })
      .eq("id", itineraryId);
  }
}
