// OpenTripPlanner (OTP2) adapter — *alternative-route* re-planning for disruption
// recovery. Where Darwin answers "the next trains on your booked route", OTP
// answers the harder question: "the line's blocked — what's another way to your
// destination?" (a different interchange, rail→tube→rail, a coach leg). It plans
// across the whole GB transit graph (rail + bus + tube), so it surfaces routes a
// single departure board never could.
//
// OTP is open source (https://www.opentripplanner.org), self-hosted exactly like
// the Valhalla/Photon nav seams — one JVM + a GB GTFS feed + an OSM extract. The
// runbook lives in docs/otp-self-hosting.md.
//
// GATED: returns `null` (no-op) unless OTP_URL is set, so this is completely
// inert until an instance is stood up — zero cost, no false alternatives. The
// request build + response mapping are PURE (exported) so they unit-test against
// a fixture with no network.

import type { RecoveryCandidate, RecoveryMode } from "@/lib/recovery/engine";

export function otpUrl(): string | null {
  // The base of the self-hosted instance, e.g. https://otp.khonsera.com — the
  // adapter appends the GraphQL path. Unset = the whole adapter is inert.
  return process.env.OTP_URL ?? null;
}

// OTP2 canonical GraphQL endpoint (the GtfsGraphQLApi, default-enabled). The
// legacy OTP1 path was /otp/routers/default/index/graphql — overridable if a
// deployment pins the old router.
const GRAPHQL_PATH = process.env.OTP_GRAPHQL_PATH ?? "/otp/gtfs/v1";

export type OtpPoint = { lat: number; lng: number };

// `planConnection` is the current (2.x) query; the flat `plan` is deprecated. We
// ask for a handful of itineraries after a departure time and read each leg's
// mode + times + route + interchange names.
export function buildOtpPlanQuery(origin: OtpPoint, destination: OtpPoint, whenIso: string) {
  const query = `query Recover($fromLat: CoordinateValue!, $fromLon: CoordinateValue!, $toLat: CoordinateValue!, $toLon: CoordinateValue!, $when: OffsetDateTime!) {
  planConnection(
    origin: { location: { coordinate: { latitude: $fromLat, longitude: $fromLon } } }
    destination: { location: { coordinate: { latitude: $toLat, longitude: $toLon } } }
    dateTime: { earliestDeparture: $when }
    first: 5
  ) {
    edges { node {
      start
      end
      numberOfTransfers
      legs {
        mode
        from { name }
        to { name }
        start { scheduledTime }
        end { scheduledTime }
        route { shortName longName }
      }
    } }
  }
}`;
  return {
    query,
    variables: {
      fromLat: origin.lat,
      fromLon: origin.lng,
      toLat: destination.lat,
      toLon: destination.lng,
      when: whenIso,
    },
  };
}

// OTP mode enum → our recovery mode. An itinerary that mixes transit modes is
// "mixed" (computed below); these map a single leg.
const MODE_MAP: Record<string, RecoveryMode> = {
  WALK: "walk",
  RAIL: "rail",
  SUBWAY: "tube",
  TRAM: "tube",
  BUS: "bus",
  COACH: "bus",
  FERRY: "mixed",
  CAR: "taxi",
};

type OtpLeg = {
  mode?: string;
  from?: { name?: string | null } | null;
  to?: { name?: string | null } | null;
  start?: { scheduledTime?: string | null } | null;
  end?: { scheduledTime?: string | null } | null;
  route?: { shortName?: string | null; longName?: string | null } | null;
};
type OtpNode = { start?: string | null; end?: string | null; numberOfTransfers?: number | null; legs?: OtpLeg[] | null };
export type OtpResponse = { data?: { planConnection?: { edges?: { node: OtpNode }[] | null } | null } | null };

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

