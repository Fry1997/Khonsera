// Rail candidate timing + pair fares (P2.6 core).
//
// A rail candidate isn't just a train time — it's a door-to-door consequence.
// Pick the 07:13 and you've committed to leaving home at 06:50 and being on
// site at 09:19. This module turns a raw timetable candidate into those
// derived times, folding in the mode-specific buffers from P1.2 (board the
// train ~8 min early, ~5 min through the station building each end).
//
// It also runs the v1 pair-fare heuristic: an off-peak return is ~20% cheaper
// than two singles; a peak or split-operator pair is shown honestly as two
// singles. All amounts are in pence; the caller converts provider pounds.
//
// Pure, no IO. The server action (`getRailCandidatesForGap`) fetches the
// timetable + the first-/last-mile minutes and hands plain candidates in.

import { boardingBufferMinutes, STATION_DWELL_MINUTES } from "./buffers";

function shift(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// A raw timetable candidate, provider-agnostic. `peak` and `pricePence` come
// from the caller (computed in the workspace timezone / converted from pounds).
export type RailCandidate = {
  dep: string; // ISO
  arr: string; // ISO
  durationMinutes: number;
  changes: number;
  peak: boolean;
  pricePence: number | null;
  serviceNumbers: string[];
};

// First-/last-mile minutes either side of the OUTBOUND rail leg.
export type OutboundLegTiming = {
  firstMileMinutes: number; // home → departure station
  lastMileMinutes: number; // arrival station → venue
  venueArrivalBufferMinutes?: number; // optional margin before the appointment
};

export type OutboundCandidate = RailCandidate & {
  leaveHome: string;
  onSiteStart: string;
};

// leave_home = rail dep − first-mile − board buffer − station entry.
// on_site_start = rail arr + station exit + last-mile + venue margin.
export function deriveOutbound(
  c: RailCandidate,
  t: OutboundLegTiming,
): OutboundCandidate {
  const board = boardingBufferMinutes("train");
  const leaveHome = shift(
    c.dep,
    -(t.firstMileMinutes + board + STATION_DWELL_MINUTES),
  );
  const onSiteStart = shift(
    c.arr,
    STATION_DWELL_MINUTES +
      t.lastMileMinutes +
      (t.venueArrivalBufferMinutes ?? 0),
  );
  return { ...c, leaveHome, onSiteStart };
}

// First-/last-mile minutes either side of the RETURN rail leg.
export type ReturnLegTiming = {
  toStationMinutes: number; // venue → departure station
  toHomeMinutes: number; // arrival station → home
  leaveVenueBufferMinutes?: number; // optional margin to wrap up & leave
};

export type ReturnCandidate = RailCandidate & {
  leaveAppointmentBy: string;
  arriveHome: string;
};

// leave_appointment_by = rail dep − last-mile-to-station − board − station
// entry − leave-venue margin. arrive_home = rail arr + station exit + last-mile.
export function deriveReturn(
  c: RailCandidate,
  t: ReturnLegTiming,
): ReturnCandidate {
  const board = boardingBufferMinutes("train");
  const leaveAppointmentBy = shift(
    c.dep,
    -(
      t.toStationMinutes +
      board +
      STATION_DWELL_MINUTES +
      (t.leaveVenueBufferMinutes ?? 0)
    ),
  );
  const arriveHome = shift(c.arr, STATION_DWELL_MINUTES + t.toHomeMinutes);
  return { ...c, leaveAppointmentBy, arriveHome };
}

// ── Pair fares ──────────────────────────────────────────────────────────────

const OFF_PEAK_RETURN_DISCOUNT = 0.2; // v1 heuristic: ~20% off two singles

export type PairFare = {
  twoSinglesPence: number | null;
  returnTicketPricePence: number | null;
  savingsVsTwoSinglesPence: number;
  qualifiesForReturnFare: boolean;
};

// Operator family = the alpha prefix of the first service number
// (e.g. "EMR-1A23" → "EMR"). Null when we can't read one.
function operatorOf(c: RailCandidate): string | null {
  const first = c.serviceNumbers[0];
  if (!first) return null;
  const m = first.match(/^[A-Za-z]+/);
  return m ? m[0].toUpperCase() : null;
}

// v1 heuristic: a through-return fare applies when neither leg is peak and the
// two legs share an operator family. Unknown operators don't disqualify (we
// don't penalise missing data); a clear operator mismatch does.
export function qualifiesForReturnFare(
  outbound: RailCandidate,
  ret: RailCandidate,
): boolean {
  if (outbound.peak || ret.peak) return false;
  const a = operatorOf(outbound);
  const b = operatorOf(ret);
  if (a != null && b != null && a !== b) return false;
  return true;
}

export function pairFare(
  outbound: RailCandidate,
  ret: RailCandidate,
): PairFare {
  const qualifies = qualifiesForReturnFare(outbound, ret);
  const out = outbound.pricePence;
  const back = ret.pricePence;
  const twoSingles = out != null && back != null ? out + back : null;

  if (twoSingles == null) {
    return {
      twoSinglesPence: null,
      returnTicketPricePence: null,
      savingsVsTwoSinglesPence: 0,
      qualifiesForReturnFare: qualifies,
    };
  }
  if (!qualifies) {
    return {
      twoSinglesPence: twoSingles,
      returnTicketPricePence: twoSingles,
      savingsVsTwoSinglesPence: 0,
      qualifiesForReturnFare: false,
    };
  }
  const returnTicket = Math.round(twoSingles * (1 - OFF_PEAK_RETURN_DISCOUNT));
  return {
    twoSinglesPence: twoSingles,
    returnTicketPricePence: returnTicket,
    savingsVsTwoSinglesPence: twoSingles - returnTicket,
    qualifiesForReturnFare: true,
  };
}
