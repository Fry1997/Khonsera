"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import {
  evaluateContext,
  type Nudge,
  type NudgeAction,
  type WeatherLegInput,
  type FlightBufferInput,
  type LoungeInput,
  type ParkingInput,
  type GateChangeInput,
} from "@/lib/context/engine";
import { bookFastTrack, bookLounge } from "@/lib/integrations/dragonpass";
import { parkingOutlook, reserveParking } from "@/lib/integrations/parkopedia";
import { flightDepartureStatus } from "@/lib/integrations/aerodatabox";
import { createNote } from "@/lib/actions/notes";

const hhmm = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));

export type NudgeVM = Nudge & { verdict?: "accepted" | "dismissed"; actionResult?: unknown };

type LegFact = {
  legId: string;
  mode: string;
  toLabel: string;
  departIso: string | null;
  lat: number | null;
  lng: number | null;
  isFirstLeaveHome: boolean;
};
type FlightFact = { flightStopId: string; airport: string; flightDepartIso: string; arriveAirportIso: string };
type LoungeFact = { flightStopId: string; airport: string; dwellMin: number; boardingIso: string };
type ParkingFact = { legId: string; site: string; arriveIso: string; departIso: string; untilIso: string };
type GateFlightFact = { flightStopId: string; airport: string; flightNumber: string; baselineGate: string; walkMin: number; boardingIso: string; dateIso: string };

type LoadNudgesArgs = {
  itineraryId: string;
  nowIso: string;
  legs: LegFact[];
  flights: FlightFact[];
  lounges?: LoungeFact[];
  parkings?: ParkingFact[];
  gateFlights?: GateFlightFact[];
};

// The current action accepts structured context. The second overload keeps the
// older Plan page call working while that surface is incrementally moved onto
// the structured facts: it simply produces no speculative provider nudges.
export function loadNudges(args: LoadNudgesArgs): Promise<NudgeVM[]>;
export function loadNudges(itineraryId: string, legacyNodes: unknown[]): Promise<NudgeVM[]>;
export async function loadNudges(argsOrId: LoadNudgesArgs | string, _legacyNodes?: unknown[]): Promise<NudgeVM[]> {
  const args: LoadNudgesArgs =
    typeof argsOrId === "string"
      ? { itineraryId: argsOrId, nowIso: new Date().toISOString(), legs: [], flights: [] }
      : argsOrId;
  const supabase = await createClient();

  // Weather is intentionally absent here. It is fetched on Today, where it is
  // visible and day-of relevant, rather than blocking every Plan render.
  const weatherLegs: WeatherLegInput[] = [];

  const flightBuffers: FlightBufferInput[] = args.flights.map((f) => ({
    flightStopId: f.flightStopId,
    airport: f.airport,
    flightDepartIso: f.flightDepartIso,
    arriveAirportIso: f.arriveAirportIso,
  }));

  const lounges: LoungeInput[] = (args.lounges ?? []).map((l) => ({
    flightStopId: l.flightStopId,
    airport: l.airport,
    dwellMin: l.dwellMin,
    boardingIso: l.boardingIso,
  }));

  const parkings: ParkingInput[] = await Promise.all(
    (args.parkings ?? []).map(async (p) => {
      const outlook = await parkingOutlook({ site: p.site, arriveIso: p.arriveIso });
      return {
        legId: p.legId,
        site: p.site,
        predictedOccupancyPct: outlook.predictedOccupancyPct,
        departIso: p.departIso,
        untilIso: p.untilIso,
        sample: outlook.sample,
      };
    }),
  );

  const gateChanges: GateChangeInput[] = (
    await Promise.all(
      (args.gateFlights ?? []).map(async (g): Promise<GateChangeInput | null> => {
        const status = await flightDepartureStatus({ flightNumber: g.flightNumber, dateIso: g.dateIso });
        if (!status?.gate || status.gate === g.baselineGate || status.sample) return null;
        return {
          flightStopId: g.flightStopId,
          airport: g.airport,
          fromGate: g.baselineGate,
          toGate: status.gate,
          walkMin: g.walkMin,
          boardingIso: g.boardingIso,
        };
      }),
    )
  ).filter((g): g is GateChangeInput => g !== null);

  const nudges = evaluateContext({
    nowIso: args.nowIso,
    weatherLegs,
    flightBuffers,
    lounges,
    parkings,
    gateChanges,
  });
  if (!nudges.length) return [];

  const { data: states } = await supabase
    .from("nudge_states")
    .select("nudge_key, verdict, action")
    .eq("itinerary_id", args.itineraryId);
  const byKey = new Map((states ?? []).map((s) => [s.nudge_key as string, s]));

  return nudges
    .map((n): NudgeVM | null => {
      const st = byKey.get(n.key);
      if (st?.verdict === "dismissed") return null;
      return {
        ...n,
        verdict: st?.verdict as NudgeVM["verdict"],
        actionResult: st?.action ?? undefined,
      };
    })
    .filter((n): n is NudgeVM => n !== null);
}

const setSchema = z.object({
  itineraryId: z.string().uuid(),
  nudgeKey: z.string().min(1),
  verdict: z.enum(["accepted", "dismissed"]),
  action: z.any().optional(),
});

export async function setNudgeVerdict(input: z.input<typeof setSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid nudge verdict." };
  const { itineraryId, nudgeKey, verdict } = parsed.data;
  const action = parsed.data.action as NudgeAction | undefined;
  const supabase = await createClient();
  await requireUserContext();

  let actionResult: unknown = null;

  if (verdict === "accepted" && action) {
    if (action.kind === "leave-earlier") {
      await createNote({
        itineraryId,
        kind: "prep",
        title: `Leave ${action.minutes} min earlier`,
        body: `Khonsera: ${action.reason}.`,
      });
    } else if (action.kind === "expedite-security") {
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
        body: `Khonsera: ${voucher.lane}. Ref ${voucher.reference}, valid until ${hhmm(voucher.validToIso)}.${voucher.sample ? " (sample)" : ""}`,
      });
    } else if (action.kind === "book-lounge") {
      const stopId = nudgeKey.split(":")[1];
      const pass = await bookLounge({ airport: action.airport, boardingIso: action.boardingIso, windowMin: action.windowMin });
      actionResult = pass;
      await createNote({
        itineraryId,
        stopId,
        kind: "prep",
        title: `Lounge booked — ${pass.loungeName}`,
        body: `Khonsera: ${pass.loungeName} at ${action.airport}. Ref ${pass.reference}, access until ${hhmm(pass.validToIso)}.${pass.sample ? " (sample)" : ""}`,
      });
    } else if (action.kind === "prebook-parking") {
      const reservation = await reserveParking({ site: action.site, fromIso: action.fromIso, toIso: action.toIso });
      actionResult = reservation;
      await createNote({
        itineraryId,
        kind: "prep",
        title: `Parking reserved — ${action.site}`,
        body: `Khonsera: space held at ${action.site}. Ref ${reservation.reference}.${reservation.sample ? " (sample)" : ""}`,
      });
    } else if (action.kind === "gate-reroute") {
      const stopId = nudgeKey.split(":")[1];
      await createNote({
        itineraryId,
        stopId,
        kind: "prep",
        title: `Gate ${action.toGate} — ${action.airport}`,
        body: `Khonsera: head to gate ${action.toGate} (was ${action.fromGate}), about ${action.walkMin} min walk.`,
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
