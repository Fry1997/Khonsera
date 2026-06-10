"use server";

import { revalidatePath } from "next/cache";
import { previewCapture } from "@/lib/actions/tell-khonsera";
import { factsToBrief } from "@/lib/parser/materialise";
import { createStop, reorderStops } from "@/lib/actions/stops";
import { resolveItineraryTimes } from "@/lib/actions/itineraries";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import type { ParsedPayload } from "@/lib/parser/types";

// Capture → an Event (proposal §4). Chunk 2: when you're inside an Event, a
// plain-language fact APPENDS to that Event, by time — the same model as a
// manual add. The global "Tell" routing (find-or-create by date) + dateless →
// reminder land in chunk 2b; the global create-from-empty path is captureOnPlan.

// brief anchor kind → stops.type
const KIND_STOP: Record<string, string> = {
  appointment: "appointment",
  event: "event",
  meal: "meal",
  stay: "accommodation",
};

function isoFrom(date: string, time: string | null): string | null {
  if (!time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Materialise the ANCHOR facts of a parse into an existing Event. Booked travel,
// transitions and accommodation bookings are deferred (they ride the booking /
// scan path) — reported back so the user knows nothing was silently dropped.
async function appendFactsToEvent(
  eventId: string,
  payload: Awaited<ReturnType<typeof previewCapture>>,
): Promise<{ ok: boolean; added: number; deferred: boolean; error?: string }> {
  const { brief } = factsToBrief(payload);
  const anchors = brief.anchors.filter((a) => a.kind in KIND_STOP);
  const deferred =
    brief.transport_bookings.length > 0 ||
    brief.transitions.length > 0 ||
    brief.accommodation_bookings.length > 0 ||
    brief.anchors.some((a) => a.kind === "station");

  let added = 0;
  for (const a of anchors) {
    const iso = isoFrom(a.date, a.time);
    const res = await createStop({
      itinerary_id: eventId,
      type: KIND_STOP[a.kind] as Parameters<typeof createStop>[0]["type"],
      title: a.label ?? null,
      start_time: iso,
      is_time_fixed: Boolean(iso) && a.timing_mode === "arrive_by",
      location_id: a.location_id ?? null,
      contact_id: a.contact_id ?? null,
      metadata: { source: "captured", timing_mode: a.timing_mode },
    });
    if (res.ok) added += 1;
  }

  if (added === 0) {
    // Nothing addable, but there were booked-travel/connection facts → not a
    // failure, just deferred to the booking/scan path.
    if (deferred) return { ok: true, added: 0, deferred: true };
    return { ok: false, added: 0, deferred, error: "I couldn't place that on this day." };
  }

  // Re-sequence the whole spine chronologically (insert-by-time), then re-solve.
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("stops")
    .select("id, start_time")
    .eq("itinerary_id", eventId)
    .eq("workspace_id", ctx.workspaceId);
  const ordered = (rows ?? [])
    .slice()
    .sort((x, y) => {
      const tx = x.start_time ? new Date(x.start_time as string).getTime() : Infinity;
      const ty = y.start_time ? new Date(y.start_time as string).getTime() : Infinity;
      return tx - ty;
    })
    .map((r) => r.id as string);
  if (ordered.length > 1) await reorderStops({ itinerary_id: eventId, stop_ids: ordered });
  await resolveItineraryTimes(eventId);

  return { ok: true, added, deferred };
}

// In-Event capture: parse text and append to THIS Event.
export async function captureToEvent(
  eventId: string,
  text: string,
): Promise<{ ok: boolean; error?: string; note?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Tell me something to add." };

  const payload = await previewCapture(trimmed);
  if (!payload.facts || payload.facts.length === 0) {
    return { ok: false, error: "I couldn't find a fact in that — try a place, a time, or an appointment." };
  }

  const res = await appendFactsToEvent(eventId, payload);
  if (!res.ok) return { ok: false, error: res.error ?? "Couldn't add that." };

  revalidatePath(`/plan/${eventId}`);
  return {
    ok: true,
    note: res.deferred
      ? "Added. Booked travel and connections add via Scan / + Transport — coming next."
      : undefined,
  };
}

// Global "Tell Khonsera" routing (proposal §4) — resolve the target Event from
// the fact's DATE, never a silent singleton:
//   · a date that an existing Event covers  → append to it
//   · a date with no Event                  → create one from the facts (confirmCapture)
//   · no date at all                        → a Reminder (a dateless intent)
// Takes the (possibly slot-edited) payload from the capture screen.
export async function routeCaptureGlobal(input: {
  captured_input_id?: string | null;
  payload: ParsedPayload;
}): Promise<{ ok: boolean; eventId?: string; reminder?: boolean; note?: string; error?: string }> {
  const payload = input.payload;
  const { brief } = factsToBrief(payload);

  const dates: string[] = [];
  for (const a of brief.anchors) if (a.date) dates.push(a.date);
  for (const b of brief.transport_bookings) if (b.date) dates.push(b.date);
  for (const ac of brief.accommodation_bookings) if (ac.check_in_date) dates.push(ac.check_in_date);
  const primaryDate = dates.sort()[0] ?? null;

  const { confirmCapture } = await import("@/lib/actions/tell-khonsera");

  // Dateless → a Reminder (confirmCapture routes anchorless facts to intents).
  if (!primaryDate) {
    const res = await confirmCapture(input as unknown as Parameters<typeof confirmCapture>[0]);
    if (!res.ok) {
      const msg = "message" in res.error ? res.error.message : "Couldn't save that.";
      return { ok: false, error: msg };
    }
    return { ok: true, reminder: true };
  }

  // Find an existing Event whose span covers the date.
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: found } = await supabase
    .from("itineraries")
    .select("id")
    .eq("mode", ctx.activeMode)
    .lte("date_start", primaryDate)
    .gte("date_end", primaryDate)
    .order("date_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (found) {
    const res = await appendFactsToEvent(found.id as string, payload);
    if (!res.ok) return { ok: false, error: res.error ?? "Couldn't add that." };
    revalidatePath(`/plan/${found.id}`);
    return {
      ok: true,
      eventId: found.id as string,
      note: res.deferred ? "Booked travel and connections add via Scan / + Transport — coming next." : undefined,
    };
  }

  // No Event for that date → create one from the facts.
  const res = await confirmCapture(input as unknown as Parameters<typeof confirmCapture>[0]);
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't add that.";
    return { ok: false, error: msg };
  }
  revalidatePath("/plan");
  return res.value.itinerary_id
    ? { ok: true, eventId: res.value.itinerary_id }
    : { ok: true, reminder: true };
}

// Legacy create-from-empty path (kept for compatibility). Creates a NEW Event.
export async function captureOnPlan(text: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Tell me something to add." };

  const payload = await previewCapture(trimmed);
  if (!payload.facts || payload.facts.length === 0) {
    return { ok: false, error: "I couldn't find a fact in that — try a place, a time, or a booking." };
  }

  const { confirmCapture } = await import("@/lib/actions/tell-khonsera");
  const res = await confirmCapture({ payload } as unknown as Parameters<typeof confirmCapture>[0]);
  if (!res.ok) {
    const msg = "message" in res.error ? res.error.message : "Couldn't add that.";
    return { ok: false, error: msg };
  }
  revalidatePath("/plan");
  return { ok: true };
}
