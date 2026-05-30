// The parsed-payload shape the parser returns to the UI and persists to
// captured_inputs.parsed_payload (brief §13). Multi-fact: one input → 0..n facts.

import type { ImperativeIntent } from "@/lib/dictionary/dictionary";

export const PARSER_VERSION = "dictionary-v1.0.0";

export interface SourceRange {
  start: number;
  end: number;
}

export type Confidence = "high" | "medium" | "low";

// A populated slot. `value` is the normalised value (ISO date, resolved hub id,
// plain label, integer, etc.); everything else is provenance + quality.
export interface Slot {
  value: unknown;
  source_text: string;
  source_range: SourceRange;
  confidence: Confidence;
  inferred: boolean;
  // Layer-5 pattern envelope (optional).
  fuzzy?: boolean;
  range?: boolean;
  granularity?: string;
  // Set when resolution found more than one candidate (e.g. two Birminghams).
  ambiguous?: boolean;
  candidates?: unknown[];
}

export type LinkKind =
  | "destination_of"
  | "return_of"
  | "same_day"
  | "at_same_place"
  | "contains";

export interface FactLink {
  target: string; // a local_id
  kind: LinkKind;
}

export interface ParsedFact {
  local_id: string; // fact_1, fact_2, ...
  fact_type: string;
  slots: Record<string, Slot>;
  links: FactLink[];
  warnings: string[];
  confidence: Confidence;
  source_range: SourceRange; // the clause span that produced this fact
}

export interface UnmatchedSpan {
  text: string;
  source_range: SourceRange;
}

export interface ParsedPayload {
  parser_version: string;
  original_text: string;
  facts: ParsedFact[];
  input_level_warnings: string[];
  ambiguities: string[];
  unmatched_text: UnmatchedSpan[];
  intent_type: ImperativeIntent | null;
}
