"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { createStop } from "@/lib/actions/stops";
import { ensureHomeBookend } from "@/lib/actions/plan-edit";
import { resolveItineraryTimes } from "@/lib/actions/itineraries";
import { wallClockToIso } from "@/lib/time-zone";

// Recurring events (mig 0050). A recurring COMMITMENT, not a recurring booking:
// the rule seeds the event only (weekday/time/place); transport is added per
// occurrence. Materialisation is LAZY — generated on Plan load, ~8 weeks ahead,
// idempotent (a date already created for a rule is skipped). Once a day is
// generated it's its own thing: editing it is local; editing the rule only
// affects future, not-yet-generated days.

export type RecurringEventVM = {
  id: string;
  title: string;
  weekday: number; // 0=Sun..6=Sat
  startTime: string; // HH:MM
  durationMinutes: number;
  mode: "work" | "personal";
  locationId: string | null;
  active: boolean;
};

const WEEKS_AHEAD = 8;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function listRecurringEvents(): Promise<RecurringEventVM[]> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_events")
    .select("id, title, weekday, start_time, duration_minutes, mode, location_id, active")
    .eq("user_id", ctx.userId)
    .order("weekday");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    weekday: r.weekday as number,
    startTime: r.start_time as string,
    durationMinutes: r.duration_minutes as number,
    mode: (r.mode as "work" | "personal") ?? "work",
    locationId: (r.location_id as string | null) ?? null,
    active: r.active as boolean,
  }));
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  mode: z.enum(["work", "personal"]),
  locationId: z.string().uuid().nullable().optional(),
});

export async function createRecurringEvent(
  input: z.input<typeof createSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in the event, day and time." };
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_events").insert({
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    title: parsed.data.title,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    duration_minutes: parsed.data.durationMinutes,
    mode: parsed.data.mode,
    location_id: parsed.data.locationId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  // Materialise straight away so the upcoming days appear now.
  await materializeRecurring();
  revalidatePath("/plan");
  return { ok: true };
}

export async function deleteRecurringEvent(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireUserContext();
  const supabase = await createClient();
  // Stop future generation. Already-generated days remain (delete them individually).
  const { error } = await supabase.from("recurring_events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plan");
  return { ok: true };
}

// LAZY GENERATOR — called on Plan load + after create. For each active rule it
// ensures the next WEEKS_AHEAD weekly occurrences exist as real days. Idempotent:
// a (rule, date) already present is skipped, so steady-state is just a read.
export async function materializeRecurring(): Promise<void> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("recurring_events")
    .select("id, title, weekday, start_time, duration_minutes, mode, location_id")
    .eq("user_id", ctx.userId)
    .eq("active", true);
  if (!rules?.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rule of rules) {
    // The next WEEKS_AHEAD dates on this weekday, from today.
    const dates: string[] = [];
    const cursor = new Date(today);
    while (cursor.getDay() !== (rule.weekday as number)) cursor.setDate(cursor.getDate() + 1);
    for (let i = 0; i < WEEKS_AHEAD; i++) {
      dates.push(ymd(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    const { data: existing } = await supabase
      .from("itineraries")
      .select("date_start")
      .eq("recurring_event_id", rule.id as string)
      .in("date_start", dates);
    const have = new Set((existing ?? []).map((r) => r.date_start as string));
    const missing = dates.filter((d) => !have.has(d));

    for (const date of missing) {
      const { data: itin } = await supabase
        .from("itineraries")
        .insert({
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          mode: rule.mode,
          title: rule.title as string,
          date_start: date,
          date_end: date,
          status: "planning",
          recurring_event_id: rule.id as string,
        })
        .select("id")
        .single();
      if (!itin) continue;

      const startIso = wallClockToIso(date, rule.start_time as string);
      const endIso = startIso
        ? new Date(new Date(startIso).getTime() + (rule.duration_minutes as number) * 60_000).toISOString()
        : null;
      await createStop({
        itinerary_id: itin.id as string,
        type: "appointment",
        title: rule.title as string,
        start_time: startIso,
        end_time: endIso,
        duration_minutes: rule.duration_minutes as number,
        is_time_fixed: true,
        location_id: (rule.location_id as string | null) ?? null,
      });
      await ensureHomeBookend(itin.id as string, { create: true });
      await resolveItineraryTimes(itin.id as string);
    }
  }
}
