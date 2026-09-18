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
  status: TravelStatus;
  label: string; // "On time" · "Delayed" · "Cancelled" · "Now 07:38"
  detail?: string; // "+13 min" · "Platform 2"
  platform?: string;
  platformAvailable: boolean; // board-level Darwin permission to surface platform data
  std: string; // scheduled departure HH:MM
  etd: string; // raw estimate from Darwin, preserved verbatim for diagnostics
  uncertain?: boolean; // Darwin appended * to an absolute forecast
  destination?: string; // the train's final destination — "the Corby train"
  serviceId?: string; // Darwin/OpenLDB exact day-of identity for this service
  rsid?: string; // Retail Service ID when Darwin supplies one
  earlierSamePlatform?: EarlierSamePlatform;
};

// One service from the LDBWS JSON board — the ServiceItem schema (GetDepartureBoard).
type DarwinStationBoard = {
  platformAvailable?: boolean;
  trainServices?: DarwinService[];
};

type DarwinService = {
  serviceID?: string; // exact Darwin/OpenLDB identity for the returned live service
  rsid?: string; // Retail Service ID, if supplied
  std?: string; // scheduled time of departure
  etd?: string; // estimated ("On time" | "HH:MM" | "Delayed" | "Cancelled")
  platform?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  destination?: Array<{ locationName?: string; crs?: string }>;
};

// Fetch the live departure board for `crs` and resolve the passenger's service.
 // Durable provider identity is authoritative when present. Legacy time matching
 // is deliberately conservative: exactly one scheduled-minute candidate or no
 // confident live match. The passenger's hop destination is NOT used as a train
 // identity tie-break because it may be an intermediate calling point.
