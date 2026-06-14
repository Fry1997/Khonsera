// AeroDataBox adapter (Phase 13) — flight status + departure gate/terminal, the
// live source for the gate-change reroute rule (capability map: free 600 units/mo).
// Procurement-gated: MOCK until AERODATABOX_KEY is set, then the real flight-status
// endpoint drops in behind this shape. Returns the CURRENT departure gate; the
// rule fires when that differs from the gate the plan last knew (metadata).
//
// NOTE on the full signal: true gate-CHANGE detection is a day-of concern — it
// needs repeated polls + a persisted last-seen gate to diff against. This adapter
// is that signal's data source (buildable now); the continuous poll/last-seen loop
// is the positioned day-of follow-on. With a baseline gate in stop metadata, the
// rule already fires on a real difference.

const BASE = process.env.AERODATABOX_URL ?? "https://aerodatabox.p.rapidapi.com";

export type FlightStatus = {
  gate: string | null;
  terminal: string | null;
  status: string | null; // "Boarding" | "Departed" | "Expected" …
  estimatedDepartureIso: string | null;
  sample: boolean;
};

function aeroKey(): string | null {
  return process.env.AERODATABOX_KEY ?? null;
}

// Current departure status for a flight (IATA/ICAO number) on a date. Null on any
// failure → the rule simply doesn't fire (no false gate change).
export async function flightDepartureStatus(args: { flightNumber: string; dateIso: string }): Promise<FlightStatus | null> {
  const key = aeroKey();
  if (!key) {
    // Mock: a stable, deterministic gate so dev/tests don't flap. No gate CHANGE
    // is invented — the rule only fires against a real baseline difference.
    return { gate: mockGate(args.flightNumber), terminal: "—", status: "Scheduled", estimatedDepartureIso: null, sample: true };
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(args.dateIso));
  try {
    const res = await fetch(`${BASE}/flights/number/${encodeURIComponent(args.flightNumber)}/${date}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": "aerodatabox.p.rapidapi.com" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ departure?: { gate?: string; terminal?: string; revisedTime?: { local?: string } }; status?: string }>;
    const dep = Array.isArray(json) ? json[0]?.departure : undefined;
    return {
      gate: dep?.gate ?? null,
      terminal: dep?.terminal ?? null,
      status: (Array.isArray(json) ? json[0]?.status : null) ?? null,
      estimatedDepartureIso: dep?.revisedTime?.local ?? null,
      sample: false,
    };
  } catch {
    return null;
  }
}

function mockGate(flightNumber: string): string {
  let h = 0;
  for (let i = 0; i < flightNumber.length; i++) h = (h * 31 + flightNumber.charCodeAt(i)) | 0;
  return String((Math.abs(h) % 40) + 1);
}
