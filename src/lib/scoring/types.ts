// Public types for the leg-scoring engine. Pure data shapes; no React,
// no DB, no async. The engine itself sits in ./engine.ts and is a
// pure function over these.

// Modes the engine resolves between. Trains and flights are
// pre-booked facts on the timeline, not candidates; buses are out of
// scope for now. That narrows cost meaningfully (only taxi varies).
export type ModeCandidate = "walk" | "drive" | "taxi";

export type Luggage = "none" | "light" | "heavy";

// Profile-level preference. 'no_preference' is the sentinel for "I
// don't care, just pick the best one".
export type PreferredMode = ModeCandidate | "no_preference";

export type TripPurpose =
  | "maximise_meetings"
  | "budget_conscious"
  | "balanced";

// One input row per mode the engine should consider for a leg.
//
// pending semantics:
//   * pending=true                      → route preview still loading
//   * pending=false, duration=null      → preview settled but the mode
//                                         is unavailable (no service /
//                                         API failed) — candidate is
//                                         filtered with no_data
//   * pending=false, duration=number    → preview ok, scoreable
//
// costEstimatePence is taxi-only data. For walk and drive callers
// should pass 0 (it's the cost-dimension's identity).
export interface CandidateInput {
  mode: ModeCandidate;
  pending: boolean;
  durationSeconds: number | null;
  distanceMeters: number | null;
  costEstimatePence: number | null;
  // Computed by the caller from the next anchor's arrive_by minus
  // (now + durationSeconds). Positive = will arrive that many
  // seconds early; negative = would be late.
  arrivalBufferSeconds: number;
}

export interface ScoringContext {
  preferredMode: PreferredMode;
  walkingThresholdMinutes: number;
  // Reserved for future "don't recommend if buffer < this" tweak.
  // Currently the risk dimension carries that signal via lookup_risk.
  minimumBufferMinutes: number;
  maxTaxiFarePence: number;
  luggage: Luggage;
  tripPurpose: TripPurpose;
  userOverride?: ModeCandidate | null;
}

export type FilterReason =
  | "walk_exceeds_threshold"
  | "would_be_late"
  | "no_data";

export interface ScoredCandidate {
  mode: ModeCandidate;
  total: number;
  scores: {
    time: number;
    cost: number;
    effort: number;
    risk: number;
  };
  // Whether the +15% preferred-mode bias was applied to this row.
  preferredBoostApplied: boolean;
  // null = survived filters; otherwise the reason it was dropped.
  filterReason: FilterReason | null;
  // Short one-line explanation surfaced in the picker UI. Computed
  // post-hoc from the scores ("Fastest", "Cheapest", "Above your
  // £15 taxi limit").
  explanation: string;
  // Raw input echoed back so the UI can render duration / distance
  // without holding both objects.
  input: CandidateInput;
}

export type ResolutionState =
  | "resolved"
  | "resolved_override"
  | "resolving"
  | "no_data"
  | "single_candidate"
  | "no_survivors";

// Filtered candidates skip scoring entirely (their reason is enough
// for the picker's "Why isn't X here?" disclosure), so they carry
// only the original input + reason.
export interface FilteredCandidate {
  input: CandidateInput;
  filterReason: FilterReason;
}

export interface Resolution {
  state: ResolutionState;
  winner: ScoredCandidate | null;
  // Survivors sorted by total score, descending. Empty when state is
  // resolving / no_data / no_survivors.
  ranked: ScoredCandidate[];
  // Candidates that got dropped, with their filter reason for the
  // "Why isn't X here?" disclosure in the picker.
  filtered: FilteredCandidate[];
}

export interface WeightProfile {
  time: number;
  cost: number;
  effort: number;
  risk: number;
}