// Map OTP itineraries → the shared RecoveryCandidate shape, so cross-network
// alternatives land in the same trade-off band as the Darwin same-route options.
export function mapOtpItineraries(res: OtpResponse, destName: string): RecoveryCandidate[] {
  const edges = res.data?.planConnection?.edges ?? [];
  const out: RecoveryCandidate[] = [];
  for (const { node } of edges) {
    const legs = (node.legs ?? []).filter((l) => l.mode && l.mode !== "WALK");
    const departIso = node.start ?? legs[0]?.start?.scheduledTime ?? null;
    const arriveIso = node.end ?? legs[legs.length - 1]?.end?.scheduledTime ?? null;
    if (!departIso || !arriveIso || !legs.length) continue;

    // Dominant mode = the single transit mode if uniform, else "mixed".
    const modes = new Set(legs.map((l) => MODE_MAP[l.mode ?? ""] ?? "mixed"));
    const mode: RecoveryMode = modes.size === 1 ? [...modes][0] : "mixed";

    // The interchange that makes this alternative distinct — the first place you
    // change onto a different service. That's the human "via Coventry" hook.
    const via = legs.length > 1 ? legs[1]?.from?.name ?? null : null;
    const changes = node.numberOfTransfers ?? Math.max(0, legs.length - 1);
    const note = via ? `via ${via}${changes ? ` · ${changes} change${changes > 1 ? "s" : ""}` : ""}` : changes ? `${changes} change${changes > 1 ? "s" : ""}` : undefined;

    out.push({
      id: `otp-${departIso}`,
      label: `${clock(departIso)} to ${destName}`,
      mode,
      departIso,
      arriveIso,
      changes,
      note,
    });
  }
  return out;
}

// Direct scheduled journey time for ONE origin→destination leg at a booked
// departure — used to fill arrival times a retailer's eTicket omitted (RailSmartr
// prints departures only). This is the on-posture, direct-to-source alternative to
// a third-party journey API: the GB rail GTFS timetable in our own OTP, no rate
// limits, no per-request cost. Pure selection split out for unit testing.
export function pickScheduledArrival(res: OtpResponse, departIso: string): string | null {
  const departMs = new Date(departIso).getTime();
  if (Number.isNaN(departMs)) return null;
  // Edges are time-ordered; the booked train is the first itinerary departing at
  // (≈) or after the booked time. Allow 60s of slack for rounding.
  for (const { node } of res.data?.planConnection?.edges ?? []) {
    const legs = (node.legs ?? []).filter((l) => l.mode && l.mode !== "WALK");
    const dep = node.start ?? legs[0]?.start?.scheduledTime ?? null;
    const arr = node.end ?? legs[legs.length - 1]?.end?.scheduledTime ?? null;
    if (!dep || !arr) continue;
    if (new Date(dep).getTime() < departMs - 60_000) continue;
    return arr;
  }
  return null;
}

// Gated live call. Returns the booked leg's scheduled ARRIVAL ISO, or null when
// OTP_URL is unset / the instance errors — the caller then falls back to another
// timetable (Google transit) so import never blocks.
export async function otpScheduledArrival(args: {
  origin: OtpPoint;
  destination: OtpPoint;
  departIso: string;
}): Promise<string | null> {
  const base = otpUrl();
  if (!base) return null;
  const { query, variables } = buildOtpPlanQuery(args.origin, args.destination, args.departIso);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${GRAPHQL_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return pickScheduledArrival((await res.json()) as OtpResponse, args.departIso);
  } catch {
    return null;
  }
}

// Live call (gated). Returns null when OTP_URL is unset or the instance errors —
// recovery falls back to the Darwin same-route options, never a blank.
export async function otpRouteAlternatives(args: {
  origin: OtpPoint;
  destination: OtpPoint;
  destName: string;
  afterIso: string;
}): Promise<RecoveryCandidate[] | null> {
  const base = otpUrl();
  if (!base) return null;
  const { query, variables } = buildOtpPlanQuery(args.origin, args.destination, args.afterIso);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${GRAPHQL_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      // Recovery is interactive; don't let a slow graph hang the page.
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as OtpResponse;
    const cands = mapOtpItineraries(json, args.destName);
    // Drop anything that doesn't actually leave after the break.
    const afterMs = new Date(args.afterIso).getTime();
    return cands.filter((c) => new Date(c.departIso).getTime() >= afterMs);
  } catch {
    return null;
  }
}
