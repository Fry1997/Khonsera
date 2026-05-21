// Bridge from the editor's data shapes (DB rows + preview cache) to
// the pure scoring engine. Pulls together candidate previews +
// arrival window + user override into a single CandidateInput[] and
// hands it to scoreLeg.

import { estimateTaxiCostPence } from "./cost";
import { scoreLeg } from "./engine";
import type {
  CandidateInput,
  ModeCandidate,
  Resolution,
  ScoringContext,
} from "./types";

// Shape of a single preview cache entry as the editor sees it.
// 'pending' means a request is in flight; null preview after settle
// means the mode is unavailable.
export type PreviewEntry =
  | { durationMinutes: number | null; distanceMiles: number | null }
  | "pending"
  | null;

export type LegStopShape = {
  start_time: string | null;
  end_time: string | null;
};

const CANDIDATE_MODES: ModeCandidate[] = ["walk", "drive", "taxi"];

// Build the engine's CandidateInput[] from the editor's preview cache
// for a single leg, plus the surrounding stops so we can compute
// arrivalBufferSeconds.
//
// arrivalBuffer is: toStop.start_time minus (fromStop.end_time +
// travel duration). Negative means the user would arrive late under
// this mode.
export function buildCandidates(
  fromStop: LegStopShape | null,
  toStop: LegStopShape | null,
  lookup: (mode: ModeCandidate) => PreviewEntry,
): CandidateInput[] {
  // If there's no toStop start time (no fixed arrival), we still
  // build candidates but treat the buffer as a comfortable 30 min —
  // means risk score sits in the safe band rather than penalising
  // for tight arrival data we don't have.
  const toStartMs = toStop?.start_time
    ? new Date(toStop.start_time).getTime()
    : null;
  const fromEndMs = fromStop?.end_time
    ? new Date(fromStop.end_time).getTime()
    : fromStop?.start_time
      ? new Date(fromStop.start_time).getTime()
      : null;

  return CANDIDATE_MODES.map((mode): CandidateInput => {
    const entry = lookup(mode);
    if (entry === "pending") {
      return {
        mode,
        pending: true,
        durationSeconds: null,
        distanceMeters: null,
        costEstimatePence: null,
        arrivalBufferSeconds: 0,
      };
    }
    if (entry == null) {
      // Not yet asked for / errored. Treat as pending so the engine
      // returns 'resolving' rather than no_data — saves a flicker
      // when the prefetch effect is about to populate.
      return {
        mode,
        pending: true,
        durationSeconds: null,
        distanceMeters: null,
        costEstimatePence: null,
        arrivalBufferSeconds: 0,
      };
    }
    if (entry.durationMinutes == null) {
      // Settled but unavailable (e.g. Routes API returned null for
      // walking over an ocean).
      return {
        mode,
        pending: false,
        durationSeconds: null,
        distanceMeters: null,
        costEstimatePence: null,
        arrivalBufferSeconds: 0,
      };
    }
    const durationSeconds = entry.durationMinutes * 60;
    const distanceMeters =
      entry.distanceMiles != null ? entry.distanceMiles * 1609.344 : null;
    let arrivalBufferSeconds = 30 * 60;
    if (toStartMs != null && fromEndMs != null) {
      const earliestArriveMs = fromEndMs + durationSeconds * 1000;
      arrivalBufferSeconds = Math.round((toStartMs - earliestArriveMs) / 1000);
    }
    return {
      mode,
      pending: false,
      durationSeconds,
      distanceMeters,
      costEstimatePence:
        mode === "taxi" ? estimateTaxiCostPence(distanceMeters) : 0,
      arrivalBufferSeconds,
    };
  });
}

// Convenience: build candidates + run scoring in one call.
export function resolveLeg(
  fromStop: LegStopShape | null,
  toStop: LegStopShape | null,
  lookup: (mode: ModeCandidate) => PreviewEntry,
  ctx: ScoringContext,
): Resolution {
  const candidates = buildCandidates(fromStop, toStop, lookup);
  return scoreLeg(candidates, ctx);
}
