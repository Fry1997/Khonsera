// Stage 2 — pattern recognisers (Layer 5). Every match carries the spec envelope
// (source_text, normalised_value, confidence, fuzzy, range, granularity) plus the
// source_range for verbatim retention + UI highlighting.

import type { Confidence, SourceRange } from "../types";

export type PatternType =
  | "date"
  | "time"
  | "money"
  | "duration"
  | "party_size"
  | "person";

export type Granularity =
  | "exact"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "period"
  | "fuzzy";

export interface PatternMatch {
  type: PatternType;
  source_text: string;
  source_range: SourceRange;
  normalised_value: unknown;
  confidence: Confidence;
  fuzzy: boolean;
  range: boolean;
  granularity: Granularity;
  // Extra structured detail (constraint for money, kind for person, etc.).
  meta?: Record<string, unknown>;
}
