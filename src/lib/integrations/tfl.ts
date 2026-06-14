// TfL Unified API — London city-mobility live data (Phase 8). Free, key-gated.
// Built mocks-first per the build plan: returns a deterministic DEMO board until
// TFL_APP_KEY is set, then fetches live. Never blocks the build on a key.
//
// Max-scope target (capability map): line status + disruption, live arrivals,
// multimodal journey planner, StopPoint search, network-map line sequences.
// This first cut ships LINE STATUS live+mock; arrivals/journey are typed seams.

import type { IntegrationResult } from "./types";

const BASE = process.env.TFL_API_BASE ?? "https://api.tfl.gov.uk";

export function tflKey(): string | null {
  return process.env.TFL_APP_KEY ?? null;
}

export type TflLineState = "good" | "minor" | "severe" | "suspended" | "info";

export type TflLine = {
  id: string;
  name: string;
  mode: string; // tube | overground | elizabeth-line | dlr | tram
  state: TflLineState;
  status: string; // "Good Service" · "Minor Delays" …
  reason?: string;
};

// The modes a Londoner navigates by — the network maps people picture.
const MODES = "tube,overground,elizabeth-line,dlr,tram";

function stateOf(severityDescription: string): TflLineState {
  const d = severityDescription.toLowerCase();
  if (d.includes("good")) return "good";
  if (d.includes("minor")) return "minor";
  if (d.includes("suspend") || d.includes("closed") || d.includes("not running")) return "suspended";
  if (d.includes("severe") || d.includes("part")) return "severe";
  return "info";
}

type TflStatusRow = {
  id: string;
  name: string;
  modeName?: string;
  lineStatuses?: { statusSeverityDescription?: string; reason?: string }[];
};

// A realistic mock board: mostly good, with one minor + one severe carrying a
// reason — so the surface (and Design's skin) is exercised before the key lands.
function mockLines(): TflLine[] {
  const good = (id: string, name: string, mode = "tube"): TflLine => ({ id, name, mode, state: "good", status: "Good Service" });
  return [
    good("bakerloo", "Bakerloo"),
    good("central", "Central"),
    good("circle", "Circle"),
    good("district", "District"),
    { id: "jubilee", name: "Jubilee", mode: "tube", state: "minor", status: "Minor Delays", reason: "Minor delays due to an earlier signal failure at Waterloo." },
    good("northern", "Northern"),
    { id: "piccadilly", name: "Piccadilly", mode: "tube", state: "severe", status: "Severe Delays", reason: "Severe delays while we fix a faulty train at Acton Town." },
    good("victoria", "Victoria"),
    good("elizabeth", "Elizabeth line", "elizabeth-line"),
    good("london-overground", "Overground", "overground"),
    good("dlr", "DLR", "dlr"),
  ];
}