export async function liveDeparture(
  crs: string,
  plannedHHMM: string,
  _destCrs?: string | null,
  serviceId?: string | null,
): Promise<LiveDeparture | null> {
  const key = darwinKey();
  if (!key || !crs || !plannedHHMM) return null;

  const url = new URL(`${BASE}/GetDepartureBoard/${crs.toUpperCase()}`);
  // Public LDBWS documents numRows/timeWindow as exclusive upper bounds:
  // use the full supported local board without sending an out-of-range value.
  url.searchParams.set("numRows", "149");
  url.searchParams.set("timeWindow", "119"); // local board context for target + wrong-train guard

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
  // LDBWS says platform headings must be suppressed unless platformAvailable is
  // explicitly true. Do not infer availability from a stale per-service field.
  const data = json as DarwinStationBoard & {
    GetStationBoardResult?: DarwinStationBoard;
  };
  const board = data?.GetStationBoardResult ?? data;
  const services = board?.trainServices;
  if (!Array.isArray(services)) return null;
  const platformAvailable = board?.platformAvailable === true;

  const requestedServiceId = serviceId?.trim();
  let target: DarwinService | undefined;

  if (requestedServiceId) {
    // Exact identity never degrades into a time guess. If the target service is
    // absent from this board response, live truth is unavailable for this poll.
    target = services.find((service) => service?.serviceID === requestedServiceId);
    if (!target) return null;
  } else {
    const sameMinute = services.filter((service) => service?.std === plannedHHMM);
    if (sameMinute.length !== 1) return null;
    target = sameMinute[0];
  }

  const live = toLiveDeparture(target, platformAvailable);

  // Wrong-train guard is context, not identity. Compare CURRENT expected order,
  // not timetable order. Unknown forecasts are excluded rather than guessed.
  if (live.platform) {
    const targetClock = effectiveDepartureClock(target);
    if (targetClock) {
      const earlier = services
        .filter(
          (service) =>
            service !== target &&
            !service.isCancelled &&
            Boolean(service.platform) &&
            service.platform === target.platform,
        )
        .map((service) => {
          const clock = effectiveDepartureClock(service);
          return {
            service,
            delta: clock ? relativeClockDelta(clock, targetClock) : null,
          };
        })
        .filter(
          (entry): entry is { service: DarwinService; delta: number } =>
            entry.delta != null && entry.delta < 0,
        )
        .sort((a, b) => a.delta - b.delta);

      const prev = earlier[earlier.length - 1]?.service;
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
  const data = json as DarwinStationBoard & {
    GetStationBoardResult?: DarwinStationBoard;
  };
  const board = data?.GetStationBoardResult ?? data;
  const services = board?.trainServices;
  if (!Array.isArray(services)) return null;
  const platformAvailable = board?.platformAvailable === true;
  return services
    .filter((s) => s?.std)
    .slice(0, count)
    .map((s) => ({
      std: s.std!,
      etd: s.etd ?? "On time",
      isCancelled: Boolean(s.isCancelled),
      platform:
        platformAvailable && typeof s.platform === "string"
          ? s.platform
          : undefined,
    }));
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? -1 : h * 60 + m;
}

function effectiveDepartureClock(service: DarwinService): string | null {
  if (service.isCancelled) return null;
  const etd = typeof service.etd === "string" ? service.etd.trim() : "";
  if (/^\d{1,2}:\d{2}$/.test(etd)) return etd;
  if (/^on time$/i.test(etd) && service.std) return service.std;
  return null;
}

// Departure-board context is a narrow window around the journey. Treat a clock
// value on the other side of midnight as adjacent when it is within 12 hours.
function relativeClockDelta(candidate: string, target: string): number | null {
  const candidateMin = hhmmToMin(candidate);
  const targetMin = hhmmToMin(target);
  if (candidateMin < 0 || targetMin < 0) return null;
  let delta = candidateMin - targetMin;
  if (delta > 720) delta -= 1440;
  else if (delta <= -720) delta += 1440;
  return delta;
}

function toLiveDeparture(
  svc: DarwinService,
  platformAvailable: boolean,
): LiveDeparture {
  const std = svc.std ?? "";
  // Keep Darwin's passenger-facing value intact. Missing/unknown live data must
  // never be upgraded to a fabricated "On time" assertion.
  const etd = typeof svc.etd === "string" ? svc.etd.trim() : "";
  const platform =
    platformAvailable && typeof svc.platform === "string"
      ? svc.platform
      : undefined;
  const destination = Array.isArray(svc.destination) ? svc.destination[0]?.locationName : undefined;
  const serviceId = typeof svc.serviceID === "string" && svc.serviceID ? svc.serviceID : undefined;
  const rsid = typeof svc.rsid === "string" && svc.rsid ? svc.rsid : undefined;
  const base = {
    std,
    etd,
    platform,
    platformAvailable,
    destination,
    serviceId,
    rsid,
  } as const;
  const plat = platform ? `Platform ${platform}` : undefined;

  if (svc.isCancelled === true || /cancel/i.test(etd)) {
    return { ...base, status: "cancelled", label: "Cancelled", detail: svc.cancelReason || undefined };
  }
  if (/^on time$/i.test(etd)) {
    return { ...base, status: "on_time", label: "On time", detail: plat };
  }
  if (/^delayed$/i.test(etd)) {
    return { ...base, status: "delayed", label: "Delayed", detail: svc.delayReason || plat };
  }
  if (/^no report$/i.test(etd)) {
    return {
      ...base,
      status: "stale",
      label: "No live report",
      detail: plat,
    };
  }

  // Darwin marks an absolute forecast with * when that time is uncertain.
  // Preserve the time, but deliberately render it through the existing stale
  // trust state so an uncertain forecast cannot look confirmed.
  const uncertainTime = /^(\d{1,2}:\d{2})\*$/.exec(etd);
  if (uncertainTime) {
    const expected = uncertainTime[1];
    const mins = hhmmDiff(std, expected);
    const delay = mins > 0 ? `+${mins} min` : null;
    return {
      ...base,
      status: "stale",
      label: `Expected ${expected} · uncertain`,
      detail: [delay, plat].filter(Boolean).join(" · ") || undefined,
      uncertain: true,
    };
  }

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

  // Unknown or missing provider values are live uncertainty, not evidence of a
  // delay. Keep the raw value in `etd` for diagnostics while showing a
  // passenger-safe unknown state.
  return {
    ...base,
    status: "stale",
    label: "Live forecast unavailable",
    detail: plat,
  };
}

function hhmmDiff(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return 0;

  const raw = bh * 60 + bm - (ah * 60 + am);

  // Darwin's schedule ordering rules are deliberately asymmetric:
  //   < -6h   => crossed midnight, so the later clock is on the next day
  //   -6h..0  => genuinely back in time
  //   0..+18h => normal increasing time
  //   > +18h  => back in time and crossed midnight
  //
  // This is safer than "negative means tomorrow": e.g. 10:00 -> 09:55 must
  // remain -5 minutes rather than becoming a fabricated +23h55 delay.
  if (raw < -6 * 60) return raw + 24 * 60;
  if (raw > 18 * 60) return raw - 24 * 60;
  return raw;
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
      const board =
        (j.GetStationBoardResult as DarwinStationBoard | undefined) ??
        (j as DarwinStationBoard);
      const svcs = board.trainServices;
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
