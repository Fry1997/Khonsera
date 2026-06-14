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
