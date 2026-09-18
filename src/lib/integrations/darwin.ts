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

// Accept either name — earlier setup notes used DARWIN_LDBWS_TOKEN before the
// consumer-key rename to DARWIN_LDBWS_KEY, so honour both to avoid a silent miss.
export function darwinKey(): string | null {
  return process.env.DARWIN_LDBWS_KEY ?? process.env.DARWIN_LDBWS_TOKEN ?? null;
}

// Another service leaving your platform BEFORE yours — the train you might board
// by mistake. Surfaced so the day-of pass can say "let that one go".
export type EarlierSamePlatform = {
  std: string; // its scheduled departure HH:MM
  destination?: string; // where IT goes (so you can tell it apart on the board)
  platform: string;
};

export type LiveDeparture = {
  serviceId?: string; // Darwin LDBWS serviceID for this board-relative physical service
  rsid?: string; // Retail Service ID when Darwin supplies one
  status: TravelStatus;
  label: string; // "On time" · "Delayed" · "Cancelled" · "Now 07:38"
  detail?: string; // "+13 min" · "Platform 2"
  platform?: string;
  std: string; // scheduled departure HH:MM
  etd: string; // raw estimate from Darwin
  destination?: string; // the train's final destination — "the Corby train"
  earlierSamePlatform?: EarlierSamePlatform;
};

// One service from the LDBWS JSON board — the ServiceItem schema (GetDepartureBoard).
type DarwinService = {
  serviceID?: string; // board-relative id; exact live-service identity
  rsid?: string; // Retail Service ID, if supplied
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
  serviceId?: string | null,
): Promise<LiveDeparture | null> {
  const key = darwinKey();
  if (!key || !crs || !plannedHHMM) return null;

  const url = new URL(`${BASE}/GetDepartureBoard/${crs.toUpperCase()}`);
  // Public LDBWS allows up to 149 rows. Use the complete supported board
  // window so an exact serviceID is not silently lost at a busy station.
  url.searchParams.set("numRows", "149");
  url.searchParams.set("timeWindow", "119"); // provider limit is < 120 minutes
  // Deliberately NOT filtered by destination: the passenger's hop destination
  // may be only an intermediate calling point, and we also need the local board
  // context for the same-platform wrong-train guard.

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

  // Exact provider identity wins. If a caller knows the Darwin serviceID and
  // it is no longer present, do not silently downgrade to a time-only guess.
  // serviceID is board-relative, so callers must only pass one obtained for
  // this boarding location/service.
  let target: DarwinService | undefined;
  if (serviceId) {
    target = services.find((s) => s.serviceID === serviceId);
    if (!target) return null;
  } else {
    // Legacy fallback: a unique scheduled minute is usable, but a collision is
    // explicitly ambiguous. The passenger's hop destination is NOT a safe
    // final-destination tie-break (it may be an intermediate calling point).
    const sameMinute = services.filter((s) => s?.std === plannedHHMM);
    if (sameMinute.length !== 1) return null;
    target = sameMinute[0];
  }

  // Keep the parameter in the contract for the later calling-point validation
  // work (#74). It must not be used as a final-destination identity shortcut.
  void destCrs;

  const live = toLiveDeparture(target);

  // Wrong-train guard: use current expected departure order, not the static
  // timetable. If either service has no usable live departure clock, omit the
  // warning rather than invent an ordering.
  if (live.platform) {
    const targetClock = effectiveDepartureClock(target);
    if (targetClock) {
      const earlier = services
        .filter((s) => {
          if (
            s === target ||
            s.isCancelled ||
            !s.platform ||
            s.platform !== target.platform ||
            !s.std
          ) return false;
          const clock = effectiveDepartureClock(s);
          if (!clock) return false;
          const delta = clockDeltaMinutes(targetClock, clock);
          return delta < 0 && delta >= -119;
        })
        .sort((a, b) => {
          const aClock = effectiveDepartureClock(a)!;
          const bClock = effectiveDepartureClock(b)!;
          return clockDeltaMinutes(targetClock, aClock) - clockDeltaMinutes(targetClock, bClock);
        });
      const prev = earlier[earlier.length - 1];
      if (prev?.std) {
        live.earlierSamePlatform = {
          std: prev.std,
          destination: prev.destination?.[0]?.locationName,
          platform: live.platform,
        };
      }
    }
  }

  return live;
}

