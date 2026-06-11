// Darwin live rail status (National Rail) via the Rail Data Marketplace
// "Live Departure Board" REST product (RDGMyles1 / 1010-live-departure-board).
// Query-on-demand, so it fits serverless: ask for a station's departures, match
// the booked service by scheduled time, read its live status + platform.
//
// AUTH: the product's consumer KEY passed as the `x-apikey` header (per its docs —
// no OAuth token exchange needed; the consumer secret is unused here).
//
// GATED: returns `null` (no-op) unless DARWIN_LDBWS_KEY is set, so this is
// completely inert until a key is configured — zero cost on every page.

import type { TravelStatus } from "@/components/concierge";

// Override the base if RDM bumps the product slug/version; default is the path
// shown on the product's API page.
const BASE =
  process.env.DARWIN_LDBWS_ENDPOINT ??
  "https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120";

export function darwinKey(): string | null {
  return process.env.DARWIN_LDBWS_KEY ?? null;
}

export type LiveDeparture = {
  status: TravelStatus;
  label: string; // "On time" · "Delayed" · "Cancelled" · "Now 07:38"
  detail?: string; // "+13 min" · "Platform 2"
  platform?: string;
  std: string; // scheduled departure HH:MM
  etd: string; // raw estimate from Darwin
  destination?: string;
};

// One service from the LDBWS JSON board — the ServiceItem schema (GetDepartureBoard).
type DarwinService = {
  std?: string; // scheduled time of departure
  etd?: string; // estimated ("On time" | "HH:MM" | "Delayed" | "Cancelled")
  platform?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  destination?: Array<{ locationName?: string; crs?: string }>;
};

// Fetch the live departure board for `crs` and return the service whose scheduled
// departure matches `plannedHHMM` (London 24h). Optionally narrow to services
// heading toward `destCrs`. null on any failure / no key / no match — the caller
// keeps the static badge.
export async function liveDeparture(
  crs: string,
  plannedHHMM: string,
  destCrs?: string | null,
): Promise<LiveDeparture | null> {
  const key = darwinKey();
  if (!key || !crs || !plannedHHMM) return null;

  const url = new URL(`${BASE}/GetDepartureBoard/${crs.toUpperCase()}`);
  url.searchParams.set("numRows", "15");
  url.searchParams.set("timeWindow", "120"); // look up to 2h ahead
  if (destCrs) {
    url.searchParams.set("filterCrs", destCrs.toUpperCase());
    url.searchParams.set("filterType", "to");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let json: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-apikey": key, accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  // The StationBoard object — top-level, or under a SOAP-style wrapper.
  const data = json as { trainServices?: DarwinService[]; GetStationBoardResult?: { trainServices?: DarwinService[] } };
  const services = data?.trainServices ?? data?.GetStationBoardResult?.trainServices;
  if (!Array.isArray(services)) return null;

  for (const svc of services) {
    if (svc?.std !== plannedHHMM) continue;
    return toLiveDeparture(svc);
  }
  return null;
}

function toLiveDeparture(svc: DarwinService): LiveDeparture {
  const std = svc.std ?? "";
  const etd = typeof svc.etd === "string" && svc.etd ? svc.etd : "On time";
  const platform = typeof svc.platform === "string" ? svc.platform : undefined;
  const destination = Array.isArray(svc.destination) ? svc.destination[0]?.locationName : undefined;
  const base = { std, etd, platform, destination } as const;
  const plat = platform ? `Platform ${platform}` : undefined;

  if (svc.isCancelled === true || /cancel/i.test(etd)) {
    return { ...base, status: "cancelled", label: "Cancelled", detail: svc.cancelReason || undefined };
  }
  if (/^on time$/i.test(etd)) {
    return { ...base, status: "on_time", label: "On time", detail: plat };
  }
  // A revised HH:MM, or the word "Delayed".
  if (/^\d{1,2}:\d{2}$/.test(etd)) {
    const mins = hhmmDiff(std, etd);
    const delay = mins > 0 ? `+${mins} min` : null;
    return {
      ...base,
      status: "delayed",
      label: `Now ${etd}`,
      detail: [delay, plat].filter(Boolean).join(" · ") || undefined,
    };
  }
  return { ...base, status: "delayed", label: "Delayed", detail: svc.delayReason || plat };
}

function hhmmDiff(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return 0;
  return bh * 60 + bm - (ah * 60 + am);
}