/** Live London line status, or a deterministic mock until TFL_APP_KEY is set. */
export async function tflLineStatus(): Promise<IntegrationResult<TflLine[]>> {
  const key = tflKey();
  if (!key) return { mode: "demo", demo: true, data: mockLines() };
  try {
    const url = `${BASE}/Line/Mode/${MODES}/Status?app_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`TfL ${res.status}`);
    const rows = (await res.json()) as TflStatusRow[];
    const lines: TflLine[] = rows.map((r) => {
      const ls = r.lineStatuses?.[0];
      const desc = ls?.statusSeverityDescription ?? "Unknown";
      return { id: r.id, name: r.name, mode: r.modeName ?? "tube", state: stateOf(desc), status: desc, reason: ls?.reason ?? undefined };
    });
    return { mode: "live", data: lines };
  } catch (e) {
    console.warn("TfL line status failed; falling back to mock", e);
    return { mode: "demo", demo: true, data: mockLines() };
  }
}

// ---------------------------------------------------------------------------
// Multimodal journey planner (walk → Tube → walk) + live arrivals at the
// boarding stop. Both live + mock, same key. A London leg of the day-object is
// resolved to a real transit plan; arrivals come from the plan's departure stop.
// ---------------------------------------------------------------------------

export type TflJourneyLeg = {
  mode: string; // walking | tube | overground | elizabeth-line | dlr | bus
  line?: string; // "Victoria" — when it's a line
  summary: string; // "Victoria line to Victoria"
  durationMin: number;
};

export type TflJourneyPlan = {
  durationMin: number;
  legs: TflJourneyLeg[];
  boardingStopId?: string; // naptan of the first transit leg's departure — for arrivals
  boardingName?: string;
};

export type TflArrival = {
  line: string;
  destination: string;
  dueMin: number; // minutes to the platform
  platform?: string;
};

export type LatLng = { lat: number; lng: number };

function mockJourney(): TflJourneyPlan {
  return {
    durationMin: 21,
    legs: [
      { mode: "walking", summary: "Walk to the station", durationMin: 6 },
      { mode: "tube", line: "Victoria", summary: "Victoria line", durationMin: 11 },
      { mode: "walking", summary: "Walk to your destination", durationMin: 4 },
    ],
    boardingStopId: "940GZZLUVIC",
    boardingName: "Victoria",
  };
}

function mockArrivals(): TflArrival[] {
  return [
    { line: "Victoria", destination: "Brixton", dueMin: 2, platform: "Southbound - Platform 4" },
    { line: "Victoria", destination: "Brixton", dueMin: 5, platform: "Southbound - Platform 4" },
    { line: "Victoria", destination: "Walthamstow Central", dueMin: 8, platform: "Northbound - Platform 3" },
  ];
}

type TflJourneyRow = {
  duration?: number;
  legs?: {
    duration?: number;
    mode?: { name?: string };
    instruction?: { summary?: string };
    routeOptions?: { name?: string }[];
    departurePoint?: { naptanId?: string; commonName?: string };
  }[];
};

const TRANSIT_MODES = new Set(["tube", "overground", "elizabeth-line", "dlr", "tram", "national-rail"]);

/** A multimodal plan between two coordinates, or a mock until TFL_APP_KEY is set. */
export async function tflJourney(from: LatLng, to: LatLng): Promise<IntegrationResult<TflJourneyPlan>> {
  const key = tflKey();
  if (!key) return { mode: "demo", demo: true, data: mockJourney() };
  try {
    const url = `${BASE}/Journey/JourneyResults/${from.lat},${from.lng}/to/${to.lat},${to.lng}?app_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) throw new Error(`TfL ${res.status}`);
    const data = (await res.json()) as { journeys?: TflJourneyRow[] };
    const j = data.journeys?.[0];
    if (!j || !j.legs) throw new Error("no journey");
    const legs: TflJourneyLeg[] = j.legs.map((l) => {
      const mode = l.mode?.name ?? "walking";
      const line = l.routeOptions?.[0]?.name;
      return { mode, line, summary: l.instruction?.summary ?? (line ? `${line} line` : "Walk"), durationMin: Math.round(l.duration ?? 0) };
    });
    const transit = j.legs.find((l) => TRANSIT_MODES.has(l.mode?.name ?? ""));
    return {
      mode: "live",
      data: {
        durationMin: Math.round(j.duration ?? legs.reduce((s, l) => s + l.durationMin, 0)),
        legs,
        boardingStopId: transit?.departurePoint?.naptanId,
        boardingName: transit?.departurePoint?.commonName,
      },
    };
  } catch (e) {
    console.warn("TfL journey failed; falling back to mock", e);
    return { mode: "demo", demo: true, data: mockJourney() };
  }
}

/** Live arrivals at a StopPoint, or a mock. Sorted soonest-first, next few only. */
export async function tflArrivals(stopPointId: string): Promise<IntegrationResult<TflArrival[]>> {
  const key = tflKey();
  if (!key) return { mode: "demo", demo: true, data: mockArrivals() };
  try {
    const url = `${BASE}/StopPoint/${encodeURIComponent(stopPointId)}/Arrivals?app_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`TfL ${res.status}`);
    const rows = (await res.json()) as { lineName?: string; destinationName?: string; timeToStation?: number; platformName?: string }[];
    const arrivals: TflArrival[] = rows
      .map((r) => ({ line: r.lineName ?? "", destination: r.destinationName ?? "", dueMin: Math.round((r.timeToStation ?? 0) / 60), platform: r.platformName }))
      .sort((a, b) => a.dueMin - b.dueMin)
      .slice(0, 4);
    return { mode: "live", data: arrivals };
  } catch (e) {
    console.warn("TfL arrivals failed; falling back to mock", e);
    return { mode: "demo", demo: true, data: mockArrivals() };
  }
}

// A London leg of the day, resolved: the multimodal plan + live arrivals at its
// boarding stop. `sample` is true while running on the mock (no key yet).
export type TflLegPlanVM = { plan: TflJourneyPlan; arrivals: TflArrival[]; sample: boolean };

export async function tflLegPlan(from: LatLng, to: LatLng): Promise<TflLegPlanVM | null> {
  const jr = await tflJourney(from, to);
  if (jr.mode === "unavailable") return null;
  const plan = jr.data;
  let arrivals: TflArrival[] = [];
  if (plan.boardingStopId) {
    const ar = await tflArrivals(plan.boardingStopId);
    if (ar.mode !== "unavailable") arrivals = ar.data;
  }
  return { plan, arrivals, sample: jr.mode === "demo" };
}

// Greater London bounding box — gates whether a leg is a TfL city-mobility hop.
export function inGreaterLondon(c: LatLng | null | undefined): boolean {
  if (!c || (c.lat === 0 && c.lng === 0)) return false;
  return c.lat >= 51.28 && c.lat <= 51.7 && c.lng >= -0.52 && c.lng <= 0.34;
}
