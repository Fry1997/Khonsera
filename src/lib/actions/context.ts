"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { evaluateContext, type Nudge, type NudgeAction, type WeatherLegInput, type FlightBufferInput } from "@/lib/context/engine";
import { corridorForecast } from "@/lib/integrations/open-meteo";
import { bookFastTrack } from "@/lib/integrations/dragonpass";
import { createNote } from "@/lib/actions/notes";

// Context-engine action layer (Phase 12). Computes the live nudge set for a day
// (weather + buffer signals → engine), filters out anything the traveller has
// already accepted/dismissed, and persists a verdict — applying the accepted
// action through its provider seam. Nudges themselves are NEVER stored; only the
// verdict is (table 0036), so the set is always current.

// A nudge with its persisted state attached, for the surface.
export type NudgeVM = Nudge & { verdict?: "accepted" | "dismissed"; actionResult?: unknown };

type LegFact = {
  legId: string;
  mode: string;
  toLabel: string;
  departIso: string | null;
  // Destination coords for the weather corridor sample (one point, day one).
  lat: number | null;
  lng: number | null;
  isFirstLeaveHome: boolean;
};
type FlightFact = { flightStopId: string; airport: string; flightDepartIso: string; arriveAirportIso: string };

// Compute + merge. The page passes the day's leg/flight facts (it already has the
// stops loaded); we fetch weather only for the leave-home leg (one call) and run
// the engine, then drop nudges with a stored verdict.
export async function loadNudges(args: {
  itineraryId: string;
  nowIso: string;
  legs: LegFact[];
  flights: FlightFact[];
}): Promise<NudgeVM[]> {
  const supabase = await createClient();

  // Weather only where it's actionable: the leg that leaves home. One forecast.
  const weatherLegs: WeatherLegInput[] = [];
  const homeLeg = args.legs.find((l) => l.isFirstLeaveHome && l.departIso && l.lat != null && l.lng != null);
  if (homeLeg && homeLeg.departIso) {
    const endIso = new Date(new Date(homeLeg.departIso).getTime() + 90 * 60_000).toISOString();
    const weather = await corridorForecast({ lat: homeLeg.lat!, lng: homeLeg.lng!, startIso: homeLeg.departIso, endIso });
    if (weather) {
      weatherLegs.push({ legId: homeLeg.legId, mode: homeLeg.mode, toLabel: homeLeg.toLabel, departIso: homeLeg.departIso, weather });
    }
  }

  const flightBuffers: FlightBufferInput[] = args.flights.map((f) => ({
    flightStopId: f.flightStopId,
    airport: f.airport,
    flightDepartIso: f.flightDepartIso,
    arriveAirportIso: f.arriveAirportIso,
  }));

  const nudges = evaluateContext({ nowIso: args.nowIso, weatherLegs, flightBuffers });
  if (!nudges.length) return [];

  const { data: states } = await supabase
    .from("nudge_states")
    .select("nudge_key, verdict, action")
    .eq("itinerary_id", args.itineraryId);
  const byKey = new Map((states ?? []).map((s) => [s.nudge_key as string, s]));

  // Dismissed → gone (never pester). Accepted → keep, in its done state. Open → show.
  return nudges
    .map((n): NudgeVM | null => {
      const st = byKey.get(n.key);
      if (st?.verdict === "dismissed") return null;
      return { ...n, verdict: st?.verdict as NudgeVM["verdict"], actionResult: st?.action ?? undefined };
    })
    .filter((n): n is NudgeVM => n !== null);
}

const setSchema = z.object({
  itineraryId: z.string().uuid(),
  nudgeKey: z.string().min(1),
  verdict: z.enum(["accepted", "dismissed"]),
  // The engine's proposed action, echoed back so accept can apply it.
  action: z.any().optional(),
});

export async function setNudgeVerdict(input: z.input<typeof setSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid nudge verdict." };
  const { itineraryId, nudgeKey, verdict } = parsed.data;
  const action = parsed.data.action as NudgeAction | undefined;
  const supabase = await createClient();
  await requireUserContext(); // RLS enforces ownership; this just ensures auth.

  let actionResult: unknown = null;

  // Accept → apply through the seam. A prep note records the decision (the durable
  // artifact on the spine); a fast-track accept mints the voucher via DragonPass.
  if (verdict === "accepted" && action) {
    if (action.kind === "leave-earlier") {
      await createNote({
        itineraryId,
        kind: "prep",
        title: `Leave ${action.minutes} min earlier`,
        body: `Khonsera: ${action.reason}.`,
      });
    } else if (action.kind === "expedite-security") {
      // The flight's departure is encoded in the key (expedite:<stopId>); look it
      // up so the voucher window is real.
      const stopId = nudgeKey.split(":")[1];
      const { data: stop } = await supabase.from("stops").select("start_time").eq("id", stopId).maybeSingle();
      const voucher = await bookFastTrack({
        airport: action.airport,
        flightDepartIso: (stop?.start_time as string) ?? new Date().toISOString(),
      });
      actionResult = voucher;
      await createNote({
        itineraryId,
        stopId,
        kind: "prep",
        title: `Fast-track booked — ${action.airport}`,
        body: `Khonsera: ${voucher.lane}. Ref ${voucher.reference}, valid until ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(voucher.validToIso))}.${voucher.sample ? " (sample)" : ""}`,
      });
    }
  }

  const { error } = await supabase
    .from("nudge_states")
    .upsert(
      { itinerary_id: itineraryId, nudge_key: nudgeKey, verdict, action: actionResult as object | null },
      { onConflict: "itinerary_id,nudge_key" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}