// Recovery (Phase 11): the next services from `originCrs` heading TO `destCrs` —
// the ways out when a booked train is cancelled or badly delayed. Uses LDBWS's
// destination filter; returns scheduled + estimated departure + cancellation, so
// the recovery engine can build alternatives. Gated (null without the key).
export type NextService = { std: string; etd: string; isCancelled: boolean; platform?: string };

export async function nextServicesTo(originCrs: string, destCrs: string, count = 6): Promise<NextService[] | null> {
  const key = darwinKey();
  if (!key || !originCrs || !destCrs) return null;
  const url = new URL(`${BASE}/GetDepartureBoard/${originCrs.toUpperCase()}`);
  url.searchParams.set("numRows", String(Math.max(count, 10)));
  url.searchParams.set("timeWindow", "240"); // look up to 4h ahead for recovery
  url.searchParams.set("filterCrs", destCrs.toUpperCase());
  url.searchParams.set("filterType", "to");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let json: unknown;
  try {
    const res = await fetch(url.toString(), { headers: { "x-apikey": key, accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  const data = json as { trainServices?: DarwinService[]; GetStationBoardResult?: { trainServices?: DarwinService[] } };
  const services = data?.trainServices ?? data?.GetStationBoardResult?.trainServices;
  if (!Array.isArray(services)) return null;
  return services
    .filter((s) => s?.std)
    .slice(0, count)
    .map((s) => ({ std: s.std!, etd: s.etd ?? "On time", isCancelled: Boolean(s.isCancelled), platform: s.platform }));
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? -1 : h * 60 + m;
}

function effectiveDepartureClock(svc: DarwinService): string | null {
  const etd = typeof svc.etd === "string" ? svc.etd.trim() : "";
  if (/^\d{1,2}:\d{2}$/.test(etd)) return etd;
  if (/^on time$/i.test(etd) && svc.std) return svc.std;
  return null;
}

function clockDeltaMinutes(reference: string, candidate: string): number {
  const ref = hhmmToMin(reference);
  const cand = hhmmToMin(candidate);
  if (ref < 0 || cand < 0) return Number.NaN;
  let delta = cand - ref;
  // The board window is under two hours. Wrap the clock at midnight so
  // 23:58 is correctly seven minutes before 00:05, not 1,433 minutes after.
  if (delta > 720) delta -= 1440;
  if (delta < -720) delta += 1440;
  return delta;
}

function toLiveDeparture(svc: DarwinService): LiveDeparture {
  const std = svc.std ?? "";
  const etd = typeof svc.etd === "string" && svc.etd ? svc.etd : "On time";
  const platform = typeof svc.platform === "string" ? svc.platform : undefined;
  const destination = Array.isArray(svc.destination) ? svc.destination[0]?.locationName : undefined;
  const serviceId = typeof svc.serviceID === "string" && svc.serviceID ? svc.serviceID : undefined;
  const rsid = typeof svc.rsid === "string" && svc.rsid ? svc.rsid : undefined;
  const base = { serviceId, rsid, std, etd, platform, destination } as const;
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

// Diagnostic — never returns the key (only whether one is set), plus the HTTP
// status and what the board returned, so we can tell apart "key not loaded" vs
// "endpoint wrong" vs "response shape differs" vs "no service at that time".
export async function debugDeparture(
  crs: string,
  plannedHHMM: string,
): Promise<Record<string, unknown>> {
  const key = darwinKey();
  if (!key) return { keyPresent: false };

  const url = new URL(`${BASE}/GetDepartureBoard/${(crs || "").toUpperCase()}`);
  url.searchParams.set("numRows", "15");
  url.searchParams.set("timeWindow", "120");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-apikey": key, accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    let stds: string[] = [];
    let topLevelKeys: string[] = [];
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      topLevelKeys = Object.keys(j);
      const svcs =
        (j.trainServices as DarwinService[] | undefined) ??
        ((j.GetStationBoardResult as { trainServices?: DarwinService[] })?.trainServices);
      if (Array.isArray(svcs)) stds = svcs.map((s) => s.std ?? "").filter(Boolean);
    } catch {
      // body wasn't JSON
    }
    return {
      keyPresent: true,
      endpoint: url.toString(),
      status: res.status,
      ok: res.ok,
      lookingFor: plannedHHMM,
      stdsFound: stds,
      topLevelKeys,
      bodySnippet: text.slice(0, 500),
    };
  } catch (e) {
    return { keyPresent: true, endpoint: url.toString(), error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}
